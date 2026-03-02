import { useState, useEffect, useRef, useMemo } from "react";
import { Loader2, CheckCircle2, Sparkles, Code2, Eye, Cpu, FileCode, ChevronDown, ChevronUp } from "lucide-react";

type Phase = "thinking" | "editing" | "reviewing" | "done";

interface TaskStep {
  id: Phase;
  label: string;
  sub: string;
  icon: typeof Sparkles;
}

const STEPS: TaskStep[] = [
  { id: "thinking", label: "Analisando", sub: "Entendendo sua instrução...", icon: Sparkles },
  { id: "editing", label: "Gerando código", sub: "Aplicando alterações...", icon: Code2 },
  { id: "reviewing", label: "Revisando", sub: "Verificando integridade...", icon: Eye },
  { id: "done", label: "Concluído", sub: "Alterações aplicadas!", icon: CheckCircle2 },
];

interface Props {
  active: boolean;
  /** When streaming text arrives, move to editing phase */
  hasStreamContent?: boolean;
  /** File names that were updated */
  updatedFiles?: string[];
  /** Mark as fully complete */
  complete?: boolean;
  /** Auto dismiss after done (ms) */
  dismissAfter?: number;
  onDismiss?: () => void;
}

export default function ChatTaskCard({
  active, hasStreamContent, updatedFiles = [], complete, dismissAfter = 3000, onDismiss,
}: Props) {
  const [phase, setPhase] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const startTimeRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const dismissedRef = useRef(false);

  // Reset on new activation
  useEffect(() => {
    if (active) {
      setPhase(0);
      setCollapsed(false);
      startTimeRef.current = Date.now();
      dismissedRef.current = false;
    }
  }, [active]);

  // Timer
  useEffect(() => {
    if (!active && phase === 3) return;
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [active, phase]);

  // Phase advancement: thinking (auto 2s) → editing (when stream starts) → reviewing (when stream ends) → done
  useEffect(() => {
    if (!active) return;
    if (phase === 0) {
      const t = setTimeout(() => setPhase(1), 2000);
      return () => clearTimeout(t);
    }
  }, [active, phase]);

  // Move to editing when stream content appears
  useEffect(() => {
    if (hasStreamContent && phase < 1) setPhase(1);
  }, [hasStreamContent, phase]);

  // Move to reviewing when stream finishes but not complete yet
  useEffect(() => {
    if (!active && phase < 2 && !complete) setPhase(2);
  }, [active, phase, complete]);

  // Move to done when complete
  useEffect(() => {
    if (complete && phase < 3) {
      setPhase(2);
      const t = setTimeout(() => setPhase(3), 600);
      return () => clearTimeout(t);
    }
  }, [complete, phase]);

  // Auto-dismiss
  useEffect(() => {
    if (phase === 3 && !dismissedRef.current) {
      dismissedRef.current = true;
      const t = setTimeout(() => onDismiss?.(), dismissAfter);
      return () => clearTimeout(t);
    }
  }, [phase, dismissAfter, onDismiss]);

  const isDone = phase === 3;
  const fmtTime = useMemo(() => {
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }, [elapsed]);

  if (!active && phase === 0) return null;

  return (
    <div className={`ctc-root ${isDone ? "ctc-done" : ""}`}>
      {/* Header */}
      <div className="ctc-header" onClick={() => setCollapsed(c => !c)}>
        <div className="ctc-h-left">
          {isDone ? (
            <CheckCircle2 size={13} className="ctc-ico-done" />
          ) : (
            <Loader2 size={13} className="animate-spin ctc-ico-active" />
          )}
          <span className="ctc-h-title">
            {isDone ? "Concluído" : STEPS[Math.min(phase, 2)].label}
          </span>
        </div>
        <div className="ctc-h-right">
          <span className="ctc-h-time">{fmtTime}</span>
          {collapsed ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
        </div>
      </div>

      {/* Steps */}
      {!collapsed && (
        <div className="ctc-steps">
          {STEPS.map((step, i) => {
            if (step.id === "done" && !isDone) return null;
            const isActive = i === phase;
            const isPast = i < phase;
            const isFuture = i > phase;
            const Icon = step.icon;

            return (
              <div key={step.id} className={`ctc-step ${isActive ? "active" : ""} ${isPast ? "past" : ""} ${isFuture ? "future" : ""}`}>
                <div className={`ctc-step-ico ${isPast ? "past" : isActive ? "active" : ""}`}>
                  {isPast ? (
                    <CheckCircle2 size={10} />
                  ) : isActive && !isDone ? (
                    <Loader2 size={10} className="animate-spin" />
                  ) : (
                    <Icon size={10} />
                  )}
                </div>
                <div className="ctc-step-text">
                  <span className="ctc-step-label">{step.label}</span>
                  {isActive && <span className="ctc-step-sub">{step.sub}</span>}
                </div>
                {isPast && <span className="ctc-step-ok">✓</span>}
                {isActive && !isDone && (
                  <span className="ctc-step-pulse" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Updated files */}
      {isDone && updatedFiles.length > 0 && !collapsed && (
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
          className={`ctc-progress-fill ${isDone ? "done" : ""}`}
          style={{ width: `${isDone ? 100 : phase === 0 ? 15 : phase === 1 ? 50 : 85}%` }}
        />
      </div>
    </div>
  );
}
