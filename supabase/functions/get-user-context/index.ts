import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ valid: false, error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { licenseKey } = await req.json();
    if (!licenseKey) {
      return new Response(JSON.stringify({ valid: false, error: "licenseKey required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch license + tenant
    const { data: license } = await admin
      .from("licenses")
      .select("id, plan, plan_type, daily_messages, hourly_limit, is_active, tenant_id, user_id")
      .eq("token", licenseKey)
      .eq("is_active", true)
      .maybeSingle();

    if (!license) {
      return new Response(JSON.stringify({ valid: false, error: "License not found" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch today's usage
    const today = new Date().toISOString().split("T")[0];
    const { data: usage } = await admin
      .from("daily_usage")
      .select("messages_used")
      .eq("license_id", license.id)
      .eq("date", today)
      .maybeSingle();

    const usedToday = usage?.messages_used ?? 0;

    // Fetch tenant branding if applicable
    let branding = {
      appName: "CodeLove AI",
      primaryColor: "6C3CE1",
      secondaryColor: "5E5CE6",
      logoUrl: null as string | null,
      isTenant: false,
      tenantId: null as string | null,
    };

    if (license.tenant_id) {
      const { data: tenant } = await admin
        .from("tenants")
        .select("name, primary_color, secondary_color, logo_url, branding")
        .eq("id", license.tenant_id)
        .maybeSingle();

      if (tenant) {
        const b = (tenant.branding as Record<string, string>) || {};
        branding = {
          appName: b.appName || tenant.name || "CodeLove AI",
          primaryColor: (b.primaryColor || tenant.primary_color || "#6C3CE1").replace("#", ""),
          secondaryColor: (b.secondaryColor || tenant.secondary_color || "#5E5CE6").replace("#", ""),
          logoUrl: b.logoUrl || tenant.logo_url || null,
          isTenant: true,
          tenantId: license.tenant_id,
        };
      }
    }

    return new Response(
      JSON.stringify({
        valid: true,
        plan: {
          type: license.plan_type,
          dailyLimit: license.daily_messages,
          hourlyLimit: license.hourly_limit,
          usedToday,
          planName: license.plan,
        },
        branding,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("get-user-context error:", err);
    return new Response(JSON.stringify({ valid: false, error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
