import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLovableProxy } from "@/hooks/useLovableProxy";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import StarCrawlModal from "@/components/orchestrator/StarCrawlModal";
import {
  Send, Loader2, ExternalLink, RefreshCw, BrainCircuit, ArrowLeft,
  Globe, Shield, Bug, Zap, CheckCircle, XCircle, Clock, ChevronDown,
  ChevronUp, Play, Pause, AlertTriangle, Terminal, Eye, Layers,
  SkipForward, Upload, Sparkles,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "ai" | "system";
  content: string;
  timestamp: string;
  status?: "sending" | "sent" | "error";
}

interface OrchestratorProject {
  id: string;
  status: string;
  client_prompt: string;
  lovable_project_id: string | null;
  current_task_index: number;
  total_tasks: number;
  quality_score: number | null;
  prd_json: {
    project_name?: string;
    summary?: string;
  } | null;
  created_at: string;
}

interface OrchestratorTask {
  id: string;
  task_index: number;
  title: string;
  intent: string;
  prompt_text: string;
  status: string;
  retry_count: number;
  started_at: string | null;
  completed_at: string | null;
  stop_condition: string | null;
  required_audit_before: boolean;
}

interface OrchestratorLog {
  id: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  created_at: string;
  task_id: string | null;
}

// ─── Constants ──────────────────────────────────────────────────

const INTENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  chat:            Send,
  security_fix_v2: Shield,
  seo_fix:         Globe,
  error_fix:       Bug,
  setup:           Sparkles,
  feature:         Zap,
  db_migration:    Layers,
  ux_improvement:  Eye,
  audit:           Shield,
  ghost_create:    Sparkles,
};

const INTENT_LABELS: Record<string, string> = {
  chat:            "Chat",
  security_fix_v2: "Segurança",
  seo_fix:         "SEO",
  error_fix:       "Correção de Erro",
  setup:           "Setup",
  feature:         "Feature",
  db_migration:    "Migração DB",
  ux_improvement:  "UX",
  audit:           "Auditoria",
  ghost_create:    "Criação Ghost",
};

const STATUS_COLOR: Record<string, string> = {
  pending:    "text-muted-foreground",
  running:    "text-amber-500",
  completed:  "text-emerald-500",
  failed:     "text-red-500",
  skipped:    "text-muted-foreground",
};

// ─── Task Ticker Component (mimics Lovable task runner UI) ───────

function TaskTicker({ tasks, currentTaskIndex }: { tasks: OrchestratorTask[]; currentTaskIndex: number }) {
  const [expanded, setExpanded] = useState(true);
  const runningTask = tasks.find(t => t.status === "running");
  const completedCount = tasks.filter(t => t.status === "completed").length;

  if (tasks.length === 0) return null;

  return (
    <div className="border border-border/60 rounded-xl overflow-hidden bg-muted/20">
      {/* Header bar — click to expand/collapse */}
      <button
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        {runningTask ? (
          <Loader2 className="h-3.5 w-3.5 text-amber-500 animate-spin shrink-0" />
        ) : completedCount === tasks.length ? (
          <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
        ) : (
          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <div className="flex-1 text-left">
          <span className="text-xs font-semibold">
            {runningTask ? runningTask.title : `Tasks (${completedCount}/${tasks.length})`}
          </span>
          {/* Mini progress bar */}
          <div className="h-0.5 bg-border rounded-full mt-1 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-700"
              style={{ width: `${tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0}%` }}
            />
          </div>
        </div>
        {expanded ? <ChevronUp className="h-3 w-3 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="border-t border-border/40 divide-y divide-border/30 max-h-56 overflow-y-auto">
          {tasks.map((task, idx) => {
            const Icon = INTENT_ICONS[task.intent] || Zap;
            const isActive = task.status === "running";
            const isCurrent = idx === currentTaskIndex;
            return (
              <div
                key={task.id}
                className={`flex items-start gap-3 px-4 py-2.5 text-xs transition-colors ${isActive ? "bg-amber-500/5" : ""}`}
              >
                <div className="shrink-0 mt-0.5">
                  {task.status === "completed" && <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />}
                  {task.status === "running"   && <Loader2 className="h-3.5 w-3.5 text-amber-500 animate-spin" />}
                  {task.status === "failed"    && <XCircle className="h-3.5 w-3.5 text-red-500" />}
                  {task.status === "pending"   && (
                    isCurrent
                      ? <div className="h-3.5 w-3.5 rounded-full border-2 border-primary" />
                      : <div className="h-3.5 w-3.5 rounded-full border-2 border-border/60" />
                  )}
                  {task.status === "skipped" && <SkipForward className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className={`font-medium truncate ${STATUS_COLOR[task.status] || ""}`}>{task.title}</span>
                    {task.retry_count > 0 && (
                      <span className="text-[10px] text-amber-500 shrink-0">×{task.retry_count}</span>
                    )}
                  </div>
                  <p className="text-muted-foreground/70 truncate mt-0.5">{INTENT_LABELS[task.intent] || task.intent}</p>
                  {isActive && task.started_at && (
                    <p className="text-amber-500/80 mt-0.5">
                      {Math.round((Date.now() - new Date(task.started_at).getTime()) / 1000)}s em execução...
                    </p>
                  )}
                  {task.status === "completed" && task.started_at && task.completed_at && (
                    <p className="text-muted-foreground/50 mt-0.5">
                      {Math.round((new Date(task.completed_at).getTime() - new Date(task.started_at).getTime()) / 1000)}s
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Log Feed Component ──────────────────────────────────────────

function LogFeed({ logs, visible, onToggle }: { logs: OrchestratorLog[]; visible: boolean; onToggle: () => void }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visible) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, visible]);

  return (
    <div className="border border-border/60 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted/30 transition-colors"
        onClick={onToggle}
      >
        <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold flex-1 text-left">Log em tempo real</span>
        {logs.length > 0 && (
          <span className="text-[10px] bg-muted px-1.5 rounded-full">{logs.length}</span>
        )}
        {visible ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
      </button>
      {visible && (
        <div className="border-t border-border/40 bg-black/90 rounded-b-xl p-3 h-40 overflow-y-auto font-mono">
          {logs.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aguardando logs...</p>
          ) : (
            logs.map(l => (
              <p key={l.id} className={`text-xs leading-relaxed ${
                l.level === "error" ? "text-red-400"
                : l.level === "warn" ? "text-amber-400"
                : l.level === "debug" ? "text-zinc-500"
                : "text-green-400"
              }`}>
                <span className="text-zinc-600 select-none">{new Date(l.created_at).toLocaleTimeString("pt-BR")} </span>
                {l.message}
              </p>
            ))
          )}
          <div ref={endRef} />
        </div>
      )}
    </div>
  );
}

// ─── Main Panel ──────────────────────────────────────────────────

export default function OrchestratorProjectPanel() {
  const { id: orchestratorProjectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { enabled: orchEnabled, loading: flagLoading } = useFeatureFlag("orchestrator");
  const { invoke } = useLovableProxy();

  // ── Orchestrator state ──
  const [project, setProject] = useState<OrchestratorProject | null>(null);
  const [tasks, setTasks] = useState<OrchestratorTask[]>([]);
  const [logs, setLogs] = useState<OrchestratorLog[]>([]);
  const [loadingProject, setLoadingProject] = useState(true);
  const [logsVisible, setLogsVisible] = useState(false);

  // Preview state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showStarCrawl, setShowStarCrawl] = useState(false);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // Derived
  const lovableId = project?.lovable_project_id;

  // ── Auth guard ────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!authLoading && !flagLoading && !orchEnabled) {
      if (!user) navigate("/login");
      else navigate("/lab/orchestrator");
    }
  }, [user, authLoading, orchEnabled, flagLoading, navigate]);

  if (authLoading || flagLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!orchEnabled) return null;

  // ── Load preview URL ──────────────────────────────────────────
  const loadPreview = useCallback(async (lvId: string) => {
    setLoadingPreview(true);
    try {
      // Try sandbox URL first
      try {
        await invoke({ route: `/projects/${lvId}/sandbox/start`, method: "POST", payload: {} });
      } catch { /* may already be running */ }

      const data = await invoke<{ url: string }>({ route: `/projects/${lvId}/sandbox/url` });
      if (data?.url) {
        setPreviewUrl(data.url);
      } else {
        // Fallback to canonical preview URL (preview link, not project link)
        setPreviewUrl(`https://id-preview--${lvId}.lovable.app`);
      }
    } catch {
      setPreviewUrl(`https://id-preview--${lvId}.lovable.app`);
    } finally {
      setLoadingPreview(false);
    }
  }, [invoke]);

  // ── Load orchestrator project ─────────────────────────────────
  const loadProject = useCallback(async () => {
    if (!orchestratorProjectId || !user) return;
    setLoadingProject(true);
    const [{ data: proj }, { data: taskList }, { data: logList }] = await Promise.all([
      (supabase as any).from("orchestrator_projects").select("*").eq("id", orchestratorProjectId).eq("user_id", user.id).maybeSingle(),
      (supabase as any).from("orchestrator_tasks").select("*").eq("project_id", orchestratorProjectId).order("task_index"),
      (supabase as any).from("orchestrator_logs").select("*").eq("project_id", orchestratorProjectId).order("created_at", { ascending: true }).limit(200),
    ]);
    if (proj) {
      setProject(proj as OrchestratorProject);
      if ((proj as OrchestratorProject).lovable_project_id) {
        loadPreview((proj as OrchestratorProject).lovable_project_id!);
      }
    }
    setTasks((taskList as OrchestratorTask[]) || []);
    setLogs((logList as OrchestratorLog[]) || []);

    if (proj) {
      setChatMessages([{
        id: "welcome",
        role: "system",
        content: `👋 Projeto **${(proj as OrchestratorProject).prd_json?.project_name || "Sem nome"}** carregado.\n\nEnvie comandos diretos ao Lovable ou use os botões de ação abaixo.`,
        timestamp: new Date().toISOString(),
        status: "sent",
      }]);
    }
    setLoadingProject(false);
  }, [orchestratorProjectId, user, loadPreview]);

  useEffect(() => { loadProject(); }, [loadProject]);

  // ── Realtime subscriptions ────────────────────────────────────
  useEffect(() => {
    if (!orchestratorProjectId) return;

    const channel = supabase
      .channel(`orch-panel-${orchestratorProjectId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "orchestrator_logs",
        filter: `project_id=eq.${orchestratorProjectId}`,
      }, payload => {
        setLogs(prev => [...prev, payload.new as OrchestratorLog]);
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "orchestrator_projects",
        filter: `id=eq.${orchestratorProjectId}`,
      }, payload => {
        setProject(prev => prev ? { ...prev, ...payload.new } : prev);
        // If lovable_project_id just appeared, load preview
        const updated = payload.new as OrchestratorProject;
        if (updated.lovable_project_id && !project?.lovable_project_id) {
          loadPreview(updated.lovable_project_id);
        }
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "orchestrator_tasks",
        filter: `project_id=eq.${orchestratorProjectId}`,
      }, payload => {
        setTasks(prev => prev.map(t => t.id === (payload.new as OrchestratorTask).id ? { ...t, ...payload.new } : t));
      })
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "orchestrator_tasks",
        filter: `project_id=eq.${orchestratorProjectId}`,
      }, payload => {
        setTasks(prev => {
          const exists = prev.find(t => t.id === (payload.new as OrchestratorTask).id);
          if (exists) return prev;
          return [...prev, payload.new as OrchestratorTask].sort((a, b) => a.task_index - b.task_index);
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orchestratorProjectId, project?.lovable_project_id, loadPreview]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ── Send chat message directly to Lovable ─────────────────────
  const sendChatMessage = async () => {
    if (!message.trim() || sending || !lovableId) return;
    const userMsg = message.trim();
    setMessage("");
    setSending(true);

    const tempId = crypto.randomUUID();
    setChatMessages(prev => [...prev, {
      id: tempId,
      role: "user",
      content: userMsg,
      timestamp: new Date().toISOString(),
      status: "sending",
    }]);

    try {
      const msgId = `umsg_${Date.now().toString(36)}${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
      const aiMsgId = `aimsg_${Date.now().toString(36)}${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

      await invoke({
        route: `/projects/${lovableId}/chat`,
        method: "POST",
        payload: {
          id: msgId,
          message: userMsg,
          intent: "security_fix_v2",
          chat_only: false,
          ai_message_id: aiMsgId,
          thread_id: "main",
          view: "code",
          view_description: "User editing via Starble Orchestrator panel.",
          model: null,
          files: [],
          optimisticImageUrls: [],
          selected_elements: [],
          debug_mode: false,
          session_replay: "[]",
          client_logs: [],
          network_requests: [],
          runtime_errors: [],
          integration_metadata: { browser: { preview_viewport_width: 1536, preview_viewport_height: 730 } },
        },
      });

      setChatMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: "sent" } : m));

      // Poll for AI response
      const aiRespId = crypto.randomUUID();
      setChatMessages(prev => [...prev, {
        id: aiRespId,
        role: "ai",
        content: "Processando...",
        timestamp: new Date().toISOString(),
        status: "sending",
      }]);

      await new Promise(r => setTimeout(r, 4000));
      let captured = false;
      for (let i = 0; i < 20; i++) {
        try {
          const msg = await invoke<{ content?: string; is_streaming?: boolean; role?: string }>({
            route: `/projects/${lovableId}/latest-message`,
          });
          if (msg && !msg.is_streaming && msg.content && msg.role === "assistant") {
            setChatMessages(prev => prev.map(m => m.id === aiRespId
              ? { ...m, content: msg.content!, status: "sent" }
              : m
            ));
            captured = true;
            // Reload iframe to pick up changes
            setTimeout(() => iframeRef.current?.contentWindow?.location.reload(), 2000);
            break;
          }
        } catch { /* continue polling */ }
        await new Promise(r => setTimeout(r, 3000));
      }

      if (!captured) {
        setChatMessages(prev => prev.map(m => m.id === aiRespId
          ? { ...m, content: "Tempo esgotado — a resposta pode ainda estar processando. Verifique o preview.", status: "error" }
          : m
        ));
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Erro ao enviar mensagem";
      setChatMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: "error" } : m));
      toast.error(errMsg);
    } finally {
      setSending(false);
    }
  };

  // ── Orchestrator actions ──────────────────────────────────────
  const invokeOrchestrator = async (action: string, extras: Record<string, unknown> = {}) => {
    if (!orchestratorProjectId) return null;
    setActionLoading(action);
    try {
      const { data, error } = await supabase.functions.invoke("agentic-orchestrator", {
        body: { action, project_id: orchestratorProjectId, ...extras },
      });
      if (error) throw error;
      return data;
    } catch (e) {
      toast.error((e as Error).message || `Erro ao executar ${action}`);
      return null;
    } finally {
      setActionLoading(null);
    }
  };

  const handleExecuteNext = async () => {
    const res = await invokeOrchestrator("execute_next");
    if (res) {
      toast.success("Executando próxima task...");
      loadProject();
    }
  };

  const handlePauseResume = async () => {
    const action = project?.status === "executing" ? "pause" : "resume";
    const res = await invokeOrchestrator(action);
    if (res) {
      toast.success(action === "pause" ? "Pausado" : "Retomado");
      setProject(prev => prev ? { ...prev, status: action === "pause" ? "paused" : "executing" } : prev);
    }
  };

  const handleAudit = async () => {
    toast.info("Auditoria iniciada...");
    const res = await invokeOrchestrator("audit_checkpoint");
    if (res) {
      const { passed, quality_score, issues } = res as { passed: boolean; quality_score: number; issues: string[] };
      if (passed) {
        toast.success(`✅ Auditoria aprovada! Score: ${quality_score}/100`);
      } else {
        toast.warning(`⚠️ ${issues?.length || 0} problema(s) encontrado(s). Score: ${quality_score}/100`);
      }
      setChatMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: "system",
        content: `🔍 **Auditoria completa** — Score: ${quality_score}/100\n${issues?.length ? `\n**Problemas:**\n${issues.map((i: string) => `- ${i}`).join("\n")}` : "\n✅ Nenhum problema encontrado."}`,
        timestamp: new Date().toISOString(),
        status: "sent",
      }]);
    }
  };

  const handlePublish = async () => {
    if (!lovableId) return toast.error("Projeto Lovable não vinculado ainda.");
    setActionLoading("publish");
    try {
      await invoke({ route: `/projects/${lovableId}/publish`, method: "POST", payload: {} });
      toast.success("Projeto publicado!");
      setChatMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: "system",
        content: "**Projeto publicado com sucesso!**",
        timestamp: new Date().toISOString(),
        status: "sent",
      }]);
    } catch {
      toast.error("Erro ao publicar projeto.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendSkillPrompt = async (intent: string) => {
    if (!lovableId) return toast.error("Nenhum projeto Lovable vinculado.");
    // Fetch skill prompt from agent_skills
    setActionLoading(intent);
    try {
      const { data: skill } = await (supabase as any).from("agent_skills").select("prompt_template, name").eq("intent", intent).limit(1).maybeSingle();
      if (!skill) return toast.error("Skill não encontrada.");
      setMessage((skill as any).prompt_template);
      toast.info(`Skill "${(skill as any).name}" carregada no campo de chat. Envie para aplicar.`);
    } catch {
      toast.error("Erro ao carregar skill.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  };

  const reloadPreview = () => {
    if (lovableId) loadPreview(lovableId);
    iframeRef.current?.contentWindow?.location.reload();
  };

  // ── Status badge helper ────────────────────────────────────────
  const StatusBadge = () => {
    const status = project?.status || "loading";
    const map: Record<string, { label: string; className: string }> = {
      executing: { label: "Executando", className: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
      paused:    { label: "Pausado",   className: "bg-slate-500/10 text-slate-500 border-slate-400/30" },
      completed: { label: "Concluído", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
      failed:    { label: "Erro",      className: "bg-red-500/10 text-red-600 border-red-500/30" },
      auditing:  { label: "Auditando", className: "bg-purple-500/10 text-purple-600 border-purple-500/30" },
      planning:  { label: "Planejando",className: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
    };
    const s = map[status] || { label: status, className: "bg-muted/40 text-muted-foreground border-border/50" };
    return (
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${s.className} flex items-center gap-1`}>
        {status === "executing" && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
        {s.label}
      </span>
    );
  };

  // ─────────────────────────────────────────────────────────────
  if (authLoading || !user) return <div className="min-h-screen bg-background" />;

  const projectName = project?.prd_json?.project_name || "Projeto Orquestrado";
  const progress = project && project.total_tasks > 0
    ? Math.round((project.current_task_index / project.total_tasks) * 100)
    : 0;

  return (
    <>
    <AppLayout>
      <div className="flex" style={{ height: "calc(100vh - 3rem)" }}>

        {/* ═══ LEFT PANEL: Chat + Tasks + Controls ════════════════ */}
        <div className="w-[400px] flex flex-col shrink-0 border-r border-border/60">

          {/* Header */}
          <div className="h-12 border-b border-border/60 px-3 flex items-center gap-2 shrink-0">
            <Link
              to="/brain"
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors shrink-0"
              title="Voltar ao Brain"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            {loadingProject ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">{projectName}</p>
                </div>
                <StatusBadge />
              </>
            )}
          </div>

          {/* Progress bar */}
          {project && project.total_tasks > 0 && (
            <div className="px-3 py-1.5 border-b border-border/40 shrink-0">
              <div className="flex justify-between mb-1">
                <span className="text-[10px] text-muted-foreground">Progresso</span>
                <span className="text-[10px] text-muted-foreground">{project.current_task_index}/{project.total_tasks} · {progress}%</span>
              </div>
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-700"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {project.quality_score !== null && (
                <div className="flex items-center gap-1 mt-1">
                  {project.quality_score >= 80
                    ? <CheckCircle className="h-3 w-3 text-emerald-500" />
                    : <AlertTriangle className="h-3 w-3 text-amber-500" />}
                  <span className="text-[10px] text-muted-foreground">Quality: <strong>{project.quality_score}/100</strong></span>
                </div>
              )}
            </div>
          )}

          {/* Task Ticker */}
          <div className="px-3 py-2 border-b border-border/40 shrink-0">
            {loadingProject ? (
              <div className="h-10 flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Carregando tasks...</span>
              </div>
            ) : (
              <TaskTicker tasks={tasks} currentTaskIndex={project?.current_task_index ?? 0} />
            )}
          </div>

          {/* Action buttons */}
          <div className="px-3 py-2 border-b border-border/40 shrink-0">
            <div className="flex flex-wrap gap-1.5">
              {/* Pause / Resume */}
              <button
                onClick={handlePauseResume}
                disabled={!!actionLoading || !project}
                className="h-7 px-2.5 rounded-lg text-[11px] font-medium flex items-center gap-1 bg-muted/60 hover:bg-muted transition-colors disabled:opacity-50"
              >
                {actionLoading === "pause" || actionLoading === "resume"
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : project?.status === "executing" ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                {project?.status === "executing" ? "Pausar" : "Retomar"}
              </button>

              {/* Execute next */}
              {project?.status === "paused" && (
                <button
                  onClick={handleExecuteNext}
                  disabled={!!actionLoading}
                  className="h-7 px-2.5 rounded-lg text-[11px] font-medium flex items-center gap-1 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {actionLoading === "execute_next" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                  Executar
                </button>
              )}

              {/* Publish */}
              <button
                onClick={handlePublish}
                disabled={!!actionLoading || !lovableId}
                className="h-7 px-2.5 rounded-lg text-[11px] font-medium flex items-center gap-1 bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {actionLoading === "publish" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                Publicar
              </button>

              {/* Audit */}
              <button
                onClick={handleAudit}
                disabled={!!actionLoading || !lovableId}
                className="h-7 px-2.5 rounded-lg text-[11px] font-medium flex items-center gap-1 bg-purple-600/10 text-purple-600 border border-purple-400/30 hover:bg-purple-600/20 transition-colors disabled:opacity-50"
              >
                {actionLoading === "audit_checkpoint" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shield className="h-3 w-3" />}
                Auditoria
              </button>

              {/* Fix Errors skill */}
              <button
                onClick={() => handleSendSkillPrompt("error_fix")}
                disabled={!!actionLoading || !lovableId}
                className="h-7 px-2.5 rounded-lg text-[11px] font-medium flex items-center gap-1 bg-red-600/10 text-red-600 border border-red-400/30 hover:bg-red-600/20 transition-colors disabled:opacity-50"
              >
                {actionLoading === "error_fix" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bug className="h-3 w-3" />}
                Fix Error
              </button>

              {/* SEO Fix skill */}
              <button
                onClick={() => handleSendSkillPrompt("seo_fix")}
                disabled={!!actionLoading || !lovableId}
                className="h-7 px-2.5 rounded-lg text-[11px] font-medium flex items-center gap-1 bg-blue-600/10 text-blue-600 border border-blue-400/30 hover:bg-blue-600/20 transition-colors disabled:opacity-50"
              >
                {actionLoading === "seo_fix" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Globe className="h-3 w-3" />}
                SEO Fix
              </button>

              {/* StarCrawl */}
              <button
                onClick={() => setShowStarCrawl(true)}
                disabled={!!actionLoading || !orchestratorProjectId}
                className="h-7 px-2.5 rounded-lg text-[11px] font-medium flex items-center gap-1 bg-emerald-600/10 text-emerald-600 border border-emerald-400/30 hover:bg-emerald-600/20 transition-colors disabled:opacity-50"
                title="Extrair site e gerar prompt Lovable"
              >
                <Globe className="h-3 w-3" />
                StarCrawl
              </button>
            </div>
          </div>

          {/* Log feed */}
          <div className="px-3 py-2 border-b border-border/40 shrink-0">
            <LogFeed logs={logs} visible={logsVisible} onToggle={() => setLogsVisible(v => !v)} />
          </div>

          {/* Chat history */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {loadingProject && (
              <div className="flex justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}

            {!loadingProject && !lovableId && (
              <div className="rounded-xl bg-amber-500/10 border border-amber-400/30 px-4 py-3 text-xs text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5 inline mr-1.5 mb-0.5" />
                Projeto Lovable ainda não foi vinculado. Execute a primeira task para criar o projeto ghost.
              </div>
            )}

            {chatMessages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[92%] rounded-xl px-3 py-2.5 text-xs ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : msg.role === "system"
                    ? "bg-muted/50 border border-border/40 text-foreground w-full"
                    : "bg-muted text-foreground"
                }`}>
                  {msg.role === "system" || msg.role === "ai" ? (
                    <div className="prose prose-xs dark:prose-invert max-w-none text-xs leading-relaxed">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                  {msg.status === "sending" && <Loader2 className="h-3 w-3 animate-spin mt-1 opacity-60" />}
                  {msg.status === "error" && <span className="text-[10px] text-destructive block mt-1">Erro ao enviar</span>}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          <div className="border-t border-border/60 p-3 shrink-0">
            {!lovableId && (
              <p className="text-[10px] text-muted-foreground mb-2 text-center">
                Chat disponível após vincular projeto Lovable
              </p>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={chatInputRef}
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={lovableId ? "Enviar comando ao Lovable... (Enter para enviar)" : "Aguardando projeto..."}
                rows={1}
                disabled={sending || !lovableId}
                className="flex-1 min-h-[36px] max-h-[120px] py-2 px-3 resize-none text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                onInput={e => {
                  const t = e.currentTarget;
                  t.style.height = "auto";
                  t.style.height = Math.min(t.scrollHeight, 120) + "px";
                }}
              />
              <button
                onClick={sendChatMessage}
                disabled={!message.trim() || sending || !lovableId}
                className="h-9 w-9 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 shrink-0"
              >
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </button>
            </div>

            {/* Quick skill buttons below input */}
            {lovableId && (
              <div className="flex gap-1.5 mt-2 flex-wrap">
                <button
                  onClick={() => handleSendSkillPrompt("security_fix_v2")}
                  disabled={!!actionLoading}
                  className="h-6 px-2 rounded-md text-[10px] font-medium bg-muted/60 hover:bg-muted text-muted-foreground transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  <Shield className="h-2.5 w-2.5" /> Segurança RLS
                </button>
                <button
                  onClick={() => handleSendSkillPrompt("ux_improvement")}
                  disabled={!!actionLoading}
                  className="h-6 px-2 rounded-md text-[10px] font-medium bg-muted/60 hover:bg-muted text-muted-foreground transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  <Eye className="h-2.5 w-2.5" /> UX Mobile
                </button>
                <button
                  onClick={() => { setMessage("Adicione tratamento de erros completo com ErrorBoundary e toasts em toda a aplicação."); }}
                  className="h-6 px-2 rounded-md text-[10px] font-medium bg-muted/60 hover:bg-muted text-muted-foreground transition-colors flex items-center gap-1"
                >
                  <Bug className="h-2.5 w-2.5" /> Error Boundary
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ═══ RIGHT PANEL: Live Preview ══════════════════════════ */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Preview header */}
          <div className="h-12 border-b border-border/60 px-4 flex items-center gap-3 shrink-0">
            {/* URL bar */}
            <div className="flex-1 h-7 bg-muted/50 border border-border/50 rounded-lg flex items-center px-3 gap-2 min-w-0">
              <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-xs text-muted-foreground truncate font-mono">
                {previewUrl || (lovableId ? `https://id-preview--${lovableId}.lovable.app` : "Aguardando projeto...")}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={reloadPreview}
                className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
                title="Recarregar preview"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>

              {previewUrl && (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
                  title="Abrir em nova aba"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}

              {lovableId && (
                <a
                  href={`https://lovable.dev/projects/${lovableId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-7 px-2.5 flex items-center gap-1 rounded-lg hover:bg-muted transition-colors text-xs text-muted-foreground"
                  title="Abrir no Lovable"
                >
                  <BrainCircuit className="h-3 w-3" />
                  <span className="hidden sm:inline">Lovable</span>
                </a>
              )}
            </div>
          </div>

          {/* Iframe */}
          <div className="flex-1 bg-muted/20 relative">
            {!lovableId ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-8">
                <div className="h-16 w-16 rounded-2xl bg-muted/60 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Preview indisponível</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    O projeto ainda não foi criado no Lovable.<br />
                    Execute a primeira task para iniciar o processo ghost.
                  </p>
                </div>
                {project?.status === "paused" && (
                  <button
                    onClick={handleExecuteNext}
                    disabled={!!actionLoading}
                    className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 hover:bg-primary/90 disabled:opacity-50"
                  >
                    {actionLoading === "execute_next" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                    Executar task inicial
                  </button>
                )}
              </div>
            ) : loadingPreview ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Iniciando sandbox...</p>
                </div>
              </div>
            ) : previewUrl ? (
              <iframe
                ref={iframeRef}
                src={previewUrl}
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                title="Live Preview"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Não foi possível carregar o preview</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>

      {/* ── StarCrawl Modal ── */}
      {showStarCrawl && orchestratorProjectId && (
        <StarCrawlModal
          projectId={orchestratorProjectId}
          onUsePrompt={(prompt) => {
            setMessage(prompt);
            setTimeout(() => chatInputRef.current?.focus(), 100);
          }}
          onClose={() => setShowStarCrawl(false)}
        />
      )}
    </>
  );
}
