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
 * auto-onboard: Auto-provisions a free 10msg/day license for new users.
 * - Idempotent: skips if user already has any active license
 * - Generates proper CLF1.eyJ... HMAC-signed tokens (same format as generate-clf-token)
 * - Links to the "Grátis" plan in DB for proper extension access (allowedExtensions)
 * - Perpetual free tier (no expiration)
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

    // Block disposable emails
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

    // Resolve tenant
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

    // If license exists with proper key, skip
    if (existing && existing.key && existing.key.startsWith("CLF1.")) {
      return new Response(
        JSON.stringify({ already_exists: true, license_id: existing.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If license exists but needs signing (backfilled), sign it now
    const needsSign = existing && existing.key && existing.key.startsWith("PENDING_SIGN_");

    // Find the "Grátis" plan in DB to get plan_id and daily_message_limit
    const { data: freePlan } = await serviceClient
      .from("plans")
      .select("id, daily_message_limit")
      .eq("name", "Grátis")
      .eq("is_active", true)
      .maybeSingle();

    const planId = freePlan?.id || null;
    const dailyMessages = freePlan?.daily_message_limit || 10;

    // Perpetual free license (100 years)
    const now = Date.now();
    const expiresMs = 100 * 365.25 * 24 * 60 * 60 * 1000;
    const exp = now + expiresMs;
    const expiresAt = new Date(exp).toISOString();

    // Build proper CLF1.eyJ... HMAC-signed token
    const payload = JSON.stringify({
      uid: userId,
      email: userEmail || "",
      plan: "free",
      dailyMessages,
      exp,
      iat: now,
      v: 1,
    });

    const encodedPayload = base64urlEncode(payload);
    const signature = await hmacSign(encodedPayload, clfSecret);
    const licenseKey = `CLF1.${encodedPayload}.${signature}`;

    let finalLicenseId: string;

    if (needsSign) {
      // Update the backfilled license with proper signed key
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
      // Insert new license
      const { data: newLicense, error: insertError } = await serviceClient
        .from("licenses")
        .insert({
          user_id: userId,
          tenant_id: tenantId,
          key: licenseKey,
          active: true,
          plan: "free",
          plan_id: planId,
          plan_type: "messages",
          type: "daily_token",
          status: "active",
          daily_messages: dailyMessages,
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
        plan: "free",
        daily_messages: dailyMessages,
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
