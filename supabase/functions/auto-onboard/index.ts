import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isDisposableEmail } from "../_shared/disposable-emails.ts";
import { resolveTenant } from "../_shared/tenant-resolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-tenant-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * auto-onboard: Auto-provisions a free 10msg/day license for new users.
 * - Idempotent: skips if user already has any active license
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
      .select("id")
      .eq("user_id", userId)
      .eq("active", true)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ already_exists: true, license_id: existing.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the "Grátis" plan in DB to get plan_id and daily_message_limit
    const { data: freePlan } = await serviceClient
      .from("plans")
      .select("id, daily_message_limit")
      .eq("name", "Grátis")
      .eq("is_active", true)
      .maybeSingle();

    const planId = freePlan?.id || null;
    const dailyMessages = freePlan?.daily_message_limit || 10;

    // Generate license key
    const keyRandom = crypto.randomUUID().replace(/-/g, "").substring(0, 16).toUpperCase();
    const licenseKey = `CLF1.FREE-${keyRandom}`;

    // Perpetual free license (100 years = effectively never expires)
    const expiresAt = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();

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

    return new Response(
      JSON.stringify({
        success: true,
        license_id: newLicense.id,
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
