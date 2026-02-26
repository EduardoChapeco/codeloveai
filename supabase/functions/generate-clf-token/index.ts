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

// Admin master: unlimited, expires 2099
const ADMIN_MASTER_EXPIRES_MS = (2099 - new Date().getFullYear()) * 365.25 * 24 * 60 * 60 * 1000;

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

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // ── Resolve plan from DB (never trust client) ──
    let resolvedPlan: string | null = null;
    let resolvedPlanId: string | null = null;
    let dailyMessages: number | null = null;
    let expiresMs: number = 30 * 24 * 60 * 60 * 1000; // default 30d
    let licenseType = "monthly";

    // 0. Check if user is global admin
    const { data: adminRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (adminRole) {
      resolvedPlan = "admin";
      dailyMessages = null; // unlimited
      expiresMs = ADMIN_MASTER_EXPIRES_MS;
      licenseType = "custom";
    }

    // 1. Check if user is tenant_owner
    if (!resolvedPlan) {
      const { data: tenantOwner } = await adminClient
        .from("tenant_users")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "tenant_owner")
        .limit(1)
        .maybeSingle();

      if (tenantOwner) {
        resolvedPlan = "admin";
        dailyMessages = null;
        expiresMs = ADMIN_MASTER_EXPIRES_MS;
        licenseType = "custom";
      }
    }

    // 2. Check active paid subscription → resolve plan from DB
    if (!resolvedPlan) {
      const { data: activeSub } = await adminClient
        .from("subscriptions")
        .select("plan, status, expires_at, plan_id")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeSub && activeSub.plan) {
        const subPlan = (activeSub.plan as string).toLowerCase();
        const notExpired = !activeSub.expires_at || new Date(activeSub.expires_at) > new Date();

        if (notExpired && ["speed", "booster", "labs", "pro"].includes(subPlan)) {
          resolvedPlan = subPlan;

          // Pull limits from plans table (single source of truth)
          if (activeSub.plan_id) {
            const { data: planRow } = await adminClient
              .from("plans")
              .select("id, daily_message_limit, billing_cycle")
              .eq("id", activeSub.plan_id)
              .eq("is_active", true)
              .maybeSingle();
            if (planRow) {
              resolvedPlanId = planRow.id;
              dailyMessages = planRow.daily_message_limit; // null = unlimited
              const cycle = (planRow.billing_cycle || "monthly").toLowerCase();
              expiresMs = cycle === "yearly" ? 365 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
              licenseType = "monthly";
            }
          }
        }
      }
    }

    // 3. Check existing active license with plan_id (tenant-generated)
    if (!resolvedPlan) {
      const { data: existingLicense } = await adminClient
        .from("licenses")
        .select("plan, plan_id, type, daily_messages, expires_at")
        .eq("user_id", userId)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingLicense && existingLicense.plan_id) {
        const notExpired = !existingLicense.expires_at || new Date(existingLicense.expires_at) > new Date();
        if (notExpired) {
          const { data: planRow } = await adminClient
            .from("plans")
            .select("id, name, daily_message_limit, billing_cycle")
            .eq("id", existingLicense.plan_id)
            .eq("is_active", true)
            .maybeSingle();

          if (planRow) {
            const planName = (planRow.name as string).toLowerCase();
            if (["speed", "booster", "labs", "pro"].includes(planName)) {
              resolvedPlan = planName;
              resolvedPlanId = planRow.id;
              dailyMessages = planRow.daily_message_limit;
              const cycle = (planRow.billing_cycle || "monthly").toLowerCase();
              expiresMs = cycle === "yearly" ? 365 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
              licenseType = existingLicense.type || "monthly";
            }
          }
        }
      }
    }

    // ── NO PLAN = NO TOKEN ──
    if (!resolvedPlan) {
      return new Response(
        JSON.stringify({
          error: "no_active_plan",
          message: "Você precisa de um plano ativo para gerar um token. Acesse a página de planos.",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify profile exists
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
    const exp = now + expiresMs;
    const payload = JSON.stringify({
      uid: userId,
      email: userEmail || profile.email,
      plan: resolvedPlan,
      dailyMessages,
      exp,
      iat: now,
      v: 1,
    });

    const encodedPayload = base64urlEncode(payload);
    const signature = await hmacSign(encodedPayload, clfSecret);
    const clfToken = `CLF1.${encodedPayload}.${signature}`;

    const expiresAt = new Date(exp).toISOString();

    // Save to licenses table with plan_id linkage
    const { error: insertError } = await adminClient.from("licenses").insert({
      key: clfToken,
      user_id: userId,
      plan: resolvedPlan,
      plan_id: resolvedPlanId,
      plan_type: "messages",
      type: licenseType,
      daily_messages: dailyMessages,
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
        dailyMessages,
        type: licenseType,
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
