import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function decodeCLF1(token: string): Record<string, unknown> | null {
  if (!token?.startsWith("CLF1.")) return null;
  try {
    const parts = token.split(".");
    if (parts.length < 3) return null;
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    b64 += "=".repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(b64));
  } catch { return null; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = await req.json().catch(() => ({}));
    const authHeader = req.headers.get("authorization") || "";
    const licenseKey = body.licenseKey || body.token || body.key
      || (authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null);

    if (!licenseKey?.startsWith("CLF1.")) {
      return new Response(JSON.stringify({ valid: false, error: "Licença não informada" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" }
      });
    }

    const payload = decodeCLF1(licenseKey);
    if (!payload) {
      return new Response(JSON.stringify({ valid: false, error: "Token inválido" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Find license
    const { data: license } = await supabase
      .from("licenses")
      .select("id, key, user_id, tenant_id, plan, plan_type, type, status, expires_at, active, daily_messages, hourly_limit, plan_id, token_valid_until, trial_expires_at, trial_used, messages_used_today, messages_used_month")
      .eq("key", licenseKey)
      .eq("active", true)
      .maybeSingle();

    if (!license) {
      return new Response(
        JSON.stringify({ valid: false, error: "License not found or inactive" }),
        { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const tenantId = license.tenant_id || "a0000000-0000-0000-0000-000000000001";

    // 2. Fetch plan
    let planData: any = null;
    if (license.plan_id) {
      const { data } = await supabase
        .from("plans")
        .select("*")
        .eq("id", license.plan_id)
        .maybeSingle();
      planData = data;
    }

    // 3. Fetch daily usage
    const today = new Date().toISOString().split("T")[0];
    const { data: usage } = await supabase
      .from("daily_usage")
      .select("messages_used")
      .eq("license_id", license.id)
      .eq("date", today)
      .maybeSingle();

    // 4. Fetch tenant
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, slug, primary_color, secondary_color, accent_color, logo_url, favicon_url, extension_mode, custom_mode_prompt, modules, font_family, border_radius, theme_preset")
      .eq("id", tenantId)
      .maybeSingle();

    // 5. Fetch legacy branding
    const { data: branding } = await supabase
      .from("tenant_branding")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    // 6. Effective modules
    const defaultModules = {
      chat: false, deploy: true, preview: true, notes: true,
      split: true, auto: true, wl: true, affiliate: true, community: true,
    };
    const tenantModules = tenant?.modules || branding?.modules || defaultModules;
    const planModules = planData?.modules || null;

    let effectiveModules: Record<string, boolean> = {};
    for (const key of Object.keys(defaultModules)) {
      const tenantEnabled = (tenantModules as any)[key] ?? (defaultModules as any)[key];
      const planEnabled = planModules ? ((planModules as any)[key] ?? true) : true;
      effectiveModules[key] = tenantEnabled && planEnabled;
    }

    // 7. Extension mode
    const extensionMode = planData?.extension_mode || tenant?.extension_mode || branding?.extension_mode || "security_fix_v2";
    const customModePrompt = extensionMode === "custom" ? (tenant?.custom_mode_prompt || branding?.custom_mode_prompt || null) : null;

    // 8. Build response
    const baseUrl = tenant?.slug
      ? `https://${tenant.slug}.lovable.app`
      : "https://starble.lovable.app";

    const response = {
      valid: true,
      branding: {
        appName: branding?.app_name || tenant?.name || "Starble Booster",
        logoUrl: tenant?.logo_url || branding?.logo_url || null,
        primaryColor: (tenant?.primary_color || branding?.primary_color || "#7c3aed").replace("#", ""),
        secondaryColor: (tenant?.secondary_color || branding?.secondary_color || "#a855f7").replace("#", ""),
        accentColor: (tenant?.accent_color || branding?.accent_color || null)?.replace("#", "") || null,
        extensionMode,
        customModePrompt,
        modules: effectiveModules,
        promptSuggestions: branding?.prompt_suggestions || [],
        isTenant: tenantId !== "a0000000-0000-0000-0000-000000000001",
        tenantId,
        tenantName: tenant?.name || "Starble",
        tenantSlug: tenant?.slug || "starble",
        fontFamily: tenant?.font_family || "system",
        borderRadius: tenant?.border_radius || "1rem",
        themePreset: tenant?.theme_preset || "apple-glass",
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
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[get-user-context] error:", err);
    return new Response(
      JSON.stringify({ valid: false, error: "Internal server error" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
