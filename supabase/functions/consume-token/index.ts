import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const { licenseKey } = await req.json();

    if (!licenseKey) {
      return new Response(
        JSON.stringify({ allowed: false, error: "Missing licenseKey" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find license
    const { data: license } = await supabase
      .from("licenses")
      .select("id, user_id, tenant_id, type, status, active, daily_messages, hourly_limit, messages_used_today, messages_used_month, last_reset_at, token_valid_until, trial_expires_at, plan_id")
      .eq("key", licenseKey)
      .eq("active", true)
      .maybeSingle();

    if (!license) {
      return new Response(
        JSON.stringify({ allowed: false, error: "License not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date();

    // Check trial expiration
    if (license.type === "trial" && license.trial_expires_at && new Date(license.trial_expires_at) < now) {
      return new Response(
        JSON.stringify({ allowed: false, error: "Trial expired" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check daily token expiration
    if (license.type === "daily_token" && license.token_valid_until && new Date(license.token_valid_until) < now) {
      return new Response(
        JSON.stringify({ allowed: false, error: "Token expired, please renew" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Reset daily counter if new day
    const today = now.toISOString().split("T")[0];
    let usedToday = license.messages_used_today || 0;
    if (license.last_reset_at !== today) {
      usedToday = 0;
    }

    // Check daily limit
    if (license.daily_messages && usedToday >= license.daily_messages) {
      return new Response(
        JSON.stringify({ allowed: false, error: "Daily limit reached", usedToday, limit: license.daily_messages }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Increment counters
    const newUsedToday = usedToday + 1;
    const newUsedMonth = (license.messages_used_month || 0) + 1;

    await supabase
      .from("licenses")
      .update({
        messages_used_today: newUsedToday,
        messages_used_month: newUsedMonth,
        last_reset_at: today,
      })
      .eq("id", license.id);

    // Also increment daily_usage table
    await supabase.rpc("increment_daily_usage", {
      p_license_id: license.id,
      p_date: today,
    });

    return new Response(
      JSON.stringify({
        allowed: true,
        usedToday: newUsedToday,
        limit: license.daily_messages,
        usedThisMonth: newUsedMonth,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[consume-token] error:", err);
    return new Response(
      JSON.stringify({ allowed: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
