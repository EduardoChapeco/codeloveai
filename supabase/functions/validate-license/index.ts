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

    // FIX: Use correct column names — "key" and "active" (not "token"/"is_active")
    const { data: license } = await adminClient
      .from("licenses")
      .select("id, key, plan, plan_type, type, status, expires_at, active, device_id, user_id, tenant_id, daily_messages, hourly_limit, token_valid_until, trial_expires_at, trial_used, messages_used_today, plan_id")
      .eq("key", licenseKey)
      .eq("active", true)
      .maybeSingle();

    if (!license) {
      return new Response(JSON.stringify({ valid: false, error: "License not found or inactive" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check expiration
    const now = new Date();
    if (license.expires_at && new Date(license.expires_at) < now) {
      return new Response(JSON.stringify({ valid: false, error: "License expired" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check trial expiration
    if (license.type === 'trial' && license.trial_expires_at && new Date(license.trial_expires_at) < now) {
      return new Response(JSON.stringify({ valid: false, error: "Trial expired" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check daily token expiration
    if (license.type === 'daily_token' && license.token_valid_until && new Date(license.token_valid_until) < now) {
      return new Response(JSON.stringify({ valid: false, error: "Daily token expired, please renew" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check daily message limit
    if (license.daily_messages && license.messages_used_today >= license.daily_messages) {
      return new Response(JSON.stringify({ valid: false, error: "Daily message limit reached" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // HWID / device_id binding
    if (hwid) {
      if (!license.device_id) {
        await adminClient.from("licenses")
          .update({ device_id: hwid, last_validated_at: now.toISOString() })
          .eq("id", license.id);
      } else if (license.device_id !== hwid) {
        return new Response(JSON.stringify({ valid: false, error: "Device not authorized" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        await adminClient.from("licenses")
          .update({ last_validated_at: now.toISOString() })
          .eq("id", license.id);
      }
    } else {
      await adminClient.from("licenses")
        .update({ last_validated_at: now.toISOString() })
        .eq("id", license.id);
    }

    // Fetch allowed extensions for this license's plan
    let allowedExtensions: string[] = [];
    if (license.plan_id) {
      const { data: peData } = await adminClient
        .from("plan_extensions")
        .select("extension_id")
        .eq("plan_id", license.plan_id);
      if (peData && peData.length > 0) {
        const extIds = peData.map((pe: any) => pe.extension_id);
        const { data: exts } = await adminClient
          .from("extension_catalog")
          .select("slug")
          .in("id", extIds);
        allowedExtensions = (exts || []).map((e: any) => e.slug);
      }
    }

    return new Response(
      JSON.stringify({
        valid: true,
        plan: license.plan,
        planType: license.plan_type,
        type: license.type,
        status: license.status,
        dailyMessages: license.daily_messages,
        hourlyLimit: license.hourly_limit,
        usedToday: license.messages_used_today || 0,
        tokenValidUntil: license.token_valid_until,
        trialExpiresAt: license.trial_expires_at,
        tenantId: license.tenant_id,
        allowedExtensions,
        exp: license.expires_at ? new Date(license.expires_at).getTime() : null,
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
