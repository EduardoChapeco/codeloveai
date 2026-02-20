import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Check, Zap, Clock, MessageSquare, Shield } from "lucide-react";
import { toast } from "sonner";

const plans = [
  { id: "1_day", name: "1 DIA", price: 9.99, priceLabel: "R$9,99", period: "por dia" },
  { id: "7_days", name: "7 DIAS", price: 49.90, priceLabel: "R$49,90", period: "por semana" },
  { id: "1_month", name: "1 MÊS", price: 149.90, priceLabel: "R$149,90", period: "por mês", popular: true },
  { id: "12_months", name: "12 MESES", price: 499.00, priceLabel: "R$499,00", period: "por tempo indeterminado*", highlight: true },
];

const benefits = [
  { icon: Zap, title: "ENVIOS ILIMITADOS", desc: "Envie quantas mensagens quiser." },
  { icon: Clock, title: "24/7 SEM PARAR", desc: "Funciona o dia todo, todos os dias." },
  { icon: MessageSquare, title: "SEM DESCONTAR CRÉDITOS", desc: "Seus créditos permanecem intactos." },
  { icon: Shield, title: "MÉTODO PRÓPRIO", desc: "Tecnologia exclusiva de comunicação." },
];

export default function AffiliateRefPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [affiliate, setAffiliate] = useState<{ display_name: string; affiliate_code: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    supabase
      .from("affiliates")
      .select("display_name, affiliate_code")
      .eq("affiliate_code", code)
      .maybeSingle()
      .then(({ data }) => {
        setAffiliate(data);
        setLoading(false);
      });
  }, [code]);

  const handleSubscribe = async (planId: string) => {
    setLoadingPlan(planId);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Faça login para assinar um plano.");
      navigate(`/login?ref=${code}`);
      setLoadingPlan(null);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { plan: planId, affiliate_code: code },
      });

      if (error) throw error;
      if (data?.init_point) {
        window.location.href = data.init_point;
      } else {
        toast.error("Erro ao criar checkout.");
      }
    } catch (err: any) {
      toast.error("Erro ao processar pagamento.");
    } finally {
      setLoadingPlan(null);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="ep-subtitle">CARREGANDO...</p>
    </div>;
  }

  if (!affiliate) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <p className="ep-section-title mb-4">LINK INVÁLIDO</p>
        <Link to="/" className="ep-btn-primary">VOLTAR</Link>
      </div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-20 bg-background border-b border-border px-8 py-5 flex items-center justify-between">
        <span className="ep-label text-sm tracking-[0.3em]">{affiliate.display_name || "CODELOVE AI"}</span>
        <div className="flex items-center gap-4">
          <Link to="/login" className="ep-btn-secondary h-10 px-6 text-[9px]">ENTRAR</Link>
          <Link to="/register" className="ep-btn-primary h-10 px-6 text-[9px]">CRIAR CONTA</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-8 py-24 max-w-5xl mx-auto text-center">
        <p className="ep-subtitle mb-6">EXTENSÃO PARA LOVABLE</p>
        <h1 className="ep-title mb-8">ENVIOS ILIMITADOS SEM DESCONTAR CRÉDITOS</h1>
        <p className="text-base text-muted-foreground font-medium max-w-2xl mx-auto mb-12">
          Crie quantos projetos quiser, envie quantas mensagens quiser. 24/7 sem parar.
        </p>
      </section>

      {/* Benefits */}
      <section className="px-8 pb-20 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {benefits.map((b) => (
            <div key={b.title} className="ep-card-sm flex flex-col items-start gap-4">
              <div className="h-12 w-12 rounded-[16px] border border-border flex items-center justify-center">
                <b.icon className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <h3 className="ep-label text-[11px] mb-2">{b.title}</h3>
                <p className="text-sm text-muted-foreground font-medium">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Plans */}
      <section className="px-8 pb-24 max-w-6xl mx-auto">
        <p className="ep-subtitle text-center mb-4">ESCOLHA SEU PLANO</p>
        <h2 className="ep-section-title text-center mb-16">PLANOS E PREÇOS</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <div key={plan.id} className={`ep-card-interactive flex flex-col justify-between ${plan.popular ? "ep-card-active" : ""}`}>
              <div>
                {plan.popular && <span className="ep-badge ep-badge-live mb-6 inline-block">POPULAR</span>}
                {plan.highlight && <span className="ep-badge ep-badge-live mb-6 inline-block">MELHOR CUSTO</span>}
                <p className="ep-subtitle mb-2">{plan.name}</p>
                <p className="ep-value text-4xl mb-1">{plan.priceLabel}</p>
                <p className="text-xs text-muted-foreground font-medium mb-6">{plan.period}</p>
                <ul className="space-y-3 mb-8">
                  {["Envios ilimitados", "Sem descontar créditos", "Suporte via chat", "Ativação imediata"].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                      <Check className="h-4 w-4 text-foreground" /> {f}
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => handleSubscribe(plan.id)}
                disabled={loadingPlan === plan.id}
                className={`w-full ${plan.popular || plan.highlight ? "ep-btn-primary" : "ep-btn-secondary"}`}
              >
                {loadingPlan === plan.id ? "PROCESSANDO..." : "ASSINAR"}
              </button>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border px-8 py-8 text-center">
        <p className="ep-subtitle">© 2025 CODELOVE AI — TODOS OS DIREITOS RESERVADOS</p>
      </footer>
    </div>
  );
}
