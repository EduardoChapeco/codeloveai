import { useState, useEffect, useRef, useMemo } from "react";
import {
  Loader2, CheckCircle2, Sparkles, Code2, Eye, FileCode,
  ChevronDown, ChevronUp, AlertTriangle, RotateCcw, Cpu,
  Database, Layout, Shield, Palette, Settings
} from "lucide-react";

export type TaskStatus = "pending" | "thinking" | "editing" | "reviewing" | "done" | "error" | "retrying";

export interface TaskItem {
  id: string;
  title: string;
  status: TaskStatus;
  subtitle?: string;
  files?: string[];
  error?: string;
  retryCount?: number;
  brainType?: string;
  startedAt?: number;
}

interface Props {
  active: boolean;
  hasStreamContent?: boolean;
  updatedFiles?: string[];
  complete?: boolean;
  dismissAfter?: number;
  onDismiss?: () => void;
  /** Multi-task support */
  tasks?: TaskItem[];
  onRetryTask?: (taskId: string) => void;
}

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string }> = {
  pending: { label: "Aguardando", color: "var(--text-quaternary)" },
  thinking: { label: "Analisando", color: "var(--indigo-l)" },
  editing: { label: "Gerando código", color: "var(--indigo-l)" },
  reviewing: { label: "Revisando", color: "var(--blue-l, #60a5fa)" },
  done: { label: "Concluído", color: "var(--emerald-l, #34d399)" },
  error: { label: "Falha", color: "var(--red-l, #f87171)" },
  retrying: { label: "Re-analisando (IA)", color: "var(--amber-l, #fbbf24)" },
};

const BRAIN_ICONS: Record<string, typeof Code2> = {
  code: Code2,
  design: Palette,
  prd: Layout,
  database: Database,
  security: Shield,
  config: Settings,
};

function ElapsedTimer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [startTime]);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return <span className="ctc-h-time">{m > 0 ? `${m}m ${s}s` : `${s}s`}</span>;
}

export default function ChatTaskCard({
  active, hasStreamContent, updatedFiles = [], complete,
  dismissAfter = 5000, onDismiss, tasks, onRetryTask,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const startTimeRef = useRef(Date.now());
  const dismissedRef = useRef(false);

  // Legacy single-task phase (fallback when no tasks array)
  const [legacyPhase, setLegacyPhase] = useState(0);

  useEffect(() => {
    if (active) {
      setLegacyPhase(0);
      setCollapsed(false);
      startTimeRef.current = Date.now();
      dismissedRef.current = false;
    }
  }, [active]);

  // Legacy phase advancement — single consolidated effect
  useEffect(() => {
    if (tasks && tasks.length > 0) return;
    if (!active && !complete) {
      if (legacyPhase < 2) setLegacyPhase(2);
      return;
    }
    if (complete) {
      if (legacyPhase < 2) setLegacyPhase(2);
      else if (legacyPhase === 2) {
        const t = setTimeout(() => setLegacyPhase(3), 600);
        return () => clearTimeout(t);
      }
      return;
    }
    if (hasStreamContent && legacyPhase < 1) {
      setLegacyPhase(1);
      return;
    }
    if (legacyPhase === 0) {
      const t = setTimeout(() => setLegacyPhase(1), 2000);
      return () => clearTimeout(t);
    }
  }, [active, legacyPhase, complete, hasStreamContent, tasks]);

  // Multi-task stats
  const stats = useMemo(() => {
    if (!tasks || tasks.length === 0) return null;
    const total = tasks.length;
    const done = tasks.filter(t => t.status === "done").length;
    const errors = tasks.filter(t => t.status === "error").length;
    const retrying = tasks.filter(t => t.status === "retrying").length;
    const running = tasks.filter(t => ["thinking", "editing", "reviewing"].includes(t.status)).length;
    const pct = total > 0 ? Math.round(((done) / total) * 100) : 0;
    return { total, done, errors, retrying, running, pct };
  }, [tasks]);

  const isMultiTask = stats !== null;
  const allDone = isMultiTask ? stats.done === stats.total : legacyPhase === 3;
  const hasErrors = isMultiTask ? stats.errors > 0 : false;
  const isActive = isMultiTask ? (stats.running > 0 || stats.retrying > 0) : active;

  // Auto-dismiss
  useEffect(() => {
    if (allDone && !dismissedRef.current && !hasErrors) {
      dismissedRef.current = true;
      const t = setTimeout(() => onDismiss?.(), dismissAfter);
      return () => clearTimeout(t);
    }
  }, [allDone, hasErrors, dismissAfter, onDismiss]);

  // Progress
  const progressPct = isMultiTask
    ? stats.pct
    : (allDone ? 100 : legacyPhase === 0 ? 15 : legacyPhase === 1 ? 50 : 85);

  if (!active && !isMultiTask && legacyPhase === 0 && !complete) return null;

  // Header label
  const headerLabel = isMultiTask
    ? (allDone
      ? (hasErrors ? `${stats.done}/${stats.total} concluídas` : "Todas as tarefas concluídas")
      : `Executando ${stats.running} tarefa(s)`)
    : (allDone ? "Concluído" : legacyPhase === 0 ? "Analisando" : legacyPhase === 1 ? "Gerando código" : "Revisando");

  return (
    <div className={`ctc-root ${allDone && !hasErrors ? "ctc-done" : ""} ${hasErrors ? "ctc-has-errors" : ""}`}>
      {/* Header */}
      <div className="ctc-header" onClick={() => setCollapsed(c => !c)}>
        <div className="ctc-h-left">
          {allDone && !hasErrors ? (
            <CheckCircle2 size={13} className="ctc-ico-done" />
          ) : hasErrors ? (
            <AlertTriangle size={13} className="ctc-ico-error" />
          ) : (
            <Loader2 size={13} className="animate-spin ctc-ico-active" />
          )}
          <span className="ctc-h-title">{headerLabel}</span>
          {isMultiTask && (
            <span className="ctc-h-count">{stats.done}/{stats.total}</span>
          )}
        </div>
        <div className="ctc-h-right">
          <ElapsedTimer startTime={startTimeRef.current} />
          {collapsed ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
        </div>
      </div>

      {/* Multi-task list */}
      {!collapsed && isMultiTask && (
        <div className="ctc-tasks-list">
          {tasks!.map((task, idx) => {
            const cfg = STATUS_CONFIG[task.status];
            const BrainIcon = task.brainType ? (BRAIN_ICONS[task.brainType] || Cpu) : Cpu;
            const isRunning = ["thinking", "editing", "reviewing", "retrying"].includes(task.status);

            return (
              <div key={task.id} className={`ctc-task-row ctc-task-${task.status}`}>
                <div className="ctc-task-num">{idx + 1}</div>
                <div className="ctc-task-icon">
                  {task.status === "done" && <CheckCircle2 size={11} />}
                  {task.status === "error" && <AlertTriangle size={11} />}
                  {task.status === "pending" && <Sparkles size={11} />}
                  {task.status === "retrying" && <RotateCcw size={11} className="animate-spin" />}
                  {isRunning && task.status !== "retrying" && <Loader2 size={11} className="animate-spin" />}
                </div>
                <div className="ctc-task-info">
                  <div className="ctc-task-title">
                    {task.title}
                    {task.brainType && (
                      <span className="ctc-task-brain">
                        <BrainIcon size={8} /> {task.brainType}
                      </span>
                    )}
                  </div>
                  {(isRunning || task.status === "error") && (
                    <div className="ctc-task-sub" style={{ color: cfg.color }}>
                      {task.status === "error" && task.error
                        ? task.error.slice(0, 80)
                        : task.subtitle || cfg.label}
                      {task.retryCount ? ` (tentativa ${task.retryCount})` : ""}
                    </div>
                  )}
                  {task.status === "done" && task.files && task.files.length > 0 && (
                    <div className="ctc-task-files">
                      {task.files.slice(0, 3).map(f => (
                        <span key={f} className="ctc-file-pill">{f.split("/").pop()}</span>
                      ))}
                      {task.files.length > 3 && <span className="ctc-file-pill">+{task.files.length - 3}</span>}
                    </div>
                  )}
                </div>
                <div className="ctc-task-status-dot" style={{ background: cfg.color }} />
                {task.status === "error" && onRetryTask && (
                  <button className="ctc-task-retry" onClick={() => onRetryTask(task.id)} title="Re-analisar com IA">
                    <RotateCcw size={10} />
                  </button>
                )}
                {isRunning && (
                  <span className="ctc-step-pulse" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Legacy single-task steps */}
      {!collapsed && !isMultiTask && (
        <div className="ctc-steps">
          {[
            { id: "thinking", label: "Analisando", sub: "Entendendo sua instrução...", icon: Sparkles },
            { id: "editing", label: "Gerando código", sub: "Aplicando alterações...", icon: Code2 },
            { id: "reviewing", label: "Revisando", sub: "Verificando integridade...", icon: Eye },
            ...(allDone ? [{ id: "done", label: "Concluído", sub: "Alterações aplicadas!", icon: CheckCircle2 }] : []),
          ].map((step, i) => {
            const isStepActive = i === legacyPhase;
            const isPast = i < legacyPhase;
            const Icon = step.icon;
            return (
              <div key={step.id} className={`ctc-step ${isStepActive ? "active" : ""} ${isPast ? "past" : ""}`}>
                <div className={`ctc-step-ico ${isPast ? "past" : isStepActive ? "active" : ""}`}>
                  {isPast ? <CheckCircle2 size={10} /> : isStepActive && !allDone ? <Loader2 size={10} className="animate-spin" /> : <Icon size={10} />}
                </div>
                <div className="ctc-step-text">
                  <span className="ctc-step-label">{step.label}</span>
                  {isStepActive && <span className="ctc-step-sub">{step.sub}</span>}
                </div>
                {isPast && <span className="ctc-step-ok">✓</span>}
                {isStepActive && !allDone && <span className="ctc-step-pulse" />}
              </div>
            );
          })}
        </div>
      )}

      {/* Updated files summary */}
      {allDone && updatedFiles.length > 0 && !collapsed && (
        <div className="ctc-files">
          <FileCode size={10} className="ctc-files-ico" />
          <span>{updatedFiles.length} arquivo(s) atualizado(s)</span>
          <div className="ctc-files-list">
            {updatedFiles.slice(0, 5).map(f => (
              <span key={f} className="ctc-file-pill">{f.split("/").pop()}</span>
            ))}
            {updatedFiles.length > 5 && <span className="ctc-file-pill">+{updatedFiles.length - 5}</span>}
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="ctc-progress">
        <div
          className={`ctc-progress-fill ${allDone && !hasErrors ? "done" : ""} ${hasErrors ? "error" : ""}`}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}
