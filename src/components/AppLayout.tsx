import StarbleLayout from "@/components/redesign/StarbleLayout";
import MobileBottomNav from "@/components/MobileBottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <StarbleLayout>
      {children}
      <MobileBottomNav />
    </StarbleLayout>
  );
}
