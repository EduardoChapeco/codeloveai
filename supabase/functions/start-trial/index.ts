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
        JSON.stringify({ success: false, error: "Missing licenseKey" }),
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
      .select("id, user_id, tenant_id, trial_used, trial_started_at, type")
      .eq("key", licenseKey)
      .maybeSingle();

    if (!license) {
      return new Response(
        JSON.stringify({ success: false, error: "License not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if trial already used (once per user_id)
    if (license.trial_used || license.trial_started_at) {
      return new Response(
        JSON.stringify({ success: false, error: "Trial already used" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Also check globally: any license with this user_id that has trial_used = true
    const { data: existingTrial } = await supabase
      .from("licenses")
      .select("id")
      .eq("user_id", license.user_id)
      .eq("trial_used", true)
      .limit(1)
      .maybeSingle();

    if (existingTrial) {
      return new Response(
        JSON.stringify({ success: false, error: "Trial already used on another license" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get trial minutes from tenant_branding (default 30)
    const tenantId = license.tenant_id || "a0000000-0000-0000-0000-000000000001";
    const { data: branding } = await supabase
      .from("tenant_branding")
      .select("trial_minutes")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const trialMinutes = branding?.trial_minutes || 30;
    const now = new Date();
    const trialExpiresAt = new Date(now.getTime() + trialMinutes * 60 * 1000);

    // Start trial
    const { error } = await supabase
      .from("licenses")
      .update({
        trial_started_at: now.toISOString(),
        trial_expires_at: trialExpiresAt.toISOString(),
        trial_used: true,
        type: "trial",
        status: "trial",
        active: true,
      })
      .eq("id", license.id);

    if (error) {
      console.error("[start-trial] update error:", error);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to start trial" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        trialStartedAt: now.toISOString(),
        trialExpiresAt: trialExpiresAt.toISOString(),
        trialMinutes,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[start-trial] error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
