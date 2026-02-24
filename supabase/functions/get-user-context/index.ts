import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const licenseKey = body.licenseKey || body.token || body.key;

    if (!licenseKey) {
      return new Response(
        JSON.stringify({ valid: false, error: "Missing licenseKey" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── 1. Find license ──────────────────────────────────────────
    const { data: license } = await supabase
      .from("licenses")
      .select("id, key, user_id, tenant_id, plan, plan_type, type, status, expires_at, active, daily_messages, hourly_limit, plan_id, token_valid_until, trial_expires_at, trial_used, messages_used_today, messages_used_month")
      .eq("key", licenseKey)
      .eq("active", true)
      .maybeSingle();

    if (!license) {
      return new Response(
        JSON.stringify({ valid: false, error: "License not found or inactive" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tenantId = license.tenant_id || "a0000000-0000-0000-0000-000000000001";

    // ── 2. Fetch plan (if plan_id exists) ─────────────────────────
    let planData: any = null;
    if (license.plan_id) {
      const { data } = await supabase
        .from("plans")
        .select("*")
        .eq("id", license.plan_id)
        .maybeSingle();
      planData = data;
    }

    // ── 3. Fetch daily usage ──────────────────────────────────────
    const today = new Date().toISOString().split("T")[0];
    const { data: usage } = await supabase
      .from("daily_usage")
      .select("messages_used")
      .eq("license_id", license.id)
      .eq("date", today)
      .maybeSingle();

    // ── 4. Fetch tenant branding ──────────────────────────────────
    const { data: branding } = await supabase
      .from("tenant_branding")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    // ── 5. Fetch tenant meta ──────────────────────────────────────
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, slug")
      .eq("id", tenantId)
      .maybeSingle();

    // ── 6. Calculate effective modules ────────────────────────────
    const defaultModules = {
      chat: false, deploy: true, preview: true, notes: true,
      split: true, auto: true, wl: true, affiliate: true, community: true,
    };
    const tenantModules = branding?.modules || defaultModules;
    const planModules = planData?.modules || null;

    // Effective = intersection of tenant AND plan modules
    let effectiveModules: Record<string, boolean> = {};
    for (const key of Object.keys(defaultModules)) {
      const tenantEnabled = (tenantModules as any)[key] ?? (defaultModules as any)[key];
      const planEnabled = planModules ? ((planModules as any)[key] ?? true) : true;
      effectiveModules[key] = tenantEnabled && planEnabled;
    }

    // ── 7. Determine extension mode ───────────────────────────────
    const extensionMode = planData?.extension_mode || branding?.extension_mode || "security_fix_v2";
    const customModePrompt = extensionMode === "custom" ? branding?.custom_mode_prompt || null : null;

    // ── 8. Build response ─────────────────────────────────────────
    const baseUrl = tenant?.slug
      ? `https://${tenant.slug}.lovable.app`
      : "https://starble.lovable.app";

    const response = {
      valid: true,
      branding: {
        appName: branding?.app_name || "Starble Booster",
        logoUrl: branding?.logo_url || null,
        primaryColor: branding?.primary_color || "7c3aed",
        secondaryColor: branding?.secondary_color || "a855f7",
        accentColor: branding?.accent_color || null,
        extensionMode,
        customModePrompt,
        modules: effectiveModules,
        promptSuggestions: branding?.prompt_suggestions || [],
        isTenant: tenantId !== "a0000000-0000-0000-0000-000000000001",
        tenantId,
        tenantName: tenant?.name || "Starble",
        tenantSlug: tenant?.slug || "starble",
      },
      plan: {
        planName: planData?.name || license.plan || "Grátis",
        type: planData?.type || license.plan_type || "messages",
        dailyLimit: planData?.daily_message_limit || license.daily_messages || null,
        hourlyLimit: planData?.hourly_limit || license.hourly_limit || null,
        usedToday: usage?.messages_used || license.messages_used_today || 0,
        usedThisMonth: license.messages_used_month || 0,
        tokenValidUntil: license.token_valid_until || null,
        trialExpiresAt: license.trial_expires_at || null,
        isTrial: license.type === "trial" || license.status === "trial",
        expires_at: license.expires_at,
      },
      links: {
        dashboard: `${baseUrl}/dashboard`,
        renew: `${baseUrl}/dashboard?action=renew`,
        affiliate: `${baseUrl}/cadastro?tipo=afiliado`,
        buyCredits: `${baseUrl}/planos`,
        community: `${baseUrl}/comunidade`,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[get-user-context] error:", err);
    return new Response(
      JSON.stringify({ valid: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
