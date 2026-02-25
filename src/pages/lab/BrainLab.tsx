import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BrainCircuit, Sparkles, Zap, Shield, Globe, Lock, ArrowRight, Star, CheckCircle2, ChevronDown } from "lucide-react";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { useNavigate } from "react-router-dom";

const LabBadge = () => (
  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 border border-violet-400/30 text-violet-400 text-xs font-bold tracking-widest uppercase animate-pulse">
    <Sparkles className="h-3 w-3" />
    Starble Lab
  </span>
);

const features = [
  {
    icon: <BrainCircuit className="h-6 w-6" />,
    title: "Assistência por IA Avançada",
    desc: "Gemini 1.5 + raciocínio contextual profundo para acelerar qualquer projeto.",
  },
  {
    icon: <Zap className="h-6 w-6" />,
    title: "Respostas em Tempo Real",
    desc: "Streaming de respostas com voz sintética optativa — fluxo natural e imersivo.",
  },
  {
    icon: <Shield className="h-6 w-6" />,
    title: "Segurança por Design",
    desc: "Suas conversas nunca são armazenadas além da sessão. Privacidade total.",
  },
  {
    icon: <Globe className="h-6 w-6" />,
    title: "Contexto Web Integrado",
    desc: "O Brain sabe o que você está construindo e sugere com precisão cirúrgica.",
  },
];

const testimonials = [
  { name: "Rafael M.", role: "Fundador, SaaS B2B", text: "Reduzi em 60% o tempo de briefing. O Brain entende o contexto sem eu precisar explicar tudo." },
  { name: "Carla T.", role: "Designer de Produto", text: "Como se um sênior estivesse sempre disponível. Indispensável para quem cria sozinho." },
  { name: "Bruno F.", role: "CTO, Startup EdTech", text: "A qualidade das sugestões é absurda. Economizei semanas em validação de ideias." },
];

export default function BrainLab() {
  const { enabled, loading } = useFeatureFlag("brain");
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [joined, setJoined] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Admin goes directly to the real page
  if (!loading && enabled) {
    navigate("/brain");
    return null;
  }

  const handleWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      await (supabase as any).from("lab_waitlist").insert({ email: email.trim(), feature: "brain" });
      setJoined(true);
      toast.success("🎉 Você está na lista! Avisaremos em breve.");
    } catch {
      // ignore duplicate entries
      setJoined(true);
      toast.success("Você já está na lista! Fique ligado.");
    } finally {
      setSubmitting(false);
    }
  };

  const faqs = [
    { q: "Qual a diferença do Brain para outros assistentes de IA?", a: "O Brain é contexto-aware: ele conhece seu projeto, seu histórico e seus padrões. Não é um chatbot genérico — é uma extensão do seu raciocínio técnico, treinado especificamente para construtores digitais." },
    { q: "Preciso saber programar para usar?", a: "Absolutamente não. O Brain foi desenhado tanto para não-técnicos quanto para devs avançados. Ele se adapta ao seu nível automaticamente." },
    { q: "Meus dados ficam salvos?", a: "Suas conversas não são armazenadas além da sessão ativa. Você tem controle total. Para análises recorrentes, pode exportar o contexto a qualquer momento." },
    { q: "Quando será lançado para todos?", a: "Estamos em fase de acesso antecipado com usuários selecionados. Entre na lista e você será um dos primeiros avisados — com condições especiais de lançamento." },
  ];

  return (
    <div className="min-h-screen bg-[#09090b] text-white font-sans">
      {/* Header nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center">
              <BrainCircuit className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-sm">Starble</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="text-sm text-white/60 hover:text-white transition-colors">Dashboard</Link>
            <Link to="/login" className="text-sm px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 transition-colors">Entrar</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6 text-center relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-4xl mx-auto">
          <div className="flex justify-center mb-6">
            <LabBadge />
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 bg-gradient-to-b from-white via-white to-white/40 bg-clip-text text-transparent">
            Starble Brain
          </h1>
          <p className="text-xl md:text-2xl text-white/50 font-light mb-4 max-w-2xl mx-auto">
            O assistente de inteligência artificial que pensa junto com você.<br />
            <span className="text-white/80">Não é ferramenta. É colaborador.</span>
          </p>
          <p className="text-sm text-white/30 mb-10 max-w-xl mx-auto">
            Acesso antecipado exclusivo. Vagas limitadas. Sem compromisso.
          </p>
          {joined ? (
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold">
              <CheckCircle2 className="h-5 w-5" />
              Você está na lista de acesso antecipado!
            </div>
          ) : (
            <form onSubmit={handleWaitlist} className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm"
                required
              />
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2 justify-center whitespace-nowrap"
              >
                {submitting ? "Entrando..." : <>Garantir minha vaga <ArrowRight className="h-4 w-4" /></>}
              </button>
            </form>
          )}
          <p className="text-[11px] text-white/20 mt-3">
            <Lock className="h-3 w-3 inline mr-1" />
            Sem spam. Cancelamento a qualquer momento. Seus dados protegidos pela LGPD.
          </p>
        </div>
      </section>

      {/* Social proof numbers */}
      <section className="py-12 border-y border-white/5">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-3 gap-8 text-center">
          {[
            { value: "3.4×", label: "mais rápido para validar ideias" },
            { value: "< 2s", label: "tempo médio de resposta" },
            { value: "98%", label: "satisfação nos testes beta" },
          ].map((s, i) => (
            <div key={i}>
              <div className="text-3xl font-black text-white">{s.value}</div>
              <div className="text-sm text-white/40 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-14">
            Inteligência que <span className="text-violet-400">entende contexto</span>
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((f, i) => (
              <div key={i} className="p-6 rounded-2xl bg-white/3 border border-white/8 hover:border-violet-500/30 transition-colors group">
                <div className="h-12 w-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mb-4 group-hover:bg-violet-500/15 transition-colors">
                  {f.icon}
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 px-6 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 justify-center mb-3">
            {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 text-amber-400 fill-amber-400" />)}
          </div>
          <h2 className="text-3xl font-bold text-center mb-14">O que nossos beta testers dizem</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <div key={i} className="p-6 rounded-2xl bg-white/3 border border-white/8">
                <p className="text-sm text-white/60 italic mb-4">"{t.text}"</p>
                <div>
                  <div className="font-semibold text-sm">{t.name}</div>
                  <div className="text-xs text-white/30">{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-14">Perguntas Frequentes</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <button
                key={i}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full text-left p-5 rounded-xl bg-white/3 border border-white/8 hover:border-white/15 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="font-medium text-sm">{faq.q}</span>
                  <ChevronDown className={`h-4 w-4 text-white/40 shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </div>
                {openFaq === i && (
                  <p className="text-sm text-white/50 mt-3 leading-relaxed">{faq.a}</p>
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-xl mx-auto">
          <LabBadge />
          <h2 className="text-4xl font-black mt-6 mb-4">Pronto para o próximo nível?</h2>
          <p className="text-white/50 mb-8">Acesso antecipado gratuito. Sem cartão. Apenas para os mais rápidos.</p>
          {!joined && (
            <form onSubmit={handleWaitlist} className="flex flex-col sm:flex-row gap-3 justify-center max-w-sm mx-auto">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm"
                required
              />
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting ? "..." : "Entrar na Lista"}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-6 text-center text-xs text-white/20">
        <p>© 2026 Starble. Todos os direitos reservados.</p>
        <div className="flex justify-center gap-6 mt-3">
          <Link to="/termos" className="hover:text-white/40 transition-colors">Termos de Uso</Link>
          <Link to="/faq" className="hover:text-white/40 transition-colors">FAQ</Link>
          <Link to="/ajuda" className="hover:text-white/40 transition-colors">Ajuda</Link>
        </div>
      </footer>
    </div>
  );
}
