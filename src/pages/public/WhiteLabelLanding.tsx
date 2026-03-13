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
  name: "OrbIOS",
  slug: "orbios",
...
  const appName = brand.name || "OrbIOS";
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
          <h2 className="rd-heading text-center mb-14" style={{ fontSize: "1.5rem" }}>
            Infraestrutura <span className="text-foreground">pronta para escalar</span>
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className="rd-card">
                <div className="rd-ico-box mb-4">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="rd-body mb-2" style={{ fontWeight: 700 }}>{f.title}</h3>
                <p className="rd-body" style={{ opacity: 0.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="py-24 px-6 border-y border-border/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="rd-heading text-center mb-4" style={{ fontSize: "1.5rem" }}>Investimento</h2>
          <p className="rd-body text-center mb-14">Valores personalizados de acordo com volume e funcionalidades.</p>
          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {plans.map((p, i) => (
              <div key={i} className={`rd-card ${p.featured ? "ring-2 ring-foreground/10" : ""}`}>
                {p.featured && <p className="rd-label mb-3" style={{ textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 10, fontWeight: 700, color: "var(--text-primary)" }}>Mais escolhido</p>}
                <h3 className="rd-body mb-1" style={{ fontWeight: 700 }}>{p.name}</h3>
                <p className="rd-heading text-2xl mb-0">
                  {p.price}<span className="text-sm font-normal text-muted-foreground">{p.period}</span>
                </p>
                <p className="rd-label mb-6">{p.desc}</p>
                <ul className="space-y-2 mb-8">
                  {p.features.map((feat, j) => (
                    <li key={j} className="flex items-center gap-2 rd-body">
                      <CheckCircle2 className="h-4 w-4 text-foreground shrink-0" />{feat}
                    </li>
                  ))}
                </ul>
                <Link to={onboardingLink}
                  className={p.featured ? "gl primary w-full text-center" : "gl ghost w-full text-center"}>
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
            {[...Array(5)].map((_, i) => <Star key={i} className="h-5 w-5 text-foreground fill-foreground" />)}
          </div>
          <p className="text-xl text-muted-foreground italic mb-4">"Lançamos nossa plataforma de IA em 4 dias. Nossa agência passou de prestadora de serviços para empresa de produto. ROI em menos de 60 dias."</p>
          <p className="text-sm font-semibold text-foreground">Ana Paula Ramos</p>
          <p className="rd-label">CEO, Digital Growth Agency · SP</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-6 border-y border-border/50">
        <div className="max-w-2xl mx-auto">
          <h2 className="rd-heading text-center mb-14" style={{ fontSize: "1.5rem" }}>Perguntas Frequentes</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="rd-card cursor-pointer" style={{ padding: "14px" }}>
                <div className="flex items-center justify-between gap-4">
                  <span className="rd-body" style={{ fontWeight: 600 }}>{faq.q}</span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </div>
                {openFaq === i && <p className="rd-body mt-3 animate-fade-in" style={{ opacity: 0.6 }}>{faq.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="rd-heading mb-4" style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)" }}>Pronto para lançar sua plataforma?</h2>
          <p className="rd-body text-base mb-8">Configuração em 2 horas. Primeira venda em dias. Sua marca no mercado de IA.</p>
          <Link to={onboardingLink} className="gl primary lg inline-flex items-center gap-2">
            Configurar agora — é gratuito <ArrowRight className="h-5 w-5" />
          </Link>
          <p className="rd-label mt-4"><Lock className="h-3 w-3 inline mr-1" />Sem taxas de setup. Cancele quando quiser.</p>
        </div>
      </section>

      <footer className="border-t border-border/50 py-8 px-6 text-center">
        <p className="rd-label">© 2026 {appName}. Programa White Label.</p>
        <div className="flex justify-center gap-6 mt-3">
          <Link to="/termos" className="rd-label hover:text-foreground transition-colors">Termos</Link>
          <Link to="/afiliados" className="rd-label hover:text-foreground transition-colors">Afiliados</Link>
          <Link to="/ajuda" className="rd-label hover:text-foreground transition-colors">Ajuda</Link>
        </div>
      </footer>
    </div>
  );

  if (!authLoading && user) {
    return <AppLayout>{content}</AppLayout>;
  }
  return content;
}
