import { useLocation, useNavigate } from "react-router-dom";
import { useAuth, useIsAdmin, useIsAffiliate } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";
import { useChatContext } from "@/contexts/ChatContext";
import { useHasActiveAccess } from "@/hooks/useHasActiveAccess";
import {
  MessageCircle, Brain, FolderOpen, Star,
  ShoppingBag, BarChart3, Layout, Settings, CreditCard,
  LogOut, Sparkles, Shield, ChevronRight,
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
}

function NavEntry({ to, label, icon: Icon, iconColor, badge, badgeVariant = "default", active }: NavEntryProps) {
  return (
    <NavLink to={to} className={`nav-entry ${active ? "active" : ""}`} style={{ textDecoration: "none" }}>
      <div className={`nav-ico-box ${iconColor}`}>
        <Icon />
      </div>
      <span>{label}</span>
      {badge && (
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

  if (!user) return null;

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const initial = (user.email?.[0] || "U").toUpperCase();
  const userName = user.user_metadata?.name || user.email?.split("@")[0] || "Usuário";

  return (
    <div id="sidebar">
      {/* Header */}
      <div className="sb-header">
        <div className="sb-logo" onClick={() => navigate("/dashboard")}>
          <div className="sb-logo-mark">
            <Star size={14} color="#000" strokeWidth={2.5} />
          </div>
          <span className="sb-logo-text">{brandName}</span>
        </div>
      </div>

      {/* Body */}
      <div className="sb-body">
        <div className="sb-section">Principal</div>
        <NavEntry to="/assistente" label="Assistente IA" icon={Sparkles} iconColor="ib-orange" active={isActive("/assistente")} />
        <NavEntry to="/lovable/projects" label="Projetos" icon={FolderOpen} iconColor="ib-blue" active={isActive("/lovable/projects")} badge="2" />
        <NavEntry to="/brain" label="Star AI" icon={Brain} iconColor="ib-indigo" active={isActive("/brain")} badge="PRO" badgeVariant="pro" />
        <NavEntry to="/community" label="Comunidade" icon={MessageCircle} iconColor="ib-teal" active={isActive("/community")} badge="HOT" badgeVariant="new" />

        <div className="divider" />

        <div className="sb-section">Ferramentas</div>
        <NavEntry to="/marketplace" label="Loja" icon={ShoppingBag} iconColor="ib-pink" active={isActive("/marketplace")} badge="NOVO" badgeVariant="new" />
        <NavEntry to="/cirius" label="Cirius Editor" icon={Layout} iconColor="ib-purple" active={isActive("/cirius")} />
        <NavEntry to="/extensoes/venus" label="Venus AI" icon={Sparkles} iconColor="ib-green" active={isActive("/extensoes/venus")} badge="PRO" badgeVariant="pro" />

        <div className="divider" />

        <div className="sb-section">Conta</div>
        <NavEntry to={`/profile/${user.id}`} label="Perfil" icon={Settings} iconColor="ib-gray" active={isActive("/profile")} />
        <NavEntry to="/plans" label="Planos & Billing" icon={CreditCard} iconColor="ib-gray" active={isActive("/plans")} />

        {(isAdmin || isTenantAdmin) && (
          <>
            <div className="divider" />
            <div className="sb-section">Admin</div>
            {isTenantAdmin && <NavEntry to="/admin/tenant" label="Meu Tenant" icon={Shield} iconColor="ib-orange" active={isActive("/admin/tenant")} />}
            {isAdmin && <NavEntry to="/admin" label="Administração" icon={Shield} iconColor="ib-red" active={isActive("/admin")} />}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="sb-footer">
        {!hasAccess && (
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
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sb-user-name">{userName}</div>
            <div className="sb-user-plan">{hasAccess ? "Plano Ativo" : "Plano Gratuito"}</div>
          </div>
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
