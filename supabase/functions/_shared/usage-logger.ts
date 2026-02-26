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
    // user_id in extension_usage_logs is UUID; skip invalid values to avoid DB errors
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(params.userId || "");
    if (!isUuid) {
      console.warn(`[usage-logger] skipped log due invalid userId: ${params.userId}`);
      return;
    }

    const sc = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

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
