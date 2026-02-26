import { EditorPlan } from "@/hooks/useEditorUsage";
import { Crown, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  messagesUsed: number;
  messagesLimit: number;
  plan: EditorPlan;
  percentUsed: number;
  canSend: boolean;
}

const PLAN_LABELS: Record<EditorPlan, string> = {
  free: "Grátis",
  daily: "Diário",
  pro: "Pro",
  venus: "Venus",
};

const PLAN_COLORS: Record<EditorPlan, string> = {
  free: "bg-muted-foreground/60",
  daily: "bg-primary",
  pro: "bg-primary",
  venus: "bg-gradient-to-r from-purple-500 to-primary",
};

export default function EditorUsageBar({ messagesUsed, messagesLimit, plan, percentUsed, canSend }: Props) {
  const navigate = useNavigate();
  const isLimited = plan !== "venus";
  const isExhausted = !canSend;

  if (!isLimited) return null;

  return (
    <div className="px-3 py-2 space-y-2">
      {/* Usage bar */}
      <div className="clf-glass-sm rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Uso do Editor
          </span>
          <span className={`text-[10px] font-bold tabular-nums ${isExhausted ? "text-destructive" : "text-foreground"}`}>
            {messagesUsed}/{messagesLimit}
          </span>
        </div>

        <div className="h-1.5 rounded-full bg-border/50 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isExhausted ? "bg-destructive" : percentUsed > 70 ? "bg-amber-500" : PLAN_COLORS[plan]
            }`}
            style={{ width: `${percentUsed}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            Plano {PLAN_LABELS[plan]}
          </span>
          {isExhausted && (
            <span className="text-[10px] text-destructive font-medium">
              Limite atingido
            </span>
          )}
        </div>
      </div>

      {/* Upgrade CTA when exhausted */}
      {isExhausted && (
        <button
          onClick={() => navigate("/planos")}
          className="w-full clf-liquid-glass p-3 flex items-center gap-3 hover:scale-[1.02] transition-transform"
        >
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-purple-500 to-primary flex items-center justify-center shrink-0">
            <Crown className="h-4 w-4 text-white" />
          </div>
          <div className="text-left flex-1">
            <p className="text-xs font-semibold text-foreground">Desbloqueie edição ilimitada</p>
            <p className="text-[10px] text-muted-foreground">Venus • Edições ilimitadas + Star AI</p>
          </div>
          <Zap className="h-4 w-4 text-primary shrink-0" />
        </button>
      )}
    </div>
  );
}
