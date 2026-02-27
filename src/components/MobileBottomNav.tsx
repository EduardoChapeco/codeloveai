import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import {
  LayoutDashboard, Puzzle, MessageCircle, User, Brain, StickyNote, Download,
  Link2, FolderOpen, CreditCard, BookOpen, LifeBuoy, Scale, Users, Globe,
  Handshake, Bot, Workflow, Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const allItems = [
  { to: "/community", icon: MessageCircle },
  { to: "/dashboard", icon: LayoutDashboard },
  { to: "/extensoes", icon: Puzzle },
  { to: "/brain", icon: Brain },
  { to: "/assistente", icon: Bot },
  { to: "/orquestrador", icon: Workflow },
  { to: "/notes", icon: StickyNote },
  { to: "/lovable/projects", icon: FolderOpen },
  { to: "/plans", icon: CreditCard },
  { to: "/ajuda", icon: BookOpen },
  { to: "/suporte", icon: LifeBuoy },
];

export default function MobileBottomNav() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 md:hidden border-t border-border/40 bg-background/60 backdrop-blur-xl safe-area-bottom">
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-3 px-3 py-3" style={{ width: "max-content" }}>
          {allItems.map(item => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center justify-center h-14 w-14 rounded-2xl shrink-0 transition-all ${
                  active
                    ? "bg-primary/15 text-primary shadow-md scale-105"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                <Icon className="h-6 w-6" />
              </NavLink>
            );
          })}

          <NavLink
            to={`/profile/${user.id}`}
            className={`flex items-center justify-center h-14 w-14 rounded-2xl shrink-0 transition-all ${
              isActive(`/profile/${user.id}`)
                ? "bg-primary/15 text-primary shadow-md scale-105"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <User className="h-6 w-6" />
          </NavLink>
        </div>
      </div>
    </nav>
  );
}
