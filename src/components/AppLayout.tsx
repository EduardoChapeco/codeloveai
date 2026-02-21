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
        className="h-screen w-full p-3 flex gap-0 overflow-hidden"
        style={{
          background: `
            radial-gradient(ellipse at 10% 20%, hsl(var(--mesh-color-1) / 0.5) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 10%, hsl(var(--mesh-color-2) / 0.5) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 80%, hsl(var(--mesh-color-3) / 0.5) 0%, transparent 50%),
            hsl(var(--background))
          `,
        }}
      >
        {/* Layer 1 — Sidebar (flat, on background) */}
        <AppSidebar />

        {/* Layer 2 — Content Card (the only floating element) */}
        <main
          className="flex-1 flex flex-col min-w-0 bg-card rounded-2xl overflow-hidden ml-2"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)' }}
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
