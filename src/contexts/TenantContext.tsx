import { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { getThemePreset, hexToHSL } from "@/lib/tenant-themes";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain_custom: string | null;
  is_domain_approved: boolean;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  meta_title: string | null;
  meta_description: string | null;
  terms_template: string | null;
  commission_percent: number;
  token_cost: number;
  is_active: boolean;
  theme_preset: string;
  font_family: string;
  border_radius: string;
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

async function resolveTenantId(userId: string | null): Promise<string> {
  const hostname = window.location.hostname;
  
  if (hostname !== "localhost" && !hostname.endsWith(".lovable.app")) {
    const { data: domainTenant } = await supabase
      .from("tenants").select("id")
      .eq("domain_custom", hostname).eq("is_active", true).eq("is_domain_approved", true).maybeSingle();
    if (domainTenant) return domainTenant.id;
  }

  const params = new URLSearchParams(window.location.search);
  const slugParam = params.get("tenant");
  if (slugParam) {
    const sanitized = slugParam.replace(/[^a-zA-Z0-9_-]/g, "").substring(0, 50);
    const { data: slugTenant } = await supabase
      .from("tenants").select("id")
      .eq("slug", sanitized).eq("is_active", true).maybeSingle();
    if (slugTenant) return slugTenant.id;
  }

  if (userId) {
    const { data: primary } = await supabase
      .from("tenant_users").select("tenant_id")
      .eq("user_id", userId).eq("is_primary", true).maybeSingle();
    if (primary) return primary.tenant_id;
  }

  return DEFAULT_TENANT_ID;
}

/** Apply full tenant theme to document */
function applyTenantTheme(tenant: Tenant) {
  const root = document.documentElement;
  const isDark = root.classList.contains("dark");

  // 1. Apply theme preset variables
  const preset = getThemePreset(tenant.theme_preset);
  if (preset) {
    // Dark-native presets can be applied directly; for light presets in dark mode, skip color tokens
    const isDarkPreset = ["midnight", "neon-cyber"].includes(preset.id);
    const darkSkipKeys = new Set([
      "--background", "--foreground", "--card", "--card-foreground",
      "--popover", "--popover-foreground", "--muted", "--muted-foreground",
      "--accent", "--accent-foreground", "--border", "--input",
      "--sidebar-background", "--sidebar-foreground", "--sidebar-accent",
      "--sidebar-accent-foreground", "--sidebar-border",
      "--glass-bg", "--glass-border",
    ]);

    Object.entries(preset.variables).forEach(([key, value]) => {
      // In dark mode, only apply color-token overrides from dark-native presets
      if (isDark && !isDarkPreset && darkSkipKeys.has(key)) return;
      root.style.setProperty(key, value);
    });
  }

  // 2. Apply tenant-specific primary/secondary/accent colors (override preset)
  if (tenant.primary_color) {
    const hsl = hexToHSL(tenant.primary_color);
    root.style.setProperty("--primary", hsl);
    root.style.setProperty("--ring", hsl);
    root.style.setProperty("--sidebar-primary", hsl);
    root.style.setProperty("--sidebar-ring", hsl);
  }
  if (tenant.accent_color) {
    const hsl = hexToHSL(tenant.accent_color);
    // Only override accent if not a dark theme preset
    if (preset && !["midnight", "neon-cyber"].includes(preset.id)) {
      root.style.setProperty("--accent", hsl.replace(/(\d+)%$/, (_, l) => `${Math.min(Number(l) + 40, 96)}%`));
      root.style.setProperty("--accent-foreground", hsl.replace(/(\d+)%$/, (_, l) => `${Math.max(Number(l) - 15, 20)}%`));
    }
  }

  // 3. Border radius
  if (tenant.border_radius) {
    root.style.setProperty("--radius", tenant.border_radius);
  }

  // 4. Font family
  if (tenant.font_family && tenant.font_family !== "system") {
    const fontMap: Record<string, string> = {
      inter: "'Inter', system-ui, sans-serif",
      poppins: "'Poppins', system-ui, sans-serif",
      dm_sans: "'DM Sans', system-ui, sans-serif",
      space_grotesk: "'Space Grotesk', system-ui, sans-serif",
      nunito: "'Nunito', system-ui, sans-serif",
    };
    const font = fontMap[tenant.font_family];
    if (font) document.body.style.fontFamily = font;
  } else {
    document.body.style.fontFamily = "";
  }

  // 5. Tenant CSS vars for custom usage
  root.style.setProperty("--tenant-primary", tenant.primary_color);
  root.style.setProperty("--tenant-secondary", tenant.secondary_color);

  // 6. Favicon
  if (tenant.favicon_url) {
    const link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    if (link) link.href = tenant.favicon_url;
  }

  // 7. Document title
  if (tenant.meta_title) {
    document.title = tenant.meta_title;
  }
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
          .from("tenants").select("*")
          .eq("id", tenantId).maybeSingle();

        if (!mountedRef.current) return;

        if (tenantData) {
          const t = tenantData as Tenant;
          setTenant(t);
        }

        if (user?.id) {
          const { data: memberData } = await supabase
            .from("tenant_users").select("tenant_id, role, is_primary")
            .eq("user_id", user.id).eq("tenant_id", tenantId).maybeSingle();
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

  // Apply branding when tenant changes
  useEffect(() => {
    if (!tenant) return;
    applyTenantTheme(tenant);
  }, [tenant]);

  const isTenantAdmin = membership?.role === "tenant_admin" || membership?.role === "tenant_owner";
  const isTenantOwner = membership?.role === "tenant_owner";

  const switchTenant = async (tenantId: string) => {
    if (!user?.id) return;
    setTenantLoading(true);
    try {
      const { data: newTenant } = await supabase
        .from("tenants").select("*")
        .eq("id", tenantId).maybeSingle();
      if (newTenant) {
        const t = newTenant as Tenant;
        setTenant(t);
      }

      const { data: newMembership } = await supabase
        .from("tenant_users").select("tenant_id, role, is_primary")
        .eq("user_id", user.id).eq("tenant_id", tenantId).maybeSingle();
      setMembership(newMembership as TenantMembership | null);
    } finally {
      setTenantLoading(false);
    }
  };

  return (
    <TenantContext.Provider value={{
      tenant, tenantLoading, membership,
      isTenantAdmin, isTenantOwner,
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
