import { useEffect, useState } from "react";
import { Loader2, Check, Eye, Code2, Sparkles } from "lucide-react";

type Phase = "thinking" | "editing" | "reviewing" | "done";

interface Props {
  active: boolean;
  onComplete?: () => void;
}

const PHASES: { id: Phase; label: string; icon: typeof Sparkles; duration: number }[] = [
  { id: "thinking", label: "Pensando...", icon: Sparkles, duration: 3000 },
  { id: "editing", label: "Editando código...", icon: Code2, duration: 8000 },
  { id: "reviewing", label: "Revisando mudanças...", icon: Eye, duration: 4000 },
  { id: "done", label: "Concluído!", icon: Check, duration: 0 },
];

export default function EditorStatusCard({ active, onComplete }: Props) {
  const [phase, setPhase] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!active) { setPhase(0); setProgress(0); return; }

    let currentPhase = 0;
    let elapsed = 0;
    const tick = 80;

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
  const circleRadius = 18;
  const circumference = 2 * Math.PI * circleRadius;
  const dashOffset = circumference - (progress / 100) * circumference;

  return (
    <div className="clf-liquid-glass p-4 animate-fade-in">
      <div className="flex items-center gap-4">
        {/* Circular progress */}
        <div className="relative w-12 h-12 shrink-0">
          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 44 44">
            <circle cx="22" cy="22" r={circleRadius} fill="none" stroke="hsl(var(--border))" strokeWidth="3" opacity="0.3" />
            <circle
              cx="22" cy="22" r={circleRadius} fill="none"
              stroke={isDone ? "hsl(var(--primary))" : "hsl(var(--primary))"}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-all duration-300"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            {isDone ? (
              <Check className="h-4 w-4 text-primary" />
            ) : (
              <Icon className="h-4 w-4 text-primary animate-pulse" />
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{current.label}</p>
          <div className="flex items-center gap-2 mt-1.5">
            {PHASES.slice(0, -1).map((p, i) => (
              <div key={p.id} className="flex items-center gap-1">
                <div className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
                  i < phase ? "bg-primary" : i === phase ? "bg-primary animate-pulse" : "bg-muted-foreground/30"
                }`} />
                <span className={`text-[10px] ${i <= phase ? "text-foreground/80" : "text-muted-foreground/50"}`}>
                  {p.label.replace("...", "")}
                </span>
              </div>
            ))}
          </div>
        </div>

        {!isDone && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1 rounded-full bg-border/50 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
