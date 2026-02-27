import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "@/components/AppSidebar";
import MeshBackground from "@/components/MeshBackground";
import MobileBottomNav from "@/components/MobileBottomNav";
import { useAuth } from "@/hooks/useAuth";
import { Download } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

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

        <main className="flex-1 min-w-0 overflow-y-auto no-scrollbar pb-16 md:pb-0">
          {children}
        </main>
      </div>

      {/* Fixed "Baixar Extensão" button */}
      <button
        onClick={() => navigate("/extensoes/speed")}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 h-11 px-5 rounded-2xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-2 shadow-lg shadow-primary/25 hover:scale-105 active:scale-95 transition-transform"
      >
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">Baixar Extensão</span>
        <span className="sm:hidden">Extensão</span>
      </button>

      <MobileBottomNav />
    </SidebarProvider>
  );
}
