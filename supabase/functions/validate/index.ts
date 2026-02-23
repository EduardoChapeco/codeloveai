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

async function hmacVerify(payload: string, signature: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const expected = base64url(new Uint8Array(sig));
  return expected === signature;
}

function base64urlDecode(str: string): string {
  let s = str.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return atob(s);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ valid: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const clfSecret = Deno.env.get("CLF_TOKEN_SECRET");
    if (!clfSecret) {
      return new Response(JSON.stringify({ valid: false, error: "Server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { token, deviceId } = body;

    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ valid: false, error: "Token required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Rate limiting by deviceId (10 per minute)
    if (deviceId) {
      const rateKey = `validate:${deviceId}`;
      const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();

      const { data: rl } = await adminClient
        .from("rate_limits")
        .select("count, window_start")
        .eq("key", rateKey)
        .maybeSingle();

      if (rl) {
        if (rl.window_start > oneMinuteAgo) {
          if (rl.count >= 10) {
            return new Response(
              JSON.stringify({ valid: false, error: "Rate limit exceeded. Try again later." }),
              { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          await adminClient
            .from("rate_limits")
            .update({ count: rl.count + 1 })
            .eq("key", rateKey);
        } else {
          await adminClient
            .from("rate_limits")
            .update({ count: 1, window_start: new Date().toISOString() })
            .eq("key", rateKey);
        }
      } else {
        await adminClient.from("rate_limits").insert({
          key: rateKey,
          count: 1,
          window_start: new Date().toISOString(),
        });
      }
    }

    // Parse CLF1 token
    const parts = token.split(".");
    if (parts.length !== 3 || parts[0] !== "CLF1") {
      return new Response(JSON.stringify({ valid: false, error: "Invalid token format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [, encodedPayload, signature] = parts;

    // Verify HMAC signature
    const isValid = await hmacVerify(encodedPayload, signature, clfSecret);
    if (!isValid) {
      return new Response(JSON.stringify({ valid: false, error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decode payload
    let payload: { uid: string; email: string; plan: string; exp: number; iat: number; v: number };
    try {
      payload = JSON.parse(base64urlDecode(encodedPayload));
    } catch {
      return new Response(JSON.stringify({ valid: false, error: "Malformed payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check expiration
    if (Date.now() > payload.exp) {
      return new Response(JSON.stringify({ valid: false, error: "Token expired" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check is_active in DB
    const { data: license } = await adminClient
      .from("licenses")
      .select("is_active")
      .eq("token", token)
      .eq("is_active", true)
      .maybeSingle();

    if (!license) {
      return new Response(JSON.stringify({ valid: false, error: "License revoked or not found" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update last_validated_at and device_id
    await adminClient
      .from("licenses")
      .update({
        last_validated_at: new Date().toISOString(),
        ...(deviceId ? { device_id: deviceId } : {}),
      })
      .eq("token", token);

    // Get profile name
    const { data: profile } = await adminClient
      .from("profiles")
      .select("name, email")
      .eq("user_id", payload.uid)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        valid: true,
        name: profile?.name || "",
        email: payload.email,
        plan: payload.plan,
        exp: payload.exp,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("validate error:", err);
    return new Response(JSON.stringify({ valid: false, error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
