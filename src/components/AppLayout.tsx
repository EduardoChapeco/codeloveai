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
      {/* Layer 0 — Mesh gradient background */}
      <div
        className="h-screen w-full p-2 overflow-hidden"
        style={{
          background: `
            radial-gradient(ellipse at 10% 20%, hsl(var(--mesh-color-1) / 0.35) 0%, transparent 50%),
            radial-gradient(ellipse at 85% 15%, hsl(var(--mesh-color-2) / 0.3) 0%, transparent 45%),
            radial-gradient(ellipse at 50% 85%, hsl(var(--mesh-color-3) / 0.25) 0%, transparent 50%),
            hsl(var(--background))
          `,
        }}
      >
        {/* Layer 1 — Unified white surface */}
        <div className="h-full w-full bg-card/98 backdrop-blur-md rounded-2xl overflow-hidden flex border border-border/15">
          {/* Sidebar */}
          <AppSidebar />

          {/* Layer 2 — Content area */}
          <div className="flex-1 flex flex-col min-w-0 p-1.5 pl-0">
            <main className="flex-1 bg-muted/15 rounded-xl overflow-hidden border border-border/10">
              <div className="h-full overflow-y-auto no-scrollbar p-0">
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
