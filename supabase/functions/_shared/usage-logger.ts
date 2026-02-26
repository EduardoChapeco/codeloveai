import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Logs extension API usage to extension_usage_logs table.
 * Fire-and-forget — never blocks the response.
 */
export function logExtensionUsage(params: {
  userId: string;
  functionName: string;
  projectId?: string;
  licenseKeyHash?: string;
  ipAddress?: string;
  userAgent?: string;
  responseStatus?: number;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}) {
  try {
    const sc = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    // fire-and-forget
    sc.from("extension_usage_logs").insert({
      user_id: params.userId,
      function_name: params.functionName,
      project_id: params.projectId || null,
      license_key_hash: params.licenseKeyHash || null,
      ip_address: params.ipAddress || null,
      user_agent: params.userAgent || null,
      response_status: params.responseStatus || null,
      duration_ms: params.durationMs || null,
      metadata: params.metadata || {},
    }).then(() => {}).catch((e) => console.error("[usage-logger]", e));
  } catch (e) {
    console.error("[usage-logger] init error", e);
  }
}

/** Hash a license key for safe storage (first 12 chars) */
export function hashLicenseKey(key: string): string {
  if (!key) return "";
  return key.substring(0, 12) + "***";
}
