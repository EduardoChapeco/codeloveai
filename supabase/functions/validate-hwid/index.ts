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
    const { hwid, licenseKey } = await req.json();

    if (!licenseKey || typeof licenseKey !== "string") {
      return new Response(JSON.stringify({ valid: false, error: "licenseKey required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Fetch license
    const { data: license, error: licErr } = await admin
      .from("licenses")
      .select("id, token, plan, plan_type, daily_messages, hourly_limit, is_active, expires_at, device_id, tenant_id, user_id")
      .eq("token", licenseKey)
      .eq("is_active", true)
      .maybeSingle();

    if (licErr || !license) {
      return new Response(JSON.stringify({ valid: false, error: "License not found or inactive" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check expiry
    if (new Date(license.expires_at) < new Date()) {
      return new Response(JSON.stringify({ valid: false, error: "License expired" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // HWID logic
    if (hwid && typeof hwid === "string") {
      if (license.device_id && license.device_id !== hwid) {
        return new Response(JSON.stringify({ valid: false, error: "Dispositivo não autorizado" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Register or update HWID + last_validated_at
      await admin
        .from("licenses")
        .update({ device_id: hwid, last_validated_at: new Date().toISOString() })
        .eq("id", license.id);
    } else {
      await admin
        .from("licenses")
        .update({ last_validated_at: new Date().toISOString() })
        .eq("id", license.id);
    }

    return new Response(
      JSON.stringify({
        valid: true,
        plan: license.plan,
        dailyMessages: license.daily_messages,
        type: license.plan_type,
        tenantId: license.tenant_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("validate-hwid error:", err);
    return new Response(JSON.stringify({ valid: false, error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
