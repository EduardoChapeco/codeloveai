import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Check, Loader2, ArrowRight } from "lucide-react";
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
}

const billingCycleLabels: Record<string, string> = {
  daily: "por dia", weekly: "por semana", monthly: "por mês",
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
          .select("id, name, type, price, billing_cycle, description, features, highlight_label, display_order, is_public, is_active")
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

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <p className="lv-overline mb-2">Preços Transparentes</p>
          <h1 className="lv-heading-lg mb-4">Escolha o seu Plano</h1>
          <p className="lv-body text-muted-foreground max-w-2xl mx-auto">
            Planos flexíveis para todas as necessidades. Comece agora e potencialize seus resultados.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`lv-card h-full flex flex-col justify-between ${
                plan.popular ? "ring-2 ring-primary relative" : ""
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 lv-badge lv-badge-primary px-3 py-1">
                  Mais Popular
                </span>
              )}
              <div>
                <p className="lv-overline mb-2">{plan.name}</p>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-3xl font-bold text-foreground">R${plan.price.toFixed(2).replace(".", ",")}</span>
                  <span className="lv-caption">{plan.period}</span>
                </div>
                <p className="lv-body mb-6 min-h-[3rem]">{plan.description}</p>
                
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => navigate(`/checkout?plan=${plan.id}`)}
                className={`w-full h-11 flex items-center justify-center gap-2 text-sm font-medium rounded-xl transition-all ${
                  plan.popular 
                    ? "bg-primary text-primary-foreground hover:opacity-90" 
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                Selecionar Plano
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ))}
          
          {plans.length === 0 && (
            <div className="col-span-full text-center py-12 lv-card">
              <p className="lv-body text-muted-foreground">Nenhum plano disponível no momento.</p>
            </div>
          )}
        </div>

        <div className="mt-16 text-center">
          <p className="lv-caption">
            Precisa de um plano personalizado? <Link to="/support" className="text-primary hover:underline">Fale conosco</Link>
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
