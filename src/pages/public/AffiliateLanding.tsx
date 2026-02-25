import { Link } from "react-router-dom";
import { ArrowRight, TrendingUp, DollarSign, Users, Zap, CheckCircle2, Star, ChevronDown, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
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
    <div className="min-h-screen bg-[#09090b] text-white font-sans">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-black text-xs">S</div>
            <span className="font-bold text-sm">Starble</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm text-white/60 hover:text-white transition-colors">Entrar</Link>
            <Link to="/register" className="text-sm px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold transition-colors">
              Criar conta grátis
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6 text-center relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-amber-500/8 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-4xl mx-auto">
          <span className="inline-block px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold tracking-widest uppercase mb-6">
            Programa de Afiliados
          </span>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 bg-gradient-to-b from-white via-white to-white/40 bg-clip-text text-transparent">
            Indique.<br />Ganhe. Escale.
          </h1>
          <p className="text-xl text-white/50 mb-4 max-w-2xl mx-auto">
            Transforme sua audiência em renda recorrente. Até <strong className="text-amber-400">30% de comissão</strong> em cada cliente que você indicar — todo mês, enquanto ele for assinante.
          </p>
          <p className="text-sm text-white/30 mb-10">Sem custo de entrada. Sem taxa de adesão. Apenas resultados.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register" className="px-8 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-base hover:opacity-90 transition-opacity flex items-center gap-2 justify-center">
              Quero ser afiliado <ArrowRight className="h-5 w-5" />
            </Link>
            <Link to="/login" className="px-8 py-4 rounded-xl bg-white/5 border border-white/10 text-white font-semibold text-base hover:bg-white/8 transition-colors">
              Já tenho conta →
            </Link>
          </div>
        </div>
      </section>

      {/* Numbers */}
      <section className="py-12 border-y border-white/5">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: "30%", label: "comissão máxima" },
            { value: "R$0", label: "custo de entrada" },
            { value: "∞", label: "sem limite de indicações" },
            { value: "30d", label: "janela de rastreamento" },
          ].map((s, i) => (
            <div key={i}>
              <div className="text-3xl font-black text-amber-400">{s.value}</div>
              <div className="text-sm text-white/40 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-14">Por que afiliados <span className="text-amber-400">escolhem o Starble</span></h2>
          <div className="grid md:grid-cols-2 gap-6">
            {benefits.map((b, i) => (
              <div key={i} className="p-6 rounded-2xl bg-white/3 border border-white/8 hover:border-amber-500/30 transition-colors group">
                <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">{b.icon}</div>
                <h3 className="font-semibold mb-2">{b.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tiers */}
      <section className="py-24 px-6 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Estrutura de Comissões</h2>
          <p className="text-white/40 text-center mb-14 text-sm">Evolua automaticamente conforme suas indicações crescem</p>
          <div className="grid md:grid-cols-3 gap-6">
            {tiers.map((t, i) => (
              <div key={i} className={`p-6 rounded-2xl border border-white/8 text-center ${i === 2 ? "ring-2 ring-amber-500/40" : ""}`}>
                <div className={`text-xs font-bold tracking-widest uppercase mb-4 bg-gradient-to-r ${t.color} bg-clip-text text-transparent`}>{t.name}</div>
                <div className="text-5xl font-black mb-2">{t.commission}</div>
                <p className="text-xs text-white/40">{t.req}</p>
                {"extra" in t && t.extra && <p className="text-xs text-amber-400 mt-2 font-medium">{t.extra}</p>}
                {i === 2 && <div className="mt-4 inline-flex items-center gap-1 text-xs text-amber-400 font-semibold"><Star className="h-3 w-3 fill-amber-400" /> Mais popular</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-14">Como funciona em <span className="text-amber-400">3 passos</span></h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "1", title: "Crie sua conta", desc: "Acesse /register, crie sua conta gratuita e ative o programa de afiliados no dashboard." },
              { step: "2", title: "Compartilhe seu link", desc: "Copie seu link único e compartilhe onde sua audiência está — redes sociais, blog, YouTube, WhatsApp." },
              { step: "3", title: "Receba todo mês", desc: "Para cada assinatura ativa indicada por você, a comissão entra na sua conta mensalmente." },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="h-14 w-14 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-2xl font-black mx-auto mb-4">{s.step}</div>
                <h3 className="font-semibold mb-2">{s.title}</h3>
                <p className="text-sm text-white/40">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-16 px-6 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex justify-center gap-1 mb-4">{[...Array(5)].map((_, i) => <Star key={i} className="h-5 w-5 text-amber-400 fill-amber-400" />)}</div>
          <p className="text-xl text-white/70 italic mb-4">"Em 3 meses como afiliado Starble, gerei mais de R$4.200 em recorrência. O painel é transparente e os pagamentos sempre no prazo."</p>
          <p className="text-sm font-semibold">Lucas Andrade</p>
          <p className="text-xs text-white/30">Creator Digital · 28k seguidores</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-14">Perguntas Frequentes</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <button key={i} onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full text-left p-5 rounded-xl bg-white/3 border border-white/8 hover:border-white/15 transition-colors">
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
      <section className="py-24 px-6 text-center bg-gradient-to-b from-transparent to-amber-950/20">
        <div className="max-w-xl mx-auto">
          <h2 className="text-4xl font-black mb-4">Comece a ganhar hoje</h2>
          <p className="text-white/50 mb-8">Sem risco. Sem custo. Apenas resultados reais todo mês.</p>
          <Link to="/register" className="inline-flex items-center gap-2 px-10 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-base hover:opacity-90 transition-opacity">
            Criar conta e ser afiliado <ArrowRight className="h-5 w-5" />
          </Link>
          <p className="text-[11px] text-white/20 mt-4"><Lock className="h-3 w-3 inline mr-1" />Dados protegidos. LGPD compliant.</p>
        </div>
      </section>

      <footer className="border-t border-white/5 py-8 px-6 text-center text-xs text-white/20">
        <p>© 2026 Starble. Programa de Afiliados.</p>
        <div className="flex justify-center gap-6 mt-3">
          <Link to="/termos" className="hover:text-white/40 transition-colors">Termos de Uso</Link>
          <Link to="/faq" className="hover:text-white/40 transition-colors">FAQ</Link>
          <Link to="/whitelabel" className="hover:text-white/40 transition-colors">White Label</Link>
        </div>
      </footer>
    </div>
  );

  if (!authLoading && user) {
    return <AppLayout>{content}</AppLayout>;
  }
  return content;
}
