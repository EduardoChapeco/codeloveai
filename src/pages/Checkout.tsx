import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Check, ChevronDown, AlertTriangle, ArrowLeft, Loader2, Timer, Percent, Copy, QrCode, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const basePlans = [
  {
    id: "1_day", name: "1 DIA", price: 9.99, originalPrice: "R$29,97", period: "por dia",
    description: "Perfeito para testar a extensão antes de se comprometer.",
    features: ["Envios ilimitados por 24h", "Sem descontar créditos", "Ativação imediata", "Suporte via chat"],
  },
  {
    id: "7_days", name: "7 DIAS", price: 49.90, originalPrice: "R$149,70", period: "por semana",
    description: "Ideal para sprints rápidos ou projetos de curta duração.",
    features: ["Envios ilimitados por 7 dias", "Sem descontar créditos", "Ativação imediata", "Suporte prioritário"],
  },
  {
    id: "1_month", name: "1 MÊS", price: 149.90, originalPrice: "R$449,70", period: "por mês",
    description: "O plano mais escolhido. Ideal para projetos completos.",
    popular: true,
    features: ["Envios ilimitados por 30 dias", "Sem descontar créditos", "Tolerância de fim de semana*", "Suporte prioritário"],
  },
  {
    id: "12_months", name: "12 MESES", price: 499.00, originalPrice: "R$1.497,00", period: "por tempo indeterminado*",
    description: "Plano por tempo indeterminado até 12 meses. Acesso completo enquanto a extensão estiver ativa.",
    highlight: true,
    features: ["Acesso por tempo indeterminado (até 12 meses)", "Sem descontar créditos", "Tolerância de fim de semana*", "Suporte VIP dedicado"],
  },
];

const terms = [
  "Estamos vendendo acesso à extensão CodeLove AI, e não acesso à plataforma Lovable.",
  "A extensão NÃO é oficial e não possui nenhum vínculo com a Lovable.",
  "Não há reembolso caso a extensão pare de funcionar ou seja limitada, independentemente do tempo restante do plano.",
  "O cancelamento ou paralisação temporária do serviço não gera direito a indenização de qualquer natureza.",
  "O serviço é considerado entregue após o envio e ativação do token.",
  "O cliente assume total responsabilidade pela utilização de uma extensão não oficial, podendo ter projetos, contas bloqueados, suspensos ou excluídos a qualquer momento.",
  "Não nos responsabilizamos por quaisquer consequências do uso da extensão.",
  "O plano '12 Meses' oferece acesso por tempo indeterminado, com duração máxima de até 12 meses, enquanto a extensão estiver ativa. A descontinuação do serviço não gera reembolso.",
  "Nosso método é novo e utiliza a própria plataforma para se comunicar.",
  "Não utilizamos créditos da conta Lovable — todos os projetos, mensagens e planos criados/enviados não descontam créditos.",
];

const UNLIMITED_DEADLINE = new Date("2026-02-25T23:59:59-03:00").getTime();

function useCountdown(deadline: number) {
  const [timeLeft, setTimeLeft] = useState(() => {
    const diff = deadline - Date.now();
    return diff > 0 ? diff : 0;
  });

  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => {
      const diff = deadline - Date.now();
      setTimeLeft(diff > 0 ? diff : 0);
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline, timeLeft]);

  const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

  return { days, hours, minutes, seconds, expired: timeLeft <= 0 };
}

function formatBRL(value: number) {
  return `R$${value.toFixed(2).replace(".", ",")}`;
}

export default function Checkout() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedPlan = searchParams.get("plan");

  const [selectedPlan, setSelectedPlan] = useState<string | null>(preselectedPlan);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [step, setStep] = useState<"plan" | "terms" | "processing" | "pix">("plan");
  const countdown = useCountdown(UNLIMITED_DEADLINE);
  const [pixData, setPixData] = useState<{ pix_code: string; pix_qr_base64?: string; ticket_url?: string; payment_id?: string } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"redirect" | "pix">("pix");

  // Affiliate discount state
  const [affiliateDiscount, setAffiliateDiscount] = useState(0);
  const [loadingDiscount, setLoadingDiscount] = useState(true);

  // Check if user is an affiliate and get their discount
  useEffect(() => {
    if (!user) { setLoadingDiscount(false); return; }
    const checkAffiliate = async () => {
      try {
        const { data } = await supabase
          .from("affiliates")
          .select("discount_percent")
          .eq("user_id", user.id)
          .maybeSingle();
        if (data) setAffiliateDiscount(data.discount_percent);
      } catch {}
      finally { setLoadingDiscount(false); }
    };
    checkAffiliate();
  }, [user]);

  // Build plans with discount applied
  const plans = basePlans.map(p => ({
    ...p,
    discountedPrice: affiliateDiscount > 0
      ? Math.round(p.price * (1 - affiliateDiscount / 100) * 100) / 100
      : p.price,
  }));

  useEffect(() => {
    if (!authLoading && !user) {
      const returnPath = selectedPlan ? `/checkout?plan=${selectedPlan}` : "/checkout";
      navigate(`/login?returnTo=${encodeURIComponent(returnPath)}`);
    }
  }, [user, authLoading, navigate, selectedPlan]);

  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId);
    setStep("terms");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCopyPix = () => {
    if (!pixData?.pix_code) return;
    navigator.clipboard.writeText(pixData.pix_code).then(() => {
      toast.success("Chave PIX copiada!");
    }).catch(() => {
      toast.error("Erro ao copiar. Copie manualmente.");
    });
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
        body: { plan: selectedPlan, payment_method: paymentMethod },
      });

      console.log("Checkout response:", { data, error });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        setStep("terms");
        return;
      }

      if (paymentMethod === "pix" && data?.pix_code) {
        setPixData({
          pix_code: data.pix_code,
          pix_qr_base64: data.pix_qr_base64,
          ticket_url: data.ticket_url,
          payment_id: data.payment_id,
        });
        setStep("pix");
      } else if (paymentMethod === "pix" && data?.ticket_url) {
        window.location.href = data.ticket_url;
      } else if (data?.init_point) {
        window.location.href = data.init_point;
      } else {
        console.error("Unexpected checkout response:", data);
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

  if (authLoading || loadingDiscount) {
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
              <span className={`ep-badge ${step === s.key || (step === "pix" && s.key === "processing") ? "ep-badge-live" : "ep-badge-offline"}`}>
                {s.label}
              </span>
              {i < 2 && <ChevronDown className="h-3 w-3 text-muted-foreground -rotate-90" />}
            </div>
          ))}
        </div>

        {/* Affiliate discount banner */}
        {affiliateDiscount > 0 && step === "plan" && (
          <div className="ep-card-sm border-green-500/30 bg-green-500/10 flex items-center gap-3 mb-8">
            <Percent className="h-5 w-5 text-green-500 shrink-0" />
            <div>
              <p className="text-xs font-bold text-foreground tracking-widest">DESCONTO DE AFILIADO — {affiliateDiscount}% OFF</p>
              <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                Como afiliado, seu desconto de {affiliateDiscount}% é aplicado automaticamente em todos os planos.
              </p>
            </div>
          </div>
        )}

        {/* Step 1: Plan selection */}
        {step === "plan" && (
          <div>
            <p className="ep-subtitle text-center mb-4">ESCOLHA SEU PLANO</p>
            <h1 className="ep-section-title text-center mb-4">PLANOS E PREÇOS</h1>
            
            {/* Limited time banner */}
            <div className="ep-card-sm border-foreground/20 bg-foreground/5 text-center mb-12">
              <p className="text-xs font-bold text-foreground tracking-widest mb-1">⏰ PREÇOS POR TEMPO LIMITADO</p>
              <p className="text-[11px] text-muted-foreground font-medium">
                Aproveite os preços promocionais de lançamento.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {plans.filter(p => !(p.highlight && countdown.expired)).map((plan) => (
                <div
                  key={plan.id}
                  className={`ep-card-interactive flex flex-col justify-between cursor-pointer transition-all ${
                    plan.popular ? "ep-card-active" : ""
                  } ${selectedPlan === plan.id ? "ring-2 ring-foreground" : ""}`}
                  onClick={() => handleSelectPlan(plan.id)}
                >
                  <div className="flex flex-col h-full">
                    {/* Badge */}
                    <div className="min-h-[32px] mb-4 flex gap-2">
                      {plan.popular && (
                        <span className="ep-badge ep-badge-live inline-block">POPULAR</span>
                      )}
                      {plan.highlight && !countdown.expired && (
                        <span className="ep-badge ep-badge-live inline-block">MELHOR CUSTO</span>
                      )}
                      {affiliateDiscount > 0 && (
                        <span className="ep-badge inline-block bg-green-500/20 text-green-500 border-green-500/30">
                          -{affiliateDiscount}%
                        </span>
                      )}
                    </div>

                    {/* Countdown for highlight plan */}
                    {plan.highlight && !countdown.expired && (
                      <div className="bg-foreground/5 border border-foreground/20 rounded-[10px] p-3 mb-4">
                        <div className="flex items-center gap-1.5 justify-center mb-2">
                          <Timer className="h-3.5 w-3.5 text-foreground" />
                          <span className="text-[9px] font-bold text-foreground tracking-widest">OFERTA ENCERRA EM</span>
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          {[
                            { value: countdown.days, label: "D" },
                            { value: countdown.hours, label: "H" },
                            { value: countdown.minutes, label: "M" },
                            { value: countdown.seconds, label: "S" },
                          ].map((t, i) => (
                            <div key={i} className="flex items-baseline gap-0.5">
                              <span className="text-lg font-black text-foreground tabular-nums">{String(t.value).padStart(2, "0")}</span>
                              <span className="text-[8px] font-bold text-muted-foreground">{t.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Price block */}
                    <p className="ep-subtitle mb-2">{plan.name}</p>
                    <p className="text-sm text-muted-foreground line-through font-medium">{plan.originalPrice}</p>
                    {affiliateDiscount > 0 ? (
                      <div className="flex items-baseline gap-2">
                        <p className="text-sm text-muted-foreground line-through font-medium">{formatBRL(plan.price)}</p>
                        <p className="ep-value text-3xl text-green-500">{formatBRL(plan.discountedPrice)}</p>
                      </div>
                    ) : (
                      <p className="ep-value text-3xl mb-1">{formatBRL(plan.price)}</p>
                    )}
                    <p className="text-xs text-muted-foreground font-medium mb-4">{plan.period}</p>

                    {/* Description */}
                    <p className="text-sm text-muted-foreground font-medium mb-6">{plan.description}</p>

                    {/* Features */}
                    <ul className="space-y-2 flex-1">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground font-medium">
                          <Check className="h-4 w-4 text-foreground shrink-0 mt-0.5" />
                          <span>{f}</span>
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

            {/* Weekend grace note */}
            <div className="mt-6 text-center">
              <p className="text-[10px] text-muted-foreground font-medium italic">
                *Tolerância de fim de semana: se seu plano expirar no sábado ou domingo, o acesso é estendido automaticamente até segunda-feira.
              </p>
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
              <div className="text-right">
                {affiliateDiscount > 0 ? (
                  <div>
                    <p className="text-xs text-muted-foreground line-through">{formatBRL(selectedPlanData.price)}</p>
                    <p className="ep-value text-2xl text-green-500">{formatBRL(selectedPlanData.discountedPrice)}</p>
                    <p className="text-[9px] font-bold text-green-500">-{affiliateDiscount}% AFILIADO</p>
                  </div>
                ) : (
                  <p className="ep-value text-2xl">{formatBRL(selectedPlanData.price)}</p>
                )}
              </div>
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

            {/* Payment method selector */}
            <div className="mt-8">
              <p className="ep-label text-xs mb-3">MÉTODO DE PAGAMENTO</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPaymentMethod("pix")}
                  className={`flex items-center gap-2 justify-center p-3 rounded-lg border transition-all text-sm font-bold ${
                    paymentMethod === "pix"
                      ? "border-foreground bg-foreground/10 text-foreground"
                      : "border-border text-muted-foreground hover:border-foreground/50"
                  }`}
                >
                  <QrCode className="h-4 w-4" />
                  PIX
                </button>
                <button
                  onClick={() => setPaymentMethod("redirect")}
                  className={`flex items-center gap-2 justify-center p-3 rounded-lg border transition-all text-sm font-bold ${
                    paymentMethod === "redirect"
                      ? "border-foreground bg-foreground/10 text-foreground"
                      : "border-border text-muted-foreground hover:border-foreground/50"
                  }`}
                >
                  <CreditCard className="h-4 w-4" />
                  CARTÃO / OUTROS
                </button>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
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
                {loadingCheckout ? "PROCESSANDO..." : paymentMethod === "pix" ? "GERAR PIX" : "CONFIRMAR E PAGAR"}
              </button>
            </div>

            <div className="mt-6">
              <div className="ep-card-sm flex items-start gap-4">
                <AlertTriangle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground font-medium">
                  <strong className="text-foreground">Importante:</strong>{" "}
                  {paymentMethod === "pix"
                    ? "Ao confirmar, será gerado um código PIX para pagamento. O acesso é ativado automaticamente após a confirmação."
                    : "Ao confirmar, você será redirecionado para o Mercado Pago para completar o pagamento de forma segura."}
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

        {/* Step 4: PIX Display */}
        {step === "pix" && pixData && selectedPlanData && (
          <div>
            <p className="ep-subtitle text-center mb-4">PAGAMENTO VIA PIX</p>
            <h1 className="ep-section-title text-center mb-8">ESCANEIE OU COPIE O CÓDIGO</h1>

            {/* Plan summary */}
            <div className="ep-card-sm flex items-center justify-between mb-8">
              <div>
                <p className="text-sm font-bold text-foreground">{selectedPlanData.name}</p>
                <p className="text-xs text-muted-foreground">{selectedPlanData.description}</p>
              </div>
              <div className="text-right">
                {affiliateDiscount > 0 ? (
                  <p className="ep-value text-2xl text-green-500">{formatBRL(selectedPlanData.discountedPrice)}</p>
                ) : (
                  <p className="ep-value text-2xl">{formatBRL(selectedPlanData.price)}</p>
                )}
              </div>
            </div>

            {/* QR Code */}
            {pixData.pix_qr_base64 && (
              <div className="flex justify-center mb-8">
                <div className="bg-white p-4 rounded-xl">
                  <img
                    src={`data:image/png;base64,${pixData.pix_qr_base64}`}
                    alt="QR Code PIX"
                    className="w-64 h-64"
                  />
                </div>
              </div>
            )}

            {/* PIX Copy-Paste */}
            <div className="ep-card">
              <p className="ep-label text-xs mb-3">CÓDIGO PIX (COPIA E COLA)</p>
              <div className="bg-muted/50 rounded-lg p-4 break-all text-xs text-muted-foreground font-mono mb-4 max-h-32 overflow-y-auto">
                {pixData.pix_code}
              </div>
              <button
                onClick={handleCopyPix}
                className="ep-btn-primary w-full flex items-center justify-center gap-2"
              >
                <Copy className="h-4 w-4" />
                COPIAR CÓDIGO PIX
              </button>
            </div>

            <div className="mt-6 ep-card-sm flex items-start gap-4">
              <AlertTriangle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground font-medium">
                  <strong className="text-foreground">Ativação automática:</strong> Após o pagamento ser confirmado,
                  seu acesso será ativado automaticamente. Isso pode levar alguns minutos.
                </p>
              </div>
            </div>

            {pixData.ticket_url && (
              <div className="mt-4 text-center">
                <a
                  href={pixData.ticket_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground underline hover:text-foreground transition-colors"
                >
                  Abrir página de pagamento do Mercado Pago →
                </a>
              </div>
            )}

            <div className="mt-6 flex justify-center">
              <button
                onClick={() => { setStep("terms"); setPixData(null); }}
                className="ep-btn-secondary h-10 px-6 text-[9px] flex items-center gap-2"
              >
                <ArrowLeft className="h-3 w-3" />
                VOLTAR
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
