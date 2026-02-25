import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Check, Loader2, ArrowRight, Crown, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSEO } from "@/hooks/useSEO";
import { useTenant } from "@/contexts/TenantContext";
import AppLayout from "@/components/AppLayout";

interface Plan {
  id: string;
  name: string;
  price: number;
  period: string;
  description: string;
  features: string[];
  popular?: boolean;
  highlight?: string | null;
  maxProjects?: number | null;
  billingCycle: string;
}

const billingCycleLabels: Record<string, string> = {
  daily: "/dia", weekly: "/semana", monthly: "/mês",
};

export default function PlansPage() {
  const { tenant } = useTenant();
  const brandName = tenant?.name || "Starble";
  useSEO({ title: "Planos e Preços", description: `Conheça os planos do ${brandName} e escolha o melhor para você.` });
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const { data } = await supabase
          .from("plans")
          .select("id, name, type, price, billing_cycle, description, features, highlight_label, display_order, is_public, is_active, max_projects")
          .eq("is_public", true)
          .eq("is_active", true)
          .order("display_order", { ascending: true });
        
        if (data) {
          setPlans(data.map((p: any) => ({
            id: p.id,
            name: p.name,
            price: p.price / 100,
            period: billingCycleLabels[p.billing_cycle] || p.billing_cycle,
            description: p.description || "",
            features: Array.isArray(p.features) ? p.features : [],
            popular: p.highlight_label?.toLowerCase() === "popular",
            highlight: p.highlight_label,
            maxProjects: p.max_projects,
            billingCycle: p.billing_cycle,
          })));
        }
      } catch (err) {
        console.error("Error fetching plans:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPlans();
  }, []);

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  const dailyPlans = plans.filter(p => p.billingCycle === "daily");
  const monthlyPlans = plans.filter(p => p.billingCycle === "monthly" && p.price < 20000);
  const wlPlan = plans.find(p => p.price >= 20000);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <p className="lv-overline mb-2">Preços Transparentes</p>
          <h1 className="lv-heading-lg mb-3">Escolha o seu Plano</h1>
          <p className="lv-body-lg max-w-2xl mx-auto">
            Planos flexíveis para todas as necessidades. Comece grátis e escale conforme cresce.
          </p>
        </div>

        {/* Daily plans grid */}
        <div className={`grid gap-5 max-w-4xl mx-auto ${dailyPlans.length >= 3 ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-2"}`}>
          {dailyPlans.map((plan) => (
            <div
              key={plan.id}
              className={`clf-liquid-glass p-6 flex flex-col justify-between ${
                plan.popular ? "ring-2 ring-primary/30" : ""
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-full shadow-lg shadow-primary/20">
                  Mais Popular
                </span>
              )}
              <div>
                <p className="lv-overline mb-3">{plan.name}</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="lv-stat text-3xl">
                    R${plan.price.toFixed(2).replace(".", ",")}
                  </span>
                  <span className="lv-caption">{plan.period}</span>
                </div>
                <p className="lv-body mb-5 min-h-[2.5rem]">{plan.description}</p>

                {plan.maxProjects && (
                  <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl bg-primary/5 border border-primary/10">
                    <Crown className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-semibold text-primary">Até {plan.maxProjects} projetos</span>
                  </div>
                )}

                <ul className="space-y-2.5 mb-6">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="lv-body">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => plan.price === 0 ? navigate("/free") : navigate(`/checkout?plan=${plan.id}`)}
                className={`w-full ${plan.popular ? "lv-btn-primary" : plan.price > 0 ? "lv-btn-secondary" : "lv-btn-ghost"} h-11 text-sm`}
              >
                {plan.price === 0 ? "Começar Grátis" : "Selecionar Plano"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Monthly plans section */}
        {monthlyPlans.length > 0 && (
          <div className="max-w-4xl mx-auto mt-10">
            <p className="lv-overline text-center mb-4">Planos Mensais</p>
            <div className={`grid gap-5 ${monthlyPlans.length >= 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 max-w-md mx-auto"}`}>
              {monthlyPlans.map((plan) => (
                <div
                  key={plan.id}
                  className={`clf-liquid-glass p-6 flex flex-col justify-between ${
                    plan.popular ? "ring-2 ring-primary/30" : ""
                  }`}
                >
                  {plan.popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-full shadow-lg shadow-primary/20">
                      Mais Popular
                    </span>
                  )}
                  <div>
                    <p className="lv-overline mb-3">{plan.name}</p>
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="lv-stat text-3xl">
                        R${plan.price.toFixed(2).replace(".", ",")}
                      </span>
                      <span className="lv-caption">{plan.period}</span>
                    </div>
                    <p className="lv-body mb-5 min-h-[2.5rem]">{plan.description}</p>
                    <ul className="space-y-2.5 mb-6">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <span className="lv-body">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button
                    onClick={() => navigate(`/checkout?plan=${plan.id}`)}
                    className="lv-btn-secondary w-full h-11 text-sm"
                  >
                    Selecionar Plano <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* White Label plan */}
        {wlPlan && (
          <div className="max-w-4xl mx-auto mt-10">
            <div className="clf-liquid-glass p-6 md:p-8">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    <span className="lv-overline text-primary">{wlPlan.highlight || "Empresas"}</span>
                  </div>
                  <h3 className="lv-heading-md mb-2">{wlPlan.name}</h3>
                  <p className="lv-body mb-4">{wlPlan.description}</p>
                  <div className="flex flex-wrap gap-3">
                    {wlPlan.features.map((f, i) => (
                      <span key={i} className="flex items-center gap-1.5 lv-caption">
                        <Check className="h-3.5 w-3.5 text-primary" /> {f}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-center md:text-right shrink-0">
                  <div className="flex items-baseline gap-1 justify-center md:justify-end mb-1">
                    <span className="lv-stat text-3xl">R${wlPlan.price.toFixed(2).replace(".", ",")}</span>
                    <span className="lv-caption">{wlPlan.period}</span>
                  </div>
                  <p className="lv-caption mb-4">+ 30% comissão por usuário ativo</p>
                  <button
                    onClick={() => navigate("/whitelabel")}
                    className="lv-btn-primary h-11 px-8 text-sm mx-auto md:ml-auto md:mr-0"
                  >
                    Saiba Mais <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 text-center space-y-2">
          <p className="lv-caption opacity-60">
            * Em breve, o plano Individual terá limite de projetos. Contrate o plano Agência para múltiplos projetos.
          </p>
          <p className="lv-body">
            Precisa de um plano personalizado? <Link to="/suporte" className="text-primary hover:underline">Fale conosco</Link>
          </p>
        </div>
      </div>
    </AppLayout>
  );
}