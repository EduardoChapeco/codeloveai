import { useState, useEffect } from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
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
        <div key={b.id} className={`task-bubble ${b.phase === "done" ? "" : ""}`}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div className={`tb-phase-ico ${b.phase}`}>
              {b.phase === "running" && <Loader2 size={13} className="animate-spin" />}
              {b.phase === "done" && <CheckCircle2 size={13} />}
              {b.phase === "error" && <AlertCircle size={13} />}
            </div>
            <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{b.title}</span>
            <BubbleTimer startTime={b.startTime} />
          </div>

          {/* Steps */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginLeft: 4 }}>
            {b.steps.map((step, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "var(--text-secondary)" }}>
                <span className={`tb-step-dot ${step.s}`} />
                {step.t}
              </div>
            ))}
          </div>

          {/* Progress */}
          <div className="tb-progress">
            <div className="tb-progress-bar" style={{ width: `${b.pct}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
