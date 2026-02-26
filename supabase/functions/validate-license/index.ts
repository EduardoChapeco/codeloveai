// validate-license v2.1 — with admin bypass, auto-deactivation, smart lifecycle
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAdminMaster } from "../_shared/license-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-speed-client",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, valid: false, error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { licenseKey, hwid, token, extension } = await req.json();
    const resolvedKey = licenseKey || token;

    if (!resolvedKey || typeof resolvedKey !== "string") {
      return new Response(JSON.stringify({ ok: false, valid: false, error: "licenseKey required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Rate limiting by hwid
    if (hwid) {
      const rateKey = `vlicense:${hwid}`;
      const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
      const { data: rl } = await adminClient
        .from("rate_limits").select("count, window_start").eq("key", rateKey).maybeSingle();

      if (rl) {
        if (rl.window_start > oneMinuteAgo) {
          if (rl.count >= 10) {
            return new Response(JSON.stringify({ ok: false, valid: false, error: "Rate limit exceeded" }), {
              status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
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
      .select("id, key, plan, plan_type, type, status, expires_at, active, device_id, user_id, tenant_id, daily_messages, hourly_limit, token_valid_until, trial_expires_at, trial_used, messages_used_today, plan_id, plans(name, display_name)")
      .eq("key", resolvedKey)
      .eq("active", true)
      .maybeSingle();

    if (!license) {
      return new Response(JSON.stringify({ ok: false, valid: false, error: "License not found or inactive" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Admin master bypass — unlimited, no expiry checks ──
    const isAdmin = await isAdminMaster(adminClient, license.user_id);
    const now = new Date();

    if (!isAdmin) {
      // Check expiration → auto-deactivate
      if (license.expires_at && new Date(license.expires_at) < now) {
        await adminClient.from("licenses").update({ active: false, status: "expired" }).eq("id", license.id);
        return new Response(JSON.stringify({ ok: false, valid: false, error: "License expired" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check trial expiration → auto-deactivate
      if (license.type === "trial" && license.trial_expires_at && new Date(license.trial_expires_at) < now) {
        await adminClient.from("licenses").update({ active: false, status: "expired" }).eq("id", license.id);
        return new Response(JSON.stringify({ ok: false, valid: false, error: "Trial expired" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check daily token expiration → auto-deactivate
      if (license.type === "daily_token" && license.token_valid_until && new Date(license.token_valid_until) < now) {
        await adminClient.from("licenses").update({ active: false, status: "expired" }).eq("id", license.id);
        return new Response(JSON.stringify({ ok: false, valid: false, error: "Daily token expired, please renew" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check daily message limit
      if (license.daily_messages && license.messages_used_today >= license.daily_messages) {
        return new Response(JSON.stringify({ ok: false, valid: false, error: "Daily message limit reached" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // HWID / device_id binding
    if (hwid) {
      if (!license.device_id) {
        await adminClient.from("licenses").update({ device_id: hwid, last_validated_at: now.toISOString() }).eq("id", license.id);
      } else if (license.device_id !== hwid) {
        return new Response(JSON.stringify({ ok: false, valid: false, error: "Device not authorized" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        await adminClient.from("licenses").update({ last_validated_at: now.toISOString() }).eq("id", license.id);
      }
    } else {
      await adminClient.from("licenses").update({ last_validated_at: now.toISOString() }).eq("id", license.id);
    }

    // Fetch allowed extensions
    let allowedExtensions: string[] = [];
    if (license.plan_id) {
      const { data: peData } = await adminClient.from("plan_extensions").select("extension_id").eq("plan_id", license.plan_id);
      if (peData && peData.length > 0) {
        const extIds = peData.map((pe: any) => pe.extension_id);
        const { data: exts } = await adminClient.from("extension_catalog").select("slug").in("id", extIds);
        allowedExtensions = (exts || []).map((e: any) => e.slug);
      }
    }

    // Admin master gets ALL extensions
    if (isAdmin) {
      const { data: allExts } = await adminClient.from("extension_catalog").select("slug").eq("is_active", true);
      allowedExtensions = (allExts || []).map((e: any) => e.slug);
    }

    // Labs restriction: ONLY tenant_owners (unless admin)
    if (!isAdmin && allowedExtensions.includes("labs")) {
      const { data: tenantUser } = await adminClient
        .from("tenant_users").select("role").eq("user_id", license.user_id).eq("role", "tenant_owner").maybeSingle();
      if (!tenantUser) {
        allowedExtensions = allowedExtensions.filter(e => e !== "labs");
      }
    }

    const billingType = license.plan_type === "hourly" ? "time" : "messages";

    // User info (safe)
    let userInfo: Record<string, unknown> = { id: license.user_id };
    try {
      const { data: profile } = await adminClient
        .from("profiles").select("full_name, email").eq("user_id", license.user_id).maybeSingle();
      if (profile) userInfo = { id: license.user_id, email: profile.email, name: profile.full_name };
    } catch { /* ok */ }

    // Audit log
    adminClient.from("extension_audit_log").insert({
      license_key_hash: resolvedKey.substring(0, 10) + "...",
      extension_key: extension || "speed",
      action: "validate",
      metadata: { plan: license.plan, hwid: hwid || null, isAdmin },
    }).then(() => {}).catch(() => {});

    return new Response(
      JSON.stringify({
        ok: true,
        valid: true,
        isAdmin,
        user: userInfo,
        plan: {
          code: (license.plan || "free").toUpperCase(),
          displayName: (license as any).plans?.display_name || (license as any).plans?.name || license.plan || "Free",
          allowedExtensions,
          billingType,
          dailyMessages: isAdmin ? null : license.daily_messages,
          usedToday: license.messages_used_today || 0,
          expiresAt: isAdmin ? null : license.expires_at,
        },
        planType: license.plan_type,
        type: license.type,
        status: license.status,
        dailyMessages: isAdmin ? null : license.daily_messages,
        hourlyLimit: isAdmin ? null : license.hourly_limit,
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
    return new Response(JSON.stringify({ ok: false, valid: false, error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
