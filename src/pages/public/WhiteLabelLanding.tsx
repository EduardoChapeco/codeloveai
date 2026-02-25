import { Link } from "react-router-dom";
import { ArrowRight, Building2, Globe, Users, Shield, Palette, BarChart2, ChevronDown, Lock, CheckCircle2, Star } from "lucide-react";
import { useState } from "react";

const features = [
  { icon: <Palette className="h-6 w-6" />, title: "Sua Marca. 100% Sua.", desc: "Logotipo, cores, domínio personalizado — seus clientes nunca saberão que é Starble por baixo. Marca branca completa." },
  { icon: <Users className="h-6 w-6" />, title: "Gestão de Clientes Integrada", desc: "Dashboard completo para gerenciar usuários, planos, limites de uso e faturamento — tudo num só lugar." },
  { icon: <BarChart2 className="h-6 w-6" />, title: "Relatórios e Analytics", desc: "Métricas de engajamento, retenção, receita e crescimento. Dados que embasam decisões estratégicas." },
  { icon: <Shield className="h-6 w-6" />, title: "SLA e Suporte Dedicado", desc: "Canal de suporte exclusivo para operadores White Label. Atendimento prioritário e SLA garantido." },
  { icon: <Globe className="h-6 w-6" />, title: "Domínio Personalizado", desc: "Configure seu próprio domínio (suaempresa.com.br) com SSL automático. Experiência completamente customizada." },
  { icon: <Building2 className="h-6 w-6" />, title: "Multi-tenant por Natureza", desc: "A arquitetura foi construída para white-label desde o início. Sem gambiarras ou adaptações superficiais." },
];

const plans = [
  { name: "Diário", price: "R$3,90", period: "/usuário/dia", desc: "Pague apenas quando o usuário estiver ativo", cta: "Começar agora", features: ["Marca personalizada", "Domínio próprio", "5 planos customizáveis", "Suporte dedicado"] },
  { name: "Mensal", price: "R$29,90", period: "/usuário/mês", desc: "Economia de até 74% vs diário", cta: "Começar agora", features: ["Tudo do Diário", "Desconto recorrente", "Relatórios avançados", "Suporte prioritário", "SLA 99.9%"], featured: true },
];

const faqs = [
  { q: "Posso criar meu próprio programa de afiliados?", a: "Sim. Operadores White Label têm acesso a um sistema de afiliados próprio dentro do seu tenant, com splits de comissão configuráveis." },
  { q: "Meus clientes sabem que é Starble?", a: "Não, se você configurar um domínio personalizado e sua própria marca. A experiência é completamente sua." },
  { q: "Quanto tempo leva para configurar?", a: "A configuração básica (marca + domínio + primeiros usuários) pode ser feita em menos de 2 horas. Nosso onboarding guiado te leva passo a passo." },
  { q: "Posso oferecer preços diferentes dos planos Starble?", a: "Sim. Você define os preços para seus clientes. A Starble cobra R$3,90/usuário/dia ou R$29,90/usuário/mês (mínimo) — a margem é toda sua." },
  { q: "E se eu precisar de funcionalidades customizadas?", a: "Projetos Enterprise podem incluir desenvolvimento personalizado. Fale com nosso time comercial para avaliar a viabilidade." },
];

export default function WhiteLabelLanding() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[#09090b] text-white font-sans">
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-black text-xs">S</div>
            <span className="font-bold text-sm">Starble</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm text-white/60 hover:text-white transition-colors">Entrar</Link>
            <Link to="/whitelabel/onboarding" className="text-sm px-4 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-semibold transition-colors">
              Começar agora
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6 text-center relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-indigo-500/8 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-4xl mx-auto">
          <span className="inline-block px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-bold tracking-widest uppercase mb-6">
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
            <Link to="/whitelabel/onboarding" className="px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold text-base hover:opacity-90 transition-opacity flex items-center gap-2 justify-center">
              Configurar meu White Label <ArrowRight className="h-5 w-5" />
            </Link>
            <Link to="/faq/whitelabel" className="px-8 py-4 rounded-xl bg-white/5 border border-white/10 text-white font-semibold text-base hover:bg-white/8 transition-colors">
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
              <div className="text-3xl font-black text-indigo-400">{s.value}</div>
              <div className="text-sm text-white/40 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-14">Infraestrutura <span className="text-indigo-400">pronta para escalar</span></h2>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className="p-6 rounded-2xl bg-white/3 border border-white/8 hover:border-indigo-500/30 transition-colors group">
                <div className="h-12 w-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">{f.icon}</div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="py-24 px-6 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Investimento</h2>
          <p className="text-center text-white/40 text-sm mb-14">Valores personalizados de acordo com volume e funcionalidades. Fale com nosso time.</p>
          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {plans.map((p, i) => (
              <div key={i} className={`p-8 rounded-2xl border ${p.featured ? "border-indigo-500/40 ring-2 ring-indigo-500/20" : "border-white/8"}`}>
                {p.featured && <div className="text-xs text-indigo-400 font-bold uppercase tracking-widest mb-3">Mais escolhido</div>}
                <h3 className="text-xl font-bold mb-1">{p.name}</h3>
                <p className="text-2xl font-black text-indigo-400 mb-0">{p.price}<span className="text-sm font-normal text-white/40">{p.period}</span></p>
                <p className="text-xs text-white/40 mb-6">{p.desc}</p>
                <ul className="space-y-2 mb-8">
                  {p.features.map((feat, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-white/60">
                      <CheckCircle2 className="h-4 w-4 text-indigo-400 shrink-0" />{feat}
                    </li>
                  ))}
                </ul>
                <Link to="/whitelabel/onboarding" className={`block text-center py-3 rounded-xl font-semibold text-sm transition-colors ${p.featured ? "bg-indigo-500 hover:bg-indigo-400 text-white" : "bg-white/5 hover:bg-white/10 text-white"}`}>
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
          <div className="flex justify-center gap-1 mb-4">{[...Array(5)].map((_, i) => <Star key={i} className="h-5 w-5 text-indigo-400 fill-indigo-400" />)}</div>
          <p className="text-xl text-white/70 italic mb-4">"Lançamos nossa plataforma de IA para marketing digital em 4 dias. Nossa agência passou de prestadora de serviços para empresa de produto. ROI em menos de 60 dias."</p>
          <p className="text-sm font-semibold">Ana Paula Ramos</p>
          <p className="text-xs text-white/30">CEO, Digital Growth Agency · SP</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-6 bg-white/[0.02] border-y border-white/5">
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
      <section className="py-24 px-6 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-4xl font-black mb-4">Pronto para lançar sua plataforma?</h2>
          <p className="text-white/50 mb-8">Configuração em 2 horas. Primeira venda em dias. Sua marca no mercado de IA.</p>
          <Link to="/whitelabel/onboarding" className="inline-flex items-center gap-2 px-10 py-4 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold text-base hover:opacity-90 transition-opacity">
            Configurar agora — é gratuito <ArrowRight className="h-5 w-5" />
          </Link>
          <p className="text-[11px] text-white/20 mt-4"><Lock className="h-3 w-3 inline mr-1" />Sem taxas de setup. Cancele quando quiser.</p>
        </div>
      </section>

      <footer className="border-t border-white/5 py-8 px-6 text-center text-xs text-white/20">
        <p>© 2026 Starble. Programa White Label.</p>
        <div className="flex justify-center gap-6 mt-3">
          <Link to="/termos" className="hover:text-white/40 transition-colors">Termos</Link>
          <Link to="/afiliados" className="hover:text-white/40 transition-colors">Afiliados</Link>
          <Link to="/ajuda" className="hover:text-white/40 transition-colors">Ajuda</Link>
        </div>
      </footer>
    </div>
  );
}
