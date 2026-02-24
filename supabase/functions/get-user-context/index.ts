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

    // ── Find license ──────────────────────────────────────────────────────
    let license: any = null;

    const { data: d1 } = await supabase
      .from("licenses")
      .select("id, key, user_id, tenant_id, plan, plan_type, expires_at, active, daily_messages, hourly_limit")
      .eq("key", licenseKey)
      .eq("active", true)
      .maybeSingle();

    if (d1) {
      license = d1;
    } else {
      // Fallback: try "token" column (pre-migration schema)
      const { data: d2 } = await supabase
        .from("licenses")
        .select("id, key, user_id, tenant_id, plan, plan_type, expires_at, active, daily_messages, hourly_limit")
        .eq("token", licenseKey)
        .eq("active", true)
        .maybeSingle();
      if (d2) license = d2;
    }

    if (!license) {
      return new Response(
        JSON.stringify({ valid: false, error: "License not found or inactive" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Fetch daily usage ─────────────────────────────────────────────────
    const today = new Date().toISOString().split("T")[0];
    const { data: usage } = await supabase
      .from("daily_usage")
      .select("messages_used")
      .eq("license_id", license.id)
      .eq("date", today)
      .maybeSingle();

    // ── Fetch tenant branding ─────────────────────────────────────────────
    let branding: any = null;
    const tenantId = license.tenant_id || "a0000000-0000-0000-0000-000000000001";

    const { data: brandingRow } = await supabase
      .from("tenant_branding")
      .select("app_name, logo_url, primary_color, secondary_color, accent_color, modules, prompt_suggestions")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (brandingRow) {
      branding = brandingRow;
    }

    // ── Fetch tenant meta (name, slug) ────────────────────────────────────
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, slug")
      .eq("id", tenantId)
      .maybeSingle();

    // ── Build response ────────────────────────────────────────────────────
    const defaultModules = { chat: true, deploy: true, preview: true, notes: true, split: true, auto: true, wl: true };

    const response = {
      valid: true,
      branding: {
        appName: branding?.app_name || "Starble Booster",
        logoUrl: branding?.logo_url || null,
        primaryColor: branding?.primary_color || "7c3aed",
        secondaryColor: branding?.secondary_color || "a855f7",
        accentColor: branding?.accent_color || null,
        planType: license.plan_type || "messages",
        modules: branding?.modules || defaultModules,
        promptSuggestions: branding?.prompt_suggestions || null,
        isTenant: tenantId !== "a0000000-0000-0000-0000-000000000001",
        tenantId: tenantId,
        tenantName: tenant?.name || "Starble",
        tenantSlug: tenant?.slug || "starble",
      },
      plan: {
        planName: license.plan || "Grátis",
        type: license.plan_type || "messages",
        dailyLimit: license.daily_messages || 10,
        hourlyLimit: license.hourly_limit || null,
        usedToday: usage?.messages_used || 0,
        expires_at: license.expires_at,
      },
      links: {
        dashboard: "https://starble.lovable.app/dashboard",
        renew: "https://starble.lovable.app/dashboard?action=renew",
        affiliate: "https://starble.lovable.app/cadastro?tipo=afiliado",
        buyCredits: "https://starble.lovable.app/planos",
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
