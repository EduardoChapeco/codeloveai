import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Check, ChevronDown, AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const plans = [
  { id: "1_day", name: "1 DIA", price: "R$9,99", period: "por dia", description: "Teste rápido" },
  { id: "7_days", name: "7 DIAS", price: "R$49,90", period: "por semana", description: "Ideal para projetos curtos" },
  { id: "1_month", name: "1 MÊS", price: "R$149,90", period: "por mês", description: "Mais popular", popular: true },
  { id: "12_months", name: "12 MESES", price: "R$499,00", period: "ilimitado*", description: "Acesso enquanto ativo", highlight: true },
];

const terms = [
  "Estamos vendendo acesso à extensão CodeLove AI, e não acesso à plataforma Lovable.",
  "A extensão NÃO é oficial e não possui nenhum vínculo com a Lovable.",
  "Não há reembolso caso a extensão pare de funcionar ou seja limitada, independentemente do tempo restante do plano.",
  "O cancelamento ou paralisação temporária do serviço não gera direito a indenização de qualquer natureza.",
  "O serviço é considerado entregue após o envio e ativação do token.",
  "O cliente assume total responsabilidade pela utilização de uma extensão não oficial, podendo ter projetos, contas bloqueados, suspensos ou excluídos a qualquer momento.",
  "Não nos responsabilizamos por quaisquer consequências do uso da extensão.",
  "O plano '12 Meses — Ilimitado' refere-se ao acesso enquanto a extensão estiver ativa. A descontinuação do serviço não gera reembolso.",
  "Nosso método é novo e utiliza a própria plataforma para se comunicar.",
  "Não utilizamos créditos da conta Lovable — todos os projetos, mensagens e planos criados/enviados não descontam créditos.",
];

export default function Checkout() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedPlan = searchParams.get("plan");

  const [selectedPlan, setSelectedPlan] = useState<string | null>(preselectedPlan);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [step, setStep] = useState<"plan" | "terms" | "processing">("plan");

  // If not logged in, redirect to login with returnTo
  useEffect(() => {
    if (!authLoading && !user) {
      const returnPath = selectedPlan
        ? `/checkout?plan=${selectedPlan}`
        : "/checkout";
      navigate(`/login?returnTo=${encodeURIComponent(returnPath)}`);
    }
  }, [user, authLoading, navigate, selectedPlan]);

  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId);
    setStep("terms");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleConfirmAndPay = async () => {
    if (!selectedPlan) return;
    if (!agreedTerms) {
      toast.error("Você precisa concordar com os termos de uso.");
      return;
    }

    setLoadingCheckout(true);
    setStep("processing");

    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { plan: selectedPlan },
      });

      if (error) throw error;
      if (data?.init_point) {
        window.location.href = data.init_point;
      } else {
        toast.error("Erro ao criar checkout. Tente novamente.");
        setStep("terms");
      }
    } catch (err: any) {
      console.error("Checkout error:", err);
      toast.error("Erro ao processar pagamento. Tente novamente.");
      setStep("terms");
    } finally {
      setLoadingCheckout(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return null;

  const selectedPlanData = plans.find((p) => p.id === selectedPlan);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-20 bg-background border-b border-border px-8 py-5 flex items-center justify-between">
        <Link to="/" className="ep-label text-sm tracking-[0.3em]">CODELOVE AI</Link>
        <button
          onClick={() => {
            if (step === "terms") { setStep("plan"); setAgreedTerms(false); }
            else navigate("/");
          }}
          className="ep-btn-secondary h-10 px-6 text-[9px] flex items-center gap-2"
        >
          <ArrowLeft className="h-3 w-3" />
          VOLTAR
        </button>
      </nav>

      <div className="max-w-4xl mx-auto px-8 py-12">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-4 mb-12">
          {[
            { key: "plan", label: "1. PLANO" },
            { key: "terms", label: "2. TERMOS" },
            { key: "processing", label: "3. PAGAMENTO" },
          ].map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <span
                className={`ep-badge ${
                  step === s.key ? "ep-badge-live" : "ep-badge-offline"
                }`}
              >
                {s.label}
              </span>
              {i < 2 && <ChevronDown className="h-3 w-3 text-muted-foreground -rotate-90" />}
            </div>
          ))}
        </div>

        {/* Step 1: Plan selection */}
        {step === "plan" && (
          <div>
            <p className="ep-subtitle text-center mb-4">ESCOLHA SEU PLANO</p>
            <h1 className="ep-section-title text-center mb-12">PLANOS E PREÇOS</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`ep-card-interactive flex flex-col justify-between cursor-pointer transition-all ${
                    plan.popular ? "ep-card-active" : ""
                  } ${selectedPlan === plan.id ? "ring-2 ring-foreground" : ""}`}
                  onClick={() => handleSelectPlan(plan.id)}
                >
                  <div>
                    {plan.popular && (
                      <span className="ep-badge ep-badge-live mb-4 inline-block">POPULAR</span>
                    )}
                    {plan.highlight && (
                      <span className="ep-badge ep-badge-live mb-4 inline-block">MELHOR CUSTO</span>
                    )}
                    <p className="ep-subtitle mb-2">{plan.name}</p>
                    <p className="ep-value text-3xl mb-1">{plan.price}</p>
                    <p className="text-xs text-muted-foreground font-medium mb-2">{plan.period}</p>
                    {plan.highlight && (
                      <p className="text-[10px] text-muted-foreground font-medium italic">
                        *Acesso válido enquanto a extensão estiver ativa
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground font-medium mt-4">{plan.description}</p>
                    <ul className="space-y-2 mt-4">
                      {["Envios ilimitados", "Sem descontar créditos", "Suporte via chat", "Ativação imediata"].map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                          <Check className="h-4 w-4 text-foreground" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button
                    className={`w-full mt-6 ${plan.popular || plan.highlight ? "ep-btn-primary" : "ep-btn-secondary"}`}
                    onClick={(e) => { e.stopPropagation(); handleSelectPlan(plan.id); }}
                  >
                    SELECIONAR
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Terms */}
        {step === "terms" && selectedPlanData && (
          <div>
            <p className="ep-subtitle text-center mb-4">ACEITE OS TERMOS</p>
            <h1 className="ep-section-title text-center mb-8">TERMOS DE USO</h1>

            {/* Selected plan summary */}
            <div className="ep-card-sm flex items-center justify-between mb-8">
              <div>
                <p className="text-sm font-bold text-foreground">Plano selecionado: {selectedPlanData.name}</p>
                <p className="text-xs text-muted-foreground">{selectedPlanData.description}</p>
              </div>
              <p className="ep-value text-2xl">{selectedPlanData.price}</p>
            </div>

            <div className="ep-card space-y-4">
              {terms.map((term, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="ep-label mt-1 shrink-0">{String(i + 1).padStart(2, "0")}.</span>
                  <p className="text-sm text-muted-foreground font-medium">{term}</p>
                </div>
              ))}

              <div className="pt-8 border-t border-border">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedTerms}
                    onChange={(e) => setAgreedTerms(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded-[4px] border border-border accent-foreground"
                  />
                  <span className="text-sm font-bold text-foreground">
                    Li e concordo com todos os termos acima. Entendo que a extensão não é oficial, que o cancelamento
                    ou paralisação não gera indenização, e assumo total responsabilidade pela sua utilização.
                  </span>
                </label>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between">
              <button
                onClick={() => { setStep("plan"); setAgreedTerms(false); }}
                className="ep-btn-secondary h-12 px-8 text-[9px]"
              >
                TROCAR PLANO
              </button>
              <button
                onClick={handleConfirmAndPay}
                disabled={!agreedTerms || loadingCheckout}
                className="ep-btn-primary h-12 px-8 text-[9px]"
              >
                {loadingCheckout ? "PROCESSANDO..." : "CONFIRMAR E PAGAR"}
              </button>
            </div>

            <div className="mt-6">
              <div className="ep-card-sm flex items-start gap-4">
                <AlertTriangle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground font-medium">
                  <strong className="text-foreground">Importante:</strong> Ao confirmar, você será redirecionado para
                  o Mercado Pago para completar o pagamento de forma segura.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Processing */}
        {step === "processing" && (
          <div className="text-center py-20">
            <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mx-auto mb-6" />
            <p className="ep-subtitle mb-2">PROCESSANDO</p>
            <p className="text-sm text-muted-foreground font-medium">
              Redirecionando para o pagamento...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
