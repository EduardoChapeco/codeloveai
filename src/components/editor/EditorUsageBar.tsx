import { EditorPlan } from "@/hooks/useEditorUsage";
import { Crown, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  messagesUsed: number;
  messagesLimit: number;
  plan: EditorPlan;
  percentUsed: number;
  canSend: boolean;
  isDailyReset?: boolean;
}

const PLAN_LABELS: Record<EditorPlan, string> = {
  free: "Grátis",
  daily: "Diário Ilimitado",
  pro: "Mensal Ilimitado",
  venus: "Venus",
};

export default function EditorUsageBar({ messagesUsed, messagesLimit, plan, percentUsed, canSend, isDailyReset }: Props) {
  const navigate = useNavigate();
  const isExhausted = !canSend;

  if (plan === "venus") return null;

  return (
    <div className="px-3 py-2 space-y-2">
      <div
        className="rounded-2xl p-3 space-y-2.5"
        style={{
          background: "var(--liquid-glass-bg, rgba(255,255,255,0.04))",
          backdropFilter: "blur(20px) engiosate(180%)",
          WebkitBackdropFilter: "blur(20px) engiosate(180%)",
          border: "0.5px solid var(--clf-border)",
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Uso do Editor • {isDailyReset ? "Hoje" : "Este mês"}
          </span>
          <span className={`text-[11px] font-bold tabular-nums ${isExhausted ? "text-destructive" : "text-foreground"}`}>
            {messagesUsed}/{messagesLimit}
          </span>
        </div>

        <div className="h-1.5 rounded-full bg-border/30 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${percentUsed}%`,
              background: isExhausted
                ? "hsl(var(--destructive))"
                : percentUsed > 70
                  ? "var(--clf-warn)"
                  : "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))",
              boxShadow: isExhausted ? "none" : "0 0 6px hsl(var(--primary) / 0.2)",
            }}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground/50">
            Plano {PLAN_LABELS[plan]}
            {plan === "free" && " • 10/dia"}
            {plan === "daily" && " • Ilimitado/dia"}
            {plan === "pro" && " • Ilimitado/mês"}
          </span>
          {isExhausted && (
            <span className="text-[10px] text-destructive font-semibold">Limite atingido</span>
          )}
        </div>
      </div>

      {(isExhausted || percentUsed >= 80) && (
        <button
          onClick={() => navigate("/plans")}
          className="w-full rounded-2xl p-3.5 flex items-center gap-3 hover:scale-[1.02] transition-all active:scale-[0.98]"
          style={{
            background: "var(--liquid-glass-bg, rgba(255,255,255,0.04))",
            backdropFilter: "blur(20px) engiosate(180%)",
            WebkitBackdropFilter: "blur(20px) engiosate(180%)",
            border: "0.5px solid var(--clf-border)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(263,60%,55%)] flex items-center justify-center shrink-0 shadow-lg">
            <Crown className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="text-left flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-foreground">
              {isExhausted ? "Desbloqueie mais edições" : "Quase no limite"}
            </p>
            <p className="text-[10px] text-muted-foreground/50 truncate">
              Diário → R$19,90 • Mensal → R$149,90
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-primary shrink-0" />
        </button>
      )}
    </div>
  );
}
