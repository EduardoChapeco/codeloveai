import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Building2, Globe, Users, Shield, Palette, BarChart2, ChevronDown, Lock, CheckCircle2, Star, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TenantBranding {
  id: string;
  name: string;
  slug: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  logo_url: string | null;
  favicon_url: string | null;
  font_family: string;
  border_radius: string;
  theme_preset: string;
  meta_title: string | null;
  meta_description: string | null;
}

const DEFAULT_TENANT_ID = "a0000000-0000-0000-0000-000000000001";

const defaultBranding: TenantBranding = {
  id: DEFAULT_TENANT_ID,
  name: "Starble",
  slug: "starble",
  primary_color: "#6366f1",
  secondary_color: "#4f46e5",
  accent_color: "#818cf8",
  logo_url: null,
  favicon_url: null,
  font_family: "Inter",
  border_radius: "0.75rem",
  theme_preset: "default",
  meta_title: null,
  meta_description: null,
};

const features = [
  { icon: Palette, title: "Sua Marca. 100% Sua.", desc: "Logotipo, cores, domínio personalizado — seus clientes nunca saberão o que há por baixo. Marca branca completa." },
  { icon: Users, title: "Gestão de Clientes Integrada", desc: "Dashboard completo para gerenciar usuários, planos, limites de uso e faturamento — tudo num só lugar." },
  { icon: BarChart2, title: "Relatórios e Analytics", desc: "Métricas de engajamento, retenção, receita e crescimento. Dados que embasam decisões estratégicas." },
  { icon: Shield, title: "SLA e Suporte Dedicado", desc: "Canal de suporte exclusivo para operadores White Label. Atendimento prioritário e SLA garantido." },
  { icon: Globe, title: "Domínio Personalizado", desc: "Configure seu próprio domínio com SSL automático. Experiência completamente customizada." },
  { icon: Building2, title: "Multi-tenant por Natureza", desc: "A arquitetura foi construída para white-label desde o início. Sem gambiarras ou adaptações superficiais." },
];

const plans = [
  { name: "Diário", price: "R$7,96", period: "/usuário/dia", desc: "40% do preço final — pague apenas quando o usuário estiver ativo", cta: "Começar agora", features: ["Marca personalizada", "Domínio próprio", "Planos customizáveis", "Suporte dedicado"] },
  { name: "Mensal", price: "R$59,96", period: "/usuário/mês", desc: "40% do preço final — economia vs diário", cta: "Começar agora", features: ["Tudo do Diário", "Desconto recorrente", "Relatórios avançados", "Suporte prioritário", "SLA 99.9%"], featured: true },
];

const faqs = [
  { q: "Posso criar meu próprio programa de afiliados?", a: "Sim. Operadores White Label têm acesso a um sistema de afiliados próprio dentro do seu tenant, com splits de comissão configuráveis." },
  { q: "Meus clientes sabem a plataforma base?", a: "Não, se você configurar um domínio personalizado e sua própria marca. A experiência é completamente sua." },
  { q: "Quanto tempo leva para configurar?", a: "A configuração básica (marca + domínio + primeiros usuários) pode ser feita em menos de 2 horas. Nosso onboarding guiado te leva passo a passo." },
  { q: "Posso oferecer preços diferentes?", a: "Sim. Você define os preços para seus clientes. A plataforma cobra um custo por usuário — a margem é toda sua." },
  { q: "E se eu precisar de funcionalidades customizadas?", a: "Projetos Enterprise podem incluir desenvolvimento personalizado. Fale com nosso time comercial para avaliar a viabilidade." },
];

export default function WhiteLabelLanding() {
  const [searchParams] = useSearchParams();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { user, loading: authLoading } = useAuth();
  const [brand, setBrand] = useState<TenantBranding>(defaultBranding);
  const [loading, setLoading] = useState(true);

  const tenantSlug = searchParams.get("tenant");

  useEffect(() => {
    async function loadTenantBranding() {
      if (!tenantSlug) {
        setLoading(false);
        return;
      }
      try {
        const sanitized = tenantSlug.replace(/[^a-zA-Z0-9_-]/g, "").substring(0, 50);
        const { data } = await supabase
          .from("tenants")
          .select("id,name,slug,primary_color,secondary_color,accent_color,logo_url,favicon_url,font_family,border_radius,theme_preset,meta_title,meta_description")
          .eq("slug", sanitized)
          .eq("is_active", true)
          .maybeSingle();
        if (data) {
          setBrand(data as TenantBranding);
        }
      } catch { /* fallback to default */ }
      setLoading(false);
    }
    loadTenantBranding();
  }, [tenantSlug]);

  const isCustom = brand.id !== DEFAULT_TENANT_ID;
  const appName = brand.name || "Starble";
  const logoInitial = appName.charAt(0).toUpperCase();

  const onboardingLink = isCustom
    ? `/whitelabel/onboarding?tenant=${brand.slug}`
    : "/whitelabel/onboarding";

  const faqLink = isCustom
    ? `/faq/whitelabel?tenant=${brand.slug}`
    : "/faq/whitelabel";

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const content = (
    <div className="min-h-screen bg-background text-foreground">

      {/* Nav */}
      {(!authLoading && !user) && (
        <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/60">
          <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              {brand.logo_url ? (
                <img src={brand.logo_url} alt={appName} className="h-7 w-7 rounded-lg object-cover" />
              ) : (
                <div className="h-7 w-7 rounded-lg bg-foreground flex items-center justify-center text-background font-black text-xs">
                  {logoInitial}
                </div>
              )}
              <span className="font-bold text-sm text-foreground">{appName}</span>
            </Link>
            <div className="flex items-center gap-3">
              <Link to="/login" className="gl sm ghost">Entrar</Link>
              <Link to={onboardingLink} className="gl sm primary">Começar agora</Link>
            </div>
          </div>
        </nav>
      )}

      {/* Hero */}
      <section className={`${!user ? "pt-12" : "pt-12"} pb-24 px-6 text-center relative overflow-hidden`}>
        <div className="relative max-w-4xl mx-auto">
          <span className="chip indigo mb-6">White Label</span>
          <h1 className="rd-heading mb-6" style={{ fontSize: "clamp(1.5rem, 4vw, 2.5rem)" }}>
            Sua Plataforma. Seu Negócio.
          </h1>
          <p className="rd-body text-base max-w-2xl mx-auto mb-4">
            Lance uma plataforma de IA completa com a sua marca em dias, não meses.
            <br /><span className="text-foreground">Tecnologia que custaria R$500k para construir — disponível agora.</span>
          </p>
          <p className="rd-label mb-10 max-w-xl mx-auto">Perfeito para agências, empresas de tecnologia e empreendedores digitais que querem escalar com IA.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to={onboardingLink} className="gl primary lg inline-flex items-center gap-2">
              Configurar meu White Label <ArrowRight className="h-5 w-5" />
            </Link>
            <Link to={faqLink} className="gl lg ghost">
              Ver documentação
            </Link>
          </div>
        </div>
      </section>

      {/* Numbers */}
      <section className="py-12 border-y border-border/50">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: "R$7,96", label: "custo por usuário/dia (40%)" },
            { value: "100%", label: "da margem é sua" },
            { value: "∞", label: "usuários por tenant" },
            { value: "0", label: "taxa de setup" },
          ].map((s, i) => (
            <div key={i}>
              <div className="rd-heading text-3xl">{s.value}</div>
              <p className="rd-label mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="lv-heading-lg text-center mb-14">
            Infraestrutura <span className="text-primary">pronta para escalar</span>
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className="lv-card">
                <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="lv-heading-sm mb-2">{f.title}</h3>
                <p className="lv-body">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="py-24 px-6 border-y border-border/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="lv-heading-lg text-center mb-4">Investimento</h2>
          <p className="lv-body text-center mb-14">Valores personalizados de acordo com volume e funcionalidades.</p>
          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {plans.map((p, i) => (
              <div key={i} className={`lv-card ${p.featured ? "ring-2 ring-primary/30" : ""}`}>
                {p.featured && <p className="lv-overline text-primary mb-3">Mais escolhido</p>}
                <h3 className="lv-heading-sm mb-1">{p.name}</h3>
                <p className="lv-stat text-2xl mb-0">
                  {p.price}<span className="text-sm font-normal text-muted-foreground">{p.period}</span>
                </p>
                <p className="lv-caption mb-6">{p.desc}</p>
                <ul className="space-y-2 mb-8">
                  {p.features.map((feat, j) => (
                    <li key={j} className="flex items-center gap-2 lv-body">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />{feat}
                    </li>
                  ))}
                </ul>
                <Link to={onboardingLink}
                  className={p.featured ? "lv-btn-primary w-full text-center" : "lv-btn-secondary w-full text-center"}>
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex justify-center gap-1 mb-4">
            {[...Array(5)].map((_, i) => <Star key={i} className="h-5 w-5 text-primary fill-primary" />)}
          </div>
          <p className="text-xl text-muted-foreground italic mb-4">"Lançamos nossa plataforma de IA em 4 dias. Nossa agência passou de prestadora de serviços para empresa de produto. ROI em menos de 60 dias."</p>
          <p className="text-sm font-semibold text-foreground">Ana Paula Ramos</p>
          <p className="lv-caption">CEO, Digital Growth Agency · SP</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-6 border-y border-border/50">
        <div className="max-w-2xl mx-auto">
          <h2 className="lv-heading-lg text-center mb-14">Perguntas Frequentes</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="lv-card-sm cursor-pointer">
                <div className="flex items-center justify-between gap-4">
                  <span className="lv-body-strong">{faq.q}</span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </div>
                {openFaq === i && <p className="lv-body mt-3 animate-fade-in">{faq.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="lv-heading-xl mb-4">Pronto para lançar sua plataforma?</h2>
          <p className="lv-body-lg mb-8">Configuração em 2 horas. Primeira venda em dias. Sua marca no mercado de IA.</p>
          <Link to={onboardingLink} className="lv-btn-primary lv-btn-lg inline-flex items-center gap-2">
            Configurar agora — é gratuito <ArrowRight className="h-5 w-5" />
          </Link>
          <p className="lv-caption mt-4"><Lock className="h-3 w-3 inline mr-1" />Sem taxas de setup. Cancele quando quiser.</p>
        </div>
      </section>

      <footer className="border-t border-border/50 py-8 px-6 text-center">
        <p className="lv-caption">© 2026 {appName}. Programa White Label.</p>
        <div className="flex justify-center gap-6 mt-3">
          <Link to="/termos" className="lv-caption hover:text-foreground transition-colors">Termos</Link>
          <Link to="/afiliados" className="lv-caption hover:text-foreground transition-colors">Afiliados</Link>
          <Link to="/ajuda" className="lv-caption hover:text-foreground transition-colors">Ajuda</Link>
        </div>
      </footer>
    </div>
  );

  if (!authLoading && user) {
    return <AppLayout>{content}</AppLayout>;
  }
  return content;
}
