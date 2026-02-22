import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Check, Zap, Clock, MessageSquare, Shield, Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";
import MeshBackground from "@/components/MeshBackground";

interface WlPlan {
  id: string;
  name: string;
  description: string;
  setup_price_cents: number;
  setup_is_free: boolean;
  monthly_price_cents: number;
  yearly_price_cents: number | null;
  is_active: boolean;
}

interface WlAffiliate {
  id: string;
  code: string;
  display_name: string;
  is_active: boolean;
}

const benefits = [
  { icon: Building2, title: "Sua marca", desc: "Plataforma 100% personalizada com seu logo e cores." },
  { icon: Zap, title: "Pronto para vender", desc: "Comece a vender em minutos, sem setup técnico." },
  { icon: Clock, title: "Receita recorrente", desc: "Ganhe com cada venda de seus membros." },
  { icon: Shield, title: "Infraestrutura segura", desc: "Backend robusto com segurança enterprise." },
];

export default function WhiteLabelRefPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [affiliate, setAffiliate] = useState<WlAffiliate | null>(null);
  const [plans, setPlans] = useState<WlPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<"monthly" | "yearly">("monthly");
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    const load = async () => {
      const [affRes, plansRes] = await Promise.all([
        supabase
          .from("white_label_affiliates")
          .select("id, code, display_name, is_active")
          .eq("code", code)
          .eq("is_active", true)
          .maybeSingle(),
        supabase
          .from("white_label_plans")
          .select("*")
          .eq("is_active", true)
          .order("monthly_price_cents", { ascending: true }),
      ]);
      setAffiliate(affRes.data as WlAffiliate | null);
      setPlans((plansRes.data as WlPlan[]) || []);
      setLoading(false);
    };
    load();
  }, [code]);

  const handlePurchase = async (planId: string) => {
    setProcessingPlan(planId);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Faça login para continuar.");
      navigate(`/login?wl_ref=${code}`);
      setProcessingPlan(null);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("create-white-label-checkout", {
        body: {
          plan_id: planId,
          period: selectedPeriod,
          affiliate_wl_code: code,
        },
      });

      if (error) throw error;

      if (data?.pix_code) {
        // PIX flow - could navigate to a PIX display page
        toast.success("PIX gerado! Copie o código para pagar.");
        // For now, redirect to dashboard with PIX info
        navigate(`/dashboard?wl_payment=pending`);
      } else if (data?.init_point) {
        window.location.href = data.init_point;
      } else {
        toast.error("Erro ao criar checkout.");
      }
    } catch (err: any) {
      toast.error("Erro ao processar pagamento.");
      console.error(err);
    } finally {
      setProcessingPlan(null);
    }
  };

  const formatCents = (cents: number) => {
    return `R$${(cents / 100).toFixed(2).replace(".", ",")}`;
  };

  const brandName = affiliate?.display_name || "White Label";

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!affiliate) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="lv-heading-lg mb-4">Link inválido</p>
          <p className="lv-body mb-6">Este link de referência não é válido ou expirou.</p>
          <Link to="/" className="lv-btn-primary h-10 px-6">
            Voltar ao início
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <MeshBackground />
      {/* Nav */}
      <nav className="sticky top-0 z-20 px-6 py-3">
        <div className="lv-glass rounded-2xl px-5 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <span className="text-base font-semibold tracking-tight text-foreground">
              White Label — {brandName}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="lv-btn-secondary h-9 px-4 text-xs">Entrar</Link>
            <Link to="/register" className="lv-btn-primary h-9 px-4 text-xs">Criar conta</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-24 max-w-4xl mx-auto text-center">
        <p className="lv-overline mb-4">Indicado por {brandName}</p>
        <h1 className="lv-heading-xl mb-6">
          Tenha sua própria plataforma White Label
        </h1>
        <p className="lv-body text-base max-w-2xl mx-auto mb-10">
          Crie sua plataforma personalizada, venda para seus clientes e ganhe receita recorrente.
          Sem precisar de infraestrutura técnica.
        </p>
      </section>

      {/* Benefits */}
      <section className="px-6 pb-20 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {benefits.map((b) => (
            <div key={b.title} className="lv-card-sm flex flex-col items-start gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <b.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="lv-heading-sm mb-2">{b.title}</h3>
                <p className="lv-body">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Plans */}
      <section className="px-6 pb-24 max-w-5xl mx-auto">
        <p className="lv-overline text-center mb-3">Escolha seu plano</p>
        <h2 className="lv-heading-lg text-center mb-6">Planos White Label</h2>

        {/* Period toggle */}
        <div className="flex items-center justify-center gap-2 mb-12">
          <button
            onClick={() => setSelectedPeriod("monthly")}
            className={`h-9 px-4 text-xs rounded-lg transition-colors ${
              selectedPeriod === "monthly" ? "lv-btn-primary" : "lv-btn-secondary"
            }`}
          >
            Mensal
          </button>
          <button
            onClick={() => setSelectedPeriod("yearly")}
            className={`h-9 px-4 text-xs rounded-lg transition-colors ${
              selectedPeriod === "yearly" ? "lv-btn-primary" : "lv-btn-secondary"
            }`}
          >
            Anual
          </button>
        </div>

        {plans.length === 0 ? (
          <p className="lv-body text-center py-12">Nenhum plano disponível no momento.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan, idx) => {
              const price = selectedPeriod === "yearly" && plan.yearly_price_cents
                ? plan.yearly_price_cents
                : plan.monthly_price_cents;
              const setupPrice = plan.setup_is_free ? 0 : plan.setup_price_cents;
              const isPopular = idx === 1;

              return (
                <div
                  key={plan.id}
                  className={`lv-card-interactive flex flex-col justify-between ${
                    isPopular ? "lv-card-active ring-2 ring-primary/20" : ""
                  }`}
                >
                  <div>
                    {isPopular && (
                      <span className="lv-badge lv-badge-primary mb-4 inline-block">
                        Recomendado
                      </span>
                    )}
                    <p className="lv-heading-sm mb-2">{plan.name}</p>
                    {plan.description && (
                      <p className="lv-body mb-4">{plan.description}</p>
                    )}

                    <div className="mb-4">
                      <p className="lv-stat text-3xl">{formatCents(price)}</p>
                      <p className="lv-caption">
                        {selectedPeriod === "yearly" ? "/ano" : "/mês"}
                      </p>
                    </div>

                    {setupPrice > 0 && (
                      <p className="lv-caption mb-4">
                        + Setup: {formatCents(setupPrice)} (uma vez)
                      </p>
                    )}
                    {plan.setup_is_free && (
                      <p className="lv-caption text-primary mb-4">
                        ✓ Setup gratuito
                      </p>
                    )}

                    <ul className="space-y-2.5 mb-6">
                      {[
                        "Plataforma completa",
                        "Sua marca e cores",
                        "Gestão de membros",
                        "Sistema de afiliados",
                        "Suporte técnico",
                      ].map((f) => (
                        <li key={f} className="flex items-center gap-2 lv-body">
                          <Check className="h-4 w-4 text-primary shrink-0" /> {f}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={() => handlePurchase(plan.id)}
                    disabled={processingPlan === plan.id}
                    className={`w-full h-10 text-sm ${
                      isPopular ? "lv-btn-primary" : "lv-btn-secondary"
                    } flex items-center justify-center gap-2`}
                  >
                    {processingPlan === plan.id ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Processando...
                      </>
                    ) : (
                      "Começar agora"
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* FAQ */}
      <section className="px-6 pb-24 max-w-3xl mx-auto">
        <h2 className="lv-heading-lg text-center mb-10">Perguntas Frequentes</h2>
        <div className="space-y-4">
          {[
            {
              q: "Como funciona o White Label?",
              a: "Você recebe uma plataforma completa personalizada com sua marca. Seus clientes compram planos e você recebe a receita, descontando apenas a comissão da plataforma.",
            },
            {
              q: "Preciso de conhecimento técnico?",
              a: "Não! A plataforma já vem pronta. Você só precisa personalizar sua marca e começar a vender.",
            },
            {
              q: "Como recebo meus ganhos?",
              a: "Os ganhos são creditados automaticamente no seu wallet. Você pode solicitar saques semanais via PIX.",
            },
            {
              q: "Posso cancelar a qualquer momento?",
              a: "Sim, sem multas ou taxas de cancelamento. Seu White Label ficará ativo até o fim do período pago.",
            },
          ].map((item) => (
            <div key={item.q} className="lv-card">
              <p className="lv-body-strong mb-2">{item.q}</p>
              <p className="lv-body">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/60 px-6 py-6 text-center">
        <p className="lv-caption">© {new Date().getFullYear()} {brandName} — Todos os direitos reservados</p>
      </footer>
    </div>
  );
}
