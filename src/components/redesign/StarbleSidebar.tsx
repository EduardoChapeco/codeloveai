import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth, useIsAdmin, useIsAffiliate } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";
import { useHasActiveAccess } from "@/hooks/useHasActiveAccess";
import {
  Brain, FolderOpen, Star,
  ShoppingBag, BarChart3, CreditCard, Users,
  LogOut, Sparkles, Shield, Settings, Plug,
  Globe, ArrowLeft, Puzzle, Layers, Cloud,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";

interface NavEntryProps {
  to: string;
  label: string;
  icon: React.ElementType;
  iconColor: string;
  badge?: string;
  badgeVariant?: "default" | "new" | "pro";
  active?: boolean;
  collapsed?: boolean;
  sub?: boolean;
}

function NavEntry({ to, label, icon: Icon, iconColor, badge, badgeVariant = "default", active, collapsed, sub }: NavEntryProps) {
  return (
    <NavLink to={to} className={`nav-entry ${active ? "active" : ""}`} style={{ textDecoration: "none", paddingLeft: sub && !collapsed ? 28 : undefined }} title={collapsed ? label : undefined}>
      <div className={`nav-ico-box ${iconColor}`} style={sub ? { width: 24, height: 24 } : undefined}>
        <Icon size={sub ? 12 : undefined} />
      </div>
      {!collapsed && <span>{label}</span>}
      {!collapsed && badge && (
        <span className={`ne-badge ${badgeVariant === "new" ? "new" : badgeVariant === "pro" ? "pro" : ""}`}>
          {badge}
        </span>
      )}
    </NavLink>
  );
}

export default function StarbleSidebar() {
  const { user, signOut } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { isAffiliate } = useIsAffiliate();
  const { tenant, isTenantAdmin } = useTenant();
  const { hasAccess } = useHasActiveAccess();
  const location = useLocation();
  const navigate = useNavigate();
  const brandName = tenant?.name || "Starble";

  const [collapsed, setCollapsed] = useState(false);

  // Listen for toggle events from topbar
  useEffect(() => {
    const handler = () => setCollapsed(c => !c);
    window.addEventListener("sidebar-toggle", handler);
    return () => window.removeEventListener("sidebar-toggle", handler);
  }, []);

  if (!user) return null;

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const initial = (user.email?.[0] || "U").toUpperCase();
  const userName = user.user_metadata?.name || user.email?.split("@")[0] || "Usuário";

  // Contextual: Are we in admin area?
  const inAdminContext = location.pathname.startsWith("/admin");

  return (
    <div id="sidebar" className={collapsed ? "sb-collapsed" : ""}>
      {/* Header */}
      <div className="sb-header">
        <div className="sb-logo" onClick={() => navigate("/dashboard")}>
          {tenant?.logo_url ? (
            <img src={tenant.logo_url} alt={brandName} className="sb-logo-img" style={{ width: 28, height: 28, borderRadius: 8, objectFit: "contain" }} />
          ) : (
            <div className="sb-logo-mark">
              <Star size={14} color="#000" strokeWidth={2.5} />
            </div>
          )}
          {!collapsed && <span className="sb-logo-text">{brandName}</span>}
        </div>
      </div>

      {/* Body */}
      <div className="sb-body">
        {inAdminContext && (isAdmin || isTenantAdmin) ? (
          /* ── CONTEXTUAL ADMIN SIDEBAR ── */
          <>
            <NavEntry to="/dashboard" label="← Voltar" icon={ArrowLeft} iconColor="ib-gray" collapsed={collapsed} />
            <div className="divider" />
            {!collapsed && <div className="sb-section">Administração</div>}
            <NavEntry to="/admin" label="Painel Admin" icon={Shield} iconColor="ib-red" active={location.pathname === "/admin"} collapsed={collapsed} />

            {(isAdmin || isTenantAdmin) && (
              <NavEntry to="/admin/global" label="Admin Global" icon={Globe} iconColor="ib-red" active={isActive("/admin/global")} collapsed={collapsed} sub />
            )}

            {isAdmin && (
              <>
                <NavEntry to="/admin/integrations" label="Integrações API" icon={Settings} iconColor="ib-gray" active={isActive("/admin/integrations")} collapsed={collapsed} sub />
                <NavEntry to="/admin/cloud" label="Lovable Cloud" icon={Cloud} iconColor="ib-blue" active={isActive("/admin/cloud")} collapsed={collapsed} sub />
                <NavEntry to="/admin/brainchain" label="Brainchain" icon={Brain} iconColor="ib-purple" active={isActive("/admin/brainchain")} collapsed={collapsed} sub />

                <div className="divider" />
                {!collapsed && <div className="sb-section">Gestão</div>}
                <NavEntry to="/tenant/admin" label="Tenants" icon={Users} iconColor="ib-teal" active={isActive("/tenant/admin")} collapsed={collapsed} />
                <NavEntry to="/admin/extensions" label="Extensões" icon={Puzzle} iconColor="ib-green" active={isActive("/admin/extensions")} collapsed={collapsed} />
                <NavEntry to="/admin/modules" label="Módulos" icon={Layers} iconColor="ib-indigo" active={isActive("/admin/modules")} collapsed={collapsed} />
              </>
            )}
          </>
        ) : (
          /* ── MAIN SIDEBAR ── */
          <>
            {!collapsed && <div className="sb-section">Principal</div>}
            <NavEntry to="/dashboard" label="Dashboard" icon={BarChart3} iconColor="ib-blue" active={isActive("/dashboard")} collapsed={collapsed} />
            <NavEntry to="/lovable/projects" label="Projetos" icon={FolderOpen} iconColor="ib-indigo" active={isActive("/lovable/projects") || isActive("/cirius") || isActive("/projeto")} collapsed={collapsed} />
            <NavEntry to="/lovable/connect" label="Painel & Conexão" icon={Plug} iconColor="ib-teal" active={isActive("/lovable/connect")} collapsed={collapsed} />
            <NavEntry to="/brain" label="Star AI" icon={Brain} iconColor="ib-purple" active={isActive("/brain")} badge="PRO" badgeVariant="pro" collapsed={collapsed} />

            <div className="divider" />

            {!collapsed && <div className="sb-section">Comunidade & Loja</div>}
            <NavEntry to="/community" label="Comunidade" icon={Users} iconColor="ib-teal" active={isActive("/community")} collapsed={collapsed} />
            <NavEntry to="/marketplace" label="Loja" icon={ShoppingBag} iconColor="ib-pink" active={isActive("/marketplace")} collapsed={collapsed} />
            <NavEntry to="/extensoes/venus" label="Venus AI" icon={Sparkles} iconColor="ib-green" active={isActive("/extensoes/venus")} badge="PRO" badgeVariant="pro" collapsed={collapsed} />

            <div className="divider" />

            {!collapsed && <div className="sb-section">Conta</div>}
            <NavEntry to="/cirius/integrations" label="Configurações" icon={Settings} iconColor="ib-gray" active={isActive("/cirius/integrations")} collapsed={collapsed} />
            <NavEntry to="/plans" label="Planos & Billing" icon={CreditCard} iconColor="ib-gray" active={isActive("/plans") || isActive("/checkout")} collapsed={collapsed} />

            {/* Admin entry point */}
            {(isAdmin || isTenantAdmin) && !adminLoading && (
              <>
                <div className="divider" />
                {!collapsed && <div className="sb-section">Admin</div>}
                <NavEntry to="/admin" label="Painel Admin" icon={Shield} iconColor="ib-red" active={isActive("/admin")} collapsed={collapsed} />
              </>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="sb-footer">
        {!hasAccess && !collapsed && (
          <div className="sb-upgrade" onClick={() => navigate("/plans")}>
            <div className="su-label">
              <Sparkles size={11} style={{ display: "inline", marginRight: 4 }} />
              Upgrade para Pro
            </div>
            <div className="su-desc">Acesse Star Brain e recursos avançados</div>
            <button className="gl sm primary" style={{ width: "100%" }}>Ver planos</button>
          </div>
        )}

        <div className="sb-user" onClick={() => navigate(`/profile/${user.id}`)}>
          <div className="sb-avatar">{initial}</div>
          {!collapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sb-user-name">{userName}</div>
              <div className="sb-user-plan">{hasAccess ? "Plano Ativo" : "Plano Gratuito"}</div>
            </div>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); signOut(); }}
            className="gl ico xs ghost"
            title="Sair"
          >
            <LogOut size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
