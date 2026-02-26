// Shared license validation & lifecycle guard
// Checks expiry, trial, daily token, limits — and auto-deactivates invalid licenses
// Admin master users bypass ALL limits

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface LicenseGuardResult {
  allowed: boolean;
  error?: string;
  isAdmin?: boolean;
  license?: Record<string, unknown>;
  usedToday?: number;
  dailyLimit?: number | null;
}

/**
 * Check if user is admin master (global admin role)
 */
export async function isAdminMaster(
  adminClient: SupabaseClient,
  userId: string
): Promise<boolean> {
  if (!userId) return false;
  const { data } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

/**
 * Full license lifecycle check:
 * 1. Verify license exists and is active
 * 2. Check expiry → auto-deactivate if expired
 * 3. Check trial expiry → auto-deactivate
 * 4. Check daily_token validity → auto-deactivate
 * 5. Check daily message limits (skip for unlimited/admin)
 * 6. Admin master = always allowed, no limits
 */
export async function guardLicense(
  adminClient: SupabaseClient,
  licenseKey: string
): Promise<LicenseGuardResult> {
  // Find license
  const { data: license } = await adminClient
    .from("licenses")
    .select("id, user_id, tenant_id, type, status, active, plan, plan_id, daily_messages, hourly_limit, messages_used_today, messages_used_month, last_reset_at, token_valid_until, trial_expires_at, expires_at")
    .eq("key", licenseKey)
    .eq("active", true)
    .maybeSingle();

  if (!license) {
    return { allowed: false, error: "Licença não encontrada ou inativa." };
  }

  // Check if admin master — bypass everything
  const admin = await isAdminMaster(adminClient, license.user_id);
  if (admin) {
    return { allowed: true, isAdmin: true, license, dailyLimit: null };
  }

  const now = new Date();

  // Check general expiry
  if (license.expires_at && new Date(license.expires_at) < now) {
    await deactivateLicense(adminClient, license.id, "expired");
    return { allowed: false, error: "Licença expirada." };
  }

  // Check trial expiry
  if (license.type === "trial" && license.trial_expires_at && new Date(license.trial_expires_at) < now) {
    await deactivateLicense(adminClient, license.id, "expired");
    return { allowed: false, error: "Período de teste expirado." };
  }

  // Check daily token expiry
  if (license.type === "daily_token" && license.token_valid_until && new Date(license.token_valid_until) < now) {
    await deactivateLicense(adminClient, license.id, "expired");
    return { allowed: false, error: "Token expirado. Renove para continuar." };
  }

  // Reset daily counter if new day
  const today = now.toISOString().split("T")[0];
  let usedToday = license.messages_used_today || 0;
  if (license.last_reset_at !== today) {
    usedToday = 0;
    // Reset in background
    adminClient.from("licenses").update({
      messages_used_today: 0,
      last_reset_at: today,
    }).eq("id", license.id).then(() => {}).catch(() => {});
  }

  // Check daily limit (null = unlimited)
  const dailyLimit = license.daily_messages;
  if (dailyLimit !== null && dailyLimit !== undefined && usedToday >= dailyLimit) {
    return {
      allowed: false,
      error: `Limite diário atingido (${dailyLimit} mensagens).`,
      usedToday,
      dailyLimit,
    };
  }

  return {
    allowed: true,
    isAdmin: false,
    license,
    usedToday,
    dailyLimit,
  };
}

/**
 * Auto-deactivate a license (set active=false, status=expired)
 */
async function deactivateLicense(
  adminClient: SupabaseClient,
  licenseId: string,
  status: string
): Promise<void> {
  await adminClient
    .from("licenses")
    .update({ active: false, status })
    .eq("id", licenseId);
}

/**
 * Increment usage counter ONLY after confirmed successful delivery.
 * Returns new usedToday count.
 */
export async function incrementUsage(
  adminClient: SupabaseClient,
  licenseId: string
): Promise<number> {
  const today = new Date().toISOString().split("T")[0];
  const { data: newCount } = await adminClient.rpc("increment_daily_usage", {
    p_license_id: licenseId,
    p_date: today,
  });

  // Also update the license row
  const { data: usage } = await adminClient
    .from("daily_usage")
    .select("messages_used")
    .eq("license_id", licenseId)
    .eq("date", today)
    .maybeSingle();

  const used = usage?.messages_used || newCount || 1;

  await adminClient.from("licenses").update({
    messages_used_today: used,
    messages_used_month: used, // simplified; real month tracking is via daily_usage
    last_reset_at: today,
  }).eq("id", licenseId);

  return used;
}
