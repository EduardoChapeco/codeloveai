import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  ArrowLeft, Play, Pause, X, Github, Globe, Database,
  RefreshCw, Rocket, CheckCircle2, Clock, Loader2,
  Circle, ChevronDown, ChevronRight, FileCode, Wrench, Shield,
  Eye, EyeOff, Search, ExternalLink,
} from "lucide-react";

const statusLabels: Record<string, string> = {
  draft: "Rascunho", generating_prd: "Gerando PRD", generating_code: "Gerando Código",
  deploying: "Deploy", live: "Online", failed: "Falhou", paused: "Pausado",
};

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  generating_prd: "bg-[hsl(var(--orange-d))] text-amber-400 border border-amber-500/20",
  generating_code: "bg-[hsl(var(--blue-d))] text-blue-400 border border-blue-500/20",
  deploying: "bg-[hsl(var(--purple-d))] text-purple-400 border border-purple-500/20",
  live: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  failed: "bg-destructive/10 text-destructive border border-destructive/20",
  paused: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
};

interface TaskItem {
  title: string;
  prompt?: string;
  status: "done" | "running" | "pending" | "failed";
  duration_ms?: number;
  engine?: string;
}

export default function CiriusProject() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [expandedTask, setExpandedTask] = useState<number | null>(null);
  const [thinkingTime, setThinkingTime] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [verifying, setVerifying] = useState(false);

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

  // Realtime
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

  // Thinking timer
  useEffect(() => {
    if (!project) return;
    const isThinking = ["generating_prd", "generating_code", "deploying"].includes(project.status);
    if (!isThinking) { setThinkingTime(0); return; }
    const interval = setInterval(() => setThinkingTime(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [project?.status]);

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

  const verifyProject = async () => {
    if (!id) return;
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("cirius-generate", {
        body: { action: "debug_log", project_id: id },
      });
      if (error) {
        toast.error("Verificação falhou: " + error.message);
      } else {
        const summary = data?.summary || JSON.stringify(data).substring(0, 300);
        toast.success("Diagnóstico concluído", { description: summary, duration: 8000 });
      }
    } catch {
      toast.error("Erro na verificação");
    } finally {
      setVerifying(false);
    }
  };

  if (!user) { navigate("/login"); return null; }
  if (loading) return <AppLayout><div className="min-h-screen bg-background" /></AppLayout>;
  if (!project) return <AppLayout><div className="p-6 text-muted-foreground">Projeto não encontrado</div></AppLayout>;

  const isActive = ["generating_prd", "generating_code", "deploying"].includes(project.status);
  const prd = project.prd_json as { tasks?: TaskItem[]; design?: any } | null;
  const tasks: TaskItem[] = prd?.tasks?.map((t: any, i: number) => {
    const logForTask = logs.find(l => l.step === `code_task_${i}`);
    let status: TaskItem["status"] = "pending";
    if (logForTask?.status === "completed") status = "done";
    else if (logForTask?.status === "started") status = "running";
    else if (logForTask?.status === "failed") status = "failed";
    else if (project.status === "live" || project.progress_pct >= 80) status = "done";
    return { ...t, status, duration_ms: logForTask?.duration_ms, engine: logForTask?.message };
  }) || [];

  // Calculate done/total
  const doneCount = tasks.filter(t => t.status === "done").length;
  const runningCount = tasks.filter(t => t.status === "running").length;
  const toolsUsed = logs.length;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/cirius")} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-foreground truncate">{project.name}</h1>
             <div className="flex items-center gap-2 mt-1">
              <Badge className={statusColors[project.status] || "bg-muted"}>
                {statusLabels[project.status] || project.status}
              </Badge>
              {project.generation_engine && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Wrench className="h-3 w-3" /> {project.generation_engine}
                </Badge>
              )}
              {(project.vercel_url || project.netlify_url || project.github_url) ? (
                <Badge variant="outline" className="text-[10px] gap-1 border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                  <CheckCircle2 className="h-3 w-3" /> Deployed
                </Badge>
              ) : project.source_files_json ? (
                <Badge variant="outline" className="text-[10px] gap-1 border-blue-500/30 text-blue-400 bg-blue-500/10">
                  <CheckCircle2 className="h-3 w-3" /> Código gerado
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] gap-1 border-muted-foreground/30 text-muted-foreground">
                  Aguardando geração
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {(project.vercel_url || project.netlify_url || (project.preview_url && !String(project.preview_url).includes("lovable.app"))) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(p => !p)}
                className={`gap-1.5 text-xs ${showPreview ? "ring-2 ring-primary" : ""}`}
              >
                {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                Preview
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={verifyProject}
              disabled={verifying}
              className="gap-1.5 text-xs"
            >
              {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              Verificar
            </Button>
          </div>
        </div>

        {/* Live Preview — only show for actual deployed URLs, never the Brain project */}
        {showPreview && (() => {
          const deployedUrl = project.vercel_url || project.netlify_url || project.custom_domain;
          const previewUrl = deployedUrl
            ? (deployedUrl.startsWith("http") ? deployedUrl : `https://${deployedUrl}`)
            : (project.preview_url && !String(project.preview_url).includes("lovable.app") ? project.preview_url : null);
          return previewUrl ? (
            <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border/30">
                <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Preview
                </span>
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Abrir <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <iframe
                src={previewUrl}
                className="w-full h-[420px] border-0"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                title="Live Preview"
              />
            </div>
          ) : (
            <div className="rounded-xl border border-border/50 bg-card p-6 text-center text-sm text-muted-foreground">
              Preview disponível após deploy (GitHub → Vercel/Netlify)
            </div>
          );
        })()}
        {/* Thinking indicator */}
        {isActive && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/50 border border-border/50">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <span className="text-sm text-muted-foreground">
              {project.status === "generating_prd" ? "Pensando" : "Processando"}
              {thinkingTime > 0 && <span className="ml-1 text-xs opacity-60">({thinkingTime}s)</span>}
            </span>
          </div>
        )}

        {/* Progress Card */}
        {project.progress_pct > 0 && project.status !== "live" && (
          <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{project.status === "generating_prd" ? "Gerando PRD" : "Build em progresso"}</span>
                {toolsUsed > 0 && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {toolsUsed} tools used
                  </span>
                )}
              </div>
              <span className="text-sm font-mono font-bold text-primary">{project.progress_pct}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-purple-500 transition-all duration-1000"
                style={{ width: `${project.progress_pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Tasks Card (Lovable-style) */}
        {tasks.length > 0 && (
          <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
            {/* Tasks Header */}
            <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
              <span className="text-sm font-semibold">Tarefas ({doneCount}/{tasks.length})</span>
              <div className="flex gap-1.5">
                {doneCount > 0 && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    {doneCount} done
                  </span>
                )}
                {runningCount > 0 && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                    {runningCount} running
                  </span>
                )}
              </div>
            </div>

            {/* Tasks List */}
            <div className="divide-y divide-border/20">
              {tasks.map((task, i) => (
                <div key={i} className="group">
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedTask(expandedTask === i ? null : i)}
                  >
                    {/* Status Icon */}
                    {task.status === "done" && <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400 shrink-0" />}
                    {task.status === "running" && (
                      <div className="relative shrink-0">
                        <Loader2 className="h-4.5 w-4.5 text-blue-400 animate-spin" />
                      </div>
                    )}
                    {task.status === "pending" && <Circle className="h-4.5 w-4.5 text-muted-foreground/40 shrink-0" />}
                    {task.status === "failed" && <X className="h-4.5 w-4.5 text-destructive shrink-0" />}

                    {/* Title */}
                    <span className={`flex-1 text-sm ${task.status === "pending" ? "text-muted-foreground/60" : "text-foreground"}`}>
                      {task.title}
                    </span>

                    {/* Duration */}
                    {task.duration_ms && (
                      <span className="text-[11px] text-muted-foreground font-mono">{(task.duration_ms / 1000).toFixed(1)}s</span>
                    )}

                    {/* Expand */}
                    {expandedTask === i ? (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </button>

                  {/* Expanded Detail */}
                  {expandedTask === i && task.prompt && (
                    <div className="px-4 pb-3 pl-11">
                      <div className="rounded-lg bg-muted/40 border border-border/30 p-3 text-xs text-muted-foreground font-mono leading-relaxed max-h-40 overflow-y-auto">
                        {task.prompt.slice(0, 500)}{task.prompt.length > 500 ? "..." : ""}
                      </div>
                      {task.engine && (
                        <p className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1">
                          <Wrench className="h-3 w-3" /> {task.engine}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Action Bar */}
            <div className="px-4 py-3 border-t border-border/30 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs gap-1.5"
                onClick={() => navigate(`/cirius/editor/${id}`)}
              >
                <FileCode className="h-3.5 w-3.5" /> Abrir Editor
              </Button>
              {(project.vercel_url || project.netlify_url) ? (
                <Button
                  size="sm"
                  className="flex-1 text-xs gap-1.5"
                  variant={showPreview ? "secondary" : "default"}
                  onClick={() => setShowPreview(p => !p)}
                >
                  {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {showPreview ? "Fechar Preview" : "Preview"}
                </Button>
              ) : (
                <Button size="sm" className="flex-1 text-xs" disabled>
                  Preview
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Design Summary (from PRD) */}
        {prd?.design && (
          <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
            <span className="text-sm font-semibold">Design</span>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {prd.design.primary_color && (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md border border-border/50" style={{ background: prd.design.primary_color }} />
                  <span className="text-muted-foreground">{prd.design.primary_color}</span>
                </div>
              )}
              {prd.design.font && (
                <div className="text-muted-foreground">Fonte: <span className="text-foreground">{prd.design.font}</span></div>
              )}
              {prd.design.style && (
                <div className="text-muted-foreground">Estilo: <span className="text-foreground">{prd.design.style}</span></div>
              )}
            </div>
            {prd.design.pages && (
              <div className="flex flex-wrap gap-1.5">
                {(prd.design.pages as string[]).map((p: string) => (
                  <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
                ))}
              </div>
            )}
            {prd.design.tables && (
              <div className="flex flex-wrap gap-1.5">
                {(prd.design.tables as string[]).map((t: string) => (
                  <Badge key={t} variant="secondary" className="text-[10px] gap-1">
                    <Database className="h-2.5 w-2.5" /> {t}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {project.status === "draft" && (project.prd_json || project.has_prd) && (
            <Button onClick={() => doAction("generate_code")} disabled={acting} className="gap-2">
              <Play className="h-4 w-4" /> Gerar Código
            </Button>
          )}
          {project.status === "draft" && !project.prd_json && !project.has_prd && (
            <Button onClick={() => doAction("generate_prd")} disabled={acting} className="gap-2">
              <SparklesIcon className="h-4 w-4" /> Gerar PRD
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
          <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2">
              <Rocket className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Deploy</span>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => doDeploy("github")} disabled={acting} className="gap-2 justify-start h-auto py-3">
                <Github className="h-4 w-4 shrink-0" />
                <div className="text-left">
                  <p className="text-xs font-medium">{project.github_url ? "Conectado" : "GitHub"}</p>
                  {project.github_repo && <p className="text-[10px] text-muted-foreground truncate">{project.github_repo}</p>}
                </div>
                {project.github_url && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 ml-auto" />}
              </Button>
              <Button variant="outline" onClick={() => doDeploy("vercel")} disabled={acting || !project.github_repo} className="gap-2 justify-start h-auto py-3">
                <Globe className="h-4 w-4 shrink-0" />
                <div className="text-left">
                  <p className="text-xs font-medium">{project.vercel_url ? "Online" : "Vercel"}</p>
                </div>
                {project.vercel_url && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 ml-auto" />}
              </Button>
              <Button variant="outline" onClick={() => doDeploy("netlify")} disabled={acting} className="gap-2 justify-start h-auto py-3">
                <Globe className="h-4 w-4 shrink-0" />
                <div className="text-left">
                  <p className="text-xs font-medium">{project.netlify_url ? "Online" : "Netlify"}</p>
                </div>
                {project.netlify_url && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 ml-auto" />}
              </Button>
              <Button variant="outline" onClick={() => doDeploy("supabase")} disabled={acting} className="gap-2 justify-start h-auto py-3">
                <Database className="h-4 w-4 shrink-0" />
                <div className="text-left">
                  <p className="text-xs font-medium">{project.supabase_url ? "Connected" : "Migrations"}</p>
                </div>
                {project.supabase_url && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 ml-auto" />}
              </Button>
            </div>
            {(project.github_url || project.vercel_url || project.netlify_url) && (
              <div className="px-4 pb-3 flex flex-wrap gap-2 text-xs">
                {project.github_url && <a href={project.github_url} target="_blank" rel="noopener noreferrer" className="text-primary underline truncate max-w-[200px]">{project.github_url}</a>}
                {project.vercel_url && <a href={project.vercel_url} target="_blank" rel="noopener noreferrer" className="text-primary underline truncate max-w-[200px]">{project.vercel_url}</a>}
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {project.error_message && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {project.error_message}
          </div>
        )}

        {/* Logs Timeline */}
        {logs.length > 0 && (
          <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2">
              <FileCode className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Timeline</span>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-auto">{logs.length}</span>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {logs.map((l: any, i: number) => (
                <div key={l.id || i} className="flex items-start gap-3 px-4 py-2.5 border-b border-border/10 last:border-0 text-xs">
                  <div className="mt-0.5">
                    {l.level === "error" && <X className="h-3.5 w-3.5 text-destructive" />}
                    {l.level === "warning" && <Clock className="h-3.5 w-3.5 text-amber-400" />}
                    {l.level === "info" && l.status === "completed" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                    {l.level === "info" && l.status !== "completed" && <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />}
                  </div>
                  <span className="text-muted-foreground font-mono min-w-[48px]">
                    {new Date(l.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="flex-1 text-foreground/80">{l.message}</span>
                  {l.duration_ms && <span className="text-muted-foreground font-mono">{l.duration_ms}ms</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function SparklesIcon(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>;
}
