import { useEffect, useState, useRef } from "react";
import { Check, Code2, Sparkles, Loader2, Eye, Cpu } from "lucide-react";

type Phase = "thinking" | "editing" | "reviewing" | "processing" | "done";

interface Props {
  active: boolean;
  confirmed?: boolean; // true when update.md confirms completion
  onComplete?: () => void;
}

const PHASES: { id: Phase; label: string; sub: string; icon: typeof Sparkles; duration: number }[] = [
  { id: "thinking", label: "Pensando", sub: "Analisando sua instrução...", icon: Sparkles, duration: 4000 },
  { id: "editing", label: "Editando", sub: "Aplicando alterações no código...", icon: Code2, duration: 10000 },
  { id: "reviewing", label: "Revisando", sub: "Verificando integridade...", icon: Eye, duration: 6000 },
  { id: "processing", label: "Processando", sub: "Aguardando confirmação do projeto...", icon: Cpu, duration: 0 }, // waits for confirmed prop
  { id: "done", label: "Concluído", sub: "Alterações aplicadas!", icon: Check, duration: 0 },
];

export default function EditorStatusCard({ active, confirmed, onComplete }: Props) {
  const [phase, setPhase] = useState(0);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef(false);

  // Reset on deactivation
  useEffect(() => {
    if (!active) {
      setPhase(0);
      setProgress(0);
      completedRef.current = false;
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    }
  }, [active]);

  // Timed phases (0-2): auto-advance through thinking → editing → reviewing
  useEffect(() => {
    if (!active) return;
    if (intervalRef.current) clearInterval(intervalRef.current);

    let currentPhase = 0;
    let elapsed = 0;
    const tick = 80;

    intervalRef.current = setInterval(() => {
      const p = PHASES[currentPhase];

      // Stop at "processing" (index 3) — wait for confirmed
      if (p.id === "processing" || p.id === "done") {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
        return;
      }

      elapsed += tick;
      const dur = p.duration;
      const phaseProgress = Math.min(elapsed / dur, 1);
      // Progress: 0-75% across first 3 timed phases
      const totalProgress = ((currentPhase + phaseProgress) / 4) * 75;
      setProgress(totalProgress);

      if (elapsed >= dur) {
        currentPhase++;
        setPhase(currentPhase);
        elapsed = 0;
      }
    }, tick);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [active]);

  // When confirmed=true, advance from "processing" to "done"
  useEffect(() => {
    if (confirmed && phase >= 3 && !completedRef.current) {
      completedRef.current = true;
      // Animate to 100%
      setProgress(90);
      setTimeout(() => {
        setProgress(100);
        setPhase(4); // done
        setTimeout(() => onComplete?.(), 600);
      }, 400);
    }
  }, [confirmed, phase, onComplete]);

  if (!active && phase === 0) return null;

  const current = PHASES[phase] || PHASES[PHASES.length - 1];
  const isDone = current.id === "done";
  const isProcessing = current.id === "processing";

  return (
    <div className="animate-fade-in" style={{ marginTop: "0.75rem" }}>
      <div
        className="rounded-3xl p-5"
        style={{
          background: "var(--liquid-glass-bg, rgba(255,255,255,0.04))",
          backdropFilter: "blur(40px) saturate(200%)",
          WebkitBackdropFilter: "blur(40px) saturate(200%)",
          border: "0.5px solid var(--clf-border)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.12)",
        }}
      >
        {/* Vertical stacked phases */}
        <div className="space-y-1">
          {PHASES.map((p, i) => {
            const Icon = p.icon;
            const isActive = i === phase;
            const isPast = i < phase;
            const isFuture = i > phase;

            if (p.id === "done" && !isDone) return null;

            return (
              <div
                key={p.id}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition-all duration-500 ${
                  isDone && p.id === "done"
                    ? "bg-primary/10 border border-primary/25"
                    : isActive
                      ? "bg-primary/8 border border-primary/15"
                      : isPast
                        ? "opacity-60"
                        : isFuture
                          ? "opacity-25"
                          : ""
                }`}
              >
                {/* Circle indicator */}
                <div className="relative shrink-0">
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center transition-all duration-500 ${
                    isDone && p.id === "done"
                      ? "bg-primary/20"
                      : isPast
                        ? "bg-primary/15"
                        : isActive
                          ? "bg-primary/10"
                          : "bg-foreground/5"
                  }`}>
                    {isPast ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : isActive && !isDone ? (
                      <Loader2 className="h-4 w-4 text-primary animate-spin" />
                    ) : isDone && p.id === "done" ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <Icon className={`h-4 w-4 ${isFuture ? "text-muted-foreground/30" : "text-primary"}`} />
                    )}
                  </div>
                  {/* Vertical connector line */}
                  {i < PHASES.length - 1 && !(p.id === "done") && (
                    <div className={`absolute left-1/2 -translate-x-1/2 top-full w-px h-1 transition-colors duration-500 ${
                      isPast ? "bg-primary/30" : "bg-border/20"
                    }`} />
                  )}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] font-bold transition-colors duration-300 ${
                    isActive || (isDone && p.id === "done") ? "text-foreground" : isPast ? "text-foreground/60" : "text-muted-foreground/40"
                  }`}>
                    {p.label}
                  </p>
                  <p className={`text-[11px] transition-colors duration-300 ${
                    isActive || (isDone && p.id === "done") ? "text-muted-foreground" : "text-muted-foreground/30"
                  }`}>
                    {isProcessing ? "Aguardando atualização do projeto..." : p.sub}
                  </p>
                </div>

                {/* Status badge */}
                {isPast && (
                  <span className="text-[9px] font-semibold text-primary/60 uppercase tracking-wider">OK</span>
                )}
                {isActive && !isDone && (
                  <span className="flex items-center gap-1 text-[9px] font-semibold text-primary uppercase tracking-wider">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    {isProcessing ? "Sync" : "Ativo"}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="h-1 rounded-full bg-border/20 overflow-hidden mt-4">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${progress}%`,
              background: isDone
                ? "hsl(var(--primary))"
                : "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.6))",
              boxShadow: "0 0 8px hsl(var(--primary) / 0.3)",
            }}
          />
        </div>

        {isProcessing && (
          <p className="text-[10px] text-muted-foreground/50 mt-2 text-center">
            O projeto será atualizado automaticamente ao concluir
          </p>
        )}
      </div>
    </div>
  );
}
