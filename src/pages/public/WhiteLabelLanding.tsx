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
  { name: "Diário", price: "R$3,90", period: "/usuário/dia", desc: "Pague apenas quando o usuário estiver ativo", cta: "Começar agora", features: ["Marca personalizada", "Domínio próprio", "5 planos customizáveis", "Suporte dedicado"] },
  { name: "Mensal", price: "R$29,90", period: "/usuário/mês", desc: "Economia de até 74% vs diário", cta: "Começar agora", features: ["Tudo do Diário", "Desconto recorrente", "Relatórios avançados", "Suporte prioritário", "SLA 99.9%"], featured: true },
];

const faqs = [
  { q: "Posso criar meu próprio programa de afiliados?", a: "Sim. Operadores White Label têm acesso a um sistema de afiliados próprio dentro do seu tenant, com splits de comissão configuráveis." },
  { q: "Meus clientes sabem a plataforma base?", a: "Não, se você configurar um domínio personalizado e sua própria marca. A experiência é completamente sua." },
  { q: "Quanto tempo leva para configurar?", a: "A configuração básica (marca + domínio + primeiros usuários) pode ser feita em menos de 2 horas. Nosso onboarding guiado te leva passo a passo." },
  { q: "Posso oferecer preços diferentes?", a: "Sim. Você define os preços para seus clientes. A plataforma cobra um custo por usuário — a margem é toda sua." },
  { q: "E se eu precisar de funcionalidades customizadas?", a: "Projetos Enterprise podem incluir desenvolvimento personalizado. Fale com nosso time comercial para avaliar a viabilidade." },
];

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

function lighten(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  let r = parseInt(h.substring(0, 2), 16);
  let g = parseInt(h.substring(2, 4), 16);
  let b = parseInt(h.substring(4, 6), 16);
  r = Math.min(255, Math.round(r + (255 - r) * amount));
  g = Math.min(255, Math.round(g + (255 - g) * amount));
  b = Math.min(255, Math.round(b + (255 - b) * amount));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function darken(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  let r = parseInt(h.substring(0, 2), 16);
  let g = parseInt(h.substring(2, 4), 16);
  let b = parseInt(h.substring(4, 6), 16);
  r = Math.max(0, Math.round(r * (1 - amount)));
  g = Math.max(0, Math.round(g * (1 - amount)));
  b = Math.max(0, Math.round(b * (1 - amount)));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

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
  const pc = brand.primary_color || "#6366f1";
  const sc = brand.secondary_color || darken(pc, 0.2);
  const ac = brand.accent_color || lighten(pc, 0.3);
  const pcLight = lighten(pc, 0.15);
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
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/40" />
      </div>
    );
  }

  const content = (
    <div className="min-h-screen text-white font-sans" style={{ backgroundColor: "#09090b" }}>
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5" style={{ backgroundColor: "rgba(9,9,11,0.8)", backdropFilter: "blur(16px)" }}>
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            {brand.logo_url ? (
              <img src={brand.logo_url} alt={appName} className="h-7 w-7 rounded-lg object-cover" />
            ) : (
              <div className="h-7 w-7 rounded-lg flex items-center justify-center text-white font-black text-xs"
                style={{ background: `linear-gradient(135deg, ${pc}, ${sc})` }}>
                {logoInitial}
              </div>
            )}
            <span className="font-bold text-sm">{appName}</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm text-white/60 hover:text-white transition-colors">Entrar</Link>
            <Link to={onboardingLink}
              className="text-sm px-4 py-1.5 rounded-lg text-white font-semibold transition-colors hover:opacity-90"
              style={{ backgroundColor: pc }}>
              Começar agora
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6 text-center relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] rounded-full blur-3xl pointer-events-none"
          style={{ backgroundColor: `rgba(${hexToRgb(pc)}, 0.08)` }} />
        <div className="relative max-w-4xl mx-auto">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase mb-6"
            style={{ backgroundColor: `rgba(${hexToRgb(pc)}, 0.1)`, border: `1px solid rgba(${hexToRgb(pc)}, 0.3)`, color: pcLight }}>
            White Label
          </span>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 bg-gradient-to-b from-white via-white to-white/40 bg-clip-text text-transparent">
            Sua Plataforma.<br />Seu Negócio.
          </h1>
          <p className="text-xl text-white/50 mb-4 max-w-2xl mx-auto">
            Lance uma plataforma de IA completa com a sua marca em dias, não meses.
            <br /><span className="text-white/80">Tecnologia que custaria R$500k para construir — disponível agora.</span>
          </p>
          <p className="text-sm text-white/30 mb-10 max-w-xl mx-auto">Perfeito para agências, empresas de tecnologia e empreendedores digitais que querem escalar com IA.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to={onboardingLink}
              className="px-8 py-4 rounded-xl text-white font-bold text-base hover:opacity-90 transition-opacity flex items-center gap-2 justify-center"
              style={{ background: `linear-gradient(to right, ${pc}, ${sc})` }}>
              Configurar meu White Label <ArrowRight className="h-5 w-5" />
            </Link>
            <Link to={faqLink} className="px-8 py-4 rounded-xl bg-white/5 border border-white/10 text-white font-semibold text-base hover:bg-white/[0.08] transition-colors">
              Ver documentação →
            </Link>
          </div>
        </div>
      </section>

      {/* Numbers */}
      <section className="py-12 border-y border-white/5">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: "R$3,90", label: "mínimo por usuário/dia" },
            { value: "100%", label: "da margem é sua" },
            { value: "∞", label: "usuários por tenant" },
            { value: "0", label: "taxa de setup" },
          ].map((s, i) => (
            <div key={i}>
              <div className="text-3xl font-black" style={{ color: pcLight }}>{s.value}</div>
              <div className="text-sm text-white/40 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-14">
            Infraestrutura <span style={{ color: pcLight }}>pronta para escalar</span>
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i}
                className="p-6 rounded-2xl border transition-colors group"
                style={{ backgroundColor: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.06)" }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = `rgba(${hexToRgb(pc)}, 0.3)`)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}>
                <div className="h-12 w-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: `rgba(${hexToRgb(pc)}, 0.1)`, border: `1px solid rgba(${hexToRgb(pc)}, 0.2)`, color: pcLight }}>
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="py-24 px-6 border-y border-white/5" style={{ backgroundColor: "rgba(255,255,255,0.01)" }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Investimento</h2>
          <p className="text-center text-white/40 text-sm mb-14">Valores personalizados de acordo com volume e funcionalidades.</p>
          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {plans.map((p, i) => (
              <div key={i} className="p-8 rounded-2xl border"
                style={{
                  borderColor: p.featured ? `rgba(${hexToRgb(pc)}, 0.4)` : "rgba(255,255,255,0.06)",
                  boxShadow: p.featured ? `0 0 0 2px rgba(${hexToRgb(pc)}, 0.15)` : "none",
                }}>
                {p.featured && <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: pcLight }}>Mais escolhido</div>}
                <h3 className="text-xl font-bold mb-1">{p.name}</h3>
                <p className="text-2xl font-black mb-0" style={{ color: pcLight }}>
                  {p.price}<span className="text-sm font-normal text-white/40">{p.period}</span>
                </p>
                <p className="text-xs text-white/40 mb-6">{p.desc}</p>
                <ul className="space-y-2 mb-8">
                  {p.features.map((feat, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-white/60">
                      <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: pcLight }} />{feat}
                    </li>
                  ))}
                </ul>
                <Link to={onboardingLink}
                  className="block text-center py-3 rounded-xl font-semibold text-sm transition-colors text-white hover:opacity-90"
                  style={{ backgroundColor: p.featured ? pc : "rgba(255,255,255,0.05)" }}>
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
            {[...Array(5)].map((_, i) => <Star key={i} className="h-5 w-5" style={{ color: pcLight, fill: pcLight }} />)}
          </div>
          <p className="text-xl text-white/70 italic mb-4">"Lançamos nossa plataforma de IA em 4 dias. Nossa agência passou de prestadora de serviços para empresa de produto. ROI em menos de 60 dias."</p>
          <p className="text-sm font-semibold">Ana Paula Ramos</p>
          <p className="text-xs text-white/30">CEO, Digital Growth Agency · SP</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-6 border-y border-white/5" style={{ backgroundColor: "rgba(255,255,255,0.01)" }}>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-14">Perguntas Frequentes</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <button key={i} onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full text-left p-5 rounded-xl border transition-colors"
                style={{ backgroundColor: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.06)" }}>
                <div className="flex items-center justify-between gap-4">
                  <span className="font-medium text-sm">{faq.q}</span>
                  <ChevronDown className={`h-4 w-4 text-white/40 shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </div>
                {openFaq === i && <p className="text-sm text-white/50 mt-3 leading-relaxed">{faq.a}</p>}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-4xl font-black mb-4">Pronto para lançar sua plataforma?</h2>
          <p className="text-white/50 mb-8">Configuração em 2 horas. Primeira venda em dias. Sua marca no mercado de IA.</p>
          <Link to={onboardingLink}
            className="inline-flex items-center gap-2 px-10 py-4 rounded-xl text-white font-bold text-base hover:opacity-90 transition-opacity"
            style={{ background: `linear-gradient(to right, ${pc}, ${sc})` }}>
            Configurar agora — é gratuito <ArrowRight className="h-5 w-5" />
          </Link>
          <p className="text-[11px] text-white/20 mt-4"><Lock className="h-3 w-3 inline mr-1" />Sem taxas de setup. Cancele quando quiser.</p>
        </div>
      </section>

      <footer className="border-t border-white/5 py-8 px-6 text-center text-xs text-white/20">
        <p>© 2026 {appName}. Programa White Label.</p>
        <div className="flex justify-center gap-6 mt-3">
          <Link to="/termos" className="hover:text-white/40 transition-colors">Termos</Link>
          <Link to="/afiliados" className="hover:text-white/40 transition-colors">Afiliados</Link>
          <Link to="/ajuda" className="hover:text-white/40 transition-colors">Ajuda</Link>
        </div>
      </footer>
    </div>
  );

  if (!authLoading && user) {
    return <AppLayout>{content}</AppLayout>;
  }
  return content;
}
