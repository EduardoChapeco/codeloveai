import { Link, useLocation } from "react-router-dom";
import { useAuth, useIsAdmin, useIsAffiliate } from "@/hooks/useAuth";
import { useChatContext } from "@/contexts/ChatContext";
import { useTenant } from "@/contexts/TenantContext";
import { useHasActiveAccess } from "@/hooks/useHasActiveAccess";
import {
  Shield, Users, MessageCircle, LayoutDashboard,
  Download, Bot, Link2, FolderOpen, CreditCard, Settings2,
} from "lucide-react";

export default function AppNav() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { isAffiliate } = useIsAffiliate();
  const { toggleChat, isChatOpen } = useChatContext();
  const { tenant, isTenantAdmin, isTenantOwner } = useTenant();
  const { hasAccess } = useHasActiveAccess();
  const brandName = tenant?.name || "Starble Ai";
  const location = useLocation();

  if (authLoading || !user) return null;

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const navItems = [
    { to: "/dashboard",         label: "Painel",      icon: LayoutDashboard, show: true },
    { to: "/cirius",            label: "Cirius",      icon: Bot,             show: true },
    { to: "/community",         label: "Comunidade",  icon: MessageCircle,   show: true },
    { to: "/afiliado/dashboard", label: "Afiliado",    icon: Users,           show: isAffiliate },
    { to: "/lovable/connect",   label: "Lovable",     icon: Link2,           show: true },
    { to: "/lovable/projects",  label: "Projetos",    icon: FolderOpen,      show: true },
    { to: "/plans",             label: "Planos",      icon: CreditCard,      show: true },
    { to: "/admin/tenant",      label: "Meu WL",      icon: Settings2,       show: isTenantAdmin || isTenantOwner },
    { to: "/admin",             label: "Admin",       icon: Shield,          show: isAdmin },
    { to: "/install",           label: "Instalar",    icon: Download,        show: hasAccess },
  ];

  const initial = (user.email?.[0] || "U").toUpperCase();

  return (
    <nav
      className="sticky top-0 z-30 h-[58px] flex items-center justify-between px-5 bg-background/88 backdrop-blur-xl border-b border-border/50"
    >
      {/* ── Brand ── */}
      <Link to="/" className="flex items-center gap-2.5 shrink-0 select-none">
        {tenant?.logo_url ? (
          <img src={tenant.logo_url} alt="" className="w-[30px] h-[30px] rounded-[9px] object-cover shrink-0 shadow-md" />
        ) : (
          <div className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center text-primary-foreground text-[12px] font-black shrink-0 bg-primary shadow-md">
            {brandName.substring(0, 1)}
          </div>
        )}
        <span className="text-[13px] font-bold text-foreground hidden sm:inline" style={{ letterSpacing: "-0.02em" }}>
          {brandName}
        </span>
      </Link>

      {/* ── Nav items ── */}
      <div className="flex items-center gap-0.5 overflow-x-auto no-scrollbar">
        {navItems.filter(n => n.show).map(item => (
          <Link
            key={item.to}
            to={item.to}
            className={`lv-nav-item ${isActive(item.to) ? "lv-nav-item-active" : "lv-nav-item-inactive"}`}
          >
            <item.icon className="h-[15px] w-[15px] shrink-0" />
            <span className="hidden md:inline">{item.label}</span>
          </Link>
        ))}

        <Link
          to={`/profile/${user.id}`}
          className={`lv-nav-item ${location.pathname.startsWith("/profile") ? "lv-nav-item-active" : "lv-nav-item-inactive"}`}
        >
          <span className="hidden sm:inline text-[13px]">Perfil</span>
        </Link>

        {/* Chat AI button */}
        <button
          onClick={toggleChat}
          className={`lv-btn-icon ${isChatOpen ? "!bg-primary/10 !text-primary" : ""}`}
          title={brandName + " AI"}
        >
          <Bot className="h-4 w-4" />
        </button>

        {/* User avatar (click to sign out) */}
        <button
          onClick={signOut}
          title="Sair"
          className="ml-1 w-8 h-8 rounded-full flex items-center justify-center text-primary-foreground text-[11px] font-bold shrink-0 transition-opacity hover:opacity-80 bg-primary shadow-md"
        >
          {initial}
        </button>
      </div>
    </nav>
  );
}
