import { Link, useLocation } from "react-router-dom";
import { useAuth, useIsAdmin, useIsAffiliate } from "@/hooks/useAuth";
import { LogOut, Shield, Users, MessageCircle, LayoutDashboard, Download } from "lucide-react";

export default function AppNav() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { isAffiliate } = useIsAffiliate();
  const location = useLocation();

  if (authLoading || !user) return null;

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { to: "/dashboard", label: "PAINEL", icon: LayoutDashboard, show: true },
    { to: "/community", label: "COMUNIDADE", icon: MessageCircle, show: true },
    { to: "/affiliate", label: "AFILIADO", icon: Users, show: isAffiliate },
    { to: "/admin", label: "ADMIN", icon: Shield, show: isAdmin },
    { to: "/install", label: "INSTALAR", icon: Download, show: true },
  ];

  return (
    <nav className="sticky top-0 z-20 bg-background border-b border-border px-8 py-4 flex items-center justify-between">
      <Link to="/" className="ep-label text-sm tracking-[0.3em]">CODELOVE AI</Link>
      <div className="flex items-center gap-2">
        {navItems.filter(n => n.show).map(item => (
          <Link
            key={item.to}
            to={item.to}
            className={`h-9 px-4 rounded-[12px] text-[9px] font-bold tracking-wider flex items-center gap-1.5 transition-all ${
              isActive(item.to)
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <item.icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{item.label}</span>
          </Link>
        ))}
        <Link
          to={`/profile/${user.id}`}
          className={`h-9 px-4 rounded-[12px] text-[9px] font-bold tracking-wider flex items-center gap-1.5 transition-all ${
            location.pathname.startsWith("/profile")
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <span className="hidden sm:inline">PERFIL</span>
        </Link>
        <button onClick={signOut} className="ep-btn-icon h-9 w-9 rounded-[12px] ml-1">
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </nav>
  );
}
