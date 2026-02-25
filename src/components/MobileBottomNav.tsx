import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { LayoutDashboard, Puzzle, MessageCircle, User, MoreHorizontal } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { CreditCard, Download, Brain, StickyNote, BookOpen, LifeBuoy, Link2, FolderOpen, Users, Globe, Handshake, Scale } from "lucide-react";

const mainItems = [
  { to: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { to: "/extensoes", label: "Extensões", icon: Puzzle },
  { to: "/community", label: "Social", icon: MessageCircle },
];

const moreItems = [
  { to: "/brain", label: "Star AI", icon: Brain },
  { to: "/notes", label: "Notas", icon: StickyNote },
  { to: "/install", label: "Instalar", icon: Download },
  { to: "/lovable/connect", label: "Conectar", icon: Link2 },
  { to: "/lovable/projects", label: "Projetos", icon: FolderOpen },
  { to: "/plans", label: "Planos", icon: CreditCard },
  { to: "/ajuda", label: "Ajuda", icon: BookOpen },
  { to: "/suporte", label: "Suporte", icon: LifeBuoy },
  { to: "/termos", label: "Termos", icon: Scale },
  { to: "/afiliados", label: "Afiliados", icon: Users },
  { to: "/whitelabel", label: "White Label", icon: Globe },
  { to: "/parceiros", label: "Parceiros", icon: Handshake },
];

export default function MobileBottomNav() {
  const { user } = useAuth();
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);

  if (!user) return null;

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");

  const profileTo = `/profile/${user.id}`;

  return (
    <>
      {/* More menu overlay */}
      {showMore && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setShowMore(false)}>
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
          <div
            className="absolute bottom-16 left-2 right-2 rounded-2xl border border-border/50 bg-card/95 backdrop-blur-xl p-3 shadow-2xl animate-fade-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="grid grid-cols-4 gap-1">
              {moreItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setShowMore(false)}
                  className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-[10px] font-medium transition-colors ${
                    isActive(item.to)
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="truncate max-w-full">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav bar */}
      <nav className="fixed bottom-0 inset-x-0 z-50 md:hidden border-t border-border/50 bg-card/90 backdrop-blur-xl safe-area-bottom">
        <div className="flex items-center justify-around h-14 px-2">
          {mainItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors ${
                isActive(item.to)
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          ))}

          {/* Profile */}
          <NavLink
            to={profileTo}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors ${
              isActive(profileTo)
                ? "text-primary"
                : "text-muted-foreground"
            }`}
          >
            <User className="h-5 w-5" />
            <span className="text-[10px] font-medium">Perfil</span>
          </NavLink>

          {/* More */}
          <button
            onClick={() => setShowMore(!showMore)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors ${
              showMore ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-[10px] font-medium">Mais</span>
          </button>
        </div>
      </nav>
    </>
  );
}
