import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import {
  MessageCircle, Package, Puzzle, FolderOpen, Brain, Workflow, Zap,
  StickyNote, User, CreditCard, BookOpen, LifeBuoy,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

// Same order as AppSidebar mainItems + accountItems
const allItems = [
  { to: "/community", icon: MessageCircle },
  { to: "/marketplace", icon: Package },
  { to: "/extensoes", icon: Puzzle },
  { to: "/lovable/projects", icon: FolderOpen },
  { to: "/brain", icon: Brain },
  { to: "/orquestrador", icon: Workflow },
  { to: "/automation", icon: Zap },
  { to: "/notes", icon: StickyNote },
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
