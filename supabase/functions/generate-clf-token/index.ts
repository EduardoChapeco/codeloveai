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

// Plan config — server-side only, never trust client
const PLAN_DEFAULTS: Record<string, { expiresMs: number; dailyMessages: number | null; type: string }> = {
  free:    { expiresMs: 24 * 60 * 60 * 1000,       dailyMessages: 10,   type: "trial" },
  trial:   { expiresMs: 24 * 60 * 60 * 1000,       dailyMessages: 10,   type: "trial" },
  speed:   { expiresMs: 30 * 24 * 60 * 60 * 1000,  dailyMessages: 50,   type: "monthly" },
  booster: { expiresMs: 30 * 24 * 60 * 60 * 1000,  dailyMessages: 100,  type: "monthly" },
  labs:    { expiresMs: 30 * 24 * 60 * 60 * 1000,  dailyMessages: null,  type: "monthly" },
  pro:     { expiresMs: 30 * 24 * 60 * 60 * 1000,  dailyMessages: null,  type: "monthly" },
};

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

    // Use service role client for DB operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // ── SERVER-SIDE PLAN RESOLUTION ──
    // NEVER trust client-provided plan or expiresIn
    let resolvedPlan = "free";

    // 1. Check if user has an active paid subscription
    const { data: activeSub } = await adminClient
      .from("subscriptions")
      .select("plan, status, expires_at")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeSub && activeSub.plan) {
      const subPlan = (activeSub.plan as string).toLowerCase();
      // Only accept known paid plans
      if (["speed", "booster", "labs", "pro"].includes(subPlan)) {
        resolvedPlan = subPlan;
      }
    }

    // 2. Check if user has an active plan from the plans table via licenses
    if (resolvedPlan === "free") {
      const { data: existingLicense } = await adminClient
        .from("licenses")
        .select("plan, plan_id, type, daily_messages")
        .eq("user_id", userId)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingLicense && existingLicense.plan_id) {
        const { data: planData } = await adminClient
          .from("plans")
          .select("name, daily_message_limit")
          .eq("id", existingLicense.plan_id)
          .eq("is_active", true)
          .maybeSingle();

        if (planData) {
          const planName = (planData.name as string).toLowerCase();
          if (["speed", "booster", "labs", "pro"].includes(planName)) {
            resolvedPlan = planName;
          }
        }
      }
    }

    const planConfig = PLAN_DEFAULTS[resolvedPlan] || PLAN_DEFAULTS.free;

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

    // Deactivate existing active licenses
    await adminClient
      .from("licenses")
      .update({ active: false, status: "expired" })
      .eq("user_id", userId)
      .eq("active", true);

    // Build CLF1 token
    const now = Date.now();
    const exp = now + planConfig.expiresMs;
    const payload = JSON.stringify({
      uid: userId,
      email: userEmail || profile.email,
      plan: resolvedPlan,
      dailyMessages: planConfig.dailyMessages,
      exp,
      iat: now,
      v: 1,
    });

    const encodedPayload = base64urlEncode(payload);
    const signature = await hmacSign(encodedPayload, clfSecret);
    const clfToken = `CLF1.${encodedPayload}.${signature}`;

    const expiresAt = new Date(exp).toISOString();

    // Save to licenses table
    const { error: insertError } = await adminClient.from("licenses").insert({
      key: clfToken,
      user_id: userId,
      plan: resolvedPlan,
      plan_type: "messages",
      type: planConfig.type,
      daily_messages: planConfig.dailyMessages,
      expires_at: expiresAt,
      active: true,
      status: "active",
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
        plan: resolvedPlan,
        dailyMessages: planConfig.dailyMessages,
        type: planConfig.type,
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
