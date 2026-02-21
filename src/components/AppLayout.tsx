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
            radial-gradient(ellipse at 10% 20%, hsl(211 100% 92% / 0.5) 0%, transparent 50%),
            radial-gradient(ellipse at 90% 10%, hsl(230 80% 92% / 0.4) 0%, transparent 45%),
            radial-gradient(ellipse at 50% 90%, hsl(200 80% 94% / 0.35) 0%, transparent 50%),
            hsl(0 0% 97.5%)
          `,
        }}
      >
        {/* Layer 1 — Unified glass surface */}
        <div className="h-full w-full bg-white/85 backdrop-blur-2xl rounded-3xl overflow-hidden flex border border-white/50" style={{ backdropFilter: 'blur(24px) saturate(180%)' }}>
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
