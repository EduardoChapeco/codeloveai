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
    const { licenseKey, hwid } = await req.json();

    if (!licenseKey || typeof licenseKey !== "string") {
      return new Response(JSON.stringify({ valid: false, error: "licenseKey required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Rate limiting by hwid (10 per minute)
    if (hwid) {
      const rateKey = `vlicense:${hwid}`;
      const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();

      const { data: rl } = await adminClient
        .from("rate_limits")
        .select("count, window_start")
        .eq("key", rateKey)
        .maybeSingle();

      if (rl) {
        if (rl.window_start > oneMinuteAgo) {
          if (rl.count >= 10) {
            return new Response(
              JSON.stringify({ valid: false, error: "Rate limit exceeded" }),
              { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          await adminClient.from("rate_limits").update({ count: rl.count + 1 }).eq("key", rateKey);
        } else {
          await adminClient.from("rate_limits").update({ count: 1, window_start: new Date().toISOString() }).eq("key", rateKey);
        }
      } else {
        await adminClient.from("rate_limits").insert({ key: rateKey, count: 1, window_start: new Date().toISOString() });
      }
    }

    const { data: license } = await adminClient
      .from("licenses")
      .select("token, plan, expires_at, is_active, device_id, user_id")
      .eq("token", licenseKey)
      .eq("is_active", true)
      .maybeSingle();

    if (!license) {
      return new Response(JSON.stringify({ valid: false, error: "License not found or inactive" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    if (new Date(license.expires_at) < now) {
      return new Response(JSON.stringify({ valid: false, error: "License expired" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update HWID and last_validated_at
    await adminClient
      .from("licenses")
      .update({
        last_validated_at: now.toISOString(),
        ...(hwid ? { device_id: hwid } : {}),
      })
      .eq("token", licenseKey);

    return new Response(
      JSON.stringify({
        valid: true,
        plan: license.plan,
        exp: new Date(license.expires_at).getTime(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("validate-license error:", err);
    return new Response(JSON.stringify({ valid: false, error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
