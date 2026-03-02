import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Check, Zap, Clock, MessageSquare, Shield, Loader2, Crown, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useTenant } from "@/contexts/TenantContext";
import MeshBackground from "@/components/MeshBackground";

interface RefPlan {
  id: string;
  name: string;
  price: number;
  billing_cycle: string;
  features: string[];
  highlight_label: string | null;
}

const billingLabels: Record<string, string> = {
  daily: "/dia", weekly: "/semana", monthly: "/mês",
};

const benefits = [
  { icon: Zap, title: "Envios ilimitados", desc: "Envie quantas mensagens quiser com Venus." },
  { icon: Clock, title: "24/7 sem parar", desc: "Funciona o dia todo, todos os dias." },
  { icon: MessageSquare, title: "Sem descontar créditos", desc: "Seus créditos permanecem intactos." },
  { icon: Shield, title: "God Mode ativo", desc: "Acesso total a todas as funcionalidades." },
];

export default function AffiliateRefPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const [affiliate, setAffiliate] = useState<{ display_name: string; affiliate_code: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<RefPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
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

  // Fetch plans from DB
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const { data } = await supabase
          .from("plans")
          .select("id, name, price, billing_cycle, features, highlight_label, display_order")
          .eq("is_public", true)
          .eq("is_active", true)
          .neq("type", "trial")
          .lt("price", 2000000)
          .order("display_order", { ascending: true });
        if (data) {
          setPlans(data.map((p: any) => ({
            id: p.id,
            name: p.name,
            price: p.price / 100,
            billing_cycle: p.billing_cycle,
            features: Array.isArray(p.features) ? p.features : [],
            highlight_label: p.highlight_label,
          })));
        }
      } catch (err) { console.error(err); }
      finally { setLoadingPlans(false); }
    };
    fetchPlans();
  }, []);

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
      if (data?.pix_code || data?.init_point || data?.ticket_url) {
        const url = data.ticket_url || data.init_point;
        if (url) window.location.href = url;
        else toast.success("Checkout criado!");
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
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
        <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary">Venus God Mode</span>
        </div>
        <h1 className="lv-heading-xl mb-6">Envios ilimitados sem descontar créditos</h1>
        <p className="lv-body text-base max-w-2xl mx-auto mb-10">
          Ative o Venus God Mode e tenha poder máximo no Lovable. 24/7 sem parar.
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

      {/* Plans — from DB */}
      <section className="px-6 pb-24 max-w-5xl mx-auto">
        <p className="lv-overline text-center mb-3">Escolha seu plano</p>
        <h2 className="lv-heading-lg text-center mb-12">Planos Venus</h2>
        {loadingPlans ? (
          <div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className={`grid gap-5 max-w-3xl mx-auto ${plans.length >= 3 ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-2"}`}>
            {plans.map((plan) => {
              const isPopular = plan.highlight_label?.toLowerCase() === "popular";
              return (
                <div key={plan.id} className={`lv-card-interactive flex flex-col justify-between ${isPopular ? "lv-card-active" : ""}`}>
                  <div>
                    {isPopular && <span className="lv-badge lv-badge-primary mb-4 inline-block">Popular</span>}
                    {plan.highlight_label && !isPopular && <span className="lv-badge lv-badge-primary mb-4 inline-block">{plan.highlight_label}</span>}
                    <p className="lv-overline mb-2">{plan.name}</p>
                    <p className="lv-stat text-3xl mb-1">R${plan.price.toFixed(2).replace(".", ",")}</p>
                    <p className="lv-caption mb-5">{billingLabels[plan.billing_cycle] || plan.billing_cycle}</p>
                    <ul className="space-y-2.5 mb-6">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 lv-body">
                          <Check className="h-4 w-4 text-primary shrink-0" /> {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={loadingPlan === plan.id}
                    className={`w-full ${isPopular ? "lv-btn-primary" : "lv-btn-secondary"}`}
                  >
                    {loadingPlan === plan.id ? "Processando..." : "Ativar Venus"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <footer className="border-t border-border/60 px-6 py-6 text-center">
        <p className="lv-caption">© {new Date().getFullYear()} {brandName} — Todos os direitos reservados</p>
      </footer>
    </div>
  );
}
