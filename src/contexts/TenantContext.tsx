import { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain_custom: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  meta_title: string | null;
  meta_description: string | null;
  terms_template: string | null;
  commission_percent: number;
  token_cost: number;
  is_active: boolean;
}

export interface TenantMembership {
  tenant_id: string;
  role: string;
  is_primary: boolean;
}

interface TenantContextType {
  tenant: Tenant | null;
  tenantLoading: boolean;
  membership: TenantMembership | null;
  isTenantAdmin: boolean;
  isTenantOwner: boolean;
  isGlobalAdmin: boolean;
  switchTenant: (tenantId: string) => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

const DEFAULT_TENANT_ID = "a0000000-0000-0000-0000-000000000001";

/**
 * Resolve tenant by:
 * 1. Custom domain match
 * 2. Slug from URL (?tenant=slug)
 * 3. User's primary tenant
 * 4. Fallback to default
 */
async function resolveTenantId(userId: string | null): Promise<string> {
  const hostname = window.location.hostname;
  
  // 1. Try custom domain
  if (hostname !== "localhost" && !hostname.endsWith(".lovable.app")) {
    const { data: domainTenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("domain_custom", hostname)
      .eq("is_active", true)
      .maybeSingle();
    if (domainTenant) return domainTenant.id;
  }

  // 2. Try URL param ?tenant=slug
  const params = new URLSearchParams(window.location.search);
  const slugParam = params.get("tenant");
  if (slugParam) {
    const sanitized = slugParam.replace(/[^a-zA-Z0-9_-]/g, "").substring(0, 50);
    const { data: slugTenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("slug", sanitized)
      .eq("is_active", true)
      .maybeSingle();
    if (slugTenant) return slugTenant.id;
  }

  // 3. User's primary tenant
  if (userId) {
    const { data: primary } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", userId)
      .eq("is_primary", true)
      .maybeSingle();
    if (primary) return primary.tenant_id;
  }

  // 4. Fallback
  return DEFAULT_TENANT_ID;
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user, isAdmin } = useAuthContext();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [membership, setMembership] = useState<TenantMembership | null>(null);
  const [tenantLoading, setTenantLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    
    const loadTenant = async () => {
      try {
        const tenantId = await resolveTenantId(user?.id ?? null);

        const { data: tenantData } = await supabase
          .from("tenants")
          .select("*")
          .eq("id", tenantId)
          .maybeSingle();

        if (!mountedRef.current) return;

        if (tenantData) {
          setTenant(tenantData as Tenant);
        }

        // Load membership if user is logged in
        if (user?.id) {
          const { data: memberData } = await supabase
            .from("tenant_users")
            .select("tenant_id, role, is_primary")
            .eq("user_id", user.id)
            .eq("tenant_id", tenantId)
            .maybeSingle();

          if (!mountedRef.current) return;
          setMembership(memberData as TenantMembership | null);
        }
      } catch (err) {
        console.error("Failed to load tenant:", err);
      } finally {
        if (mountedRef.current) setTenantLoading(false);
      }
    };

    loadTenant();

    return () => { mountedRef.current = false; };
  }, [user?.id]);

  // Apply tenant branding via CSS variables
  useEffect(() => {
    if (!tenant) return;
    const root = document.documentElement;
    root.style.setProperty("--tenant-primary", tenant.primary_color);
    root.style.setProperty("--tenant-secondary", tenant.secondary_color);

    if (tenant.favicon_url) {
      const link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
      if (link) link.href = tenant.favicon_url;
    }

    if (tenant.meta_title) {
      document.title = tenant.meta_title;
    }
  }, [tenant]);

  const isTenantAdmin = membership?.role === "tenant_admin" || membership?.role === "tenant_owner";
  const isTenantOwner = membership?.role === "tenant_owner";

  const switchTenant = async (tenantId: string) => {
    if (!user?.id) return;
    setTenantLoading(true);
    try {
      const { data: newTenant } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", tenantId)
        .maybeSingle();
      if (newTenant) setTenant(newTenant as Tenant);

      const { data: newMembership } = await supabase
        .from("tenant_users")
        .select("tenant_id, role, is_primary")
        .eq("user_id", user.id)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      setMembership(newMembership as TenantMembership | null);
    } finally {
      setTenantLoading(false);
    }
  };

  return (
    <TenantContext.Provider value={{
      tenant,
      tenantLoading,
      membership,
      isTenantAdmin,
      isTenantOwner,
      isGlobalAdmin: isAdmin,
      switchTenant,
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
}
