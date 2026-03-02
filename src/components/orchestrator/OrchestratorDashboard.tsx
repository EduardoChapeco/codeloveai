import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Loader2, Play, Pause, ExternalLink, ChevronDown, ChevronRight,
  CheckCircle, XCircle, Clock, Zap, Shield, AlertTriangle, RefreshCw, Plus, ArrowRight,
  Brain as BrainIcon,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────

interface OrchestratorProject {
  id: string;
  status: string;
  client_prompt: string;
  lovable_project_id: string | null;
  current_task_index: number;
  total_tasks: number;
  quality_score: number | null;
  ghost_created: boolean;
  prd_json: {
    project_name?: string;
    summary?: string;
    tasks?: unknown[];
  } | null;
  created_at: string;
  updated_at: string;
}

interface OrchestratorTask {
  id: string;
  task_index: number;
  title: string;
  intent: string;
  status: string;
  retry_count: number;
  started_at: string | null;
  completed_at: string | null;
}

interface OrchestratorLog {
  id: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  created_at: string;
  task_id: string | null;
}

// ─── Helper ──────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending:   "text-muted-foreground",
  planning:  "text-blue-500",
  executing: "text-amber-500",
  auditing:  "text-purple-500",
  paused:    "text-slate-500",
  completed: "text-emerald-500",
  failed:    "text-red-500",
};

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  pending:   Clock,
  planning:  Loader2,
  executing: Zap,
  auditing:  Shield,
  paused:    Pause,
  completed: CheckCircle,
  failed:    XCircle,
};

const INTENT_LABELS: Record<string, string> = {
  chat:            "Chat",
  security_fix_v2: "Segurança",
  seo_fix:         "SEO",
  error_fix:       "Correção",
  tool_approve:    "Aprovação",
  setup:           "Setup",
  feature:         "Feature",
  db_migration:    "Banco de Dados",
  ux_improvement:  "UX",
};

// ─── Sub-components ──────────────────────────────────────────

function TaskCard({ task }: { task: OrchestratorTask }) {
  const [expanded, setExpanded] = useState(false);
  const statusColor =
    task.status === "completed" ? "text-emerald-500"
    : task.status === "failed"    ? "text-red-500"
    : task.status === "running"   ? "text-amber-500"
    : "text-muted-foreground";

  return (
    <div className="border border-border/50 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="lv-caption text-muted-foreground w-6 shrink-0">#{task.task_index + 1}</span>
        <span className={`lv-badge text-xs ${
          task.status === "completed" ? "lv-badge-success"
          : task.status === "failed"  ? "lv-badge-error"
          : task.status === "running" ? "lv-badge-warning"
          : "lv-badge-muted"
        }`}>
          {INTENT_LABELS[task.intent] || task.intent}
        </span>
        <span className="lv-body-strong text-sm flex-1 truncate">{task.title}</span>
        <span className={`lv-caption ${statusColor}`}>{task.status}</span>
        {expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
      </button>
      {expanded && (
        <div className="px-4 pb-3 pt-1 bg-muted/20 border-t border-border/30 space-y-1">
          {task.started_at && (
            <p className="lv-caption text-muted-foreground">
              Início: {new Date(task.started_at).toLocaleTimeString("pt-BR")}
              {task.completed_at && ` → ${new Date(task.completed_at).toLocaleTimeString("pt-BR")}`}
            </p>
          )}
          {task.retry_count > 0 && (
            <p className="lv-caption text-amber-500">Tentativas: {task.retry_count}/3</p>
          )}
        </div>
      )}
    </div>
  );
}

function LogLine({ log }: { log: OrchestratorLog }) {
  const color =
    log.level === "error" ? "text-red-400"
    : log.level === "warn"  ? "text-amber-400"
    : log.level === "debug" ? "text-muted-foreground"
    : "text-foreground";

  return (
    <p className={`text-xs font-mono ${color} leading-relaxed`}>
      <span className="text-muted-foreground select-none">
        {new Date(log.created_at).toLocaleTimeString("pt-BR")}
      </span>{" "}
      {log.message}
    </p>
  );
}

// ─── Main Component ───────────────────────────────────────────

interface UserBrain {
  id: string;
  name: string;
  brain_skills: string[];
  status: string;
}

export default function OrchestratorDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projects, setProjects] = useState<OrchestratorProject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<OrchestratorTask[]>([]);
  const [logs, setLogs] = useState<OrchestratorLog[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [launching, setLaunching] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const [brains, setBrains] = useState<UserBrain[]>([]);
  const [selectedBrainId, setSelectedBrainId] = useState<string>("");

  // Fetch user's brains
  const fetchBrains = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("user_brain_projects")
      .select("id, name, brain_skills, status")
      .eq("user_id", user.id)
      .eq("status", "active");
    setBrains((data as UserBrain[]) || []);
  }, [user]);

  // Fetch projects list
  const fetchProjects = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("orchestrator_projects")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setProjects((data as OrchestratorProject[]) || []);
    setLoadingProjects(false);
  }, [user]);

  // Fetch details for selected project
  const fetchDetails = async (id: string) => {
    setLoadingDetails(true);
    const [{ data: t }, { data: l }] = await Promise.all([
      (supabase as any).from("orchestrator_tasks").select("*").eq("project_id", id).order("task_index"),
      (supabase as any).from("orchestrator_logs").select("*").eq("project_id", id).order("created_at", { ascending: true }).limit(100),
    ]);
    setTasks((t as OrchestratorTask[]) || []);
    setLogs((l as OrchestratorLog[]) || []);
    setLoadingDetails(false);
  };

  useEffect(() => {
    fetchProjects();
    fetchBrains();
  }, [user, fetchProjects, fetchBrains]);

  useEffect(() => {
    if (selectedId) fetchDetails(selectedId);
  }, [selectedId]);

  // Realtime subscription for logs of selected project
  useEffect(() => {
    if (!selectedId) return;

    const channel = supabase
      .channel(`orchestrator-logs-${selectedId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orchestrator_logs", filter: `project_id=eq.${selectedId}` },
        (payload) => {
          setLogs(prev => [...prev, payload.new as OrchestratorLog]);
          setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orchestrator_projects", filter: `id=eq.${selectedId}` },
        (payload) => {
          setProjects(prev => prev.map(p => p.id === selectedId ? { ...p, ...payload.new } : p));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedId]);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Launch new orchestration
  const launchOrchestration = async () => {
    if (!prompt.trim()) return;
    setLaunching(true);
    try {
      const { data, error } = await supabase.functions.invoke("agentic-orchestrator", {
        body: { action: "start", client_prompt: prompt.trim(), brain_id: selectedBrainId || undefined },
      });
      if (error || !data?.project_id) throw new Error(error?.message || "No project ID returned");
      toast.success("Orchestração iniciada!");
      setPrompt("");
      await fetchProjects();
      setSelectedId(data.project_id as string);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLaunching(false);
    }
  };

  // Execute next task for selected project
  const executeNext = async () => {
    if (!selectedId) return;
    const { error } = await supabase.functions.invoke("agentic-orchestrator", {
      body: { action: "execute_next", project_id: selectedId },
    });
    if (error) toast.error(error.message);
    else { toast.success("Executando próxima task..."); fetchDetails(selectedId); fetchProjects(); }
  };

  // Pause/resume selected project
  const togglePauseResume = async () => {
    if (!selectedId) return;
    const proj = projects.find(p => p.id === selectedId);
    if (!proj) return;
    const action = proj.status === "executing" ? "pause" : "resume";
    const { error } = await supabase.functions.invoke("agentic-orchestrator", {
      body: { action, project_id: selectedId },
    });
    if (error) toast.error(error.message);
    else { fetchProjects(); }
  };

  const selected = projects.find(p => p.id === selectedId);
  const progress = selected && selected.total_tasks > 0
    ? Math.round(((selected.current_task_index) / selected.total_tasks) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Prompt input */}
      <div className="lv-card space-y-3">
        <div className="flex items-center justify-between">
          <p className="lv-body-strong">Nova Orchestração</p>
          {brains.length > 0 && (
            <div className="flex items-center gap-2">
              <BrainIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={selectedBrainId}
                onChange={e => setSelectedBrainId(e.target.value)}
                className="h-7 px-2 text-[11px] rounded-lg bg-muted/30 border border-border/50 focus:outline-none text-muted-foreground"
              >
                <option value="">Sem Brain (IA direta)</option>
                {brains.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name || "Brain"} ({(b.brain_skills || []).join(", ") || "geral"})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <textarea
            className="lv-input flex-1 resize-none"
            rows={2}
            placeholder="Descreva o projeto que deseja criar com Lovable AI..."
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && e.metaKey) launchOrchestration(); }}
          />
          <button
            onClick={launchOrchestration}
            disabled={launching || !prompt.trim()}
            className="lv-btn-primary h-auto px-5 flex flex-col items-center justify-center gap-1 shrink-0"
          >
            {launching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="text-xs">Iniciar</span>
          </button>
        </div>
        <p className="lv-caption text-muted-foreground">
          {selectedBrainId ? "Brain selecionado influencia PRD e routing de tarefas" : "Cmd+Enter para iniciar"}
        </p>
      </div>

      {loadingProjects ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : projects.length === 0 ? (
        <div className="lv-card text-center py-10">
          <p className="lv-body text-muted-foreground">Nenhuma orchestração iniciada ainda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Project list */}
          <div className="space-y-2">
            <p className="lv-caption text-muted-foreground mb-2">Projetos ({projects.length})</p>
            {projects.map(p => {
              const Icon = STATUS_ICONS[p.status] || Clock;
              const isSelected = p.id === selectedId;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  onDoubleClick={() => navigate(`/orquestrador/${p.id}`)}
                  title="Clique para selecionar · Duplo clique para abrir painel completo"
                  className={`w-full text-left lv-card p-3 transition-colors ${isSelected ? "ring-2 ring-primary" : "hover:bg-muted/30"}`}
                >
                  <div className="flex items-start gap-2">
                    <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${STATUS_COLORS[p.status] || ""} ${p.status === "executing" || p.status === "planning" ? "animate-spin" : ""}`} />
                    <div className="min-w-0 flex-1">
                      <p className="lv-body-strong text-xs truncate">
                        {p.prd_json?.project_name || "Novo Projeto"}
                      </p>
                      <p className="lv-caption truncate text-muted-foreground">{p.client_prompt.substring(0, 50)}...</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`lv-caption ${STATUS_COLORS[p.status]}`}>{p.status}</span>
                        {p.total_tasks > 0 && (
                          <span className="lv-caption text-muted-foreground">{p.current_task_index}/{p.total_tasks}</span>
                        )}
                        {p.quality_score !== null && (
                          <span className={`lv-caption ${p.quality_score >= 80 ? "text-emerald-500" : "text-amber-500"}`}>
                            Q:{p.quality_score}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detail pane */}
          {selected && (
            <div className="lg:col-span-2 space-y-4">
              {/* Header */}
              <div className="lv-card">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="lv-body-strong truncate">{selected.prd_json?.project_name || "Projeto"}</p>
                    <p className="lv-caption text-muted-foreground truncate">{selected.prd_json?.summary || selected.client_prompt.substring(0, 100)}</p>
                  </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => navigate(`/orquestrador/${selected.id}`)}
                      className="lv-btn-primary h-8 px-3 text-xs flex items-center gap-1"
                    >
                      <ArrowRight className="h-3.5 w-3.5" /> Abrir Painel
                    </button>
                    {selected.lovable_project_id && (
                      <a
                        href={`https://lovable.dev/projects/${selected.lovable_project_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="lv-btn-secondary h-8 px-3 text-xs flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" /> Ver projeto
                      </a>
                    )}
                    <button
                      onClick={togglePauseResume}
                      className="lv-btn-secondary h-8 px-3 text-xs flex items-center gap-1"
                    >
                      {selected.status === "executing" ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                      {selected.status === "executing" ? "Pausar" : "Retomar"}
                    </button>
                    {selected.status === "paused" && (
                      <button
                        onClick={executeNext}
                        className="lv-btn-primary h-8 px-3 text-xs flex items-center gap-1"
                      >
                        <Zap className="h-3 w-3" /> Executar
                      </button>
                    )}
                    <button onClick={() => fetchDetails(selected.id)} className="lv-btn-icon h-8 w-8">
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                {selected.total_tasks > 0 && (
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between">
                      <span className="lv-caption text-muted-foreground">Progresso</span>
                      <span className="lv-caption">{selected.current_task_index}/{selected.total_tasks} tasks · {progress}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {selected.quality_score !== null && (
                  <div className="mt-2 flex items-center gap-2">
                    {selected.quality_score >= 80
                      ? <CheckCircle className="h-4 w-4 text-emerald-500" />
                      : <AlertTriangle className="h-4 w-4 text-amber-500" />}
                    <span className="lv-caption">Quality Score: <strong>{selected.quality_score}/100</strong></span>
                  </div>
                )}
              </div>

              {/* Tasks */}
              {loadingDetails ? (
                <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              ) : tasks.length > 0 && (
                <div className="space-y-2">
                  <p className="lv-caption text-muted-foreground">Tasks ({tasks.length})</p>
                  {tasks.map(t => <TaskCard key={t.id} task={t} />)}
                </div>
              )}

              {/* Live log */}
              <div className="lv-card">
                <p className="lv-caption text-muted-foreground mb-3">Log em tempo real</p>
                <div className="bg-muted/40 rounded-lg p-3 h-48 overflow-y-auto space-y-1">
                  {logs.length === 0 ? (
                    <p className="text-xs text-muted-foreground font-mono">Aguardando logs...</p>
                  ) : (
                    logs.map(l => <LogLine key={l.id} log={l} />)
                  )}
                  <div ref={logEndRef} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
