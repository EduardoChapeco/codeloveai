import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Zap, Clock, MessageSquare, Shield, ChevronDown, Puzzle, Code2, Sparkles, Users, Building2, ArrowRight, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSEO } from "@/hooks/useSEO";
import { useTenant } from "@/contexts/TenantContext";
import AppLayout from "@/components/AppLayout";
import MeshBackground from "@/components/MeshBackground";

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
  { q: "Como funciona a extensão?", a: "Após criar sua conta, você recebe automaticamente acesso à extensão e um token de ativação. Instale a extensão no navegador, ative com o token e comece a usar imediatamente." },
  { q: "Meus créditos do Lovable são descontados?", a: "Não. Nossa extensão utiliza um método próprio de comunicação. Nenhum crédito da sua conta Lovable é utilizado." },
  { q: "É realmente gratuito?", a: "Sim! O plano grátis inclui 10 mensagens por dia sem custo algum. Basta criar uma conta." },
  { q: "Posso ter minha conta bloqueada?", a: "Existe o risco de bloqueio, suspensão ou exclusão da sua conta Lovable a qualquer momento. A utilização da extensão é de sua total responsabilidade." },
  { q: "O que é o White Label?", a: "Com o White Label você cria sua própria plataforma com sua marca, cores, logo e domínio. Ideal para agências e revendedores." },
  { q: "Como funciona o programa de afiliados?", a: "Ao se tornar afiliado, você recebe um link único. Cada pessoa que assinar um plano através do seu link gera 30% de comissão recorrente para você." },
];

export default function Index() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { user, loading: authLoading } = useAuth();
  const { tenant } = useTenant();
  const brandName = "Starble Ai";
  useSEO({ title: brandName, description: "A extensão que turbina o Lovable sem gastar seus créditos. Mensagens ilimitadas, White Label e programa de afiliados." });
  const demoRef = useRef<HTMLDivElement>(null);

  const scrollToDemo = () => demoRef.current?.scrollIntoView({ behavior: "smooth" });

  const guestNav = !authLoading && !user ? (
    <nav className="sticky top-0 z-20 px-6 py-3 flex items-center justify-between">
      <div className="lv-glass rounded-2xl px-5 py-2.5 flex items-center justify-between w-full">
        <span className="text-base font-semibold tracking-tight text-foreground">{brandName}</span>
        <div className="flex items-center gap-2">
          <Link to="/community" className="lv-btn-ghost h-9 px-3 text-xs">Comunidade</Link>
          <Link to="/login" className="lv-btn-secondary h-9 px-4 text-xs">Entrar</Link>
          <Link to="/register" className="lv-btn-primary h-9 px-4 text-xs">Começar Grátis</Link>
        </div>
      </div>
    </nav>
  ) : null;

  const content = (
    <div className="min-h-screen relative">
      {!authLoading && !user && <MeshBackground />}
      {guestNav}

      {/* ━━━ HERO ━━━ */}
      <section className="px-6 py-24 lg:py-32 max-w-4xl mx-auto text-center animate-fade-in">
        <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary">10 mensagens grátis por dia</span>
        </div>
        <h1 className="lv-heading-xl mb-6">
          A extensão que turbina o Lovable<br />sem gastar seus créditos
        </h1>
        <p className="lv-body-lg text-base max-w-2xl mx-auto mb-10">
          Envie mensagens ilimitadas, gerencie projetos e automatize tarefas — tudo sem consumir tokens do Lovable.
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

      {/* ━━━ WHITE LABEL ━━━ */}
      <section className="px-6 pb-24 max-w-4xl mx-auto">
        <div className="lv-card p-8 md:p-12 text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <h2 className="lv-heading-lg mb-4">Tenha sua própria plataforma com sua marca</h2>
          <p className="lv-body-lg max-w-xl mx-auto mb-4">
            Sua logo, suas cores, seu domínio, seus preços. Revenda a extensão Starble com branding personalizado.
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

      {/* ━━━ AFFILIATES ━━━ */}
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

      {/* ━━━ FAQ ━━━ */}
      <section className="px-6 pb-24 max-w-2xl mx-auto">
        <p className="lv-overline text-center mb-3">Dúvidas frequentes</p>
        <h2 className="lv-heading-lg text-center mb-10">FAQ</h2>
        <div className="space-y-2">
          {faqs.map((faq, i) => (
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

      {/* ━━━ FOOTER ━━━ */}
      <footer className="border-t border-border/50 px-6 py-8">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="lv-caption">© {new Date().getFullYear()} {brandName} — Todos os direitos reservados</p>
          <div className="flex items-center gap-4">
            <Link to="/community" className="lv-caption hover:text-foreground transition-colors">Comunidade</Link>
            <Link to="/afiliados" className="lv-caption hover:text-foreground transition-colors">Afiliados</Link>
            <Link to="/whitelabel" className="lv-caption hover:text-foreground transition-colors">White Label</Link>
            <Link to="/faq" className="lv-caption hover:text-foreground transition-colors">FAQ</Link>
            <Link to="/termos" className="lv-caption hover:text-foreground transition-colors">Termos</Link>
            <Link to="/ajuda" className="lv-caption hover:text-foreground transition-colors">Ajuda</Link>
            <Link to="/suporte" className="lv-caption hover:text-foreground transition-colors">Suporte</Link>
          </div>
        </div>
      </footer>
    </div>
  );

  if (!authLoading && user) {
    return <AppLayout>{content}</AppLayout>;
  }
  return content;
}
