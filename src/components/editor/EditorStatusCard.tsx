import { useEffect, useState } from "react";
import { Check, Eye, Code2, Sparkles, Loader2 } from "lucide-react";

type Phase = "thinking" | "editing" | "reviewing" | "done";

interface Props {
  active: boolean;
  onComplete?: () => void;
}

const PHASES: { id: Phase; label: string; sub: string; icon: typeof Sparkles; duration: number }[] = [
  { id: "thinking", label: "Pensando", sub: "Analisando sua instrução...", icon: Sparkles, duration: 3000 },
  { id: "editing", label: "Editando", sub: "Aplicando alterações no código...", icon: Code2, duration: 8000 },
  { id: "reviewing", label: "Revisando", sub: "Verificando integridade...", icon: Eye, duration: 4000 },
  { id: "done", label: "Concluído", sub: "Alterações aplicadas com sucesso!", icon: Check, duration: 0 },
];

export default function EditorStatusCard({ active, onComplete }: Props) {
  const [phase, setPhase] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!active) { setPhase(0); setProgress(0); return; }

    let currentPhase = 0;
    let elapsed = 0;
    const tick = 60;

    const interval = setInterval(() => {
      if (currentPhase >= PHASES.length - 1) {
        clearInterval(interval);
        onComplete?.();
        return;
      }

      elapsed += tick;
      const dur = PHASES[currentPhase].duration;
      const phaseProgress = Math.min(elapsed / dur, 1);
      const totalProgress = ((currentPhase + phaseProgress) / (PHASES.length - 1)) * 100;
      setProgress(totalProgress);

      if (elapsed >= dur) {
        currentPhase++;
        setPhase(currentPhase);
        elapsed = 0;
      }
    }, tick);

    return () => clearInterval(interval);
  }, [active, onComplete]);

  if (!active && phase === 0) return null;

  const current = PHASES[phase];
  const Icon = current.icon;
  const isDone = current.id === "done";
  const circleRadius = 28;
  const circumference = 2 * Math.PI * circleRadius;
  const dashOffset = circumference - (progress / 100) * circumference;

  return (
    <div className="animate-fade-in" style={{ marginTop: "0.75rem" }}>
      <div
        className="rounded-3xl p-5 space-y-4"
        style={{
          background: "var(--liquid-glass-bg, rgba(255,255,255,0.04))",
          backdropFilter: "blur(40px) saturate(200%)",
          WebkitBackdropFilter: "blur(40px) saturate(200%)",
          border: "0.5px solid var(--clf-border)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.12)",
        }}
      >
        {/* Header with circular progress */}
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 shrink-0">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r={circleRadius} fill="none" stroke="hsl(var(--border))" strokeWidth="3" opacity="0.2" />
              <circle
                cx="32" cy="32" r={circleRadius} fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                className="transition-all duration-500 ease-out"
                style={{
                  filter: "drop-shadow(0 0 6px hsl(var(--primary) / 0.4))",
                }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              {isDone ? (
                <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center">
                  <Check className="h-4 w-4 text-primary" />
                </div>
              ) : (
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-primary animate-pulse" />
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[15px] font-bold text-foreground">{current.label}</p>
              {!isDone && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary/60" />}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{current.sub}</p>
            <p className="text-[10px] font-mono text-muted-foreground/50 mt-1 tabular-nums">
              {Math.round(progress)}%
            </p>
          </div>
        </div>

        {/* Phase indicators - big glass pills */}
        <div className="flex gap-2">
          {PHASES.slice(0, -1).map((p, i) => {
            const PhaseIcon = p.icon;
            const isActive = i === phase;
            const isPast = i < phase;
            return (
              <div
                key={p.id}
                className={`flex-1 rounded-2xl px-3 py-2.5 flex items-center gap-2 transition-all duration-500 ${
                  isPast
                    ? "bg-primary/10 border border-primary/20"
                    : isActive
                      ? "bg-primary/8 border border-primary/15 shadow-sm"
                      : "bg-foreground/[0.02] border border-transparent"
                }`}
              >
                <PhaseIcon className={`h-3 w-3 shrink-0 ${
                  isPast ? "text-primary" : isActive ? "text-primary animate-pulse" : "text-muted-foreground/30"
                }`} />
                <span className={`text-[10px] font-medium truncate ${
                  isPast || isActive ? "text-foreground/80" : "text-muted-foreground/30"
                }`}>
                  {p.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-border/30 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))",
              boxShadow: "0 0 8px hsl(var(--primary) / 0.3)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
