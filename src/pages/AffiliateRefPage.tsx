import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Check, Zap, Clock, MessageSquare, Shield } from "lucide-react";
import { toast } from "sonner";
import { useTenant } from "@/contexts/TenantContext";
import MeshBackground from "@/components/MeshBackground";

const plans = [
  { id: "1_day", name: "1 Dia", price: 9.99, priceLabel: "R$9,99", period: "por dia" },
  { id: "7_days", name: "7 Dias", price: 49.90, priceLabel: "R$49,90", period: "por semana" },
  { id: "1_month", name: "1 Mês", price: 149.90, priceLabel: "R$149,90", period: "por mês", popular: true },
  { id: "12_months", name: "12 Meses", price: 499.00, priceLabel: "R$499,00", period: "por tempo indeterminado*", highlight: true },
];

const benefits = [
  { icon: Zap, title: "Envios ilimitados", desc: "Envie quantas mensagens quiser." },
  { icon: Clock, title: "24/7 sem parar", desc: "Funciona o dia todo, todos os dias." },
  { icon: MessageSquare, title: "Sem descontar créditos", desc: "Seus créditos permanecem intactos." },
  { icon: Shield, title: "Método próprio", desc: "Tecnologia exclusiva de comunicação." },
];

export default function AffiliateRefPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { tenant } = useTenant();
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

  const brandName = affiliate?.display_name || tenant?.name || "Starble";

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="lv-overline">Carregando...</p>
    </div>;
  }

  if (!affiliate) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <p className="lv-heading-lg mb-4">Link inválido</p>
        <Link to="/" className="lv-btn-primary">Voltar</Link>
      </div>
    </div>;
  }

  return (
    <div className="min-h-screen relative">
      <MeshBackground />
      <nav className="sticky top-0 z-20 px-6 py-3">
        <div className="lv-glass rounded-2xl px-5 py-2.5 flex items-center justify-between">
          <span className="text-base font-semibold tracking-tight text-foreground">{brandName}</span>
          <div className="flex items-center gap-3">
            <Link to="/login" className="lv-btn-secondary h-9 px-4 text-xs">Entrar</Link>
            <Link to="/register" className="lv-btn-primary h-9 px-4 text-xs">Criar conta</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-24 max-w-4xl mx-auto text-center">
        <p className="lv-overline mb-4">Extensão para Lovable</p>
        <h1 className="lv-heading-xl mb-6">Envios ilimitados sem descontar créditos</h1>
        <p className="lv-body text-base max-w-2xl mx-auto mb-10">
          Crie quantos projetos quiser, envie quantas mensagens quiser. 24/7 sem parar.
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
        <h2 className="lv-heading-lg text-center mb-12">Planos e preços</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => (
            <div key={plan.id} className={`lv-card-interactive flex flex-col justify-between ${plan.popular ? "lv-card-active" : ""}`}>
              <div>
                {plan.popular && <span className="lv-badge lv-badge-primary mb-4 inline-block">Popular</span>}
                {plan.highlight && <span className="lv-badge lv-badge-primary mb-4 inline-block">Melhor custo</span>}
                <p className="lv-overline mb-2">{plan.name}</p>
                <p className="lv-stat text-3xl mb-1">{plan.priceLabel}</p>
                <p className="lv-caption mb-5">{plan.period}</p>
                <ul className="space-y-2.5 mb-6">
                  {["Envios ilimitados", "Sem descontar créditos", "Suporte via chat", "Ativação imediata"].map((f) => (
                    <li key={f} className="flex items-center gap-2 lv-body">
                      <Check className="h-4 w-4 text-primary shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => handleSubscribe(plan.id)}
                disabled={loadingPlan === plan.id}
                className={`w-full ${plan.popular || plan.highlight ? "lv-btn-primary" : "lv-btn-secondary"}`}
              >
                {loadingPlan === plan.id ? "Processando..." : "Assinar"}
              </button>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/60 px-6 py-6 text-center">
        <p className="lv-caption">© 2025 {brandName} — Todos os direitos reservados</p>
      </footer>
    </div>
  );
}