import StarbleLayout from "@/components/redesign/StarbleLayout";
import MobileBottomNav from "@/components/MobileBottomNav";
import { useAccessTracker } from "@/hooks/useAccessTracker";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { tenant } = useTenant();
  useAccessTracker(user?.id, user?.email || undefined, tenant?.id);

  return (
    <StarbleLayout>
      {children}
      <MobileBottomNav />
    </StarbleLayout>
  );
}
