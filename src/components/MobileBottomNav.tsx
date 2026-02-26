import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import {
  LayoutDashboard, Puzzle, MessageCircle, User, Brain, StickyNote, Download,
  Link2, FolderOpen, CreditCard, BookOpen, LifeBuoy, Scale, Users, Globe,
  Handshake, Bot, Workflow, Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const allItems = [
  { to: "/dashboard", icon: LayoutDashboard },
  { to: "/extensoes", icon: Puzzle },
  { to: "/brain", icon: Brain },
  { to: "/assistente", icon: Bot },
  { to: "/orquestrador", icon: Workflow },
  { to: "/community", icon: MessageCircle },
  { to: "/notes", icon: StickyNote },
  { to: "/install", icon: Download },
  { to: "/lovable/connect", icon: Link2 },
  { to: "/lovable/projects", icon: FolderOpen },
  { to: "/plans", icon: CreditCard },
  { to: "/ajuda", icon: BookOpen },
  { to: "/suporte", icon: LifeBuoy },
  { to: "/termos", icon: Scale },
  { to: "/afiliados", icon: Users },
  { to: "/whitelabel", icon: Globe },
  { to: "/parceiros", icon: Handshake },
  { to: "/extensoes/venus", icon: Sparkles },
];

export default function MobileBottomNav() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 md:hidden border-t border-border/40 safe-area-bottom">
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-1 px-2 py-2 min-w-max">
          {allItems.map(item => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center justify-center h-10 w-10 rounded-xl shrink-0 transition-all ${
                  active
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <Icon className="h-5 w-5" />
              </NavLink>
            );
          })}

          {/* Profile */}
          <NavLink
            to={`/profile/${user.id}`}
            className={`flex items-center justify-center h-10 w-10 rounded-xl shrink-0 transition-all ${
              isActive(`/profile/${user.id}`)
                ? "bg-primary/10 text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <User className="h-5 w-5" />
          </NavLink>
        </div>
      </div>
    </nav>
  );
}
