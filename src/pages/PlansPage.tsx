import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Check, Loader2, ArrowRight, Crown, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSEO } from "@/hooks/useSEO";
import { useTenant } from "@/contexts/TenantContext";
import AppLayout from "@/components/AppLayout";

interface Plan {
  id: string; name: string; price: number; period: string; description: string;
  features: string[]; popular?: boolean; highlight?: string | null;
  maxProjects?: number | null; billingCycle: string;
}

const billingCycleLabels: Record<string, string> = { daily: "/dia", weekly: "/semana", monthly: "/mês" };

export default function PlansPage() {
  const { tenant } = useTenant();
  const brandName = tenant?.name || "OrbIOS";
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
          .eq("is_public", true).eq("is_active", true).order("display_order", { ascending: true });
        if (data) {
          setPlans(data.map((p: any) => ({
            id: p.id, name: p.name, price: p.price / 100, period: billingCycleLabels[p.billing_cycle] || p.billing_cycle,
            description: p.description || "", features: Array.isArray(p.features) ? p.features : [],
            popular: p.highlight_label?.toLowerCase() === "popular", highlight: p.highlight_label,
            maxProjects: p.max_projects, billingCycle: p.billing_cycle,
          })));
        }
      } catch (err) { console.error("Error fetching plans:", err); }
      finally { setLoading(false); }
    };
    fetchPlans();
  }, []);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
        </div>
      </AppLayout>
    );
  }

  const dailyPlans = plans.filter(p => p.billingCycle === "daily");
  const monthlyPlans = plans.filter(p => p.billingCycle === "monthly" && p.price < 20000);
  const wlPlan = plans.find(p => p.price >= 20000);

  return (
    <AppLayout>
      <div style={{ background: 'var(--bg-0)', minHeight: '100%' }}>
        <div className="rd-page-content" style={{ maxWidth: 1100, paddingTop: 48, paddingBottom: 48 }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div className="sec-label" style={{ marginBottom: 8 }}>Preços Transparentes</div>
            <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--text-primary)', marginBottom: 8 }}>
              Escolha o seu Plano
            </h1>
            <p className="body-text" style={{ maxWidth: 500, margin: '0 auto' }}>
              Planos flexíveis para todas as necessidades. Comece grátis e escale conforme cresce.
            </p>
          </div>

          {/* Daily plans */}
          <div className={`rd-grid-${dailyPlans.length >= 3 ? '3' : '2'}`} style={{ maxWidth: 900, margin: '0 auto', marginBottom: 24 }}>
            {dailyPlans.map((plan) => (
              <div key={plan.id} className="rd-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', border: plan.popular ? '1.5px solid rgba(245,158,11,0.35)' : undefined }}>
                {plan.popular && (
                  <span className="chip ch-orange" style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)' }}>
                    Mais Popular
                  </span>
                )}
                <div>
                  <div className="sec-label" style={{ marginBottom: 10 }}>{plan.name}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                    <span className="rd-stat-value">R${plan.price.toFixed(2).replace(".", ",")}</span>
                    <span className="caption">{plan.period}</span>
                  </div>
                  <p className="body-text" style={{ marginBottom: 16, minHeight: 40 }}>{plan.description}</p>

                  {plan.maxProjects && (
                    <div className="rd-alert info" style={{ marginBottom: 12, padding: '8px 12px' }}>
                      <Crown size={12} /> Até {plan.maxProjects} projetos
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                    {plan.features.map((feature, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <Check size={14} style={{ color: 'var(--green)', flexShrink: 0, marginTop: 2 }} />
                        <span className="body-text">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => plan.price === 0 ? navigate("/free") : navigate(`/checkout?plan=${plan.id}`)}
                  className={plan.popular ? "gl orange" : plan.price > 0 ? "gl" : "gl ghost"}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {plan.price === 0 ? "Começar Grátis" : "Selecionar Plano"}
                  <ArrowRight size={12} />
                </button>
              </div>
            ))}
          </div>

          {/* Monthly plans */}
          {monthlyPlans.length > 0 && (
            <div style={{ maxWidth: 900, margin: '0 auto', marginBottom: 24 }}>
              <div className="sec-label" style={{ textAlign: 'center', marginBottom: 14 }}>Planos Mensais</div>
              <div className="rd-grid-2">
                {monthlyPlans.map((plan) => (
                  <div key={plan.id} className="rd-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', border: plan.popular ? '1.5px solid rgba(245,158,11,0.35)' : undefined }}>
                    {plan.popular && (
                      <span className="chip ch-orange" style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)' }}>
                        Mais Popular
                      </span>
                    )}
                    <div>
                      <div className="sec-label" style={{ marginBottom: 10 }}>{plan.name}</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                        <span className="rd-stat-value">R${plan.price.toFixed(2).replace(".", ",")}</span>
                        <span className="caption">{plan.period}</span>
                      </div>
                      <p className="body-text" style={{ marginBottom: 16, minHeight: 40 }}>{plan.description}</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                        {plan.features.map((feature, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <Check size={14} style={{ color: 'var(--green)', flexShrink: 0, marginTop: 2 }} />
                            <span className="body-text">{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => navigate(`/checkout?plan=${plan.id}`)} className="gl" style={{ width: '100%', justifyContent: 'center' }}>
                      Selecionar Plano <ArrowRight size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* White Label */}
          {wlPlan && (
            <div className="rd-card-full" style={{ maxWidth: 900, margin: '0 auto', marginBottom: 24 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Building2 size={16} style={{ color: 'var(--purple)' }} />
                  <span className="sec-label" style={{ color: 'var(--purple-l)' }}>{wlPlan.highlight || "Empresas"}</span>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>{wlPlan.name}</div>
                  <p className="body-text" style={{ marginBottom: 12 }}>{wlPlan.description}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {wlPlan.features.map((f, i) => (
                      <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                        <Check size={12} style={{ color: 'var(--green)' }} /> {f}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <span className="rd-stat-value" style={{ fontSize: 24 }}>R${wlPlan.price.toFixed(2).replace(".", ",")}</span>
                    <span className="caption" style={{ marginLeft: 4 }}>{wlPlan.period}</span>
                    <div className="caption-sm" style={{ marginTop: 2 }}>+ 30% comissão por usuário ativo</div>
                  </div>
                  <button onClick={() => navigate("/whitelabel")} className="gl purple">
                    Saiba Mais <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <p className="caption-sm" style={{ opacity: .5, marginBottom: 8 }}>
              * Em breve, o plano Individual terá limite de projetos. Contrate o plano Agência para múltiplos projetos.
            </p>
            <p className="body-text">
              Precisa de um plano personalizado? <Link to="/suporte" style={{ color: 'var(--blue-l)' }}>Fale conosco</Link>
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}