import { EditorPlan } from "@/hooks/useEditorUsage";
import { Crown, Zap, ArrowRight } from "lucide-react";
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
  daily: "Diário",
  pro: "Pro",
  venus: "Venus",
};

export default function EditorUsageBar({ messagesUsed, messagesLimit, plan, percentUsed, canSend, isDailyReset }: Props) {
  const navigate = useNavigate();
  const isExhausted = !canSend;

  // Venus plan = unlimited, hide bar
  if (plan === "venus") return null;

  return (
    <div className="px-3 py-2 space-y-2">
      {/* Usage bar */}
      <div className="clf-glass-sm rounded-2xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="lv-overline">
            Uso do Editor • {isDailyReset ? "Hoje" : "Este mês"}
          </span>
          <span className={`text-[11px] font-bold tabular-nums ${isExhausted ? "text-destructive" : "text-foreground"}`}>
            {messagesUsed}/{messagesLimit}
          </span>
        </div>

        <div className="h-1.5 rounded-full bg-border/50 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isExhausted
                ? "bg-destructive"
                : percentUsed > 70
                  ? "bg-[var(--clf-warn)]"
                  : "bg-primary"
            }`}
            style={{ width: `${percentUsed}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="lv-caption">
            Plano {PLAN_LABELS[plan]}
            {plan === "free" && " • 10/dia"}
            {plan === "daily" && " • 20/dia"}
            {plan === "pro" && " • 50/mês"}
          </span>
          {isExhausted && (
            <span className="text-[10px] text-destructive font-semibold">
              Limite atingido
            </span>
          )}
        </div>
      </div>

      {/* Upgrade CTA when exhausted or close to limit */}
      {(isExhausted || percentUsed >= 80) && (
        <button
          onClick={() => navigate("/planos")}
          className="w-full clf-liquid-glass p-3.5 flex items-center gap-3 hover:scale-[1.02] transition-transform active:scale-[0.98]"
        >
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(263,60%,55%)] flex items-center justify-center shrink-0 shadow-lg">
            <Crown className="h-4.5 w-4.5 text-primary-foreground" />
          </div>
          <div className="text-left flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-foreground">
              {isExhausted ? "Desbloqueie mais edições" : "Quase no limite"}
            </p>
            <p className="lv-caption truncate">
              Venus → Ilimitado • Pro → 50/mês • Diário → 20/dia
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-primary shrink-0" />
        </button>
      )}
    </div>
  );
}
