import { useState, useRef, useEffect } from "react";
import { Link, useSearchParams, Navigate } from "react-router-dom";
import { Zap, Clock, MessageSquare, Shield, ChevronDown, Puzzle, Code2, Sparkles, Users, Building2, ArrowRight, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSEO } from "@/hooks/useSEO";
import { useTenant } from "@/contexts/TenantContext";
import AppLayout from "@/components/AppLayout";
import MeshBackground from "@/components/MeshBackground";
import { hexToHSL, getThemePreset } from "@/lib/tenant-themes";

const benefits = [
  { icon: Zap, title: "Envios ilimitados", desc: "Envie quantas mensagens quiser, sem limite algum." },
  { icon: Clock, title: "24/7 sem parar", desc: "Funciona o dia todo, todos os dias, sem interrupções." },
  { icon: MessageSquare, title: "Sem descontar créditos", desc: "Seus créditos Lovable permanecem intactos." },
  { icon: Shield, title: "Seguro e confiável", desc: "Validação de dispositivo e criptografia de ponta." },
];

const plans = [
  {
    name: "Grátis",
    price: "R$0",
    period: "",
    badge: "Comece agora",
    features: ["10 mensagens/dia", "1 projeto", "Sem cartão de crédito", "Suporte comunidade"],
    cta: "Começar Grátis",
    href: "/register",
    highlight: false,
  },
  {
    name: "Individual",
    price: "R$4,90",
    period: "/dia",
    badge: "Mais popular",
    features: ["Mensagens ilimitadas", "Até 2 projetos", "Ativa por 24h", "Sem mensalidade fixa"],
    cta: "Comprar acesso",
    href: "/checkout",
    highlight: true,
  },
];

const faqs = [
  { q: "Como funciona a extensão?", a: "Após criar sua conta, você recebe automaticamente acesso à extensão e um token de ativação. Instale a extensão no navegador, ative com o token e comece a usar imediatamente.", wlOnly: false },
  { q: "Meus créditos do Lovable são descontados?", a: "Não. Nossa extensão utiliza um método próprio de comunicação. Nenhum crédito da sua conta Lovable é utilizado.", wlOnly: false },
  { q: "É realmente gratuito?", a: "Sim! O plano grátis inclui 10 mensagens por dia sem custo algum. Basta criar uma conta.", wlOnly: false },
  { q: "Posso ter minha conta bloqueada?", a: "Existe o risco de bloqueio, suspensão ou exclusão da sua conta Lovable a qualquer momento. A utilização da extensão é de sua total responsabilidade.", wlOnly: false },
  { q: "O que é o White Label?", a: "Com o White Label você cria sua própria plataforma com sua marca, cores, logo e domínio. Ideal para agências e revendedores.", wlOnly: true },
  { q: "Como funciona o programa de afiliados?", a: "Ao se tornar afiliado, você recebe um link único. Cada pessoa que assinar um plano através do seu link gera 30% de comissão recorrente para você.", wlOnly: true },
];

export default function Index() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { user, loading: authLoading } = useAuth();
  const { tenant } = useTenant();
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get("_preview") === "1";

  // Dynamic brand: preview params > tenant context > default
  const isDefaultTenant = !tenant || tenant.id === "a0000000-0000-0000-0000-000000000001";
  const brandName = isPreview
    ? (searchParams.get("name") || tenant?.name || "Starble Ai")
    : (tenant?.name || "Starble Ai");
  const brandLogo = isPreview
    ? searchParams.get("logo") ? decodeURIComponent(searchParams.get("logo")!) : tenant?.logo_url
    : tenant?.logo_url;

  const demoRef = useRef<HTMLDivElement>(null);
  useSEO({
    title: tenant?.meta_title || brandName,
    description: tenant?.meta_description || "A extensão que turbina o Lovable sem gastar seus créditos. Mensagens ilimitadas, White Label e programa de afiliados.",
  });

  // Apply theme overrides when in preview mode
  useEffect(() => {
    if (!isPreview) return;
    const root = document.documentElement;
    const overrides: Record<string, string> = {};

    const preset = searchParams.get("preset");
    if (preset) {
      const themePreset = getThemePreset(preset);
      if (themePreset) {
        Object.entries(themePreset.variables).forEach(([key, value]) => {
          overrides[key] = value;
        });
      }
    }

    const primary = searchParams.get("primary");
    const secondary = searchParams.get("secondary");
    const accent = searchParams.get("accent");
    if (primary) overrides["--primary"] = hexToHSL(primary);
    if (secondary) overrides["--secondary"] = hexToHSL(secondary);
    if (accent) overrides["--accent"] = hexToHSL(accent);

    const radius = searchParams.get("radius");
    if (radius) overrides["--radius"] = `${radius}px`;

    const font = searchParams.get("font");
    if (font) {
      const fontMap: Record<string, string> = {
        inter: "'Inter', sans-serif", poppins: "'Poppins', sans-serif",
        dm_sans: "'DM Sans', sans-serif", space_grotesk: "'Space Grotesk', sans-serif",
        nunito: "'Nunito', sans-serif", system: "system-ui, sans-serif",
      };
      if (fontMap[font]) root.style.fontFamily = fontMap[font];
    }

    const logoUrl = searchParams.get("logo");
    if (logoUrl) {
      // We'll handle logo in the rendering below via isPreview
    }

    Object.entries(overrides).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    return () => {
      Object.keys(overrides).forEach((key) => {
        root.style.removeProperty(key);
      });
      root.style.fontFamily = "";
    };
  }, [isPreview, searchParams]);

  const scrollToDemo = () => demoRef.current?.scrollIntoView({ behavior: "smooth" });

  const guestNav = ((!authLoading && !user) || isPreview) ? (
    <nav className="sticky top-0 z-20 px-6 py-3 flex items-center justify-between">
      <div className="lv-glass rounded-2xl px-5 py-2.5 flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          {brandLogo && <img src={brandLogo} alt="" className="h-6 w-6 object-contain rounded-md" />}
          <span className="text-base font-semibold tracking-tight text-foreground">{brandName}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/community" className="lv-btn-ghost h-9 px-3 text-xs">CodeLovers</Link>
          <Link to="/login" className="lv-btn-secondary h-9 px-4 text-xs">Entrar</Link>
          <Link to="/register" className="lv-btn-primary h-9 px-4 text-xs">Começar Grátis</Link>
        </div>
      </div>
    </nav>
  ) : null;

  const content = (
    <div className="min-h-screen relative">
      {(!authLoading && !user) && <MeshBackground />}
      {guestNav}

      {/* ━━━ HERO ━━━ */}
      <section className="px-6 py-24 lg:py-32 max-w-4xl mx-auto text-center animate-fade-in">
        <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary">🚀 30 dias grátis — tudo liberado!</span>
        </div>
        <h1 className="lv-heading-xl mb-6">
          {isDefaultTenant
            ? <>A extensão que turbina o Lovable<br />sem gastar seus créditos</>
            : <>Sua plataforma de IA.<br />Turbinada por {brandName}.</>
          }
        </h1>
        <p className="lv-body-lg text-base max-w-2xl mx-auto mb-10">
          {isDefaultTenant
            ? "Envie mensagens ilimitadas, gerencie projetos e automatize tarefas — tudo sem consumir tokens do Lovable."
            : `Envie mensagens ilimitadas, gerencie projetos e automatize tarefas com ${brandName}.`
          }
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link to="/register" className="lv-btn-primary lv-btn-lg">Começar Grátis</Link>
          <button onClick={scrollToDemo} className="lv-btn-secondary lv-btn-lg">Ver como funciona</button>
        </div>
      </section>

      {/* ━━━ BENEFITS ━━━ */}
      <section className="px-6 pb-24 max-w-5xl mx-auto">
        <p className="lv-overline text-center mb-3">Por que escolher</p>
        <h2 className="lv-heading-lg text-center mb-12">{brandName}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {benefits.map((b, i) => (
            <div key={b.title} className="lv-card flex flex-col items-start gap-4" style={{ animationDelay: `${i * 100}ms` }}>
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

      {/* ━━━ HOW IT WORKS ━━━ */}
      <section ref={demoRef} className="px-6 pb-24 max-w-4xl mx-auto">
        <p className="lv-overline text-center mb-3">Como funciona</p>
        <h2 className="lv-heading-lg text-center mb-12">3 passos simples</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { step: "01", icon: Code2, title: "Instale a extensão", desc: "Disponível para Chrome. Baixe e instale em segundos." },
            { step: "02", icon: Puzzle, title: "Conecte ao Lovable", desc: "Login automático detecta sua conta e sincroniza." },
            { step: "03", icon: Zap, title: "Use sem limite", desc: "Seu plano define o volume diário. Upgrade a qualquer momento." },
          ].map((item) => (
            <div key={item.step} className="lv-card text-center">
              <span className="text-4xl font-bold text-primary/10 mb-4 block">{item.step}</span>
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="lv-heading-sm mb-2">{item.title}</h3>
              <p className="lv-body">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ━━━ PLANS ━━━ */}
      <section className="px-6 pb-24 max-w-5xl mx-auto">
        <p className="lv-overline text-center mb-3">Planos</p>
        <h2 className="lv-heading-lg text-center mb-12">Escolha o melhor para você</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {plans.map((plan) => (
            <div key={plan.name} className={`lv-card flex flex-col ${plan.highlight ? 'ring-2 ring-primary/30' : ''}`}>
              {plan.highlight && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <span className="bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-full">{plan.badge}</span>
                </div>
              )}
              <div className="mb-6">
                <h3 className="lv-heading-sm mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="lv-stat text-3xl">{plan.price}</span>
                  <span className="lv-caption">{plan.period}</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    <span className="lv-body">{f}</span>
                  </li>
                ))}
              </ul>
              <Link to={plan.href} className={plan.highlight ? "lv-btn-primary w-full text-center" : "lv-btn-secondary w-full text-center"}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ━━━ WHITE LABEL (only for default tenant) ━━━ */}
      {isDefaultTenant && (
      <section className="px-6 pb-24 max-w-4xl mx-auto">
        <div className="lv-card p-8 md:p-12 text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <h2 className="lv-heading-lg mb-4">Tenha sua própria plataforma com sua marca</h2>
          <p className="lv-body-lg max-w-xl mx-auto mb-4">
            Sua logo, suas cores, seu domínio, seus preços. Revenda a extensão com branding personalizado.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            {["Sua logo e cores", "Domínio personalizado", "Painel de gestão", "Comissões automáticas"].map((f) => (
              <span key={f} className="lv-card-sm text-xs font-medium flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-primary" /> {f}
              </span>
            ))}
          </div>
          <p className="lv-caption mb-6">A partir de <strong className="text-foreground">R$3,90/usuário/dia</strong> ou <strong className="text-foreground">R$29,90/usuário/mês</strong></p>
          <Link to="/whitelabel" className="lv-btn-primary lv-btn-lg inline-flex items-center gap-2">
            Saiba mais sobre White Label <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
      )}

      {/* ━━━ AFFILIATES (only for default tenant) ━━━ */}
      {isDefaultTenant && (
      <section className="px-6 pb-24 max-w-4xl mx-auto">
        <div className="lv-card p-8 md:p-12 text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Users className="h-7 w-7 text-primary" />
          </div>
          <h2 className="lv-heading-lg mb-4">Indique e ganhe comissão recorrente</h2>
          <p className="lv-body-lg max-w-xl mx-auto mb-6">
            Ganhe <strong className="text-foreground">30% de comissão</strong> sobre cada plano vendido através do seu link de indicação. Pagamentos automáticos.
          </p>
          <Link to="/register?tipo=afiliado" className="lv-btn-primary lv-btn-lg inline-flex items-center gap-2">
            Quero ser afiliado <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
      )}

      {/* ━━━ FAQ ━━━ */}
      <section className="px-6 pb-24 max-w-2xl mx-auto">
        <p className="lv-overline text-center mb-3">Dúvidas frequentes</p>
        <h2 className="lv-heading-lg text-center mb-10">FAQ</h2>
        <div className="space-y-2">
          {faqs.filter(faq => isDefaultTenant || !faq.wlOnly).map((faq, i) => (
            <div key={i} className="lv-card-sm cursor-pointer" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
              <div className="flex items-center justify-between">
                <span className="lv-body-strong">{faq.q}</span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${openFaq === i ? "rotate-180" : ""}`} />
              </div>
              {openFaq === i && <p className="mt-3 lv-body animate-fade-in">{faq.a}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* ━━━ DONATE ━━━ */}
      {isDefaultTenant && (
      <section className="px-6 pb-16 max-w-2xl mx-auto text-center">
        <div className="clf-liquid-glass p-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-orange-500/5 pointer-events-none" />
          <div className="relative z-10">
            <span className="text-4xl mb-4 block">☕</span>
            <h3 className="lv-heading-sm mb-2">Gostou do projeto?</h3>
            <p className="lv-body mb-5">Doe um cafezinho via PIX pelo Mercado Pago e ajude a manter o projeto vivo!</p>
            <a
              href="https://link.mercadopago.com.br/starbleai"
              target="_blank"
              rel="noopener noreferrer"
              className="lv-btn-primary lv-btn-lg inline-flex items-center gap-2"
            >
              ☕ Doe um cafezinho
            </a>
            <p className="lv-caption mt-3 opacity-60">Qualquer valor é bem-vindo 💛</p>
          </div>
        </div>
      </section>
      )}

      {/* ━━━ FOOTER ━━━ */}
      <footer className="border-t border-border/50 px-6 py-8">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="lv-caption">© {new Date().getFullYear()} {brandName} — Todos os direitos reservados</p>
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <Link to="/community" className="lv-caption hover:text-foreground transition-colors">CodeLovers</Link>
            <Link to="/marketplace" className="lv-caption hover:text-foreground transition-colors">Marketplace</Link>
            {isDefaultTenant && <Link to="/afiliados" className="lv-caption hover:text-foreground transition-colors">Afiliados</Link>}
            {isDefaultTenant && <Link to="/whitelabel" className="lv-caption hover:text-foreground transition-colors">White Label</Link>}
            <Link to="/termos" className="lv-caption hover:text-foreground transition-colors">Termos</Link>
            <Link to="/ajuda" className="lv-caption hover:text-foreground transition-colors">Ajuda</Link>
            <Link to="/suporte" className="lv-caption hover:text-foreground transition-colors">Suporte</Link>
          </div>
        </div>
      </footer>
    </div>
  );

  if (isPreview) {
    return content;
  }
  // Authenticated users go straight to CodeLovers community
  if (!authLoading && user) {
    return <Navigate to="/community" replace />;
  }
  return content;
}
