import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
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
        className="h-screen w-full p-3 overflow-hidden"
        style={{
          background: `
            radial-gradient(ellipse at 10% 20%, hsl(var(--mesh-color-1) / 0.45) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 10%, hsl(var(--mesh-color-2) / 0.45) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 80%, hsl(var(--mesh-color-3) / 0.45) 0%, transparent 50%),
            hsl(var(--background))
          `,
        }}
      >
        {/* Layer 1 — Single white card containing sidebar + content */}
        <div
          className="h-full w-full bg-card rounded-2xl overflow-hidden flex"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.05)' }}
        >
          {/* Sidebar — part of the white card */}
          <AppSidebar />

          {/* Layer 2 — Content area (scrollable, no visible scrollbar) */}
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto no-scrollbar">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
