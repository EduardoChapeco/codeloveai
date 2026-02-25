import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "@/components/AppSidebar";
import MeshBackground from "@/components/MeshBackground";
import MobileBottomNav from "@/components/MobileBottomNav";
import { useAuth } from "@/hooks/useAuth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      {/* Animated mesh gradient — Layer 0 */}
      <MeshBackground />

      {/* Full-screen surface — Apple iCloud style */}
      <div className="h-screen w-full flex overflow-hidden relative">
        {/* Sidebar — glass panel, hidden on mobile */}
        <div className="hidden md:block">
          <AppSidebar />
        </div>

        {/* Content — add bottom padding on mobile for nav bar */}
        <main className="flex-1 min-w-0 overflow-y-auto no-scrollbar pb-16 md:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <MobileBottomNav />
    </SidebarProvider>
  );
}
