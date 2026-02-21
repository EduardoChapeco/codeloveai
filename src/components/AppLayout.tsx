import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      {/* Layer 0 — Soft mesh gradient background */}
      <div
        className="h-screen w-full p-2 overflow-hidden"
        style={{
          background: `
            radial-gradient(ellipse at 10% 20%, hsl(252 85% 92% / 0.5) 0%, transparent 50%),
            radial-gradient(ellipse at 90% 10%, hsl(280 70% 90% / 0.4) 0%, transparent 45%),
            radial-gradient(ellipse at 50% 90%, hsl(220 80% 92% / 0.35) 0%, transparent 50%),
            hsl(0 0% 97%)
          `,
        }}
      >
        {/* Layer 1 — Unified glass surface */}
        <div className="h-full w-full bg-white/90 backdrop-blur-xl rounded-2xl overflow-hidden flex border border-white/60">
          {/* Sidebar */}
          <AppSidebar />

          {/* Layer 2 — Content viewing area (recessed) */}
          <div className="flex-1 flex flex-col min-w-0 p-1.5 pl-0">
            <main className="flex-1 rounded-xl overflow-hidden bg-[hsl(0_0%_97.5%)] border border-[hsl(0_0%_0%/0.04)]">
              <div className="h-full overflow-y-auto no-scrollbar">
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
