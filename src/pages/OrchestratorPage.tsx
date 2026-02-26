import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSEO } from "@/hooks/useSEO";
import AppLayout from "@/components/AppLayout";
import OrchestratorDashboard from "@/components/orchestrator/OrchestratorDashboard";
import { Loader2, Zap } from "lucide-react";

export default function OrchestratorPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  useSEO({ title: "Orquestrador" });

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  if (authLoading || !user) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-3rem)]">
        {/* Header */}
        <div className="border-b border-border/40 px-4 sm:px-6 py-3 flex items-center gap-3 shrink-0">
          <div className="h-9 w-9 rounded-2xl bg-amber-500/10 flex items-center justify-center">
            <Zap className="h-5 w-5 text-amber-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">Orquestrador</p>
            <p className="text-[11px] text-muted-foreground">Automação de tarefas via Star AI</p>
          </div>
        </div>

        {/* Dashboard */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          <OrchestratorDashboard />
        </div>
      </div>
    </AppLayout>
  );
}
