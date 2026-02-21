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
        className="h-screen w-full p-4 flex gap-3 overflow-hidden"
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
          className="flex-1 flex flex-col min-w-0 bg-card rounded-3xl overflow-hidden"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.05)' }}
        >
          <header className="h-11 flex items-center px-4">
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
