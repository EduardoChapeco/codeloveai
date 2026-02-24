import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mic, Volume2, Radio, Activity, ArrowRight, Lock, CheckCircle2, ChevronDown, Sparkles } from "lucide-react";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";

const LabBadge = () => (
  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-orange-500/20 to-rose-500/20 border border-orange-400/30 text-orange-400 text-xs font-bold tracking-widest uppercase animate-pulse">
    <Sparkles className="h-3 w-3" />
    Starble Lab
  </span>
);

const features = [
  { icon: <Volume2 className="h-6 w-6" />, title: "Síntese de Voz Ultra-Realista", desc: "Vozes geradas por ElevenLabs — indistinguíveis de humanos. Perfeitas para demos, narração e assistentes." },
  { icon: <Radio className="h-6 w-6" />, title: "Respostas em Áudio Real-Time", desc: "Converse com assistentes e receba respostas em voz — latência abaixo de 1 segundo." },
  { icon: <Mic className="h-6 w-6" />, title: "Múltiplas Vozes e Personas", desc: "Selecione entre dezenas de vozes com personalidade, sotaque e tonalidade ajustáveis." },
  { icon: <Activity className="h-6 w-6" />, title: "Integração com Projetos", desc: "Adicione narração automática a qualquer projeto — onboarding falado, tutoriais em áudio." },
];

export default function VoiceLab() {
  const { enabled, loading } = useFeatureFlag("voice");
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [joined, setJoined] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  if (!loading && enabled) {
    navigate("/brain");
    return null;
  }

  const handleWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await supabase.from("lab_waitlist").insert({ email: email.trim(), feature: "voice" });
      setJoined(true);
      toast.success("🎙️ Você está na lista!");
    } catch {
      setJoined(true);
      toast.success("Já estamos com você na lista!");
    } finally {
      setSubmitting(false);
    }
  };

  const faqs = [
    { q: "Quais idiomas são suportados?", a: "Português, Inglês, Espanhol, Francês e mais 20 idiomas. Para pt-BR, temos vozes de alta qualidade especialmente calibradas." },
    { q: "Posso usar as vozes em meus projetos comerciais?", a: "Sim, dentro dos termos de uso do Starble e da ElevenLabs. Consulte os termos completos em /termos." },
    { q: "Há limite de caracteres ou minutos por dia?", a: "Estamos definindo os limites com base nos testes. A intenção é oferecer cotas generosas nos planos pagos." },
    { q: "Funciona em mobile?", a: "Sim. A síntese de voz funciona em qualquer dispositivo moderno com suporte a Web Audio API." },
  ];

  return (
    <div className="min-h-screen bg-[#09090b] text-white font-sans">
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center">
              <Mic className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-sm">Starble</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="text-sm text-white/60 hover:text-white transition-colors">Dashboard</Link>
            <Link to="/login" className="text-sm px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 transition-colors">Entrar</Link>
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-24 px-6 text-center relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-orange-500/8 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-4xl mx-auto">
          <div className="flex justify-center mb-6"><LabBadge /></div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 bg-gradient-to-b from-white via-white to-white/40 bg-clip-text text-transparent">Voice AI</h1>
          <p className="text-xl md:text-2xl text-white/50 font-light mb-4 max-w-2xl mx-auto">
            Sua plataforma fala. Seus projetos ganham voz.<br />
            <span className="text-white/80">IA conversacional que soa humana.</span>
          </p>
          <p className="text-sm text-white/30 mb-10 max-w-xl mx-auto">Tecnologia ElevenLabs integrada nativamente. Nenhuma configuração técnica necessária.</p>
          {joined ? (
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 font-semibold">
              <CheckCircle2 className="h-5 w-5" /> Você está na lista!
            </div>
          ) : (
            <form onSubmit={handleWaitlist} className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required
                className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-sm" />
              <button type="submit" disabled={submitting}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-orange-600 to-rose-600 text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2 whitespace-nowrap">
                {submitting ? "..." : <>Garantir acesso <ArrowRight className="h-4 w-4" /></>}
              </button>
            </form>
          )}
          <p className="text-[11px] text-white/20 mt-3"><Lock className="h-3 w-3 inline mr-1" />Sem spam. LGPD compliant.</p>
        </div>
      </section>

      <section className="py-12 border-y border-white/5">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-3 gap-8 text-center">
          {[{ value: "<1s", label: "latência de geração" }, { value: "28+", label: "idiomas suportados" }, { value: "100%", label: "via API nativa" }].map((s, i) => (
            <div key={i}><div className="text-3xl font-black">{s.value}</div><div className="text-sm text-white/40 mt-1">{s.label}</div></div>
          ))}
        </div>
      </section>

      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-14">Voz que <span className="text-orange-400">engaja e converte</span></h2>
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((f, i) => (
              <div key={i} className="p-6 rounded-2xl bg-white/3 border border-white/8 hover:border-orange-500/30 transition-colors group">
                <div className="h-12 w-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 mb-4">{f.icon}</div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

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

      <footer className="border-t border-white/5 py-8 px-6 text-center text-xs text-white/20">
        <p>© 2026 Starble. Todos os direitos reservados.</p>
        <div className="flex justify-center gap-6 mt-3">
          <Link to="/termos" className="hover:text-white/40 transition-colors">Termos de Uso</Link>
          <Link to="/faq" className="hover:text-white/40 transition-colors">FAQ</Link>
          <Link to="/ajuda" className="hover:text-white/40 transition-colors">Central de Ajuda</Link>
        </div>
      </footer>
    </div>
  );
}
