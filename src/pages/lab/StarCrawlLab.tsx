import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Globe, Search, FileText, Zap, ArrowRight, Lock, CheckCircle2, ChevronDown, Star, Sparkles } from "lucide-react";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";

const LabBadge = () => (
  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-400/30 text-emerald-400 text-xs font-bold tracking-widest uppercase animate-pulse">
    <Sparkles className="h-3 w-3" />
    Starble Lab
  </span>
);

const features = [
  { icon: <Globe className="h-6 w-6" />, title: "Extração de Conteúdo Web", desc: "Scrape qualquer URL com fidelidade total — estrutura, texto, imagens, metadados — sem uma linha de código." },
  { icon: <Search className="h-6 w-6" />, title: "Pesquisa Semântica", desc: "Busca não por palavra-chave, mas por significado. Encontra o que você precisa antes de saber que precisa." },
  { icon: <FileText className="h-6 w-6" />, title: "Geração Automática de Prompts", desc: "Transforma conteúdo extraído em prompts prontos para construção de projetos — briefing automático." },
  { icon: <Zap className="h-6 w-6" />, title: "Pipeline Completo em 1 Clique", desc: "Da URL ao projeto em minutos. Sem overhead manual. Escale sua capacidade de pesquisa infinitamente." },
];

export default function StarCrawlLab() {
  const { enabled, loading } = useFeatureFlag("starcrawl");
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
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      await (supabase as any).from("lab_waitlist").insert({ email: email.trim(), feature: "starcrawl" });
      setJoined(true);
      toast.success("🎉 Você está na lista!");
    } catch {
      setJoined(true);
      toast.success("Já estamos com você na lista!");
    } finally {
      setSubmitting(false);
    }
  };

  const faqs = [
    { q: "O StarCrawl extrai dados de qualquer site?", a: "Funciona com a grande maioria dos sites públicos. Sites protegidos por CAPTCHA avançado ou login podem ter limitações — nesses casos, o sistema notifica automaticamente." },
    { q: "Os dados extraídos ficam salvos?", a: "Você controla o que salvar. A extração é feita sob demanda e o conteúdo pode ser exportado ou descartado. Nada é retido sem sua autorização." },
    { q: "Posso usar para análise competitiva?", a: "Sim. A análise de conteúdo público para fins de pesquisa e criação de projetos próprios é um dos casos de uso mais poderosos do StarCrawl." },
    { q: "Qual o limite de páginas que posso extrair?", a: "Depende do seu plano. Estamos calibrando os limites com nossos beta testers para garantir performance e custo justo para todos." },
  ];

  return (
    <div className="min-h-screen bg-[#09090b] text-white font-sans">
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Globe className="h-4 w-4 text-white" />
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
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-emerald-500/8 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-4xl mx-auto">
          <div className="flex justify-center mb-6"><LabBadge /></div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 bg-gradient-to-b from-white via-white to-white/40 bg-clip-text text-transparent">
            StarCrawl
          </h1>
          <p className="text-xl md:text-2xl text-white/50 font-light mb-4 max-w-2xl mx-auto">
            Inteligência web que transforma qualquer site em conhecimento estruturado.<br />
            <span className="text-white/80">Pesquisa que escala. Contexto que constrói.</span>
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-6">
            <Lock className="h-3.5 w-3.5" />
            Acesso exclusivo para proprietários de White Label
          </div>
          <p className="text-sm text-white/30 mb-10 max-w-xl mx-auto">Exclusivo para operadores White Label. Usuários comuns podem visualizar, mas não utilizar esta funcionalidade.</p>
          {joined ? (
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold">
              <CheckCircle2 className="h-5 w-5" />
              Você está na lista de acesso antecipado!
            </div>
          ) : (
            <form onSubmit={handleWaitlist} className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required
                className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm" />
              <button type="submit" disabled={submitting}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2 whitespace-nowrap">
                {submitting ? "Entrando..." : <>Garantir acesso <ArrowRight className="h-4 w-4" /></>}
              </button>
            </form>
          )}
          <p className="text-[11px] text-white/20 mt-3"><Lock className="h-3 w-3 inline mr-1" />Sem spam. LGPD compliant.</p>
        </div>
      </section>

      <section className="py-12 border-y border-white/5">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-3 gap-8 text-center">
          {[{ value: "10s", label: "para extrair qualquer URL" }, { value: "99%", label: "de precisão nos dados" }, { value: "∞", label: "pipelines simultâneos" }].map((s, i) => (
            <div key={i}><div className="text-3xl font-black text-white">{s.value}</div><div className="text-sm text-white/40 mt-1">{s.label}</div></div>
          ))}
        </div>
      </section>

      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-14">Da URL ao <span className="text-emerald-400">projeto em minutos</span></h2>
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((f, i) => (
              <div key={i} className="p-6 rounded-2xl bg-white/3 border border-white/8 hover:border-emerald-500/30 transition-colors group">
                <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 group-hover:bg-emerald-500/15 transition-colors">{f.icon}</div>
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
          <Link to="/ajuda" className="hover:text-white/40 transition-colors">Ajuda</Link>
        </div>
      </footer>
    </div>
  );
}
