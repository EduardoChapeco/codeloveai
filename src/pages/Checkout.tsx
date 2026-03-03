import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Check, ChevronDown, AlertTriangle, ArrowLeft, Loader2, Timer, Percent, Copy, QrCode, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSEO } from "@/hooks/useSEO";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";

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
      <AppLayout>
        <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
        </div>
      </AppLayout>
    );
  }

  if (!user) return null;

  const selectedPlanData = plans.find((p) => p.id === selectedPlan);

  return (
    <AppLayout>
    <div className="rd-page-content">
      {/* Nav */}
      <nav style={{ position: "sticky", top: 0, zIndex: 20, padding: "12px 24px" }}>
        <div className="rd-card" style={{ padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link to="/" style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", textDecoration: "none" }}>{brandName}</Link>
          <button
            onClick={() => {
              if (step === "terms") { setStep("plan"); setAgreedTerms(false); }
              else navigate("/");
            }}
            className="gl sm ghost"
          >
            <ArrowLeft size={14} /> Voltar
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>
        {/* Step indicator */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 40 }}>
          {[
            { key: "plan", label: "1. Plano" },
            { key: "terms", label: "2. Termos" },
            { key: "processing", label: "3. Pagamento" },
          ].map((s, i) => (
            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className={`chip sm ${step === s.key || (step === "pix" && s.key === "processing") ? "ch-orange" : "ch-gray"}`}>
                {s.label}
              </span>
              {i < 2 && <ChevronDown size={12} style={{ color: "var(--text-quaternary)", transform: "rotate(-90deg)" }} />}
            </div>
          ))}
        </div>

        {/* Affiliate discount banner */}
        {affiliateDiscount > 0 && step === "plan" && (
          <div className="rd-card" style={{ borderLeft: "3px solid var(--green)", marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
            <Percent size={18} style={{ color: "var(--green-l)", flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Desconto de afiliado — {affiliateDiscount}% OFF</p>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                Como afiliado, seu desconto de {affiliateDiscount}% é aplicado automaticamente em todos os planos.
              </p>
            </div>
          </div>
        )}

        {/* Step 1: Plan selection */}
        {step === "plan" && (
          <div>
            <div className="sec-label" style={{ textAlign: "center", marginBottom: 8 }}>Escolha seu plano</div>
            <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.04em", color: "var(--text-primary)", textAlign: "center", marginBottom: 16 }}>Planos e Preços</h1>
            
            <div className="rd-card" style={{ textAlign: "center", marginBottom: 32 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Preços por tempo limitado</p>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>Aproveite os preços promocionais de lançamento.</p>
            </div>

            <div className="rd-grid-2">
              {plans.filter(p => !(p.highlight && countdown.expired)).map((plan) => (
                <div
                  key={plan.id}
                  className="rd-card"
                  style={{
                    display: "flex", flexDirection: "column", justifyContent: "space-between", cursor: "pointer",
                    border: plan.popular ? "1.5px solid rgba(245,158,11,0.35)" : selectedPlan === plan.id ? "1.5px solid rgba(59,130,246,0.35)" : undefined,
                  }}
                  onClick={() => handleSelectPlan(plan.id)}
                >
                  <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                    <div style={{ minHeight: 28, marginBottom: 12, display: "flex", gap: 8 }}>
                      {plan.popular && <span className="chip ch-orange">Popular</span>}
                      {plan.highlight && !countdown.expired && <span className="chip ch-orange">Melhor custo</span>}
                      {affiliateDiscount > 0 && <span className="chip ch-green">-{affiliateDiscount}%</span>}
                    </div>

                    {plan.highlight && !countdown.expired && (
                      <div style={{ background: "rgba(245,158,11,0.06)", borderRadius: "var(--r3)", padding: 12, marginBottom: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center", marginBottom: 8 }}>
                          <Timer size={14} style={{ color: "var(--orange-l)" }} />
                          <span style={{ fontSize: 11, fontWeight: 500, color: "var(--orange-l)" }}>Oferta encerra em</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                          {[
                            { value: countdown.days, label: "D" },
                            { value: countdown.hours, label: "H" },
                            { value: countdown.minutes, label: "M" },
                            { value: countdown.seconds, label: "S" },
                          ].map((t, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
                              <span style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{String(t.value).padStart(2, "0")}</span>
                              <span style={{ fontSize: 10, fontWeight: 500, color: "var(--text-tertiary)" }}>{t.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="sec-label" style={{ marginBottom: 8 }}>{plan.name}</div>
                    {plan.originalPrice && <p style={{ fontSize: 12, color: "var(--text-tertiary)", textDecoration: "line-through" }}>{plan.originalPrice}</p>}
                    {affiliateDiscount > 0 ? (
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <p style={{ fontSize: 12, color: "var(--text-tertiary)", textDecoration: "line-through" }}>{formatBRL(plan.price)}</p>
                        <p className="rd-stat-value" style={{ color: "var(--green-l)" }}>{formatBRL(plan.discountedPrice)}</p>
                      </div>
                    ) : (
                      <p className="rd-stat-value" style={{ marginBottom: 4 }}>{formatBRL(plan.price)}</p>
                    )}
                    <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 16 }}>{plan.period}</p>
                    <p className="body-text" style={{ marginBottom: 20 }}>{plan.description}</p>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                      {plan.features.map((f) => (
                        <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                          <Check size={14} style={{ color: "var(--green)", flexShrink: 0, marginTop: 2 }} />
                          <span className="body-text">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    className={plan.popular || plan.highlight ? "gl orange" : "gl"}
                    style={{ width: "100%", justifyContent: "center", marginTop: 20 }}
                    onClick={(e) => { e.stopPropagation(); handleSelectPlan(plan.id); }}
                  >
                    Selecionar
                  </button>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 20, textAlign: "center" }}>
              <p className="caption-sm" style={{ fontStyle: "italic", opacity: 0.5 }}>
                *Vitalício: acesso enquanto a extensão estiver funcional. Serviço considerado concluído após ativação do token. Não há reembolso.
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Terms */}
        {step === "terms" && selectedPlanData && (
          <div>
            <div className="sec-label" style={{ textAlign: "center", marginBottom: 8 }}>Aceite os termos</div>
            <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.04em", color: "var(--text-primary)", textAlign: "center", marginBottom: 32 }}>Termos de Uso</h1>

            <div className="rd-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Plano selecionado: {selectedPlanData.name}</p>
                <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{selectedPlanData.description}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                {affiliateDiscount > 0 ? (
                  <div>
                    <p style={{ fontSize: 11, color: "var(--text-tertiary)", textDecoration: "line-through" }}>{formatBRL(selectedPlanData.price)}</p>
                    <p className="rd-stat-value" style={{ color: "var(--green-l)" }}>{formatBRL(selectedPlanData.discountedPrice)}</p>
                    <p style={{ fontSize: 10, fontWeight: 500, color: "var(--green-l)" }}>-{affiliateDiscount}% afiliado</p>
                  </div>
                ) : (
                  <p className="rd-stat-value">{formatBRL(selectedPlanData.price)}</p>
                )}
              </div>
            </div>

            <div className="rd-card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {(tenant?.terms_template ? tenant.terms_template.split("\n").filter(Boolean) : defaultTerms).map((term, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500, marginTop: 2, flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}.</span>
                  <p className="body-text">{term}</p>
                </div>
              ))}

              <div style={{ paddingTop: 24, borderTop: "1px solid var(--b1)" }}>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={agreedTerms}
                    onChange={(e) => setAgreedTerms(e.target.checked)}
                    style={{ marginTop: 3 }}
                  />
                  <span className="body-text">
                    Li e concordo com todos os termos acima. Entendo que não há garantia de funcionamento contínuo e que não há reembolso.
                  </span>
                </label>
              </div>

              {/* Payment method selection */}
              <div style={{ paddingTop: 16 }}>
                <div className="sec-label" style={{ marginBottom: 12 }}>Método de pagamento</div>
                <div className="rd-grid-2">
                  <button
                    onClick={() => setPaymentMethod("pix")}
                    className="rd-card"
                    style={{
                      display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
                      border: paymentMethod === "pix" ? "1.5px solid rgba(245,158,11,0.35)" : undefined,
                    }}
                  >
                    <QrCode size={18} style={{ color: "var(--text-primary)" }} />
                    <div style={{ textAlign: "left" }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>PIX</p>
                      <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Pagamento instantâneo</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setPaymentMethod("redirect")}
                    className="rd-card"
                    style={{
                      display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
                      border: paymentMethod === "redirect" ? "1.5px solid rgba(245,158,11,0.35)" : undefined,
                    }}
                  >
                    <CreditCard size={18} style={{ color: "var(--text-primary)" }} />
                    <div style={{ textAlign: "left" }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>Cartão / Outros</p>
                      <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Via Mercado Pago</p>
                    </div>
                  </button>
                </div>
              </div>

              <button
                onClick={handleConfirmAndPay}
                disabled={!agreedTerms || loadingCheckout}
                className="gl primary"
                style={{ width: "100%", justifyContent: "center", marginTop: 16, height: 44 }}
              >
                {loadingCheckout ? "Processando..." : `Pagar ${affiliateDiscount > 0 ? formatBRL(selectedPlanData.discountedPrice) : formatBRL(selectedPlanData.price)}`}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Processing */}
        {step === "processing" && (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <Loader2 size={40} className="animate-spin" style={{ margin: "0 auto 16px", color: "var(--orange)" }} />
            <p style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Processando...</p>
            <p className="body-text">Aguarde enquanto preparamos seu pagamento.</p>
          </div>
        )}

        {/* PIX step */}
        {step === "pix" && pixData && (
          <div style={{ maxWidth: 420, margin: "0 auto" }}>
            <div className="sec-label" style={{ textAlign: "center", marginBottom: 8 }}>Pagamento PIX</div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: "var(--text-primary)", textAlign: "center", marginBottom: 32 }}>Escaneie ou copie</h1>

            <div className="rd-card" style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 24 }}>
              {pixData.pix_qr_base64 && (
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <img src={`data:image/png;base64,${pixData.pix_qr_base64}`} alt="QR Code PIX" style={{ height: 192, width: 192, borderRadius: "var(--r3)" }} />
                </div>
              )}

              <div>
                <div className="sec-label" style={{ marginBottom: 8 }}>Código PIX Copia e Cola</div>
                <div style={{ background: "var(--bg-3)", borderRadius: "var(--r3)", padding: 12, wordBreak: "break-all", fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-primary)" }}>
                  {pixData.pix_code.substring(0, 60)}...
                </div>
              </div>

              <button onClick={handleCopyPix} className="gl primary" style={{ width: "100%", justifyContent: "center" }}>
                <Copy size={14} /> Copiar código PIX
              </button>

              <div className="rd-card" style={{ background: "rgba(245,158,11,0.05)" }}>
                <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                  Após o pagamento, seu plano será ativado automaticamente em até 5 minutos.
                  Você receberá seu token de acesso no dashboard.
                </p>
              </div>

              <Link to="/home" className="gl ghost" style={{ width: "100%", justifyContent: "center", textDecoration: "none" }}>
                Ir para o Dashboard
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
    </AppLayout>
  );
}

