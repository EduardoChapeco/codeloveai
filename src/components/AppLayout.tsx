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
        className="h-screen w-full p-2.5 overflow-hidden"
        style={{
          background: `
            radial-gradient(ellipse at 10% 20%, hsl(var(--mesh-color-1) / 0.4) 0%, transparent 50%),
            radial-gradient(ellipse at 85% 15%, hsl(var(--mesh-color-2) / 0.35) 0%, transparent 45%),
            radial-gradient(ellipse at 50% 85%, hsl(var(--mesh-color-3) / 0.3) 0%, transparent 50%),
            hsl(var(--background))
          `,
        }}
      >
        {/* Layer 1 — White surface containing sidebar + content */}
        <div
          className="h-full w-full bg-card/95 backdrop-blur-sm rounded-2xl overflow-hidden flex border border-border/20"
          style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.02), 0 2px 8px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.04)' }}
        >
          {/* Sidebar — sits on white surface */}
          <AppSidebar />

          {/* Layer 2 — Content viewing card */}
          <div className="flex-1 flex flex-col min-w-0 m-1.5 ml-0">
            <main
              className="flex-1 bg-muted/20 rounded-xl overflow-hidden"
              style={{ boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}
            >
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
