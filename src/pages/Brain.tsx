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

const ALL_SKILLS: { id: BrainSkill; label: string; icon: typeof BrainIcon; desc: string; color: string }[] = [
  { id: "general", label: "Geral", icon: Sparkles, desc: "Assistente técnico completo", color: "bg-blue-500/15 text-blue-500" },
  { id: "design", label: "Design", icon: Palette, desc: "UX/UI, Design Systems, Branding", color: "bg-pink-500/15 text-pink-500" },
  { id: "code", label: "Code", icon: Code2, desc: "TypeScript, React, Node, Deno", color: "bg-emerald-500/15 text-emerald-500" },
  { id: "scraper", label: "Scraper", icon: Search, desc: "Web Scraping, Crawlers, NLP", color: "bg-amber-500/15 text-amber-500" },
  { id: "migration", label: "Migration", icon: Database, desc: "PostgreSQL, SQL, Modelagem", color: "bg-violet-500/15 text-violet-500" },
  { id: "data", label: "Data", icon: BarChart3, desc: "ML, Estatística, ETL, Analytics", color: "bg-cyan-500/15 text-cyan-500" },
  { id: "devops", label: "DevOps", icon: Server, desc: "CI/CD, Kubernetes, Infra", color: "bg-orange-500/15 text-orange-500" },
  { id: "security", label: "Security", icon: Shield, desc: "AppSec, Pentesting, RLS, OAuth", color: "bg-red-500/15 text-red-500" },
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
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-primary">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm font-medium">{phase.icon} {phase.text}</span>
      </div>
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary/60 rounded-full transition-all duration-1000 ease-out" style={{ width: `${progress}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground">{Math.floor(elapsed / 1000)}s</span>
    </div>
  );
}

// ── Onboarding Step ──
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
        body: {
          action: "setup",
          skills: selectedSkills,
          name: name.trim() || undefined,
        },
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
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-16">
      <div className="text-center mb-8">
        <div className="h-16 w-16 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <BrainIcon className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Criar novo Star AI Brain</h1>
        <p className="text-muted-foreground text-sm">Selecione as especialidades. Cada skill injeta um perfil PhD/Sênior dedicado.</p>
      </div>

      {/* Name */}
      <div className="mb-6">
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nome do Brain (opcional)</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Ex: Meu Brain Full-Stack"
          className="w-full h-10 px-4 rounded-xl bg-muted/50 border border-border/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          maxLength={60}
        />
      </div>

      {/* Skills grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {ALL_SKILLS.map(s => {
          const active = selectedSkills.includes(s.id);
          return (
            <button
              key={s.id}
              onClick={() => toggleSkill(s.id)}
              className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all text-center ${
                active
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border/30 hover:border-border/60 bg-muted/20"
              }`}
            >
              {active && (
                <div className="absolute top-2 right-2">
                  <CheckCircle className="h-4 w-4 text-primary" />
                </div>
              )}
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${s.color}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium">{s.label}</span>
              <span className="text-[10px] text-muted-foreground leading-tight">{s.desc}</span>
            </button>
          );
        })}
      </div>

      {selectedSkills.length > 1 && (
        <p className="text-xs text-muted-foreground text-center mb-4">
          {selectedSkills.length} skills selecionadas — cada uma será injetada como prompt de sistema no projeto.
        </p>
      )}

      <button
        onClick={handleCreate}
        disabled={loading || creating || selectedSkills.length === 0}
        className="w-full h-12 rounded-2xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
      >
        {loading || creating ? <><Loader2 className="h-4 w-4 animate-spin" /> Criando Brain...</> : <><Plus className="h-4 w-4" /> Criar Brain</>}
      </button>
    </div>
  );
}

// ── Brain Card ──
function BrainCard({ brain, active, onSelect, onDelete }: { brain: BrainEntry; active: boolean; onSelect: () => void; onDelete: () => void }) {
  const skills = brain.skills || [brain.skill];
  return (
    <div
      onClick={onSelect}
      className={`group cursor-pointer p-3 rounded-2xl border-2 transition-all ${
        active ? "border-primary bg-primary/5" : "border-border/20 hover:border-border/50 bg-muted/10"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <BrainIcon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{brain.name}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {skills.map(s => {
              const meta = ALL_SKILLS.find(sk => sk.id === s);
              return (
                <span key={s} className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${meta?.color || "bg-muted text-muted-foreground"}`}>
                  {meta?.label || s}
                </span>
              );
            })}
          </div>
          {brain.last_message_at && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Último uso: {new Date(brain.last_message_at).toLocaleDateString("pt-BR")}
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

// ── Main Page ──
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) { loadStatus(); loadHistory(); }
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allConversations]);

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

  const sendMsg = async () => {
    if (!message.trim() || sending || !activeBrainId) return;
    const userMsg = message.trim();
    setMessage("");
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
    return <AppLayout><div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div></AppLayout>;
  }

  if (lovableConnected === false) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto px-6 py-20 text-center">
          <div className="h-20 w-20 rounded-3xl bg-destructive/10 flex items-center justify-center mx-auto mb-6">
            <LinkIcon className="h-10 w-10 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-3">Lovable não conectado</h1>
          <p className="text-muted-foreground mb-8">Para usar o Star AI, conecte sua conta Lovable primeiro.</p>
          <Link to="/lovable/connect" className="inline-flex items-center gap-2 h-12 px-8 rounded-2xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <LinkIcon className="h-4 w-4" /> Conectar Lovable
          </Link>
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
    return <AppLayout><div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></AppLayout>;
  }

  const activeBrain = brains.find(b => b.id === activeBrainId);
  const activeSkills = activeBrain?.skills || [brainType];

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-3rem)] relative">
        {/* Sidebar overlay */}
        {sidebarOpen && <div className="absolute inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

        {/* Sidebar */}
        <div className={`
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0 lg:w-0 lg:overflow-hidden"}
          absolute lg:relative z-30 lg:z-auto w-72 lg:w-72 h-full
          bg-background border-r border-border/30 flex flex-col shrink-0 transition-all duration-200
        `}>
          <div className="p-3 border-b border-border/20">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Brains</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setShowOnboarding(true)} className="h-7 w-7 flex items-center justify-center rounded-xl hover:bg-accent transition-colors" title="Novo Brain">
                  <Plus className="h-4 w-4" />
                </button>
                <button onClick={() => setSidebarOpen(false)} className="h-7 w-7 flex items-center justify-center rounded-xl hover:bg-accent transition-colors lg:hidden">
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="space-y-2">
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
          <div className="flex-1 overflow-y-auto p-2">
            <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-2 mb-2">Histórico</p>
            {allConversations.filter(c => c.status !== "processing").length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhuma conversa ainda</p>
            )}
            {allConversations.filter(c => c.status !== "processing").map(c => (
              <div key={c.id} className="px-2.5 py-2 rounded-xl text-xs text-muted-foreground truncate">
                <MessageSquare className="h-3 w-3 inline mr-1.5 opacity-50" />
                {c.user_message.slice(0, 40)}{c.user_message.length > 40 ? "..." : ""}
              </div>
            ))}
          </div>
        </div>

        {/* Main chat */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="border-b border-border/40 px-3 sm:px-4 py-2.5 flex items-center gap-2 sm:gap-3 shrink-0">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="h-8 w-8 flex items-center justify-center rounded-xl hover:bg-accent transition-colors shrink-0">
              {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
            </button>
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <BrainIcon className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 mr-auto">
              <p className="text-sm font-semibold leading-tight">{activeBrain?.name || "Star AI"}</p>
              <div className="flex items-center gap-1 mt-0.5">
                {activeSkills.map(s => {
                  const meta = ALL_SKILLS.find(sk => sk.id === s);
                  return meta ? (
                    <span key={s} className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium ${meta.color}`}>{meta.label}</span>
                  ) : null;
                })}
              </div>
            </div>

            {activeBrain?.project_url && (
              <a href={activeBrain.project_url} target="_blank" rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded-xl bg-accent text-foreground text-[11px] font-medium hover:bg-accent/80 transition-colors shrink-0">
                <ExternalLink className="h-3.5 w-3.5" /> Projeto
              </a>
            )}

            {/* Skill selector for sending */}
            <div className="hidden sm:flex items-center gap-1">
              {activeSkills.map(s => {
                const meta = ALL_SKILLS.find(sk => sk.id === s);
                if (!meta) return null;
                return (
                  <button
                    key={s}
                    onClick={() => setBrainType(s as BrainSkill)}
                    className={`h-7 px-2.5 rounded-full text-[11px] font-medium flex items-center gap-1 transition-all ${
                      brainType === s ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    <meta.icon className="h-3 w-3" /> {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mobile skill selector */}
          <div className="sm:hidden flex items-center gap-1 px-3 py-1.5 border-b border-border/20 overflow-x-auto">
            {activeSkills.map(s => {
              const meta = ALL_SKILLS.find(sk => sk.id === s);
              if (!meta) return null;
              return (
                <button key={s} onClick={() => setBrainType(s as BrainSkill)}
                  className={`h-7 px-2.5 rounded-full text-[11px] font-medium flex items-center gap-1 shrink-0 transition-all ${
                    brainType === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <meta.icon className="h-3 w-3" /> {meta.label}
                </button>
              );
            })}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-4">
            {!activeBrainId && (
              <div className="text-center py-12 sm:py-20">
                <BrainIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground/20" />
                <p className="font-medium mb-1">Selecione um Brain</p>
                <p className="text-sm text-muted-foreground">Clique em um Brain na barra lateral ou crie um novo.</p>
              </div>
            )}

            {activeBrainId && allConversations.length === 0 && (
              <div className="text-center py-12 sm:py-20">
                <BrainIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground/20" />
                <p className="font-medium mb-1">Inicie uma conversa</p>
                <p className="text-sm text-muted-foreground">Envie uma mensagem para o Star AI.</p>
              </div>
            )}

            {allConversations.map(convo => (
              <div key={convo.id} className="space-y-3 max-w-3xl mx-auto">
                <div className="flex justify-end">
                  <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-4 py-3">
                    <p className="text-sm whitespace-pre-wrap break-words">{convo.user_message}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] opacity-60">{ALL_SKILLS.find(b => b.id === convo.brain_type)?.label}</span>
                      <span className="text-[10px] opacity-40">{new Date(convo.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="max-w-[90%] sm:max-w-[85%] rounded-2xl rounded-bl-sm bg-muted/50 border border-border/30 px-4 py-3">
                    {convo.status === "processing" && sendStartTime && <ProcessingIndicator startTime={sendStartTime} />}
                    {convo.status === "processing" && !sendStartTime && (
                      <div className="flex items-center gap-3 text-primary"><Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm">Processando...</span></div>
                    )}
                    {convo.status === "timeout" && (
                      <div className="flex items-center gap-2 text-amber-500"><AlertTriangle className="h-4 w-4" /><span className="text-sm">Tempo esgotado.</span></div>
                    )}
                    {convo.status === "failed" && (
                      <div className="flex items-center gap-2 text-destructive"><XCircle className="h-4 w-4" /><span className="text-sm">{convo.ai_response || "Falha"}</span></div>
                    )}
                    {convo.status === "completed" && convo.ai_response && (
                      <>
                        <div className="prose prose-sm dark:prose-invert max-w-none text-sm break-words [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_code]:break-all">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{convo.ai_response}</ReactMarkdown>
                        </div>
                        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/30">
                          <button onClick={() => { navigator.clipboard.writeText(convo.ai_response!); toast.success("Copiado!"); }} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">📋 Copiar</button>
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          {activeBrainId && (
            <div className="border-t border-border/40 px-3 sm:px-6 py-3 shrink-0">
              <div className="max-w-3xl mx-auto flex items-end gap-2">
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); } }}
                  placeholder={`Pergunte ao Star AI (${ALL_SKILLS.find(b => b.id === brainType)?.label})...`}
                  rows={1}
                  disabled={sending}
                  className="flex-1 min-h-[44px] max-h-[160px] py-3 px-4 resize-none text-sm rounded-2xl bg-muted/50 border border-border/30 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all disabled:opacity-50"
                  style={{ height: "auto", overflow: "hidden" }}
                  onInput={e => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 160) + "px"; }}
                />
                <button
                  onClick={sendMsg}
                  disabled={!message.trim() || sending}
                  className="h-11 w-11 flex items-center justify-center shrink-0 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
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
