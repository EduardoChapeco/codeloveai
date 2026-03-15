import { Link } from "react-router-dom";
import { ArrowRight, TrendingUp, DollarSign, Users, Zap, CheckCircle2, Star, ChevronDown, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import MeshBackground from "@/components/MeshBackground";
import { useState } from "react";

const benefits = [
  { icon: <DollarSign className="h-6 w-6" />, title: "Comissão Recorrente", desc: "Ganhe até 30% de comissão em cada assinatura indicada, mês após mês. Renda passiva real." },
  { icon: <TrendingUp className="h-6 w-6" />, title: "Painel Completo", desc: "Dashboard dedicado com rastreamento de cliques, conversões e pagamentos em tempo real." },
  { icon: <Zap className="h-6 w-6" />, title: "Materiais de Apoio", desc: "Banners, landing pages prontas e scripts de venda criados por especialistas em marketing." },
  { icon: <Users className="h-6 w-6" />, title: "Comunidade Exclusiva", desc: "Acesso a grupo VIP de afiliados com estratégias, suporte e conteúdo exclusivo." },
];

const tiers = [
  { name: "Starter", commission: "30%", req: "1+ indicação", color: "from-slate-500 to-slate-600" },
  { name: "Pro", commission: "30%", req: "6+ indicações/mês", color: "from-violet-500 to-purple-600", extra: "+ 20% desconto próprio" },
  { name: "Elite", commission: "30%", req: "21+ indicações/mês", color: "from-amber-500 to-orange-600", extra: "+ Bônus CodeCoins 2x" },
];

const faqs = [
  { q: "Quando recebo minhas comissões?", a: "Pagamentos são processados semanalmente (segundas-feiras) via PIX, para saldos acima de R$50." },
  { q: "Quem pode ser afiliado?", a: "Qualquer pessoa com conta ativa no Starble pode se tornar afiliado. Não é necessário ter indicações ativas para se cadastrar." },
  { q: "A comissão é sobre qual valor?", a: "Sobre o valor da venda realizada pelo cliente indicado, excluindo reembolsos e chargebacks." },
  { q: "Há limite de indicações?", a: "Não. Quanto mais você indica, mais você ganha — não há teto de comissão." },
  { q: "O que acontece se o cliente cancelar?", a: "A comissão se aplica sobre a venda já realizada. Para planos recorrentes, comissões futuras param quando o cliente cancela." },
];

export default function AffiliateLanding() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { user, loading: authLoading } = useAuth();

  const content = (
    <div className="min-h-screen bg-background text-foreground">
      {(!authLoading && !user) && <MeshBackground />}

      {/* Nav */}
      {(!authLoading && !user) && (
        <nav className="fixed top-0 inset-x-0 z-50 clf-glass-nav">
          <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-black text-xs">S</div>
              <span className="font-bold text-sm text-foreground">Starble</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link to="/login" className="gl ghost h-9 px-3 text-xs">Entrar</Link>
              <Link to="/register" className="gl primary h-9 px-4 text-xs">Criar conta grátis</Link>
            </div>
          </div>
        </nav>
      )}

      {/* Hero */}
      <section className={`${!user ? "pt-32" : "pt-12"} pb-24 px-6 text-center relative overflow-hidden`}>
        <div className="relative max-w-4xl mx-auto">
          <span className="chip chip-orange mb-6">Programa de Afiliados</span>
          <h1 className="text-4xl lg:text-5xl font-black text-foreground leading-tight mb-6" style={{ letterSpacing: "-0.04em" }}>
            Indique. Ganhe. Escale.
          </h1>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto mb-4">
            Transforme sua audiência em renda recorrente. Até <strong className="text-foreground">30% de comissão</strong> em cada cliente que você indicar — todo mês, enquanto ele for assinante.
          </p>
          <p className="text-xs text-muted-foreground mb-10">Sem custo de entrada. Sem taxa de adesão. Apenas resultados.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register" className="gl primary h-11 px-5 inline-flex items-center gap-2">
              Quero ser afiliado <ArrowRight className="h-5 w-5" />
            </Link>
            <Link to="/login" className="gl ghost h-11 px-5 inline-flex items-center gap-2">
              Já tenho conta
            </Link>
          </div>
        </div>
      </section>

      {/* Numbers */}
      <section className="py-12 border-y border-border/50">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: "30%", label: "comissão máxima" },
            { value: "R$0", label: "custo de entrada" },
            { value: "∞", label: "sem limite de indicações" },
            { value: "30d", label: "janela de rastreamento" },
          ].map((s, i) => (
            <div key={i}>
              <div className="text-3xl font-extrabold text-foreground" style={{ letterSpacing: "-0.03em" }}>{s.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-[28px] font-extrabold text-foreground text-center mb-14" style={{ letterSpacing: "-0.03em" }}>Por que afiliados <span className="text-primary">escolhem o Starble</span></h2>
          <div className="grid md:grid-cols-2 gap-6">
            {benefits.map((b, i) => (
              <div key={i} className="rd-card">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4">{b.icon}</div>
                <h3 className="text-[15px] font-bold text-foreground mb-2">{b.title}</h3>
                <p className="text-sm text-muted-foreground">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tiers */}
      <section className="py-24 px-6 border-y border-border/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-[28px] font-extrabold text-foreground text-center mb-4" style={{ letterSpacing: "-0.03em" }}>Estrutura de Comissões</h2>
          <p className="text-sm text-muted-foreground text-center mb-14">Evolua automaticamente conforme suas indicações crescem</p>
          <div className="grid md:grid-cols-3 gap-6">
            {tiers.map((t, i) => (
              <div key={i} className={`rd-card text-center ${i === 2 ? "ring-2 ring-primary/30" : ""}`}>
                <div className={`text-xs font-bold tracking-widest uppercase mb-4 bg-gradient-to-r ${t.color} bg-clip-text text-transparent`}>{t.name}</div>
                <div className="text-5xl font-extrabold text-foreground mb-2" style={{ letterSpacing: "-0.03em" }}>{t.commission}</div>
                <p className="text-xs text-muted-foreground">{t.req}</p>
                {"extra" in t && t.extra && <p className="text-xs text-primary mt-2 font-medium">{t.extra}</p>}
                {i === 2 && <div className="mt-4 inline-flex items-center gap-1 text-xs text-primary font-semibold"><Star className="h-3 w-3 fill-current" /> Mais popular</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-[28px] font-extrabold text-foreground text-center mb-14" style={{ letterSpacing: "-0.03em" }}>Como funciona em <span className="text-primary">3 passos</span></h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "1", title: "Crie sua conta", desc: "Acesse /register, crie sua conta gratuita e ative o programa de afiliados no dashboard." },
              { step: "2", title: "Compartilhe seu link", desc: "Copie seu link único e compartilhe onde sua audiência está — redes sociais, blog, YouTube, WhatsApp." },
              { step: "3", title: "Receba todo mês", desc: "Para cada assinatura ativa indicada por você, a comissão entra na sua conta mensalmente." },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="h-14 w-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary text-2xl font-black mx-auto mb-4">{s.step}</div>
                <h3 className="text-[15px] font-bold text-foreground mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-16 px-6 border-y border-border/50">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex justify-center gap-1 mb-4">{[...Array(5)].map((_, i) => <Star key={i} className="h-5 w-5 text-primary fill-primary" />)}</div>
          <p className="text-xl text-muted-foreground italic mb-4">"Em 3 meses como afiliado Starble, gerei mais de R$4.200 em recorrência. O painel é transparente e os pagamentos sempre no prazo."</p>
          <p className="text-sm font-semibold text-foreground">Lucas Andrade</p>
          <p className="text-xs text-muted-foreground">Creator Digital · 28k seguidores</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-[28px] font-extrabold text-foreground text-center mb-14" style={{ letterSpacing: "-0.03em" }}>Perguntas Frequentes</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="rd-card cursor-pointer">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-semibold text-foreground">{faq.q}</span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </div>
                {openFaq === i && <p className="text-sm text-muted-foreground mt-3 animate-fade-in">{faq.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-4xl lg:text-5xl font-black text-foreground leading-tight mb-4" style={{ letterSpacing: "-0.04em" }}>Comece a ganhar hoje</h2>
          <p className="text-base text-muted-foreground mb-8">Sem risco. Sem custo. Apenas resultados reais todo mês.</p>
          <Link to="/register" className="gl primary h-11 px-5 inline-flex items-center gap-2">
            Criar conta e ser afiliado <ArrowRight className="h-5 w-5" />
          </Link>
          <p className="text-xs text-muted-foreground mt-4"><Lock className="h-3 w-3 inline mr-1" />Dados protegidos. LGPD compliant.</p>
        </div>
      </section>

      <footer className="border-t border-border/50 py-8 px-6 text-center">
        <p className="text-xs text-muted-foreground">© 2026 Starble. Programa de Afiliados.</p>
        <div className="flex justify-center gap-6 mt-3">
          <Link to="/termos" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Termos de Uso</Link>
          <Link to="/faq" className="text-xs text-muted-foreground hover:text-foreground transition-colors">FAQ</Link>
          <Link to="/whitelabel" className="text-xs text-muted-foreground hover:text-foreground transition-colors">White Label</Link>
        </div>
      </footer>
    </div>
  );

  if (!authLoading && user) {
    return <AppLayout>{content}</AppLayout>;
  }
  return content;
}
