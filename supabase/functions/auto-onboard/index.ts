import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isDisposableEmail } from "../_shared/disposable-emails.ts";
import { resolveTenant } from "../_shared/tenant-resolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-tenant-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

/**
 * auto-onboard: Auto-provisions "Free Master" (30 days, unlimited) for new users.
 * - Idempotent: skips if user already has any active license
 * - Generates proper CLF1.eyJ... HMAC-signed tokens
 * - Links to "Free Master" plan (is_promotional=true, 30 days)
 * - Admin can kill this plan globally via AdminGlobal operations tab
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clfSecret = Deno.env.get("CLF_TOKEN_SECRET");
    if (!clfSecret) {
      return new Response(JSON.stringify({ error: "CLF_TOKEN_SECRET not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const userEmail = user.email;

    if (userEmail && isDisposableEmail(userEmail)) {
      return new Response(JSON.stringify({ error: "Emails temporários não são permitidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const tenantInfo = await resolveTenant(serviceClient, req, userId);
    const tenantId = tenantInfo.id || tenantInfo.tenant_id;

    // Idempotent: check if user already has any active license
    const { data: existing } = await serviceClient
      .from("licenses")
      .select("id, key")
      .eq("user_id", userId)
      .eq("active", true)
      .limit(1)
      .maybeSingle();

    if (existing && existing.key && existing.key.startsWith("CLF1.")) {
      return new Response(
        JSON.stringify({ already_exists: true, license_id: existing.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const needsSign = existing && existing.key && existing.key.startsWith("PENDING_SIGN_");

    // Use "Free Master" promotional plan (30 days, unlimited)
    const { data: freeMasterPlan } = await serviceClient
      .from("plans")
      .select("id, daily_message_limit")
      .eq("name", "Free Master")
      .eq("is_active", true)
      .maybeSingle();

    // Fallback to old "Grátis" if Free Master doesn't exist or is deactivated
    const { data: fallbackPlan } = !freeMasterPlan ? await serviceClient
      .from("plans")
      .select("id, daily_message_limit")
      .eq("name", "Grátis")
      .eq("is_active", true)
      .maybeSingle() : { data: null };

    const activePlan = freeMasterPlan || fallbackPlan;
    const planId = activePlan?.id || null;
    const dailyMessages = activePlan?.daily_message_limit || null; // NULL = unlimited
    const planName = freeMasterPlan ? "free_master" : "free";
    const isUnlimited = dailyMessages === null;

    // 30 days for Free Master, 100 years for old free
    const now = Date.now();
    const expiresMs = freeMasterPlan
      ? 30 * 24 * 60 * 60 * 1000       // 30 days
      : 100 * 365.25 * 24 * 60 * 60 * 1000; // 100 years (legacy)
    const exp = now + expiresMs;
    const expiresAt = new Date(exp).toISOString();

    const payload = JSON.stringify({
      uid: userId,
      email: userEmail || "",
      plan: planName,
      dailyMessages: dailyMessages ?? -1, // -1 = unlimited
      exp,
      iat: now,
      v: 1,
    });

    const encodedPayload = base64urlEncode(payload);
    const signature = await hmacSign(encodedPayload, clfSecret);
    const licenseKey = `CLF1.${encodedPayload}.${signature}`;

    let finalLicenseId: string;

    if (needsSign) {
      const { error: updateError } = await serviceClient
        .from("licenses")
        .update({ key: licenseKey })
        .eq("id", existing.id);
      if (updateError) {
        console.error("auto-onboard sign error:", updateError);
        return new Response(JSON.stringify({ error: "Failed to sign license" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      finalLicenseId = existing.id;
    } else {
      const { data: newLicense, error: insertError } = await serviceClient
        .from("licenses")
        .insert({
          user_id: userId,
          tenant_id: tenantId,
          key: licenseKey,
          active: true,
          plan: planName,
          plan_id: planId,
          plan_type: "messages",
          type: "daily_token",
          status: "active",
          daily_messages: isUnlimited ? null : dailyMessages,
          expires_at: expiresAt,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("auto-onboard insert error:", insertError);
        return new Response(JSON.stringify({ error: "Failed to create license" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      finalLicenseId = newLicense.id;
    }

    return new Response(
      JSON.stringify({
        success: true,
        license_id: finalLicenseId,
        token: licenseKey,
        plan: planName,
        daily_messages: dailyMessages,
        unlimited: isUnlimited,
        expires_at: expiresAt,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("auto-onboard error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
