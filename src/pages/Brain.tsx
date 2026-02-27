import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useSEO } from "@/hooks/useSEO";
import AppLayout from "@/components/AppLayout";
import {
  Brain as BrainIcon, Send, Loader2, Sparkles, Code2, Palette, Search, Database,
  Plus, Clock, CheckCircle, XCircle, AlertTriangle, Power, LinkIcon, ExternalLink,
  MessageSquare, ChevronLeft, RotateCcw, Trash2, Shield, Server, BarChart3,
  Zap, Bot, ArrowDown,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type BrainSkill = "general" | "design" | "code" | "scraper" | "migration" | "data" | "devops" | "security";
type ConvoStatus = "pending" | "processing" | "completed" | "timeout" | "failed";

interface BrainEntry {
  id: string;
  name: string;
  project_id: string;
  project_url: string | null;
  status: string;
  skill: string;
  skills: string[];
  workspace_id: string;
  last_message_at: string | null;
  created_at: string;
}

interface Conversation {
  id: string;
  user_message: string;
  ai_response: string | null;
  brain_type: BrainSkill;
  status: ConvoStatus;
  created_at: string;
  target_project_id: string | null;
}

const ALL_SKILLS: { id: BrainSkill; label: string; icon: typeof BrainIcon; desc: string; gradient: string; bg: string }[] = [
  { id: "general", label: "Geral", icon: Sparkles, desc: "Assistente técnico completo", gradient: "from-blue-500 to-cyan-400", bg: "bg-blue-500/10 text-blue-500" },
  { id: "design", label: "Design", icon: Palette, desc: "UX/UI, Design Systems, Branding", gradient: "from-pink-500 to-rose-400", bg: "bg-pink-500/10 text-pink-500" },
  { id: "code", label: "Code", icon: Code2, desc: "TypeScript, React, Node, Deno", gradient: "from-emerald-500 to-green-400", bg: "bg-emerald-500/10 text-emerald-500" },
  { id: "scraper", label: "Scraper", icon: Search, desc: "Web Scraping, Crawlers, NLP", gradient: "from-amber-500 to-yellow-400", bg: "bg-amber-500/10 text-amber-500" },
  { id: "migration", label: "Migration", icon: Database, desc: "PostgreSQL, SQL, Modelagem", gradient: "from-violet-500 to-purple-400", bg: "bg-violet-500/10 text-violet-500" },
  { id: "data", label: "Data", icon: BarChart3, desc: "ML, Estatística, ETL, Analytics", gradient: "from-cyan-500 to-teal-400", bg: "bg-cyan-500/10 text-cyan-500" },
  { id: "devops", label: "DevOps", icon: Server, desc: "CI/CD, Kubernetes, Infra", gradient: "from-orange-500 to-amber-400", bg: "bg-orange-500/10 text-orange-500" },
  { id: "security", label: "Security", icon: Shield, desc: "AppSec, Pentesting, RLS, OAuth", gradient: "from-red-500 to-rose-400", bg: "bg-red-500/10 text-red-500" },
];

const PROCESSING_PHASES = [
  { text: "Conectando ao Star AI...", icon: "🔗", duration: 3000 },
  { text: "Analisando sua pergunta...", icon: "🧠", duration: 5000 },
  { text: "Processando com IA...", icon: "⚡", duration: 8000 },
  { text: "Gerando resposta...", icon: "✍️", duration: 15000 },
  { text: "Refinando resultado...", icon: "🔄", duration: 20000 },
  { text: "Quase lá...", icon: "⏳", duration: 30000 },
  { text: "Finalizando (pode demorar um pouco)...", icon: "🎯", duration: 60000 },
];

function ProcessingIndicator({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setElapsed(Date.now() - startTime), 500);
    return () => clearInterval(interval);
  }, [startTime]);
  let phase = PROCESSING_PHASES[0];
  for (let i = PROCESSING_PHASES.length - 1; i >= 0; i--) {
    if (elapsed >= PROCESSING_PHASES[i].duration) { phase = PROCESSING_PHASES[i]; break; }
  }
  const progress = Math.min((elapsed / 90000) * 100, 95);
  return (
    <div className="space-y-3 py-1">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
        <div>
          <span className="text-sm font-medium">{phase.icon} {phase.text}</span>
          <span className="text-[10px] text-muted-foreground block mt-0.5">{Math.floor(elapsed / 1000)}s decorridos</span>
        </div>
      </div>
      <div className="w-full h-1.5 bg-muted/50 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r from-primary/60 via-primary to-primary/80"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

/* ── Typing dots animation ── */
function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 py-2 px-1">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="h-2 w-2 rounded-full bg-primary/50"
          style={{
            animation: `typing-dot 1.4s infinite`,
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes typing-dot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/* ── Onboarding Step ── */
function BrainOnboarding({ onCreated, creating }: { onCreated: () => void; creating: boolean }) {
  const [selectedSkills, setSelectedSkills] = useState<BrainSkill[]>(["general"]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleSkill = (skill: BrainSkill) => {
    setSelectedSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  };

  const handleCreate = async () => {
    if (selectedSkills.length === 0) { toast.error("Selecione ao menos uma skill."); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("brain", {
        body: { action: "setup", skills: selectedSkills, name: name.trim() || undefined },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Erro ao criar Brain");
      toast.success("Brain criado com sucesso! 🧠");
      onCreated();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex items-center justify-center p-4">
      <div className="max-w-2xl w-full animate-fade-in">
        <div className="text-center mb-10">
          <div className="h-24 w-24 rounded-[2rem] bg-gradient-to-br from-primary/20 via-primary/10 to-transparent flex items-center justify-center mx-auto mb-6 shadow-xl shadow-primary/10 relative">
            <BrainIcon className="h-11 w-11 text-primary" />
            <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg">
              <Zap className="h-3 w-3 text-white" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">Criar novo Star AI Brain</h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto">
            Selecione as especialidades. Cada skill injeta um perfil PhD/Sênior dedicado ao seu projeto.
          </p>
        </div>

        <div className="mb-8">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Nome do Brain</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex: Meu Brain Full-Stack"
            maxLength={60}
            className="w-full h-12 px-4 rounded-2xl text-sm bg-background/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-muted-foreground/40"
            style={{ border: '1px solid var(--clf-border)' }}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {ALL_SKILLS.map(s => {
            const active = selectedSkills.includes(s.id);
            return (
              <button
                key={s.id}
                onClick={() => toggleSkill(s.id)}
                className={`relative flex flex-col items-center gap-2.5 p-4 rounded-2xl transition-all text-center group ${
                  active ? "shadow-lg" : "hover:shadow-md"
                }`}
                style={{
                  border: active ? '1.5px solid hsl(var(--primary) / 0.3)' : '1px solid var(--clf-border)',
                  background: active ? 'hsl(var(--primary) / 0.06)' : 'var(--liquid-glass-bg)',
                  backdropFilter: 'blur(20px)',
                }}
              >
                {active && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 ${
                  active ? `bg-gradient-to-br ${s.gradient} text-white shadow-lg` : s.bg
                }`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <span className="text-sm font-semibold">{s.label}</span>
                <span className="text-[10px] text-muted-foreground leading-tight">{s.desc}</span>
              </button>
            );
          })}
        </div>

        {selectedSkills.length > 1 && (
          <p className="text-xs text-muted-foreground text-center mb-6">
            {selectedSkills.length} skills selecionadas
          </p>
        )}

        <button
          onClick={handleCreate}
          disabled={loading || creating || selectedSkills.length === 0}
          className="w-full h-13 rounded-2xl bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:shadow-xl hover:shadow-primary/20 disabled:opacity-40 transition-all active:scale-[0.98]"
        >
          {loading || creating ? <><Loader2 className="h-4 w-4 animate-spin" /> Criando Brain...</> : <><Sparkles className="h-4 w-4" /> Criar Brain</>}
        </button>
      </div>
    </div>
  );
}

/* ── Brain Card ── */
function BrainCard({ brain, active, onSelect, onDelete }: { brain: BrainEntry; active: boolean; onSelect: () => void; onDelete: () => void }) {
  const skills = brain.skills || [brain.skill];
  return (
    <div
      onClick={onSelect}
      className={`group cursor-pointer p-3 rounded-2xl transition-all duration-200 ${
        active ? "shadow-sm" : "hover:bg-muted/20"
      }`}
      style={{
        border: active ? '1px solid hsl(var(--primary) / 0.2)' : '1px solid transparent',
        background: active ? 'hsl(var(--primary) / 0.06)' : undefined,
      }}
    >
      <div className="flex items-start gap-3">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${
          active ? 'bg-gradient-to-br from-primary/20 to-primary/5 shadow-sm' : 'bg-muted/40'
        }`}>
          <BrainIcon className={`h-4.5 w-4.5 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{brain.name}</p>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {skills.map(s => {
              const meta = ALL_SKILLS.find(sk => sk.id === s);
              return (
                <span key={s} className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${meta?.bg || "bg-muted text-muted-foreground"}`}>
                  {meta?.label || s}
                </span>
              );
            })}
          </div>
          {brain.last_message_at && (
            <p className="text-[10px] text-muted-foreground mt-1.5">
              {new Date(brain.last_message_at).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 h-7 w-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all shrink-0"
          title="Remover Brain"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ── Empty state ── */
function EmptyChat({ hasActiveBrain }: { hasActiveBrain: boolean }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center animate-fade-in max-w-sm">
        <div className="h-24 w-24 rounded-[2rem] bg-gradient-to-br from-primary/10 to-transparent flex items-center justify-center mx-auto mb-6 relative">
          {hasActiveBrain ? (
            <Send className="h-9 w-9 text-primary/30" />
          ) : (
            <BrainIcon className="h-9 w-9 text-muted-foreground/20" />
          )}
        </div>
        <h2 className="text-lg font-bold mb-2">
          {hasActiveBrain ? "Inicie uma conversa" : "Selecione um Brain"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {hasActiveBrain
            ? "Envie uma mensagem e o Star AI responderá como um especialista PhD dedicado."
            : "Clique em um Brain na barra lateral ou crie um novo."}
        </p>
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function BrainPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  useSEO({ title: "Star AI" });

  const [brains, setBrains] = useState<BrainEntry[]>([]);
  const [activeBrainId, setActiveBrainId] = useState<string | null>(null);
  const [lovableConnected, setLovableConnected] = useState<boolean | null>(null);
  const [creating, setCreating] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [allConversations, setAllConversations] = useState<Conversation[]>([]);
  const [message, setMessage] = useState("");
  const [brainType, setBrainType] = useState<BrainSkill>("general");
  const [sending, setSending] = useState(false);
  const [sendStartTime, setSendStartTime] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) { loadStatus(); loadHistory(); }
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allConversations]);

  // Scroll-to-bottom button logic
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const onScroll = () => {
      const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      setShowScrollBtn(distFromBottom > 120);
    };
    container.addEventListener("scroll", onScroll);
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("brain", { body: { action: "status" } });
      if (error || !data) { setLovableConnected(false); return; }
      setLovableConnected(data.connected !== false);
      setCreating(!!data.creating);
      const brainList = (data.brains || []) as BrainEntry[];
      setBrains(brainList);
      if (brainList.length > 0 && !activeBrainId) {
        setActiveBrainId(brainList[0].id);
        const primarySkill = brainList[0].skill as BrainSkill;
        if (ALL_SKILLS.some(s => s.id === primarySkill)) setBrainType(primarySkill);
      }
      setShowOnboarding(brainList.length === 0 && !data.creating);
    } catch { setLovableConnected(false); }
  }, [activeBrainId]);

  const loadHistory = useCallback(async () => {
    try {
      const { data } = await supabase.functions.invoke("brain", {
        body: { action: "history", limit: 100, brain_id: activeBrainId || undefined },
      });
      if (data?.conversations) setAllConversations(data.conversations.reverse());
    } catch {}
  }, [activeBrainId]);

  useEffect(() => { if (activeBrainId) loadHistory(); }, [activeBrainId]);

  const deleteBrain = async (brainId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("brain", { body: { action: "delete", brain_id: brainId } });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success("Brain removido.");
      if (activeBrainId === brainId) setActiveBrainId(null);
      loadStatus();
    } catch (e: any) { toast.error(e.message); }
  };

  // Realtime polling — when a conversation is processing, poll for completion via cron capture
  useEffect(() => {
    const processingConvo = allConversations.find(c => c.status === "processing" && c.id !== "temp");
    if (!processingConvo || !sending) return;
    
    const interval = setInterval(async () => {
      try {
        const { data } = await supabase
          .from("loveai_conversations")
          .select("ai_response, status")
          .eq("id", processingConvo.id)
          .single();
        
        if (data && data.status !== "processing" && data.ai_response) {
          setAllConversations(prev =>
            prev.map(c => c.id === processingConvo.id
              ? { ...c, ai_response: data.ai_response, status: data.status as ConvoStatus }
              : c
            )
          );
          setSending(false);
          setSendStartTime(null);
        }
      } catch { /* ignore */ }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [allConversations, sending]);

  const sendMsg = async () => {
    if (!message.trim() || sending || !activeBrainId) return;
    const userMsg = message.trim();
    setMessage("");
    if (textareaRef.current) { textareaRef.current.style.height = "auto"; }
    setSending(true);
    setSendStartTime(Date.now());

    const tempId = crypto.randomUUID();
    const tempConvo: Conversation = {
      id: tempId, user_message: userMsg, ai_response: null,
      brain_type: brainType, status: "processing",
      created_at: new Date().toISOString(), target_project_id: null,
    };
    setAllConversations(prev => [...prev, tempConvo]);

    try {
      const { data, error } = await supabase.functions.invoke("brain", {
        body: { action: "send", message: userMsg, brain_type: brainType, brain_id: activeBrainId },
      });
      if (error || data?.error) {
        if (data?.code === "no_token") setLovableConnected(false);
        if (data?.code === "brain_inactive") setShowOnboarding(true);
        throw new Error(data?.error || error?.message);
      }
      const finalStatus = data.status === "completed" ? "completed" : data.status === "timeout" ? "timeout" : "failed";
      setAllConversations(prev =>
        prev.map(c => c.id === tempId ? { ...c, id: data.conversation_id || tempId, ai_response: data.response, status: finalStatus as ConvoStatus } : c)
      );
    } catch (e: any) {
      setAllConversations(prev => prev.map(c => c.id === tempId ? { ...c, status: "failed", ai_response: e.message } : c));
      toast.error(e.message);
    } finally {
      setSending(false);
      setSendStartTime(null);
    }
  };

  if (authLoading || !user) {
    return <AppLayout><div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div></AppLayout>;
  }

  if (lovableConnected === false) {
    return (
      <AppLayout>
        <div className="h-full flex items-center justify-center p-6">
          <div className="text-center animate-fade-in max-w-sm">
            <div className="h-20 w-20 rounded-3xl bg-destructive/10 flex items-center justify-center mx-auto mb-6">
              <LinkIcon className="h-10 w-10 text-destructive" />
            </div>
            <h1 className="text-xl font-bold mb-3">Lovable não conectado</h1>
            <p className="text-sm text-muted-foreground mb-8">Para usar o Star AI, conecte sua conta Lovable primeiro.</p>
            <Link to="/lovable/connect" className="inline-flex items-center gap-2 h-12 px-8 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm hover:shadow-lg transition-all">
              <LinkIcon className="h-4 w-4" /> Conectar Lovable
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (showOnboarding || (brains.length === 0 && !creating)) {
    return (
      <AppLayout>
        <BrainOnboarding
          creating={creating}
          onCreated={() => { setShowOnboarding(false); loadStatus(); }}
        />
      </AppLayout>
    );
  }

  if (lovableConnected === null) {
    return <AppLayout><div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></AppLayout>;
  }

  const activeBrain = brains.find(b => b.id === activeBrainId);
  const activeSkills = activeBrain?.skills || [brainType];

  return (
    <AppLayout>
      {/* Full-height container that fills the main area without scrolling */}
      <div className="flex h-[calc(100vh-4rem)] md:h-screen relative">
        {/* Sidebar overlay (mobile) */}
        {sidebarOpen && <div className="absolute inset-0 z-20 bg-black/40 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />}

        {/* ── Sidebar ── */}
        <div className={`
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0 lg:w-0 lg:overflow-hidden"}
          absolute lg:relative z-30 lg:z-auto w-72 lg:w-72 h-full
          flex flex-col shrink-0 transition-all duration-300
        `}
          style={{
            background: 'transparent',
          }}
        >
          {/* Sidebar header */}
          <div className="p-3 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Brains</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setShowOnboarding(true)} className="h-7 w-7 flex items-center justify-center rounded-xl hover:bg-primary/10 transition-colors" title="Novo Brain">
                  <Plus className="h-4 w-4 text-primary" />
                </button>
                <button onClick={() => setSidebarOpen(false)} className="h-7 w-7 flex items-center justify-center rounded-xl hover:bg-accent transition-colors lg:hidden">
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="space-y-1">
              {brains.map(b => (
                <BrainCard
                  key={b.id}
                  brain={b}
                  active={activeBrainId === b.id}
                  onSelect={() => { setActiveBrainId(b.id); setSidebarOpen(false); }}
                  onDelete={() => deleteBrain(b.id)}
                />
              ))}
              {brains.length === 0 && creating && (
                <div className="flex items-center gap-2 text-muted-foreground text-xs p-3">
                  <Loader2 className="h-3 w-3 animate-spin" /> Criando Brain...
                </div>
              )}
            </div>
          </div>

          {/* Conversation history */}
          <div className="flex-1 overflow-y-auto p-2 no-scrollbar">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 mb-2 mt-1">Histórico</p>
            {allConversations.filter(c => c.status !== "processing").length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6 opacity-50">Nenhuma conversa ainda</p>
            )}
            {allConversations.filter(c => c.status !== "processing").map(c => (
              <div key={c.id} className="px-2.5 py-2 rounded-xl text-xs text-muted-foreground truncate hover:bg-muted/30 transition-colors cursor-pointer">
                <MessageSquare className="h-3 w-3 inline mr-1.5 opacity-40" />
                {c.user_message.slice(0, 40)}{c.user_message.length > 40 ? "..." : ""}
              </div>
            ))}
          </div>
        </div>

        {/* ── Main chat area ── */}
        <div className="flex-1 flex flex-col min-w-0 h-full">
          {/* Header */}
          <div
            className="px-4 py-3 flex items-center gap-3 shrink-0"
          >
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-muted/50 transition-colors shrink-0">
              {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
            </button>
            
            {/* Avatar with gradient ring */}
            <div className="relative shrink-0">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary via-primary/80 to-primary/60 p-[2px]">
                <div className="h-full w-full rounded-full bg-background flex items-center justify-center">
                  <BrainIcon className="h-4.5 w-4.5 text-primary" />
                </div>
              </div>
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
            </div>

            <div className="min-w-0 mr-auto">
              <p className="text-[15px] font-bold leading-tight truncate">{activeBrain?.name || "Star AI"}</p>
              <span className="text-[11px] text-green-600 dark:text-green-400 font-medium">online</span>
            </div>

            {activeBrain?.project_url && (
              <a href={activeBrain.project_url} target="_blank" rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-[11px] font-semibold hover:bg-muted/50 transition-colors shrink-0 text-muted-foreground hover:text-foreground"
                style={{ border: '0.5px solid var(--clf-border)' }}
              >
                <ExternalLink className="h-3.5 w-3.5" /> Projeto
              </a>
            )}

            {/* Skill selector chips */}
            <div className="hidden sm:flex items-center gap-1">
              {activeSkills.map(s => {
                const meta = ALL_SKILLS.find(sk => sk.id === s);
                if (!meta) return null;
                return (
                  <button
                    key={s}
                    onClick={() => setBrainType(s as BrainSkill)}
                    className={`h-8 px-3 rounded-full text-[11px] font-semibold flex items-center gap-1.5 transition-all ${
                      brainType === s
                        ? `bg-gradient-to-r ${meta.gradient} text-white shadow-md`
                        : "text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <meta.icon className="h-3 w-3" /> {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mobile skill selector */}
          <div className="sm:hidden flex items-center gap-1 px-3 py-2 overflow-x-auto shrink-0 no-scrollbar">
            {activeSkills.map(s => {
              const meta = ALL_SKILLS.find(sk => sk.id === s);
              if (!meta) return null;
              return (
                <button key={s} onClick={() => setBrainType(s as BrainSkill)}
                  className={`h-8 px-3 rounded-full text-[11px] font-semibold flex items-center gap-1.5 shrink-0 transition-all ${
                    brainType === s ? `bg-gradient-to-r ${meta.gradient} text-white shadow-md` : "text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <meta.icon className="h-3 w-3" /> {meta.label}
                </button>
              );
            })}
          </div>

          {/* ── Chat messages area — scrollable ── */}
          {(!activeBrainId || (activeBrainId && allConversations.length === 0 && !sending)) ? (
            <EmptyChat hasActiveBrain={!!activeBrainId} />
          ) : (
            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-5 relative no-scrollbar"
              style={{
                backgroundImage: `
                  radial-gradient(ellipse at 20% 50%, hsl(var(--primary) / 0.02) 0%, transparent 50%),
                  radial-gradient(ellipse at 80% 20%, hsl(var(--primary) / 0.015) 0%, transparent 40%)
                `,
              }}
            >
              {allConversations.map(convo => (
                <div key={convo.id} className="space-y-3 max-w-3xl mx-auto animate-fade-in">
                  {/* User bubble — right side */}
                  <div className="flex justify-end">
                    <div className="max-w-[85%] sm:max-w-[70%]">
                      <div className="rounded-2xl rounded-tr-sm bg-gradient-to-br from-primary to-primary/90 text-primary-foreground px-4 py-3 shadow-lg shadow-primary/15">
                        <p className="text-[13px] whitespace-pre-wrap break-words leading-relaxed">{convo.user_message}</p>
                        <div className="flex items-center justify-end gap-2 mt-2">
                          <span className="text-[10px] opacity-50">{ALL_SKILLS.find(b => b.id === convo.brain_type)?.label}</span>
                          <span className="text-[10px] opacity-40">{new Date(convo.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                          {convo.status === "completed" && <CheckCircle className="h-3 w-3 opacity-60" />}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* AI bubble — left side */}
                  <div className="flex justify-start gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 mt-1 shadow-sm ring-1 ring-primary/10">
                      <BrainIcon className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="max-w-[85%] sm:max-w-[80%]">
                      <div
                        className="rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm"
                        style={{
                          background: 'var(--liquid-glass-bg)',
                          backdropFilter: 'blur(20px)',
                          border: '0.5px solid var(--clf-border)',
                        }}
                      >
                        {convo.status === "processing" && sendStartTime && <ProcessingIndicator startTime={sendStartTime} />}
                        {convo.status === "processing" && !sendStartTime && <TypingDots />}
                        {convo.status === "timeout" && (
                          <div className="flex items-center gap-2 text-amber-500"><AlertTriangle className="h-4 w-4" /><span className="text-sm">Tempo esgotado. Tente novamente.</span></div>
                        )}
                        {convo.status === "failed" && (
                          <div className="flex items-center gap-2 text-destructive"><XCircle className="h-4 w-4" /><span className="text-sm">{convo.ai_response || "Falha ao processar."}</span></div>
                        )}
                        {convo.status === "completed" && convo.ai_response && (
                          <>
                            <div className="prose prose-sm dark:prose-invert max-w-none text-[13px] leading-relaxed break-words [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_code]:break-all [&_pre]:rounded-xl [&_pre]:bg-muted/50 [&_pre]:p-3 [&_pre]:text-xs [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{convo.ai_response}</ReactMarkdown>
                            </div>
                            <div className="flex items-center gap-3 mt-3 pt-2.5">
                              <button
                                onClick={() => { navigator.clipboard.writeText(convo.ai_response!); toast.success("Copiado!"); }}
                                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 hover:bg-muted/30 px-2 py-1 rounded-lg"
                              >
                                📋 Copiar
                              </button>
                              <span className="text-[10px] text-muted-foreground/40 ml-auto">
                                {new Date(convo.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                              <CheckCircle className="h-3 w-3 text-green-500" />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Scroll to bottom FAB */}
          {showScrollBtn && (
            <div className="absolute bottom-20 right-6 z-10">
              <button
                onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })}
                className="h-10 w-10 rounded-full bg-background shadow-xl flex items-center justify-center hover:scale-110 transition-all"
                style={{ border: '1px solid var(--clf-border)' }}
              >
                <ArrowDown className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          )}

          {/* ── Input bar — pinned to bottom ── */}
          {activeBrainId && (
            <div
              className="px-4 sm:px-6 py-3 shrink-0"
            >
              <div className="max-w-3xl mx-auto flex items-end gap-2.5">
                <div
                  className="flex-1 rounded-2xl overflow-hidden transition-shadow focus-within:shadow-lg focus-within:shadow-primary/5"
                  style={{ border: '1px solid var(--clf-border)', background: 'hsl(var(--background) / 0.6)' }}
                >
                  <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); } }}
                    placeholder={`Mensagem para ${ALL_SKILLS.find(b => b.id === brainType)?.label || "Star AI"}...`}
                    rows={1}
                    disabled={sending}
                    className="w-full min-h-[44px] max-h-[140px] py-3 px-4 resize-none text-[13px] bg-transparent focus:outline-none placeholder:text-muted-foreground/40 disabled:opacity-50"
                    onInput={e => {
                      const t = e.currentTarget;
                      t.style.height = "auto";
                      t.style.height = Math.min(t.scrollHeight, 140) + "px";
                    }}
                  />
                </div>
                <button
                  onClick={sendMsg}
                  disabled={!message.trim() || sending}
                  className={`h-11 w-11 flex items-center justify-center shrink-0 rounded-full transition-all active:scale-90 ${
                    message.trim() && !sending
                      ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:scale-105"
                      : "bg-muted/50 text-muted-foreground"
                  }`}
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
