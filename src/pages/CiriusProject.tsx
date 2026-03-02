import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ArrowLeft, Play, Pause, X, Github, Globe, Database, RefreshCw, FileCode, Rocket } from "lucide-react";

const statusLabels: Record<string, string> = {
  draft: "Rascunho", generating_prd: "Gerando PRD", generating_code: "Gerando Código",
  deploying: "Deploy", live: "Online", failed: "Falhou", paused: "Pausado",
};

const levelIcons: Record<string, string> = {
  info: "ℹ️", success: "✅", warning: "⚠️", error: "❌",
};

export default function CiriusProject() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const loadProject = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.functions.invoke("cirius-status", {
      body: { action: "get", project_id: id },
    });
    if (data?.project) {
      setProject(data.project);
      setLogs(data.logs || []);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { loadProject(); }, [loadProject]);

  // Realtime subscription
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`cirius:project:${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "cirius_generation_log", filter: `project_id=eq.${id}` },
        (payload) => { setLogs(prev => [payload.new, ...prev].slice(0, 30)); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "cirius_projects", filter: `id=eq.${id}` },
        (payload) => { setProject(payload.new); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  async function doAction(action: string) {
    setActing(true);
    try {
      const { data } = await supabase.functions.invoke("cirius-generate", {
        body: { action, project_id: id },
      });
      if (data?.error) toast.error(data.error);
      else toast.success(`${action} executado`);
      await loadProject();
    } catch { toast.error("Erro"); }
    setActing(false);
  }

  async function doDeploy(target: string) {
    setActing(true);
    try {
      const { data } = await supabase.functions.invoke("cirius-deploy", {
        body: { action: target, project_id: id },
      });
      if (data?.error) toast.error(data.error);
      else toast.success(`Deploy ${target} iniciado`);
      await loadProject();
    } catch { toast.error("Erro no deploy"); }
    setActing(false);
  }

  if (!user) { navigate("/login"); return null; }
  if (loading) return <AppLayout><div className="min-h-screen bg-background" /></AppLayout>;
  if (!project) return <AppLayout><div className="p-6 text-muted-foreground">Projeto não encontrado</div></AppLayout>;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/cirius")}><ArrowLeft className="h-4 w-4" /></Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{statusLabels[project.status] || project.status}</Badge>
              {project.generation_engine && <Badge variant="secondary">{project.generation_engine}</Badge>}
              {project.template_type && <Badge variant="secondary">{project.template_type}</Badge>}
            </div>
          </div>
        </div>

        {/* Progress */}
        {project.progress_pct > 0 && project.status !== "live" && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-medium">{project.progress_pct}%</span>
            </div>
            <Progress value={project.progress_pct} />
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {project.status === "draft" && project.prd_json && (
            <Button onClick={() => doAction("generate_code")} disabled={acting} className="gap-2">
              <Play className="h-4 w-4" /> Gerar Código
            </Button>
          )}
          {project.status === "draft" && !project.prd_json && (
            <Button onClick={() => doAction("generate_prd")} disabled={acting} className="gap-2">
              <Sparkles className="h-4 w-4" /> Gerar PRD
            </Button>
          )}
          {["generating_code", "generating_prd"].includes(project.status) && (
            <Button variant="outline" onClick={() => doAction("pause")} disabled={acting} className="gap-2">
              <Pause className="h-4 w-4" /> Pausar
            </Button>
          )}
          {project.status === "paused" && (
            <Button onClick={() => doAction("resume")} disabled={acting} className="gap-2">
              <Play className="h-4 w-4" /> Retomar
            </Button>
          )}
          {project.status === "failed" && (
            <Button onClick={() => doAction("generate_code")} disabled={acting} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" /> Tentar Novamente
            </Button>
          )}
          {!["draft", "live"].includes(project.status) && (
            <Button variant="destructive" onClick={() => doAction("cancel")} disabled={acting} size="sm" className="gap-2">
              <X className="h-4 w-4" /> Cancelar
            </Button>
          )}
        </div>

        {/* Deploy Panel */}
        {(project.status === "live" || project.source_files_json) && (
          <Card>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Rocket className="h-5 w-5" /> Deploy</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Button variant="outline" onClick={() => doDeploy("github")} disabled={acting} className="gap-2 justify-start">
                  <Github className="h-4 w-4" />
                  {project.github_url ? `✅ ${project.github_repo}` : "Push to GitHub"}
                </Button>
                <Button variant="outline" onClick={() => doDeploy("vercel")} disabled={acting || !project.github_repo} className="gap-2 justify-start">
                  <Globe className="h-4 w-4" />
                  {project.vercel_url ? `✅ Online` : "Deploy Vercel"}
                </Button>
                <Button variant="outline" onClick={() => doDeploy("netlify")} disabled={acting} className="gap-2 justify-start">
                  <Globe className="h-4 w-4" />
                  {project.netlify_url ? `✅ Online` : "Deploy Netlify"}
                </Button>
                <Button variant="outline" onClick={() => doDeploy("supabase")} disabled={acting} className="gap-2 justify-start">
                  <Database className="h-4 w-4" />
                  {project.supabase_url ? `✅ Connected` : "Apply Migrations"}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {project.github_url && <a href={project.github_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">{project.github_url}</a>}
                {project.vercel_url && <a href={project.vercel_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">{project.vercel_url}</a>}
                {project.netlify_url && <a href={project.netlify_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">{project.netlify_url}</a>}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {project.error_message && (
          <Card className="border-destructive">
            <CardContent className="py-3 text-sm text-destructive">{project.error_message}</CardContent>
          </Card>
        )}

        {/* Logs */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2"><FileCode className="h-5 w-5" /> Logs</CardTitle>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum log ainda</p>
            ) : (
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {logs.map((l: any, i: number) => (
                  <div key={l.id || i} className="flex items-start gap-2 text-sm py-1 border-b border-border/50 last:border-0">
                    <span>{levelIcons[l.level] || "📝"}</span>
                    <span className="text-muted-foreground text-xs min-w-[60px]">
                      {new Date(l.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="flex-1">{l.message}</span>
                    {l.duration_ms && <span className="text-xs text-muted-foreground">{l.duration_ms}ms</span>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function Sparkles(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>;
}
