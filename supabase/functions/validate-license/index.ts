// validate-license v3.0 — Venus God Mode validators, anti-bypass, admin notifications
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAdminMaster } from "../_shared/license-guard.ts";

const VENUS_EXTENSION_ID = "f1a2b3c4-d5e6-7890-abcd-ef1234567890";
const VENUS_SLUG = "venus";
const MAX_VALIDATION_RATE = 10; // per minute per hwid
const BYPASS_THRESHOLD = 30; // suspicious validation attempts per 5min

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-speed-client",
};

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Notify admin of suspicious activity
async function notifyAdmin(
  sc: ReturnType<typeof createClient>,
  title: string,
  description: string,
  type: string,
  referenceId?: string,
) {
  await sc.from("admin_notifications").insert({
    title,
    description,
    type,
    reference_id: referenceId || null,
    is_read: false,
  }).then(() => {}).catch(() => {});
}

// Check for bypass attempts (rapid validation with different keys/hwids)
async function checkBypassAttempt(
  sc: ReturnType<typeof createClient>,
  hwid: string | null,
  licenseKey: string,
  userId: string,
): Promise<boolean> {
  if (!hwid) return false;

  const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data } = await sc
    .from("extension_audit_log")
    .select("id")
    .eq("action", "validate")
    .gte("created_at", fiveMinAgo)
    .or(`metadata->>hwid.eq.${hwid},license_key_hash.eq.${licenseKey.substring(0, 10)}...`)
    .limit(BYPASS_THRESHOLD + 1);

  return (data?.length || 0) >= BYPASS_THRESHOLD;
}

// Venus-specific CLF1 signature validation
function isVenusTokenFormat(key: string): boolean {
  if (!key.startsWith("CLF1.")) return false;
  const parts = key.split(".");
  // Venus CLF1 must have 3 parts: CLF1.{payload}.{signature}
  return parts.length === 3 && parts[1].length >= 20 && parts[2].length >= 20;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonRes({ ok: false, valid: false, error: "Method not allowed" }, 405);

  try {
    const { licenseKey, hwid, token, extension } = await req.json();
    const resolvedKey = licenseKey || token;
    const requestedExtension = extension || "speed";

    if (!resolvedKey || typeof resolvedKey !== "string") {
      return jsonRes({ ok: false, valid: false, error: "licenseKey required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sc = createClient(supabaseUrl, serviceRoleKey);

    // ── Rate limiting by hwid ──
    if (hwid) {
      const rateKey = `vlicense:${hwid}`;
      const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
      const { data: rl } = await sc
        .from("rate_limits").select("count, window_start").eq("key", rateKey).maybeSingle();

      if (rl) {
        if (rl.window_start > oneMinuteAgo) {
          if (rl.count >= MAX_VALIDATION_RATE) {
            await notifyAdmin(sc, "Rate limit excedido", `HWID ${hwid} atingiu ${MAX_VALIDATION_RATE} validações/min`, "rate_limit", hwid);
            return jsonRes({ ok: false, valid: false, error: "Rate limit exceeded" }, 429);
          }
          await sc.from("rate_limits").update({ count: rl.count + 1 }).eq("key", rateKey);
        } else {
          await sc.from("rate_limits").update({ count: 1, window_start: new Date().toISOString() }).eq("key", rateKey);
        }
      } else {
        await sc.from("rate_limits").insert({ key: rateKey, count: 1, window_start: new Date().toISOString() });
      }
    }

    // ── Venus-specific: require proper CLF1 signed token ──
    if (requestedExtension === VENUS_SLUG) {
      if (!isVenusTokenFormat(resolvedKey)) {
        await notifyAdmin(sc, "Venus: Token inválido", `Tentativa de usar Venus com token malformado: ${resolvedKey.substring(0, 15)}...`, "security");
        return jsonRes({ ok: false, valid: false, error: "Venus requires a signed CLF1 token" }, 403);
      }
    }

    // ── Fetch license ──
    const { data: license } = await sc
      .from("licenses")
      .select("id, key, plan, plan_type, type, status, expires_at, active, device_id, user_id, tenant_id, daily_messages, hourly_limit, token_valid_until, trial_expires_at, trial_used, messages_used_today, plan_id, plans(name, display_name)")
      .eq("key", resolvedKey)
      .eq("active", true)
      .maybeSingle();

    if (!license) {
      return jsonRes({ ok: false, valid: false, error: "License not found or inactive" }, 401);
    }

    const isAdmin = await isAdminMaster(sc, license.user_id);
    const now = new Date();

    // ── Bypass detection ──
    if (!isAdmin && hwid) {
      const isBypass = await checkBypassAttempt(sc, hwid, resolvedKey, license.user_id);
      if (isBypass) {
        // Block the account
        await sc.from("licenses").update({ active: false, status: "suspended" }).eq("user_id", license.user_id);
        await notifyAdmin(
          sc,
          "🚨 Conta bloqueada por bypass",
          `Usuário ${license.user_id} bloqueado por tentativa de bypass. HWID: ${hwid}. Key: ${resolvedKey.substring(0, 15)}...`,
          "security_block",
          license.user_id,
        );
        return jsonRes({ ok: false, valid: false, error: "Account suspended for security violation" }, 403);
      }
    }

    // ── Lifecycle checks (skip for admin) ──
    if (!isAdmin) {
      if (license.expires_at && new Date(license.expires_at) < now) {
        await sc.from("licenses").update({ active: false, status: "expired" }).eq("id", license.id);
        await notifyAdmin(sc, "Licença expirada", `Licença ${license.id} expirou automaticamente`, "license_expired", license.id);
        return jsonRes({ ok: false, valid: false, error: "License expired" }, 401);
      }

      if (license.type === "trial" && license.trial_expires_at && new Date(license.trial_expires_at) < now) {
        await sc.from("licenses").update({ active: false, status: "expired" }).eq("id", license.id);
        return jsonRes({ ok: false, valid: false, error: "Trial expired" }, 401);
      }

      if (license.type === "daily_token" && license.token_valid_until && new Date(license.token_valid_until) < now) {
        await sc.from("licenses").update({ active: false, status: "expired" }).eq("id", license.id);
        return jsonRes({ ok: false, valid: false, error: "Daily token expired, please renew" }, 401);
      }

      if (license.daily_messages && license.messages_used_today >= license.daily_messages) {
        return jsonRes({ ok: false, valid: false, error: "Daily message limit reached" }, 429);
      }
    }

    // ── HWID binding ──
    if (hwid) {
      if (!license.device_id) {
        await sc.from("licenses").update({ device_id: hwid, last_validated_at: now.toISOString() }).eq("id", license.id);
        await notifyAdmin(sc, "Novo dispositivo vinculado", `HWID ${hwid} vinculado à licença ${license.id}`, "device_bind", license.id);
      } else if (license.device_id !== hwid) {
        await notifyAdmin(sc, "Dispositivo não autorizado", `HWID ${hwid} tentou usar licença vinculada a ${license.device_id}`, "device_mismatch", license.id);
        return jsonRes({ ok: false, valid: false, error: "Device not authorized" }, 403);
      } else {
        await sc.from("licenses").update({ last_validated_at: now.toISOString() }).eq("id", license.id);
      }
    } else {
      await sc.from("licenses").update({ last_validated_at: now.toISOString() }).eq("id", license.id);
    }

    // ── Fetch allowed extensions ──
    let allowedExtensions: string[] = [];
    if (license.plan_id) {
      const { data: peData } = await sc.from("plan_extensions").select("extension_id").eq("plan_id", license.plan_id);
      if (peData && peData.length > 0) {
        const extIds = peData.map((pe: any) => pe.extension_id);
        const { data: exts } = await sc.from("extension_catalog").select("slug").in("id", extIds);
        allowedExtensions = (exts || []).map((e: any) => e.slug);
      }
    }

    if (isAdmin) {
      const { data: allExts } = await sc.from("extension_catalog").select("slug").eq("is_active", true);
      allowedExtensions = (allExts || []).map((e: any) => e.slug);
    }

    // ── Labs restriction: tenant_owners only ──
    if (!isAdmin && allowedExtensions.includes("labs")) {
      const { data: tenantUser } = await sc
        .from("tenant_users").select("role").eq("user_id", license.user_id).eq("role", "tenant_owner").maybeSingle();
      if (!tenantUser) {
        allowedExtensions = allowedExtensions.filter(e => e !== "labs");
      }
    }

    // ── Venus access validation: must have venus in allowedExtensions ──
    if (requestedExtension === VENUS_SLUG && !allowedExtensions.includes(VENUS_SLUG)) {
      await notifyAdmin(
        sc,
        "Venus: Acesso negado",
        `Usuário ${license.user_id} tentou usar Venus sem plano God Mode. Plan: ${license.plan}`,
        "venus_unauthorized",
        license.user_id,
      );
      return jsonRes({
        ok: false,
        valid: false,
        error: "Venus requires God Mode plan. Upgrade at /extensoes/venus",
        upgrade_required: true,
        upgrade_url: "/extensoes/venus",
      }, 403);
    }

    const billingType = license.plan_type === "hourly" ? "time" : "messages";

    // ── User info ──
    let userInfo: Record<string, unknown> = { id: license.user_id };
    try {
      const { data: profile } = await sc
        .from("profiles").select("full_name, email").eq("user_id", license.user_id).maybeSingle();
      if (profile) userInfo = { id: license.user_id, email: profile.email, name: profile.full_name };
    } catch { /* ok */ }

    // ── Audit log ──
    sc.from("extension_audit_log").insert({
      license_key_hash: resolvedKey.substring(0, 10) + "...",
      extension_key: requestedExtension,
      action: "validate",
      metadata: { plan: license.plan, hwid: hwid || null, isAdmin, venus: requestedExtension === VENUS_SLUG },
    }).then(() => {}).catch(() => {});

    return jsonRes({
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
    });
  } catch (err) {
    console.error("validate-license error:", err);
    return jsonRes({ ok: false, valid: false, error: "Internal server error" }, 500);
  }
});
