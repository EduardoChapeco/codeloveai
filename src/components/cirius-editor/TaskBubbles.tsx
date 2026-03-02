import { useState, useEffect } from "react";
import { Loader2, CheckCircle2, AlertCircle, Clock, Wrench } from "lucide-react";
import type { Bubble } from "@/components/cirius-editor/types";

interface Props {
  bubbles: Bubble[];
  onRemove: (id: string) => void;
}

function BubbleTimer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [startTime]);
  return <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--mono)" }}>{elapsed}s</span>;
}

export default function TaskBubbles({ bubbles, onRemove }: Props) {
  if (!bubbles.length) return null;

  return (
    <div className="ce-bubbles">
      {bubbles.map((b) => (
        <div key={b.id} className={`task-bubble ${b.phase === "done" ? "bubble-done" : ""}`}>
          {/* Thinking indicator */}
          {b.phase === "running" && (
            <div className="tb-thinking">
              <Clock size={10} />
              <span>Pensando há </span>
              <BubbleTimer startTime={b.startTime} />
            </div>
          )}

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div className={`tb-phase-ico ${b.phase}`}>
              {b.phase === "running" && <Loader2 size={13} className="animate-spin" />}
              {b.phase === "done" && <CheckCircle2 size={13} />}
              {b.phase === "error" && <AlertCircle size={13} />}
            </div>
            <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{b.title}</span>
            {b.phase === "done" && (
              <button
                onClick={() => onRemove(b.id)}
                style={{ background: "none", border: "none", color: "var(--text-quaternary)", cursor: "pointer", fontSize: 10 }}
              >✕</button>
            )}
          </div>

          {/* Steps */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginLeft: 4 }}>
            {b.steps.map((step, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: step.s === "done" ? "var(--text-secondary)" : "var(--text-quaternary)" }}>
                <span className={`tb-step-dot ${step.s}`} />
                {step.t}
                {step.s === "run" && <Loader2 size={9} className="animate-spin" style={{ marginLeft: "auto", color: "var(--blue-l)" }} />}
              </div>
            ))}
          </div>

          {/* Tool count */}
          {b.steps.filter(s => s.s === "done").length > 0 && (
            <div className="tb-tool-count">
              <Wrench size={9} />
              {b.steps.filter(s => s.s === "done").length} tools used
            </div>
          )}

          {/* Progress */}
          <div className="tb-progress">
            <div className="tb-progress-bar" style={{ width: `${b.pct}%` }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
            <span style={{ fontSize: 9, color: "var(--text-quaternary)", fontFamily: "var(--mono)" }}>{Math.round(b.pct)}%</span>
            <BubbleTimer startTime={b.startTime} />
          </div>
        </div>
      ))}
    </div>
  );
}
