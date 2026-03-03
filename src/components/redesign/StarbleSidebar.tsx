import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth, useIsAdmin, useIsAffiliate } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";
import { useChatContext } from "@/contexts/ChatContext";
import { useHasActiveAccess } from "@/hooks/useHasActiveAccess";
import {
  MessageCircle, Brain, FolderOpen, Star,
  ShoppingBag, BarChart3, Layout, Settings, CreditCard,
  LogOut, Sparkles, Shield, PanelLeftClose, PanelLeftOpen,
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
}

function NavEntry({ to, label, icon: Icon, iconColor, badge, badgeVariant = "default", active, collapsed }: NavEntryProps) {
  return (
    <NavLink to={to} className={`nav-entry ${active ? "active" : ""}`} style={{ textDecoration: "none" }} title={collapsed ? label : undefined}>
      <div className={`nav-ico-box ${iconColor}`}>
        <Icon />
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
  const { isAdmin } = useIsAdmin();
  const { isAffiliate } = useIsAffiliate();
  const { tenant, isTenantAdmin } = useTenant();
  const { hasAccess } = useHasActiveAccess();
  const location = useLocation();
  const navigate = useNavigate();
  const brandName = tenant?.name || "Starble";

  const [collapsed, setCollapsed] = useState(false);

  if (!user) return null;

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const initial = (user.email?.[0] || "U").toUpperCase();
  const userName = user.user_metadata?.name || user.email?.split("@")[0] || "Usuário";

  return (
    <div id="sidebar" className={collapsed ? "sb-collapsed" : ""}>
      {/* Header */}
      <div className="sb-header">
        <div className="sb-logo" onClick={() => navigate("/dashboard")}>
          <div className="sb-logo-mark">
            <Star size={14} color="#000" strokeWidth={2.5} />
          </div>
          {!collapsed && <span className="sb-logo-text">{brandName}</span>}
        </div>
        <button
          className="gl ico xs ghost"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        </button>
      </div>

      {/* Body */}
      <div className="sb-body">
        {!collapsed && <div className="sb-section">Principal</div>}
        <NavEntry to="/dashboard" label="Dashboard" icon={BarChart3} iconColor="ib-orange" active={isActive("/dashboard")} collapsed={collapsed} />
        <NavEntry to="/lovable/projects" label="Projetos" icon={FolderOpen} iconColor="ib-blue" active={isActive("/lovable/projects")} badge="2" collapsed={collapsed} />
        <NavEntry to="/brain" label="Star AI" icon={Brain} iconColor="ib-indigo" active={isActive("/brain")} badge="PRO" badgeVariant="pro" collapsed={collapsed} />
        <NavEntry to="/community" label="Comunidade" icon={MessageCircle} iconColor="ib-teal" active={isActive("/community")} badge="HOT" badgeVariant="new" collapsed={collapsed} />

        <div className="divider" />

        {!collapsed && <div className="sb-section">Ferramentas</div>}
        <NavEntry to="/marketplace" label="Loja" icon={ShoppingBag} iconColor="ib-pink" active={isActive("/marketplace")} badge="NOVO" badgeVariant="new" collapsed={collapsed} />
        <NavEntry to="/cirius" label="Cirius Editor" icon={Layout} iconColor="ib-purple" active={isActive("/cirius")} collapsed={collapsed} />
        <NavEntry to="/extensoes/venus" label="Venus AI" icon={Sparkles} iconColor="ib-green" active={isActive("/extensoes/venus")} badge="PRO" badgeVariant="pro" collapsed={collapsed} />

        <div className="divider" />

        {!collapsed && <div className="sb-section">Conta</div>}
        <NavEntry to={`/profile/${user.id}`} label="Perfil" icon={Settings} iconColor="ib-gray" active={isActive("/profile")} collapsed={collapsed} />
        <NavEntry to="/plans" label="Planos & Billing" icon={CreditCard} iconColor="ib-gray" active={isActive("/plans")} collapsed={collapsed} />

        {(isAdmin || isTenantAdmin) && (
          <>
            <div className="divider" />
            {!collapsed && <div className="sb-section">Admin</div>}
            {isTenantAdmin && <NavEntry to="/admin/tenant" label="Meu Tenant" icon={Shield} iconColor="ib-orange" active={isActive("/admin/tenant")} collapsed={collapsed} />}
            {isAdmin && <NavEntry to="/admin" label="Administração" icon={Shield} iconColor="ib-red" active={isActive("/admin")} collapsed={collapsed} />}
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
            <button className="gl sm orange" style={{ width: "100%" }}>Ver planos</button>
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
