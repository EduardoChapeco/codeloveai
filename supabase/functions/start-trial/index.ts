// start-trial v2.0 — JWT-authenticated trial activation with anti-abuse
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    // ── REQUIRE JWT AUTH ──────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseAnon.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── GLOBAL CHECK: has this user EVER used a trial? ─────────────────
    const { data: anyTrialUsed } = await supabase
      .from("licenses")
      .select("id")
      .eq("user_id", userId)
      .eq("trial_used", true)
      .limit(1)
      .maybeSingle();

    if (anyTrialUsed) {
      return new Response(
        JSON.stringify({ success: false, error: "Trial already used" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Find active license owned by this user ─────────────────────────
    const { data: license } = await supabase
      .from("licenses")
      .select("id, user_id, tenant_id, trial_used, trial_started_at, type")
      .eq("user_id", userId)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!license) {
      return new Response(
        JSON.stringify({ success: false, error: "No active license found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Double-check on the specific license
    if (license.trial_used || license.trial_started_at) {
      return new Response(
        JSON.stringify({ success: false, error: "Trial already used" }),
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
      .eq("id", license.id)
      .eq("user_id", userId); // ← additional safety: ensure ownership

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
