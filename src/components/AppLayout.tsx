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
      <div
        className="h-screen w-full p-3 flex gap-3 overflow-hidden"
        style={{
          background: `
            radial-gradient(ellipse at 10% 20%, hsl(var(--mesh-color-1)) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 10%, hsl(var(--mesh-color-2)) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 80%, hsl(var(--mesh-color-3)) 0%, transparent 50%),
            hsl(var(--background))
          `,
        }}
      >
        {/* Layer 1 — Sidebar */}
        <AppSidebar />

        {/* Layer 2 — Content Card */}
        <main
          className="flex-1 flex flex-col min-w-0 bg-card rounded-2xl overflow-hidden"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.06)' }}
        >
          <header className="h-12 flex items-center px-4 border-b border-border/30">
            <SidebarTrigger />
          </header>
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
