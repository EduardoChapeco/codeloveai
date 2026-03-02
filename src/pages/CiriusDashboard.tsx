import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Plus, Rocket, Globe, Github, Clock, AlertCircle, CheckCircle2,
  Loader2, ArrowRight, Wrench, Layers
} from "lucide-react";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  generating_prd: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  generating_code: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  deploying: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
  live: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  failed: "bg-destructive/10 text-destructive border border-destructive/20",
  paused: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
};

const statusLabels: Record<string, string> = {
  draft: "Rascunho", generating_prd: "Gerando PRD", generating_code: "Gerando Código",
  deploying: "Fazendo Deploy", live: "Online", failed: "Falhou", paused: "Pausado",
};

const statusIcons: Record<string, any> = {
  draft: Layers,
  generating_prd: Loader2,
  generating_code: Loader2,
  deploying: Rocket,
  live: CheckCircle2,
  failed: AlertCircle,
  paused: Clock,
};

export default function CiriusDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadProjects();
  }, [user]);

  async function loadProjects() {
    setLoadingProjects(true);
    const { data } = await supabase.functions.invoke("cirius-status", {
      body: { action: "list" },
    });
    setProjects(data?.projects || []);
    setLoadingProjects(false);
  }

  if (loading) return <AppLayout><div className="min-h-screen bg-background" /></AppLayout>;
  if (!user) { navigate("/login"); return null; }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center shadow-lg shadow-primary/20">
              <Rocket className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Cirius</h1>
              <p className="text-xs text-muted-foreground">AI App & Site Builder</p>
            </div>
          </div>
          <Button onClick={() => navigate("/cirius/new")} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Projeto
          </Button>
        </div>

        {loadingProjects ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="rounded-xl border border-border/50 bg-card animate-pulse h-44" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-card/50">
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
                <Rocket className="h-7 w-7 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">Nenhum projeto ainda</p>
                <p className="text-sm text-muted-foreground mt-1">Crie seu primeiro app com IA em segundos</p>
              </div>
              <Button onClick={() => navigate("/cirius/new")} className="gap-2">
                <Plus className="h-4 w-4" /> Criar primeiro projeto
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((p: any) => {
              const StatusIcon = statusIcons[p.status] || Layers;
              const isActive = ["generating_prd", "generating_code", "deploying"].includes(p.status);

              return (
                <div
                  key={p.id}
                  className="rounded-xl border border-border/50 bg-card hover:border-primary/30 transition-all cursor-pointer group overflow-hidden"
                  onClick={() => navigate(`/cirius/project/${p.id}`)}
                >
                  {/* Progress bar at top */}
                  {p.progress_pct > 0 && p.status !== "live" && (
                    <div className="h-0.5 bg-muted">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-purple-500 transition-all duration-1000"
                        style={{ width: `${p.progress_pct}%` }}
                      />
                    </div>
                  )}

                  <div className="p-5 space-y-4">
                    {/* Title + Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                          {p.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(p.created_at).toLocaleDateString("pt-BR")}
                        </div>
                      </div>
                      <Badge className={`${statusColors[p.status] || ""} shrink-0 gap-1`}>
                        <StatusIcon className={`h-3 w-3 ${isActive ? "animate-spin" : ""}`} />
                        {statusLabels[p.status] || p.status}
                      </Badge>
                    </div>

                    {/* Info badges */}
                    <div className="flex flex-wrap gap-1.5">
                      {p.generation_engine && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <Wrench className="h-2.5 w-2.5" /> {p.generation_engine}
                        </Badge>
                      )}
                      {p.template_type && (
                        <Badge variant="secondary" className="text-[10px]">{p.template_type}</Badge>
                      )}
                      {p.github_url && (
                        <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
                          <Github className="h-2.5 w-2.5" /> GitHub
                        </Badge>
                      )}
                      {(p.vercel_url || p.netlify_url) && (
                        <Badge variant="outline" className="text-[10px] gap-1 text-emerald-400">
                          <Globe className="h-2.5 w-2.5" /> Live
                        </Badge>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-1">
                      {p.status === "failed" && (
                        <span className="text-[11px] text-destructive">Falha na geração</span>
                      )}
                      {p.progress_pct > 0 && p.status !== "live" && p.status !== "failed" && (
                        <span className="text-[11px] text-muted-foreground font-mono">{p.progress_pct}%</span>
                      )}
                      {p.status === "live" && (
                        <span className="text-[11px] text-emerald-400">Projeto pronto</span>
                      )}
                      {!p.progress_pct && p.status === "draft" && (
                        <span className="text-[11px] text-muted-foreground">Rascunho</span>
                      )}
                      <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors ml-auto" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
