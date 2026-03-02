import { useState, useEffect, useMemo } from "react";
import { Loader2, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Cpu } from "lucide-react";
import type { Bubble } from "@/components/cirius-editor/types";

interface Props {
  bubbles: Bubble[];
  onRemove: (id: string) => void;
}

function ElapsedTimer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [startTime]);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return <span className="tb-timer">{m > 0 ? `${m}m ${s}s` : `${s}s`}</span>;
}

export default function TaskBubbles({ bubbles, onRemove }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const stats = useMemo(() => {
    const total = bubbles.length;
    const done = bubbles.filter(b => b.phase === "done").length;
    const errors = bubbles.filter(b => b.phase === "error").length;
    const running = bubbles.filter(b => b.phase === "running").length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const earliest = bubbles.reduce((min, b) => Math.min(min, b.startTime), Date.now());
    return { total, done, errors, running, pct, earliest };
  }, [bubbles]);

  if (!bubbles.length) return null;

  const allDone = stats.done === stats.total;

  return (
    <div className="tb-unified-card">
      {/* Header */}
      <div className="tb-uc-header" onClick={() => setCollapsed(c => !c)}>
        <div className="tb-uc-status">
          {allDone ? (
            <CheckCircle2 size={14} className="tb-uc-ico done" />
          ) : stats.running > 0 ? (
            <Loader2 size={14} className="tb-uc-ico running animate-spin" />
          ) : stats.errors > 0 ? (
            <AlertCircle size={14} className="tb-uc-ico error" />
          ) : (
            <Loader2 size={14} className="tb-uc-ico running animate-spin" />
          )}
          <span className="tb-uc-title">
            {allDone ? "Tarefas concluídas" : `Executando tarefas`}
          </span>
        </div>
        <div className="tb-uc-meta">
          <span className="tb-uc-count">{stats.done}/{stats.total}</span>
          <ElapsedTimer startTime={stats.earliest} />
          {collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        </div>
      </div>

      {/* Progress bar */}
      <div className="tb-uc-progress">
        <div
          className={`tb-uc-progress-bar ${allDone ? "complete" : ""}`}
          style={{ width: `${stats.pct}%` }}
        />
      </div>

      {/* Task list */}
      {!collapsed && (
        <div className="tb-uc-tasks">
          {bubbles.map((b, idx) => (
            <div key={b.id} className={`tb-uc-task ${b.phase}`}>
              <div className="tb-uc-task-row">
                <span className="tb-uc-task-num">{idx + 1}</span>
                <div className="tb-uc-task-ico">
                  {b.phase === "running" && <Loader2 size={11} className="animate-spin" />}
                  {b.phase === "done" && <CheckCircle2 size={11} />}
                  {b.phase === "error" && <AlertCircle size={11} />}
                </div>
                <span className="tb-uc-task-title">{b.title}</span>
                {b.brainType && (
                  <span className="tb-uc-brain">
                    <Cpu size={8} /> {b.brainType}
                  </span>
                )}
              </div>

              {/* Sub-steps for active task */}
              {b.phase === "running" && b.steps.length > 0 && (
                <div className="tb-uc-steps">
                  {b.steps.map((step, i) => (
                    <div key={i} className={`tb-uc-step ${step.s}`}>
                      <span className={`tb-uc-step-dot ${step.s}`} />
                      <span>{step.t}</span>
                      {step.s === "run" && <Loader2 size={8} className="animate-spin" style={{ marginLeft: "auto" }} />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      {allDone && (
        <button className="tb-uc-dismiss" onClick={() => bubbles.forEach(b => onRemove(b.id))}>
          Limpar
        </button>
      )}
    </div>
  );
}
