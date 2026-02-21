/**
 * Shared tenant resolution logic for Edge Functions.
 * Resolves tenant_id from:
 * 1. X-Tenant-ID header (explicit)
 * 2. Origin/Referer domain match
 * 3. User's primary tenant
 * 4. Default tenant fallback
 */

const DEFAULT_TENANT_ID = "a0000000-0000-0000-0000-000000000001";

export interface TenantInfo {
  tenant_id: string;
  commission_percent: number;
  token_cost: number;
  is_active: boolean;
}

export async function resolveTenant(
  serviceClient: any,
  req: Request,
  userId?: string
): Promise<TenantInfo> {
  // 1. Explicit header
  const headerTenantId = req.headers.get("X-Tenant-ID");
  if (headerTenantId && /^[0-9a-f-]{36}$/i.test(headerTenantId)) {
    const { data } = await serviceClient
      .from("tenants")
      .select("id, commission_percent, token_cost, is_active")
      .eq("id", headerTenantId)
      .eq("is_active", true)
      .maybeSingle();
    if (data) return data as TenantInfo;
  }

  // 2. Origin domain match
  const origin = req.headers.get("origin") || req.headers.get("referer") || "";
  if (origin) {
    try {
      const hostname = new URL(origin).hostname;
      if (hostname && !hostname.endsWith("localhost")) {
        const { data } = await serviceClient
          .from("tenants")
          .select("id, commission_percent, token_cost, is_active")
          .eq("domain_custom", hostname)
          .eq("is_domain_approved", true)
          .eq("is_active", true)
          .maybeSingle();
        if (data) return data as TenantInfo;
      }
    } catch {}
  }

  // 3. User's primary tenant
  if (userId) {
    const { data: tu } = await serviceClient
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", userId)
      .eq("is_primary", true)
      .maybeSingle();
    if (tu) {
      const { data } = await serviceClient
        .from("tenants")
        .select("id, commission_percent, token_cost, is_active")
        .eq("id", tu.tenant_id)
        .eq("is_active", true)
        .maybeSingle();
      if (data) return data as TenantInfo;
    }
  }

  // 4. Default
  const { data: defaultTenant } = await serviceClient
    .from("tenants")
    .select("id, commission_percent, token_cost, is_active")
    .eq("id", DEFAULT_TENANT_ID)
    .maybeSingle();

  return defaultTenant || {
    tenant_id: DEFAULT_TENANT_ID,
    commission_percent: 0,
    token_cost: 0,
    is_active: true,
  };
}
