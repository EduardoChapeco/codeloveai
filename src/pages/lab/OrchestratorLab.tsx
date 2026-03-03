import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bot, Cpu, BarChart2, GitBranch, ArrowRight, Lock, CheckCircle2, ChevronDown, Sparkles, Layers } from "lucide-react";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";

const LabBadge = () => (
  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border border-blue-400/30 text-blue-400 text-xs font-bold tracking-widest uppercase animate-pulse">
    <Sparkles className="h-3 w-3" />
    Starble Lab
  </span>
);

const features = [
  { icon: <Bot className="h-6 w-6" />, title: "Criação Autônoma de Projetos", desc: "Descreva o que quer. O Orchestrator Engine cria, testa, corrige e publica — sem você precisar codificar nada." },
  { icon: <GitBranch className="h-6 w-6" />, title: "Sistema de Tasks com Rollback", desc: "Cada passo do projeto é uma task rastreável. Erros disparam rollback automático — nunca perde progresso." },
  { icon: <Cpu className="h-6 w-6" />, title: "IA de Auto-Auditoria", desc: "O motor audita o próprio código gerado. Detecta problemas de segurança, performance e UX antes de você." },
  { icon: <BarChart2 className="h-6 w-6" />, title: "Dashboard de Progressão em Tempo Real", desc: "Acompanhe cada etapa do projeto com logs detalhados, qualidade e status em tempo real." },
];

export default function OrchestratorLab() {
  const { enabled, loading } = useFeatureFlag("orchestrator");
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [joined, setJoined] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  if (!loading && enabled) {
    navigate("/ai");
    return null;
  }

  const handleWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await (supabase as any).from("lab_waitlist").insert({ email: email.trim(), feature: "orchestrator" });
      setJoined(true);
      toast.success("🤖 Você está na lista do Orchestrator!");
    } catch {
      setJoined(true);
      toast.success("Já estamos com você na lista!");
    } finally {
      setSubmitting(false);
    }
  };

  const faqs = [
    { q: "Preciso saber programar para usar o Orchestrator?", a: "Não. Você descreve o projeto em linguagem natural. O Orchestrator interpreta, planeja e executa as tasks de desenvolvimento de forma autônoma." },
    { q: "Quais tipos de projetos posso criar?", a: "Aplicações web SaaS, landing pages, sistemas de gestão, marketplaces — qualquer projeto que possa ser construído numa plataforma de desenvolvimento low-code/no-code." },
    { q: "O que acontece se a IA errar?", a: "O sistema tem 3 camadas de proteção: stop conditions automáticas, rollback em caso de 3 falhas consecutivas, e auditoria de qualidade a cada checkpoint. Seu projeto está seguro." },
    { q: "Posso monitorar o que a IA está fazendo?", a: "Sim, em tempo real. Cada task, cada decisão, cada log aparece no painel de controle. Você tem visibilidade total do processo." },
  ];

  return (
    <div className="min-h-screen bg-[#09090b] text-white font-sans">
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Layers className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-sm">Starble</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/home" className="text-sm text-white/60 hover:text-white transition-colors">Dashboard</Link>
            <Link to="/login" className="text-sm px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 transition-colors">Entrar</Link>
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-24 px-6 text-center relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-blue-500/8 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-4xl mx-auto">
          <div className="flex justify-center mb-6"><LabBadge /></div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 bg-gradient-to-b from-white via-white to-white/40 bg-clip-text text-transparent">
            Orchestrator Engine
          </h1>
          <p className="text-xl md:text-2xl text-white/50 font-light mb-4 max-w-2xl mx-auto">
            O primeiro motor autônomo que cria projetos digitais do zero.<br />
            <span className="text-white/80">Planejamento. Execução. Auditoria. Tudo automático.</span>
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-6">
            <Lock className="h-3.5 w-3.5" />
            Acesso exclusivo para proprietários de White Label
          </div>
          <p className="text-sm text-white/30 mb-10 max-w-xl mx-auto">Tecnologia de nível empresarial exclusiva para operadores White Label. Usuários comuns podem visualizar, mas não utilizar.</p>
          {joined ? (
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 font-semibold">
              <CheckCircle2 className="h-5 w-5" /> Você está na lista do Orchestrator!
            </div>
          ) : (
            <form onSubmit={handleWaitlist} className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required
                className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm" />
              <button type="submit" disabled={submitting}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2 whitespace-nowrap">
                {submitting ? "..." : <>Garantir acesso antecipado <ArrowRight className="h-4 w-4" /></>}
              </button>
            </form>
          )}
          <p className="text-[11px] text-white/20 mt-3"><Lock className="h-3 w-3 inline mr-1" />Sem spam. Cancele quando quiser. LGPD.</p>
        </div>
      </section>

      <section className="py-12 border-y border-white/5">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-3 gap-8 text-center">
          {[{ value: "100%", label: "autônomo do início ao fim" }, { value: "3×", label: "mais rápido que dev manual" }, { value: "0", label: "linhas de código necessárias" }].map((s, i) => (
            <div key={i}><div className="text-3xl font-black">{s.value}</div><div className="text-sm text-white/40 mt-1">{s.label}</div></div>
          ))}
        </div>
      </section>

      {/* Process flow */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-14">Como funciona o <span className="text-blue-400">Orchestrator Engine</span></h2>
          <div className="grid md:grid-cols-4 gap-4">
            {[
              { step: "01", label: "Descreva", desc: "Explique seu projeto em português simples" },
              { step: "02", label: "Planejamento", desc: "O motor gera um PRD e lista de tasks estruturado" },
              { step: "03", label: "Execução", desc: "Cada task é construída e testada automaticamente" },
              { step: "04", label: "Publicação", desc: "Projeto auditado e pronto. Você só aprova" },
            ].map((s, i) => (
              <div key={i} className="p-5 rounded-2xl bg-white/3 border border-white/8 text-center">
                <div className="text-4xl font-black text-blue-400/30 mb-2">{s.step}</div>
                <h3 className="font-semibold mb-1 text-sm">{s.label}</h3>
                <p className="text-xs text-white/40">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-14">Motor que trabalha <span className="text-blue-400">enquanto você dorme</span></h2>
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((f, i) => (
              <div key={i} className="p-6 rounded-2xl bg-white/3 border border-white/8 hover:border-blue-500/30 transition-colors group">
                <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4">{f.icon}</div>
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
