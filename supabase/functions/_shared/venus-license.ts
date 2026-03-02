import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface LicenseResult {
  valid: boolean;
  license?: Record<string, unknown>;
  error?: string;
}

export async function validateVenusLicense(licenseKey: string): Promise<LicenseResult> {
  if (!licenseKey) return { valid: false, error: "missing_key" };

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data, error } = await supabase
    .from("venus_licenses")
    .select("*")
    .eq("license_key", licenseKey)
    .eq("active", true)
    .single();

  if (error || !data) return { valid: false, error: "invalid_key" };

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { valid: false, error: "expired" };
  }

  if (data.quota !== -1 && data.used >= data.quota) {
    return { valid: false, error: "quota_exceeded" };
  }

  return { valid: true, license: data };
}

export function venusJson(data: unknown, status = 200) {
  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-clf-token, Authorization, authorization, x-client-info, apikey, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

export const VENUS_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-clf-token, Authorization, authorization, x-client-info, apikey, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
