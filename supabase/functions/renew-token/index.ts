import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const { licenseKey, paymentId } = await req.json();

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
      .select("id, user_id, tenant_id, type, active")
      .eq("key", licenseKey)
      .maybeSingle();

    if (!license) {
      return new Response(
        JSON.stringify({ success: false, error: "License not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date();
    const validUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24h

    // Renew: set token_valid_until = now + 24h, activate, reset daily counters
    const { error } = await supabase
      .from("licenses")
      .update({
        token_valid_until: validUntil.toISOString(),
        last_renewed_at: now.toISOString(),
        active: true,
        status: "active",
        type: "daily_token",
        messages_used_today: 0,
        last_reset_at: now.toISOString().split("T")[0],
      })
      .eq("id", license.id);

    if (error) {
      console.error("[renew-token] update error:", error);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to renew" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log transaction if paymentId provided
    if (paymentId) {
      await supabase.from("transactions").insert({
        type: "subscription",
        tenant_id: license.tenant_id,
        user_id: license.user_id,
        amount: 19.90,
        mp_payment_id: paymentId,
        status: "approved",
        description: "Renovação token 24h (R$19,90)",
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        tokenValidUntil: validUntil.toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[renew-token] error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
