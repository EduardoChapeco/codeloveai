import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import {
  FolderOpen, Brain, MessageCircle,
  ShoppingBag, Layout, CreditCard, User,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const items = [
  { to: "/dashboard", icon: Layout },
  { to: "/lovable/projects", icon: FolderOpen },
  { to: "/brain", icon: Brain },
  { to: "/community", icon: MessageCircle },
  { to: "/marketplace", icon: ShoppingBag },
  { to: "/plans", icon: CreditCard },
];

export default function MobileBottomNav() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 md:hidden" style={{
      background: 'var(--bg-1)', borderTop: '1px solid var(--b1)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
    }}>
      <div className="overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="flex items-center gap-1 px-2 py-2" style={{ width: "max-content" }}>
          {items.map(item => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className="flex items-center justify-center shrink-0"
                style={{
                  width: 44, height: 44, borderRadius: 'var(--r3)',
                  background: active ? 'rgba(245,158,11,0.12)' : 'transparent',
                  color: active ? 'var(--orange-l)' : 'var(--text-tertiary)',
                  transition: 'all .12s',
                }}
              >
                <Icon size={18} />
              </NavLink>
            );
          })}
          <NavLink
            to={`/profile/${user.id}`}
            className="flex items-center justify-center shrink-0"
            style={{
              width: 44, height: 44, borderRadius: 'var(--r3)',
              background: isActive(`/profile/${user.id}`) ? 'rgba(245,158,11,0.12)' : 'transparent',
              color: isActive(`/profile/${user.id}`) ? 'var(--orange-l)' : 'var(--text-tertiary)',
              transition: 'all .12s',
            }}
          >
            <User size={18} />
          </NavLink>
        </div>
      </div>
    </nav>
  );
}