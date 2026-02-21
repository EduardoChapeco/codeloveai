import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "@/components/AppSidebar";
import MeshBackground from "@/components/MeshBackground";
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
        {/* Sidebar — glass panel */}
        <AppSidebar />

        {/* Content — clean, no extra wrapper card */}
        <main className="flex-1 min-w-0 overflow-y-auto no-scrollbar">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
