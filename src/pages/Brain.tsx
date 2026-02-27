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
    <div className="space-y-3 py-1">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
        <div>
          <span className="text-sm font-medium text-foreground">{phase.icon} {phase.text}</span>
          <span className="text-[10px] text-muted-foreground block">{Math.floor(elapsed / 1000)}s</span>
        </div>
      </div>
      <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-primary/60 to-primary rounded-full transition-all duration-1000 ease-out" style={{ width: `${progress}%` }} />
      </div>
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
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-16 animate-fade-in">
      <div className="text-center mb-10">
        <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-primary/10">
          <BrainIcon className="h-10 w-10 text-primary" />
        </div>
        <h1 className="lv-heading-lg mb-2">Criar novo Star AI Brain</h1>
        <p className="lv-body-lg max-w-md mx-auto">Selecione as especialidades. Cada skill injeta um perfil PhD/Sênior dedicado.</p>
      </div>

      {/* Name */}
      <div className="mb-8">
        <label className="lv-label mb-2 block">Nome do Brain (opcional)</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Ex: Meu Brain Full-Stack"
          className="lv-input"
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
              className={`relative flex flex-col items-center gap-2.5 p-4 rounded-2xl transition-all text-center group ${
                active
                  ? "bg-primary/8 border-primary/25 shadow-sm shadow-primary/10"
                  : "hover:bg-muted/40"
              }`}
              style={{
                border: active ? '1.5px solid hsl(var(--primary) / 0.25)' : '1.5px solid transparent',
                background: active ? undefined : 'var(--liquid-glass-bg)',
                backdropFilter: 'blur(20px)',
              }}
            >
              {active && (
                <div className="absolute top-2 right-2">
                  <CheckCircle className="h-4 w-4 text-primary" />
                </div>
              )}
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${s.color}`}>
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
          {selectedSkills.length} skills selecionadas — cada uma será injetada como prompt de sistema no projeto.
        </p>
      )}

      <button
        onClick={handleCreate}
        disabled={loading || creating || selectedSkills.length === 0}
        className="lv-btn-primary w-full h-12 text-sm"
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
      className={`group cursor-pointer p-3 rounded-2xl transition-all duration-200 ${
        active
          ? "bg-primary/8 shadow-sm shadow-primary/5"
          : "hover:bg-muted/30"
      }`}
      style={{
        border: active ? '1px solid hsl(var(--primary) / 0.2)' : '1px solid transparent',
      }}
    >
      <div className="flex items-start gap-3">
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
          active ? 'bg-primary/15' : 'bg-muted/50'
        }`}>
          <BrainIcon className={`h-4 w-4 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
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
        <div className="max-w-lg mx-auto px-6 py-20 text-center animate-fade-in">
          <div className="h-20 w-20 rounded-3xl bg-destructive/10 flex items-center justify-center mx-auto mb-6">
            <LinkIcon className="h-10 w-10 text-destructive" />
          </div>
          <h1 className="lv-heading-lg mb-3">Lovable não conectado</h1>
          <p className="lv-body-lg mb-8">Para usar o Star AI, conecte sua conta Lovable primeiro.</p>
          <Link to="/lovable/connect" className="lv-btn-primary h-12 px-8 inline-flex items-center gap-2">
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
        {sidebarOpen && <div className="absolute inset-0 z-20 bg-black/40 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />}

        {/* Sidebar */}
        <div className={`
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0 lg:w-0 lg:overflow-hidden"}
          absolute lg:relative z-30 lg:z-auto w-72 lg:w-72 h-full
          flex flex-col shrink-0 transition-all duration-200
        `}
          style={{
            background: 'var(--liquid-glass-bg)',
            backdropFilter: 'blur(30px) saturate(200%)',
            WebkitBackdropFilter: 'blur(30px) saturate(200%)',
            borderRight: '0.5px solid var(--clf-border)',
          }}
        >
          <div className="p-3" style={{ borderBottom: '0.5px solid var(--clf-border)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="lv-label">Brains</span>
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
          <div className="flex-1 overflow-y-auto p-2">
            <p className="lv-label px-2 mb-2">Histórico</p>
            {allConversations.filter(c => c.status !== "processing").length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhuma conversa ainda</p>
            )}
            {allConversations.filter(c => c.status !== "processing").map(c => (
              <div key={c.id} className="px-2.5 py-2 rounded-xl text-xs text-muted-foreground truncate hover:bg-muted/30 transition-colors cursor-pointer">
                <MessageSquare className="h-3 w-3 inline mr-1.5 opacity-50" />
                {c.user_message.slice(0, 40)}{c.user_message.length > 40 ? "..." : ""}
              </div>
            ))}
          </div>
        </div>

        {/* Main chat area — WhatsApp Web style */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header bar */}
          <div
            className="px-4 py-3 flex items-center gap-3 shrink-0"
            style={{
              background: 'var(--liquid-glass-bg)',
              backdropFilter: 'blur(30px) saturate(200%)',
              WebkitBackdropFilter: 'blur(30px) saturate(200%)',
              borderBottom: '0.5px solid var(--clf-border)',
            }}
          >
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-muted/50 transition-colors shrink-0">
              {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
            </button>
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 shadow-sm">
              <BrainIcon className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 mr-auto">
              <p className="text-[15px] font-bold leading-tight">{activeBrain?.name || "Star AI"}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[11px] text-muted-foreground">online</span>
              </div>
            </div>

            {activeBrain?.project_url && (
              <a href={activeBrain.project_url} target="_blank" rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-[11px] font-medium hover:bg-muted/50 transition-colors shrink-0 text-muted-foreground hover:text-foreground"
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
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
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
          <div className="sm:hidden flex items-center gap-1 px-3 py-2 overflow-x-auto" style={{ borderBottom: '0.5px solid var(--clf-border)' }}>
            {activeSkills.map(s => {
              const meta = ALL_SKILLS.find(sk => sk.id === s);
              if (!meta) return null;
              return (
                <button key={s} onClick={() => setBrainType(s as BrainSkill)}
                  className={`h-8 px-3 rounded-full text-[11px] font-semibold flex items-center gap-1.5 shrink-0 transition-all ${
                    brainType === s ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : "text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <meta.icon className="h-3 w-3" /> {meta.label}
                </button>
              );
            })}
          </div>

          {/* Chat messages — WhatsApp style with wallpaper pattern */}
          <div
            className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-4"
            style={{
              backgroundImage: `radial-gradient(circle at 50% 50%, hsl(var(--mesh-1) / 0.03) 0%, transparent 70%)`,
            }}
          >
            {!activeBrainId && (
              <div className="text-center py-16 sm:py-24 animate-fade-in">
                <div className="h-20 w-20 rounded-3xl bg-muted/30 flex items-center justify-center mx-auto mb-5">
                  <BrainIcon className="h-10 w-10 text-muted-foreground/20" />
                </div>
                <p className="lv-heading-sm mb-2">Selecione um Brain</p>
                <p className="lv-body max-w-xs mx-auto">Clique em um Brain na barra lateral ou crie um novo.</p>
              </div>
            )}

            {activeBrainId && allConversations.length === 0 && (
              <div className="text-center py-16 sm:py-24 animate-fade-in">
                <div className="h-20 w-20 rounded-3xl bg-primary/5 flex items-center justify-center mx-auto mb-5">
                  <Send className="h-8 w-8 text-primary/30" />
                </div>
                <p className="lv-heading-sm mb-2">Inicie uma conversa</p>
                <p className="lv-body max-w-xs mx-auto">Envie uma mensagem para o Star AI responder como especialista.</p>
              </div>
            )}

            {allConversations.map(convo => (
              <div key={convo.id} className="space-y-2 max-w-3xl mx-auto animate-fade-in">
                {/* User bubble — right side, WhatsApp green-ish (using primary) */}
                <div className="flex justify-end">
                  <div className="max-w-[80%] sm:max-w-[70%] relative">
                    <div className="rounded-2xl rounded-tr-md bg-primary text-primary-foreground px-4 py-3 shadow-md shadow-primary/10">
                      <p className="text-[13px] whitespace-pre-wrap break-words leading-relaxed">{convo.user_message}</p>
                      <div className="flex items-center justify-end gap-2 mt-1.5">
                        <span className="text-[10px] opacity-50">{ALL_SKILLS.find(b => b.id === convo.brain_type)?.label}</span>
                        <span className="text-[10px] opacity-40">{new Date(convo.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                        {convo.status === "completed" && <CheckCircle className="h-3 w-3 opacity-50" />}
                      </div>
                    </div>
                  </div>
                </div>
                {/* AI bubble — left side */}
                <div className="flex justify-start gap-2">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 mt-1 shadow-sm">
                    <BrainIcon className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="max-w-[85%] sm:max-w-[80%]">
                    <div
                      className="rounded-2xl rounded-tl-md px-4 py-3 shadow-sm"
                      style={{
                        background: 'var(--liquid-glass-bg)',
                        backdropFilter: 'blur(20px)',
                        border: '0.5px solid var(--clf-border)',
                      }}
                    >
                      {convo.status === "processing" && sendStartTime && <ProcessingIndicator startTime={sendStartTime} />}
                      {convo.status === "processing" && !sendStartTime && (
                        <div className="flex items-center gap-3">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span className="text-sm text-muted-foreground">Processando...</span>
                        </div>
                      )}
                      {convo.status === "timeout" && (
                        <div className="flex items-center gap-2 text-amber-500"><AlertTriangle className="h-4 w-4" /><span className="text-sm">Tempo esgotado.</span></div>
                      )}
                      {convo.status === "failed" && (
                        <div className="flex items-center gap-2 text-destructive"><XCircle className="h-4 w-4" /><span className="text-sm">{convo.ai_response || "Falha"}</span></div>
                      )}
                      {convo.status === "completed" && convo.ai_response && (
                        <>
                          <div className="prose prose-sm dark:prose-invert max-w-none text-[13px] leading-relaxed break-words [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_code]:break-all [&_pre]:rounded-xl [&_pre]:bg-muted/50 [&_pre]:p-3">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{convo.ai_response}</ReactMarkdown>
                          </div>
                          <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-border/20">
                            <button
                              onClick={() => { navigator.clipboard.writeText(convo.ai_response!); toast.success("Copiado!"); }}
                              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                            >
                              📋 Copiar
                            </button>
                            <span className="text-[10px] text-muted-foreground/50">
                              {new Date(convo.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <CheckCircle className="h-3 w-3 text-green-500 ml-auto" />
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

          {/* Input bar — fixed bottom, WhatsApp style */}
          {activeBrainId && (
            <div
              className="px-4 sm:px-8 py-3 shrink-0"
              style={{
                background: 'var(--liquid-glass-bg)',
                backdropFilter: 'blur(30px) saturate(200%)',
                WebkitBackdropFilter: 'blur(30px) saturate(200%)',
                borderTop: '0.5px solid var(--clf-border)',
              }}
            >
              <div className="max-w-3xl mx-auto flex items-end gap-3">
                <div
                  className="flex-1 rounded-2xl overflow-hidden"
                  style={{ border: '0.5px solid var(--clf-border)', background: 'var(--liquid-glass-bg)' }}
                >
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); } }}
                    placeholder={`Pergunte ao Star AI (${ALL_SKILLS.find(b => b.id === brainType)?.label})...`}
                    rows={1}
                    disabled={sending}
                    className="w-full min-h-[44px] max-h-[160px] py-3 px-4 resize-none text-[13px] bg-transparent focus:outline-none placeholder:text-muted-foreground/40 disabled:opacity-50"
                    onInput={e => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 160) + "px"; }}
                  />
                </div>
                <button
                  onClick={sendMsg}
                  disabled={!message.trim() || sending}
                  className="h-11 w-11 flex items-center justify-center shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary/20"
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
