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
      <MeshBackground />

      <div className="h-screen w-full flex overflow-hidden relative">
        <div className="hidden md:block">
          <AppSidebar />
        </div>

        <main className="flex-1 min-w-0 overflow-y-auto no-scrollbar pb-24 md:pb-0">
          {children}
        </main>
      </div>

      <MobileBottomNav />
    </SidebarProvider>
  );
}
