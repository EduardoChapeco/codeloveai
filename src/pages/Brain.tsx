import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useSEO } from "@/hooks/useSEO";
import AppLayout from "@/components/AppLayout";
import OrchestratorDashboard from "@/components/orchestrator/OrchestratorDashboard";
import {
  Brain as BrainIcon, Send, Loader2, Sparkles, Code2, Palette, Search, Database,
  Plus, Clock, CheckCircle, XCircle, AlertTriangle, Power, LinkIcon,
  MessageSquare, ChevronLeft, ChevronRight, Bug, Globe, Zap, Volume2, VolumeX, Stars,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AssistantMessage {
  role: "user" | "ai";
  content: string;
  audioUrl?: string;
  loading?: boolean;
}

type BrainType = "general" | "design" | "code" | "scraper" | "migration" | "error" | "seo";
type ConvoStatus = "pending" | "processing" | "completed" | "timeout" | "failed";

interface Conversation {
  id: string;
  user_message: string;
  ai_response: string | null;
  brain_type: BrainType;
  status: ConvoStatus;
  created_at: string;
  target_project_id: string | null;
}

const brainTypes: { id: BrainType; label: string; icon: typeof BrainIcon; desc: string }[] = [
  { id: "general", label: "Geral", icon: Sparkles, desc: "Perguntas e respostas gerais" },
  { id: "design", label: "Design", icon: Palette, desc: "Prompts de design detalhados" },
  { id: "code", label: "Code", icon: Code2, desc: "Geração de código" },
  { id: "scraper", label: "Scraper", icon: Search, desc: "Scripts de scraping" },
  { id: "migration", label: "Migration", icon: Database, desc: "Scripts de migração SQL" },
  { id: "error", label: "Error Fix", icon: Bug, desc: "Correção de erros de runtime (gratuito)" },
  { id: "seo", label: "SEO Fix", icon: Globe, desc: "Correção de SEO via PageSpeed (gratuito)" },
];

function groupByDate(convos: Conversation[]): Record<string, Conversation[]> {
  const groups: Record<string, Conversation[]> = {};
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString();

  convos.forEach(c => {
    const d = new Date(c.created_at);
    const ds = d.toDateString();
    let label: string;
    if (ds === today) label = "Hoje";
    else if (ds === yesterday) label = "Ontem";
    else {
      const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
      if (diff < 7) label = "Últimos 7 dias";
      else if (diff < 30) label = "Últimos 30 dias";
      else label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    }
    if (!groups[label]) groups[label] = [];
    groups[label].push(c);
  });
  return groups;
}

export default function BrainPage() {
  const { user, loading: authLoading } = useAuth();
  const brainEnabled = true;
  const flagLoading = false;
  const navigate = useNavigate();

  const [brainActive, setBrainActive] = useState<boolean | null>(null);
  const [lovableConnected, setLovableConnected] = useState<boolean | null>(null);
  const [settingUp, setSettingUp] = useState(false);
  const [allConversations, setAllConversations] = useState<Conversation[]>([]);
  const [currentConvoId, setCurrentConvoId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [brainType, setBrainType] = useState<BrainType>("general");
  const [sending, setSending] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [brainMode, setBrainMode] = useState<"chat" | "orchestrator" | "assistant">("chat");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const assistantEndRef = useRef<HTMLDivElement>(null);

  // ── Gemini Assistant state ────────────────────────────────────
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([]);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<HTMLAudioElement | null>(null);

  const historyConvos = useMemo(() => {
    return allConversations.filter(c => c.status === "completed" || c.status === "timeout" || c.status === "failed");
  }, [allConversations]);

  const groupedHistory = useMemo(() => groupByDate(historyConvos), [historyConvos]);

  // ── Access Gates effect (must be after all hooks) ──
  useEffect(() => {
    if (!authLoading && !flagLoading && !brainEnabled) {
      if (!user) navigate("/login");
      else navigate("/lab/brain");
    }
  }, [user, authLoading, brainEnabled, flagLoading, navigate]);


  useEffect(() => {
    if (!user) return;
    checkBrainStatus();
    loadHistory();
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allConversations]);

  const checkBrainStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("loveai-brain", {
        body: { action: "status" },
      });
      if (!error && data) {
        const statusData = data as { active: boolean; connected?: boolean };
        setBrainActive(statusData.active);
        setLovableConnected(statusData.connected !== false);
      } else {
        const errorMsg = (data as { error?: string })?.error || "";
        if (errorMsg.includes("não conectado") || errorMsg.includes("not_connected")) {
          setLovableConnected(false);
          setBrainActive(false);
        } else {
          setBrainActive(false);
          setLovableConnected(null);
        }
      }
    } catch {
      setBrainActive(false);
    }
  };

  const loadHistory = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("loveai-brain", {
        body: { action: "history", limit: 100 },
      });
      if (!error && data?.conversations) {
        setAllConversations(data.conversations.reverse());
      }
    } catch { /* silent */ }
  };

  const startNewConversation = () => {
    setCurrentConvoId(null);
    setMessage("");
  };

  const selectConversation = (convo: Conversation) => {
    setCurrentConvoId(convo.id);
    setBrainType(convo.brain_type);
  };

  const setupBrain = async () => {
    setSettingUp(true);
    try {
      const { data, error } = await supabase.functions.invoke("loveai-brain", {
        body: { action: "setup" },
      });
      if (error) throw { message: (data as { error?: string })?.error || error.message || "Erro ao ativar Star AI" };
      if (data && (data as { error?: string }).error) throw { message: (data as { error?: string }).error };
      setBrainActive(true);
      toast.success((data as { already_exists?: boolean })?.already_exists ? "Star AI já estava ativo!" : "Star AI ativado com sucesso! 🧠");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error(errorMsg);
    } finally {
      setSettingUp(false);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || sending || capturing) return;

    const userMsg = message.trim();
    setMessage("");
    setSending(true);

    const tempId = crypto.randomUUID();
    const tempConvo: Conversation = {
      id: tempId,
      user_message: userMsg,
      ai_response: null,
      brain_type: brainType,
      status: "processing",
      created_at: new Date().toISOString(),
      target_project_id: null,
    };
    setAllConversations(prev => [...prev, tempConvo]);

    try {
      const { data, error } = await supabase.functions.invoke("loveai-brain", {
        body: { action: "send", message: userMsg, brain_type: brainType },
      });
      if (error) {
        const errData = data as { code?: string; error?: string };
        if (errData?.code === "token_expired") {
          setLovableConnected(false);
          setBrainActive(false);
        }
        throw { message: errData?.error || error.message };
      }
      const responseData = data as { conversation_id: string; brain_message_id: string; chat_mode?: string; error?: string; code?: string };
      if (responseData?.error) {
        if (responseData?.code === "token_expired") {
          setLovableConnected(false);
          setBrainActive(false);
        }
        throw { message: responseData.error };
      }

      const conversationId = responseData.conversation_id;
      const chatMode = data.chat_mode || "security_fix";

      setAllConversations(prev =>
        prev.map(c => c.id === tempId ? { ...c, id: conversationId } : c)
      );
      setCurrentConvoId(conversationId);

      setSending(false);
      setCapturing(true);

      // Polling — wait 8s initially, then poll every 4s for up to 180s
      await new Promise(r => setTimeout(r, 8000));
      
      const maxPolls = 43;
      let captured = false;
      for (let i = 0; i < maxPolls; i++) {
        await new Promise(r => setTimeout(r, 4000));
        try {
          const { data: captureData, error: captureError } = await supabase.functions.invoke("loveai-brain", {
            body: { action: "capture", conversation_id: conversationId, brain_message_id: data.brain_message_id },
          });
          
          if (captureError) {
            console.warn("Capture poll error:", captureError);
            continue;
          }
          
          if (captureData?.status === "completed" && captureData?.response) {
            setAllConversations(prev =>
              prev.map(c =>
                c.id === conversationId
                  ? { ...c, ai_response: captureData.response, status: "completed" }
                  : c
              )
            );
            captured = true;
            break;
          }
        } catch {
          // Network error, retry
        }
      }

      if (!captured) {
        setAllConversations(prev =>
          prev.map(c => c.id === conversationId ? { ...c, status: "timeout" } : c)
        );
        toast.error("Star AI não respondeu a tempo (180s). Tente novamente.");
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setAllConversations(prev =>
        prev.map(c => c.id === tempId ? { ...c, status: "failed" } : c)
      );
      toast.error(errorMsg);
    } finally {
      setSending(false);
      setCapturing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Gemini assistant send ────────────────────────────────────
  const sendAssistantMessage = useCallback(async () => {
    const text = assistantInput.trim();
    if (!text || assistantLoading) return;
    setAssistantInput("");
    setAssistantMessages(prev => [
      ...prev,
      { role: "user", content: text },
      { role: "ai", content: "", loading: true },
    ]);
    setAssistantLoading(true);
    try {
      const history = assistantMessages
        .filter(m => !m.loading)
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }));
      const { data, error } = await supabase.functions.invoke("gemini-chat", {
        body: { message: text, history },
      });
      if (error) throw error;
      const reply = (data as { reply: string }).reply || "Não consegui processar sua pergunta. Tente novamente.";
      setAssistantMessages(prev =>
        prev.map((m, i) => i === prev.length - 1 ? { ...m, content: reply, loading: false } : m)
      );
    } catch (e: unknown) {
      setAssistantMessages(prev =>
        prev.map((m, i) => i === prev.length - 1
          ? { ...m, content: "Erro ao conectar com o assistente. Tente novamente.", loading: false }
          : m
        )
      );
      toast.error((e as Error).message);
    } finally {
      setAssistantLoading(false);
    }
  }, [assistantInput, assistantLoading, assistantMessages]);

  const playVoice = useCallback(async (text: string) => {
    if (playingAudio) { playingAudio.pause(); setPlayingAudio(null); return; }
    try {
      const { data, error } = await supabase.functions.invoke("voice-response", {
        body: { text },
      });
      if (error || !(data as { url?: string }).url) throw new Error("Sem URL de áudio");
      const audio = new Audio((data as { url: string }).url);
      setPlayingAudio(audio);
      audio.onended = () => setPlayingAudio(null);
      audio.play();
    } catch { toast.error("Não foi possível gerar o áudio."); }
  }, [playingAudio]);

  useEffect(() => {
    assistantEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [assistantMessages]);

  const copyResponse = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Resposta copiada!");
  };

  if (authLoading || flagLoading || !user) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!brainEnabled) return null;

  if (lovableConnected === false) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto px-6 py-20 text-center">
          <div className="h-20 w-20 rounded-3xl bg-destructive/10 flex items-center justify-center mx-auto mb-6">
            <LinkIcon className="h-10 w-10 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-3">Lovable não conectado</h1>
          <p className="text-muted-foreground mb-2">
            Para usar o Star AI, você precisa conectar sua conta Lovable primeiro.
          </p>
          <p className="text-sm text-muted-foreground/70 mb-8">
            O Star AI utiliza o Lovable como motor de processamento. Conecte seu token nas configurações.
          </p>
          <Link to="/lovable/connect" className="lv-btn-primary h-12 px-8 text-sm inline-flex items-center gap-2">
            <LinkIcon className="h-4 w-4" /> Conectar Lovable
          </Link>
        </div>
      </AppLayout>
    );
  }

  if (brainActive === false) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto px-6 py-20 text-center">
          <div className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <BrainIcon className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-3">Star AI</h1>
          <p className="text-muted-foreground mb-2">
            O Star AI é sua IA pessoal alimentada pelo Lovable.
          </p>
          <p className="text-sm text-muted-foreground/70 mb-8">
            Funciona via modos gratuitos — sem gastar créditos do Lovable.
          </p>
          <button onClick={setupBrain} disabled={settingUp} className="lv-btn-primary h-12 px-8 text-sm inline-flex items-center gap-2">
            {settingUp ? <><Loader2 className="h-4 w-4 animate-spin" /> Criando Star AI...</> : <><Power className="h-4 w-4" /> Ativar Star AI</>}
          </button>
        </div>
      </AppLayout>
    );
  }

  if (brainActive === null) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  const displayConvos = currentConvoId
    ? allConversations.filter(c => c.id === currentConvoId)
    : allConversations.filter(c => c.status === "processing");

  return (
    <AppLayout>
      <div className="flex" style={{ height: "calc(100vh - 3rem)" }}>
        {/* Sidebar */}
        <div className={`clf-glass-sidebar flex flex-col shrink-0 transition-all duration-200 ${sidebarOpen ? "w-64" : "w-0 overflow-hidden"}`}>
          <div className="p-3 border-b border-white/[0.06] flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Histórico</span>
            <button onClick={startNewConversation} className="h-7 w-7 flex items-center justify-center rounded-xl hover:bg-white/[0.06] transition-colors" title="Nova conversa">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-3">
            {Object.keys(groupedHistory).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhuma conversa ainda</p>
            )}
            {Object.entries(groupedHistory).map(([label, convos]) => (
              <div key={label}>
                <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-2 mb-1">{label}</p>
                {convos.map(c => (
                  <button
                    key={c.id}
                    onClick={() => selectConversation(c)}
                    className={`w-full text-left px-2.5 py-2 rounded-xl text-xs truncate transition-all ${
                      currentConvoId === c.id ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:bg-white/[0.04]"
                    }`}
                  >
                    <MessageSquare className="h-3 w-3 inline mr-1.5 opacity-50" />
                    {c.user_message.slice(0, 40)}{c.user_message.length > 40 ? "..." : ""}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="border-b border-white/[0.06] px-4 py-3 flex items-center gap-3 shrink-0">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="h-8 w-8 flex items-center justify-center rounded-xl hover:bg-white/[0.06] transition-colors">
              {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <BrainIcon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Star AI</p>
              <p className="text-[11px] text-muted-foreground">🟢 Ativo</p>
            </div>

            {/* Mode toggle */}
            <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-0.5 ml-2">
              <button
                onClick={() => setBrainMode("chat")}
                className={`h-7 px-3 rounded-md text-xs font-medium flex items-center gap-1 transition-colors ${
                  brainMode === "chat" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <MessageSquare className="h-3 w-3" /> Chat
              </button>
              <button
                onClick={() => setBrainMode("assistant")}
                className={`h-7 px-3 rounded-md text-xs font-medium flex items-center gap-1 transition-colors ${
                  brainMode === "assistant" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Stars className="h-3 w-3" /> Assistente
              </button>
              <button
                onClick={() => setBrainMode("orchestrator")}
                className={`h-7 px-3 rounded-md text-xs font-medium flex items-center gap-1 transition-colors ${
                  brainMode === "orchestrator" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Zap className="h-3 w-3" /> Orquestrador
              </button>
            </div>

            {brainMode === "chat" && (
              <div className="ml-auto flex items-center gap-1 flex-wrap justify-end">
                {brainTypes.map(bt => (
                  <button
                    key={bt.id}
                    onClick={() => setBrainType(bt.id)}
                    title={bt.desc}
                    className={`h-7 px-2.5 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors ${
                      brainType === bt.id ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <bt.icon className="h-3 w-3" />
                    <span className="hidden lg:inline">{bt.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Orchestrator mode */}
          {brainMode === "orchestrator" && (
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <OrchestratorDashboard />
            </div>
          )}

          {/* ── Gemini Assistant Mode ──────────────────────────── */}
          {brainMode === "assistant" && (
            <div className="flex-1 flex flex-col min-w-0">
              {/* Info banner */}
              <div className="px-4 py-2.5 bg-blue-500/5 border-b border-blue-400/20 flex items-center gap-2">
                <Stars className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                <p className="text-[11px] text-blue-600/80">
                  <strong>Assistente Starble</strong> — responde dúvidas sobre como usar a plataforma. Powered by Gemini.
                </p>
                {assistantMessages.length > 0 && (
                  <button
                    onClick={() => setAssistantMessages([])}
                    className="ml-auto text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Limpar conversa
                  </button>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {assistantMessages.length === 0 && (
                  <div className="text-center py-16">
                    <div className="h-16 w-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
                      <Stars className="h-8 w-8 text-blue-500" />
                    </div>
                    <p className="font-medium mb-1">Como posso ajudar?</p>
                    <p className="text-sm text-muted-foreground mb-6">Tire dúvidas sobre a plataforma Starble</p>
                    <div className="flex flex-col gap-2 max-w-sm mx-auto">
                      {[
                        "Como funciona o Orquestrador?",
                        "O que é o StarCrawl?",
                        "Como conectar minha conta Lovable?",
                        "Diferença entre os planos?",
                      ].map(q => (
                        <button
                          key={q}
                          onClick={() => { setAssistantInput(q); }}
                          className="text-left px-4 py-2.5 rounded-xl bg-muted/40 hover:bg-muted/70 text-sm text-muted-foreground transition-colors border border-border/40"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {assistantMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "ai" && (
                      <div className="h-7 w-7 rounded-full bg-blue-500/15 flex items-center justify-center shrink-0 mr-2 mt-1">
                        <Stars className="h-3.5 w-3.5 text-blue-500" />
                      </div>
                    )}
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted/60 border border-border/40 rounded-bl-sm"
                    }`}>
                      {msg.loading ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span className="text-xs text-muted-foreground">Pensando...</span>
                        </div>
                      ) : (
                        <>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                          {msg.role === "ai" && msg.content && (
                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/30">
                              <button
                                onClick={() => playVoice(msg.content)}
                                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                                title="Ouvir resposta"
                              >
                                {playingAudio ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                                {playingAudio ? "Parar" : "Ouvir"}
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={assistantEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-border/60 px-4 py-3">
                <div className="flex items-end gap-2">
                  <textarea
                    value={assistantInput}
                    onChange={e => setAssistantInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAssistantMessage(); }
                    }}
                    placeholder="Pergunte sobre a plataforma..."
                    rows={1}
                    className="flex-1 resize-none bg-muted/40 border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[44px] max-h-[120px] focus:border-primary/50"
                    style={{ scrollbarWidth: "none" }}
                  />
                  <button
                    onClick={sendAssistantMessage}
                    disabled={assistantLoading || !assistantInput.trim()}
                    className="h-11 w-11 flex items-center justify-center rounded-xl bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 transition-colors shrink-0"
                  >
                    {assistantLoading
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Send className="h-4 w-4" />
                    }
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Messages + Input (chat mode only) */}
          {brainMode === "chat" && (
            <>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {displayConvos.length === 0 && !currentConvoId && (
              <div className="text-center py-20">
                <BrainIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground/20" />
                <p className="font-medium mb-1">Inicie uma conversa</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Envie uma mensagem e o Star AI processará via modos gratuitos do Lovable.
                </p>
                <div className="flex flex-wrap gap-2 justify-center text-xs text-muted-foreground">
                  <span className="px-2 py-1 rounded-md bg-muted/50">🔒 Security Fix</span>
                  <span className="px-2 py-1 rounded-md bg-muted/50">🐛 Error Fix</span>
                  <span className="px-2 py-1 rounded-md bg-muted/50">🌐 SEO Fix</span>
                </div>
              </div>
            )}

            {(currentConvoId ? [allConversations.find(c => c.id === currentConvoId)].filter(Boolean) as Conversation[] : allConversations).map((convo) => (
              <div key={convo.id} className="space-y-3">
                <div className="flex justify-end">
                  <div className="max-w-[75%] rounded-2xl rounded-br-md bg-primary text-primary-foreground px-4 py-3">
                    <p className="text-sm whitespace-pre-wrap">{convo.user_message}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] opacity-60">{brainTypes.find(b => b.id === convo.brain_type)?.label || convo.brain_type}</span>
                      <span className="text-[10px] opacity-40">{new Date(convo.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-[22px] rounded-bl-md clf-liquid-glass px-5 py-4 shadow-sm border-black/[0.03] dark:border-white/[0.03]">
                    {convo.status === "processing" && (
                      <div className="flex items-center gap-3 text-primary">
                        <Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm font-medium tracking-tight">Analisando prompt...</span>
                      </div>
                    )}
                    {convo.status === "timeout" && (
                      <div className="flex items-center gap-2 text-amber-500">
                        <AlertTriangle className="h-4 w-4" /><span className="text-sm">Tempo esgotado — tente novamente</span>
                      </div>
                    )}
                    {convo.status === "failed" && (
                      <div className="flex items-center gap-2 text-destructive">
                        <XCircle className="h-4 w-4" /><span className="text-sm">Falha ao processar</span>
                      </div>
                    )}
                    {convo.status === "completed" && convo.ai_response && (
                      <>
                        <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{convo.ai_response}</ReactMarkdown>
                        </div>
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/40">
                          <button onClick={() => copyResponse(convo.ai_response!)} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">📋 Copiar</button>
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
          <div className="border-t border-border/60 px-6 py-3 shrink-0">
            <div className="max-w-4xl mx-auto flex items-end gap-3">
              <div className="flex-1 relative">
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Pergunte algo ao Star AI (${brainTypes.find(b => b.id === brainType)?.label})...`}
                  rows={1}
                  disabled={sending || capturing}
                  className="w-full min-h-[44px] max-h-[160px] py-3 px-4 pr-12 resize-none text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  style={{ height: "auto", overflow: "hidden" }}
                  onInput={(e) => {
                    const t = e.currentTarget;
                    t.style.height = "auto";
                    t.style.height = Math.min(t.scrollHeight, 160) + "px";
                  }}
                />
              </div>
              <button
                onClick={sendMessage}
                disabled={!message.trim() || sending || capturing}
                className="h-11 w-11 flex items-center justify-center shrink-0 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {sending || capturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
            {capturing && (
              <p className="text-center text-xs text-muted-foreground mt-2 animate-pulse">
                ⏳ Aguardando resposta do Star AI (até 180s)...
              </p>
            )}
          </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
