import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { licenseKey } = await req.json();
    if (!licenseKey) {
      return new Response(JSON.stringify({ error: "licenseKey required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: license } = await admin
      .from("licenses")
      .select("id, user_id, tenant_id, daily_messages, plan_type")
      .eq("token", licenseKey)
      .eq("is_active", true)
      .maybeSingle();

    if (!license) {
      return new Response(JSON.stringify({ error: "License not found" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().split("T")[0];

    // Check current usage
    const { data: existing } = await admin
      .from("daily_usage")
      .select("id, messages_used")
      .eq("license_id", license.id)
      .eq("date", today)
      .maybeSingle();

    let messagesUsed: number;

    if (existing) {
      // Check limit before incrementing
      if (license.plan_type === "messages" && existing.messages_used >= license.daily_messages) {
        return new Response(
          JSON.stringify({ error: "Daily limit reached", messagesUsed: existing.messages_used, limit: license.daily_messages }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      messagesUsed = existing.messages_used + 1;
      await admin
        .from("daily_usage")
        .update({ messages_used: messagesUsed })
        .eq("id", existing.id);
    } else {
      messagesUsed = 1;
      await admin.from("daily_usage").insert({
        license_id: license.id,
        user_id: license.user_id,
        tenant_id: license.tenant_id,
        date: today,
        messages_used: 1,
      });
    }

    return new Response(
      JSON.stringify({ success: true, messagesUsed, limit: license.daily_messages }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("increment-usage error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
