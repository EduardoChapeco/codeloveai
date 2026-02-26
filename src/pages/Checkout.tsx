import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Check, ChevronDown, AlertTriangle, ArrowLeft, Loader2, Timer, Percent, Copy, QrCode, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSEO } from "@/hooks/useSEO";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";

interface Plan {
  id: string;
  name: string;
  price: number;
  originalPrice: string;
  period: string;
  description: string;
  features: string[];
  popular?: boolean;
  highlight?: boolean;
  discountedPrice?: number;
}

// No hardcoded fallback — all plans are fetched from DB
const fallbackPlans: Plan[] = [];

const defaultTerms = [
  "Estamos vendendo acesso à extensão, e não acesso à plataforma Lovable.",
  "A extensão NÃO é oficial e não possui nenhum vínculo com a Lovable.",
  "Não há reembolso em nenhuma hipótese — o serviço é considerado CONCLUÍDO e ENTREGUE a partir do momento da ativação do token.",
  "O cancelamento ou paralisação temporária do serviço não gera direito a indenização de qualquer natureza.",
  "O cliente assume total responsabilidade pela utilização de uma extensão não oficial, estando ciente de que contas, projetos e dados podem ser bloqueados, suspensos ou excluídos pela Lovable a qualquer momento.",
  "Não nos responsabilizamos por quaisquer consequências do uso da extensão, incluindo mas não se limitando a perda de dados, bloqueio de conta ou suspensão de serviços.",
  "A ativação da extensão será registrada com dados do dispositivo, IP e localização para fins de comprovação de entrega do serviço.",
  "Nosso método é não oficial e utiliza a própria plataforma para se comunicar. Por ser não oficial, está sob risco constante de suspensão.",
  "O Lovable pode cobrar créditos em alguns casos durante o uso da extensão. Recomendamos monitorar seu saldo de créditos na plataforma Lovable.",
  "Ao ativar a extensão, o cliente reconhece que o serviço foi entregue e declara ciência de todos os riscos envolvidos.",
];

// Promotional deadline — update or remove when promotion ends
const UNLIMITED_DEADLINE = new Date("2026-04-15T23:59:59-03:00").getTime();

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

function formatBRL(value: number | undefined) {
  return `R$${(value ?? 0).toFixed(2).replace(".", ",")}`;
}

// Billing cycle label map
const billingCycleLabels: Record<string, string> = {
  daily: "por dia", weekly: "por semana", monthly: "por mês",
};

export default function Checkout() {
  const { user, loading: authLoading } = useAuth();
  const { tenant } = useTenant();
  const brandName = tenant?.name || "Starble";
  useSEO({ title: "Checkout", description: `Escolha seu plano ${brandName} e comece a usar envios ilimitados.` });
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

  const [affiliateDiscount, setAffiliateDiscount] = useState(0);
  const [loadingDiscount, setLoadingDiscount] = useState(true);
  const [dbPlans, setDbPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  // Fetch plans from DB
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const { data } = await supabase
          .from("plans")
          .select("id, name, type, price, billing_cycle, description, features, highlight_label, display_order, is_public, is_active")
          .eq("is_public", true)
          .eq("is_active", true)
          .neq("type", "trial")
          .order("display_order", { ascending: true });
        if (data && data.length > 0) {
          // Filter out White Label plan — not purchasable via checkout
          const filtered = data.filter((p: any) => (p.price as number) < 20000);
          setDbPlans(filtered.map((p: Record<string, unknown>) => ({
            id: p.id as string,
            name: p.name as string,
            price: (p.price as number) / 100,
            originalPrice: "",
            period: billingCycleLabels[(p.billing_cycle as string)] || (p.billing_cycle as string),
            description: (p.description as string) || "",
            features: Array.isArray(p.features) ? (p.features as string[]) : [],
            popular: (p.highlight_label as string)?.toLowerCase() === "popular",
            highlight: !!(p.highlight_label) && (p.highlight_label as string)?.toLowerCase() !== "popular",
          })));
        }
      } catch (err) { console.error("Error fetching plans:", err); } finally { setLoadingPlans(false); }
    };
    fetchPlans();
  }, []);

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
      } catch (err) { console.error("Error fetching affiliate discount:", err); }
      finally { setLoadingDiscount(false); }
    };
    checkAffiliate();
  }, [user]);

  // Use DB plans if available, otherwise fallback
  const basePlans = dbPlans.length > 0 ? dbPlans : fallbackPlans;
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
        toast.error("Erro ao criar checkout. Tente novamente.");
        setStep("terms");
      }
    } catch (err: unknown) {
      console.error("Checkout error:", err);
      toast.error("Erro ao processar pagamento. Tente novamente.");
      setStep("terms");
    } finally {
      setLoadingCheckout(false);
    }
  };

  if (authLoading || loadingDiscount || loadingPlans) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return null;

  const selectedPlanData = plans.find((p) => p.id === selectedPlan);

  return (
    <div className="min-h-screen relative">
      {/* Nav — glass */}
      <nav className="sticky top-0 z-20 px-6 py-3">
        <div className="lv-glass rounded-2xl px-5 py-2.5 flex items-center justify-between">
        <Link to="/" className="text-base font-semibold tracking-tight text-foreground">{brandName}</Link>
        <button
          onClick={() => {
            if (step === "terms") { setStep("plan"); setAgreedTerms(false); }
            else navigate("/");
          }}
          className="lv-btn-secondary h-9 px-4 text-xs flex items-center gap-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar
        </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-3 mb-10">
          {[
            { key: "plan", label: "1. Plano" },
            { key: "terms", label: "2. Termos" },
            { key: "processing", label: "3. Pagamento" },
          ].map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <span className={`lv-badge ${step === s.key || (step === "pix" && s.key === "processing") ? "lv-badge-primary" : "lv-badge-muted"}`}>
                {s.label}
              </span>
              {i < 2 && <ChevronDown className="h-3 w-3 text-muted-foreground -rotate-90" />}
            </div>
          ))}
        </div>

        {/* Affiliate discount banner */}
        {affiliateDiscount > 0 && step === "plan" && (
          <div className="lv-card-sm border-green-500/30 bg-green-500/5 flex items-center gap-3 mb-8">
            <Percent className="h-5 w-5 text-green-500 shrink-0" />
            <div>
              <p className="lv-body-strong">Desconto de afiliado — {affiliateDiscount}% OFF</p>
              <p className="lv-caption mt-0.5">
                Como afiliado, seu desconto de {affiliateDiscount}% é aplicado automaticamente em todos os planos.
              </p>
            </div>
          </div>
        )}

        {/* Step 1: Plan selection */}
        {step === "plan" && (
          <div>
            <p className="lv-overline text-center mb-2">Escolha seu plano</p>
            <h1 className="lv-heading-lg text-center mb-4">Planos e Preços</h1>
            
            <div className="lv-card-sm text-center mb-10">
              <p className="lv-body-strong">⏰ Preços por tempo limitado</p>
              <p className="lv-caption mt-0.5">Aproveite os preços promocionais de lançamento.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {plans.filter(p => !(p.highlight && countdown.expired)).map((plan) => (
                <div
                  key={plan.id}
                  className={`lv-card-interactive flex flex-col justify-between ${
                    plan.popular ? "lv-card-active" : ""
                  } ${selectedPlan === plan.id ? "ring-2 ring-primary" : ""}`}
                  onClick={() => handleSelectPlan(plan.id)}
                >
                  <div className="flex flex-col h-full">
                    <div className="min-h-[28px] mb-3 flex gap-2">
                      {plan.popular && <span className="lv-badge lv-badge-primary">Popular</span>}
                      {plan.highlight && !countdown.expired && <span className="lv-badge lv-badge-primary">Melhor custo</span>}
                      {affiliateDiscount > 0 && <span className="lv-badge lv-badge-success">-{affiliateDiscount}%</span>}
                    </div>

                    {plan.highlight && !countdown.expired && (
                      <div className="bg-accent rounded-xl p-3 mb-4">
                        <div className="flex items-center gap-1.5 justify-center mb-2">
                          <Timer className="h-3.5 w-3.5 text-primary" />
                          <span className="text-xs font-medium text-primary">Oferta encerra em</span>
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          {[
                            { value: countdown.days, label: "D" },
                            { value: countdown.hours, label: "H" },
                            { value: countdown.minutes, label: "M" },
                            { value: countdown.seconds, label: "S" },
                          ].map((t, i) => (
                            <div key={i} className="flex items-baseline gap-0.5">
                              <span className="text-lg font-semibold text-foreground tabular-nums">{String(t.value).padStart(2, "0")}</span>
                              <span className="text-[10px] font-medium text-muted-foreground">{t.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="lv-overline mb-2">{plan.name}</p>
                    <p className="text-sm text-muted-foreground line-through">{plan.originalPrice}</p>
                    {affiliateDiscount > 0 ? (
                      <div className="flex items-baseline gap-2">
                        <p className="text-sm text-muted-foreground line-through">{formatBRL(plan.price)}</p>
                        <p className="lv-stat text-2xl text-green-600">{formatBRL(plan.discountedPrice)}</p>
                      </div>
                    ) : (
                      <p className="lv-stat text-2xl mb-1">{formatBRL(plan.price)}</p>
                    )}
                    <p className="lv-caption mb-4">{plan.period}</p>
                    <p className="lv-body mb-5">{plan.description}</p>

                    <ul className="space-y-2 flex-1">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button
                    className={`w-full mt-5 ${plan.popular || plan.highlight ? "lv-btn-primary" : "lv-btn-secondary"} h-10 text-sm`}
                    onClick={(e) => { e.stopPropagation(); handleSelectPlan(plan.id); }}
                  >
                    Selecionar
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-5 text-center">
              <p className="lv-caption italic">
                *Vitalício: acesso enquanto a extensão estiver funcional. Serviço considerado concluído após ativação do token. Não há reembolso.
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Terms */}
        {step === "terms" && selectedPlanData && (
          <div>
            <p className="lv-overline text-center mb-2">Aceite os termos</p>
            <h1 className="lv-heading-lg text-center mb-8">Termos de Uso</h1>

            <div className="lv-card-sm flex items-center justify-between mb-8">
              <div>
                <p className="lv-body-strong">Plano selecionado: {selectedPlanData.name}</p>
                <p className="lv-caption">{selectedPlanData.description}</p>
              </div>
              <div className="text-right">
                {affiliateDiscount > 0 ? (
                  <div>
                    <p className="text-xs text-muted-foreground line-through">{formatBRL(selectedPlanData.price)}</p>
                    <p className="lv-stat text-xl text-green-600">{formatBRL(selectedPlanData.discountedPrice)}</p>
                    <p className="text-[10px] font-medium text-green-600">-{affiliateDiscount}% afiliado</p>
                  </div>
                ) : (
                  <p className="lv-stat text-xl">{formatBRL(selectedPlanData.price)}</p>
                )}
              </div>
            </div>

            <div className="lv-card space-y-4">
              {(tenant?.terms_template ? tenant.terms_template.split("\n").filter(Boolean) : defaultTerms).map((term, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="lv-caption font-medium mt-0.5 shrink-0">{String(i + 1).padStart(2, "0")}.</span>
                  <p className="lv-body">{term}</p>
                </div>
              ))}

              <div className="pt-6 border-t border-border/60">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedTerms}
                    onChange={(e) => setAgreedTerms(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border border-border accent-primary"
                  />
                  <span className="lv-body">
                    Li e concordo com todos os termos acima. Entendo que não há garantia de funcionamento contínuo e que não há reembolso.
                  </span>
                </label>
              </div>

              {/* Payment method selection */}
              <div className="pt-4">
                <p className="lv-overline mb-3">Método de pagamento</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPaymentMethod("pix")}
                    className={`lv-card-sm flex items-center gap-3 cursor-pointer transition-all ${
                      paymentMethod === "pix" ? "lv-card-active" : ""
                    }`}
                  >
                    <QrCode className="h-5 w-5 text-foreground" />
                    <div className="text-left">
                      <p className="lv-body-strong text-xs">PIX</p>
                      <p className="lv-caption">Pagamento instantâneo</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setPaymentMethod("redirect")}
                    className={`lv-card-sm flex items-center gap-3 cursor-pointer transition-all ${
                      paymentMethod === "redirect" ? "lv-card-active" : ""
                    }`}
                  >
                    <CreditCard className="h-5 w-5 text-foreground" />
                    <div className="text-left">
                      <p className="lv-body-strong text-xs">Cartão / Outros</p>
                      <p className="lv-caption">Via Mercado Pago</p>
                    </div>
                  </button>
                </div>
              </div>

              <button
                onClick={handleConfirmAndPay}
                disabled={!agreedTerms || loadingCheckout}
                className="lv-btn-primary w-full h-12 text-sm mt-4"
              >
                {loadingCheckout ? "Processando..." : `Pagar ${affiliateDiscount > 0 ? formatBRL(selectedPlanData.discountedPrice) : formatBRL(selectedPlanData.price)}`}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Processing */}
        {step === "processing" && (
          <div className="text-center py-20">
            <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary mb-4" />
            <p className="lv-heading-md mb-2">Processando...</p>
            <p className="lv-body">Aguarde enquanto preparamos seu pagamento.</p>
          </div>
        )}

        {/* PIX step */}
        {step === "pix" && pixData && (
          <div className="max-w-md mx-auto">
            <p className="lv-overline text-center mb-2">Pagamento PIX</p>
            <h1 className="lv-heading-lg text-center mb-8">Escaneie ou copie</h1>

            <div className="lv-card text-center space-y-6">
              {pixData.pix_qr_base64 && (
                <div className="flex justify-center">
                  <img src={`data:image/png;base64,${pixData.pix_qr_base64}`} alt="QR Code PIX" className="h-48 w-48 rounded-xl" />
                </div>
              )}

              <div>
                <p className="lv-overline mb-2">Código PIX Copia e Cola</p>
                <div className="bg-muted/50 rounded-xl p-3 break-all text-xs font-mono text-foreground">
                  {pixData.pix_code.substring(0, 60)}...
                </div>
              </div>

              <button onClick={handleCopyPix} className="lv-btn-primary w-full h-11 text-sm flex items-center justify-center gap-2">
                <Copy className="h-4 w-4" /> Copiar código PIX
              </button>

              <div className="lv-card-sm bg-accent/50">
                <p className="lv-caption">
                  Após o pagamento, seu plano será ativado automaticamente em até 5 minutos.
                  Você receberá seu token de acesso no dashboard.
                </p>
              </div>

              <Link to="/dashboard" className="lv-btn-secondary w-full h-10 text-sm flex items-center justify-center">
                Ir para o Dashboard
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
