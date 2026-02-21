import { Link, useLocation } from "react-router-dom";
import { useAuth, useIsAdmin, useIsAffiliate } from "@/hooks/useAuth";
import { useChatContext } from "@/contexts/ChatContext";
import { useTenant } from "@/contexts/TenantContext";
import { LogOut, Shield, Users, MessageCircle, LayoutDashboard, Download, Bot, Link2, FolderOpen } from "lucide-react";

export default function AppNav() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { isAffiliate } = useIsAffiliate();
  const { toggleChat, isChatOpen } = useChatContext();
  const { tenant } = useTenant();
  const brandName = tenant?.name || "CodeLove AI";
  const location = useLocation();

  if (authLoading || !user) return null;

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { to: "/dashboard", label: "Painel", icon: LayoutDashboard, show: true },
    { to: "/community", label: "Comunidade", icon: MessageCircle, show: true },
    { to: "/affiliate", label: "Afiliado", icon: Users, show: isAffiliate },
    { to: "/lovable/connect", label: "Lovable", icon: Link2, show: true },
    { to: "/lovable/projects", label: "Projetos", icon: FolderOpen, show: true },
    { to: "/admin", label: "Admin", icon: Shield, show: isAdmin },
    { to: "/install", label: "Instalar", icon: Download, show: true },
  ];

  return (
    <nav className="sticky top-0 z-20 bg-card/80 backdrop-blur-sm border-b border-border/60 px-6 py-3 flex items-center justify-between">
      <Link to="/" className="text-base font-semibold tracking-tight text-foreground">
        {brandName}
      </Link>
      <div className="flex items-center gap-1">
        {navItems.filter(n => n.show).map(item => (
          <Link
            key={item.to}
            to={item.to}
            className={`lv-nav-item ${
              isActive(item.to) ? "lv-nav-item-active" : "lv-nav-item-inactive"
            }`}
          >
            <item.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{item.label}</span>
          </Link>
        ))}
        <Link
          to={`/profile/${user.id}`}
          className={`lv-nav-item ${
            location.pathname.startsWith("/profile") ? "lv-nav-item-active" : "lv-nav-item-inactive"
          }`}
        >
          <span className="hidden sm:inline">Perfil</span>
        </Link>
        <button
          onClick={toggleChat}
          className={`lv-btn-icon ${
            isChatOpen ? "bg-primary/10 text-primary" : ""
          }`}
          title={brandName}
        >
          <Bot className="h-4 w-4" />
        </button>
        <button onClick={signOut} className="lv-btn-icon ml-1">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}