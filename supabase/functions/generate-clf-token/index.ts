import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function base64url(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlEncode(str: string): string {
  return base64url(new TextEncoder().encode(str));
}

async function hmacSign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return base64url(new Uint8Array(sig));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const clfSecret = Deno.env.get("CLF_TOKEN_SECRET");

    if (!clfSecret) {
      return new Response(JSON.stringify({ error: "CLF_TOKEN_SECRET not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate user JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const userEmail = claimsData.claims.email as string;

    // Parse request body
    const body = await req.json();
    const plan = body.plan || "trial";
    const expiresIn = body.expiresIn || 30 * 24 * 60 * 60 * 1000; // 30 days default

    // Use service role client for DB operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify user exists in profiles
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("user_id, email, name")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "User profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deactivate any existing active licenses for this user
    await adminClient
      .from("licenses")
      .update({ active: false })
      .eq("user_id", userId)
      .eq("active", true);

    // Build CLF1 token
    const now = Date.now();
    const exp = now + expiresIn;
    const payload = JSON.stringify({
      uid: userId,
      email: userEmail || profile.email,
      plan,
      exp,
      iat: now,
      v: 1,
    });

    const encodedPayload = base64urlEncode(payload);
    const signature = await hmacSign(encodedPayload, clfSecret);
    const clfToken = `CLF1.${encodedPayload}.${signature}`;

    const expiresAt = new Date(exp).toISOString();

    // Save to licenses table (new schema: key + active)
    const { error: insertError } = await adminClient.from("licenses").insert({
      key: clfToken,
      user_id: userId,
      plan_type: plan,
      expires_at: expiresAt,
      active: true,
    });

    if (insertError) {
      console.error("Insert license error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to save license" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        token: clfToken,
        expires_at: expiresAt,
        plan,
        email: userEmail || profile.email,
        name: profile.name,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("generate-clf-token error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
