import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useSEO } from "@/hooks/useSEO";
import AppLayout from "@/components/AppLayout";
import {
  Brain as BrainIcon, Send, Loader2, Sparkles, Code2, Palette, Search, Database,
  Plus, Clock, CheckCircle, XCircle, AlertTriangle, Power, LinkIcon,
  MessageSquare, ChevronLeft, ChevronRight, RotateCcw, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type BrainType = "general" | "design" | "code" | "scraper" | "migration";
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
  const navigate = useNavigate();
  useSEO({ title: "Star AI" });

  const [brainActive, setBrainActive] = useState<boolean | null>(null);
  const [lovableConnected, setLovableConnected] = useState<boolean | null>(null);
  const [settingUp, setSettingUp] = useState(false);
  const [allConversations, setAllConversations] = useState<Conversation[]>([]);
  const [currentConvoId, setCurrentConvoId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [brainType, setBrainType] = useState<BrainType>("general");
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const historyConvos = useMemo(() => {
    return allConversations.filter(c => c.status === "completed" || c.status === "timeout" || c.status === "failed");
  }, [allConversations]);

  const groupedHistory = useMemo(() => groupByDate(historyConvos), [historyConvos]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

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
        setBrainActive((data as any).active);
        setLovableConnected((data as any).connected !== false);
      } else {
        setBrainActive(false);
        setLovableConnected(false);
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

  const setupBrain = async () => {
    setSettingUp(true);
    try {
      const { data, error } = await supabase.functions.invoke("loveai-brain", {
        body: { action: "setup" },
      });
      if (error) throw new Error((data as any)?.error || error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      setBrainActive(true);
      if ((data as any)?.recreated) {
        toast.success("Star AI recriado com sucesso! Conta Lovable pode ter mudado. 🔄");
      } else {
        toast.success((data as any)?.already_exists ? "Star AI já estava ativo!" : "Star AI ativado com sucesso! 🧠");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao ativar Star AI");
    } finally {
      setSettingUp(false);
    }
  };

  const resetBrain = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("loveai-brain", {
        body: { action: "reset" },
      });
      if (error) throw new Error((data as any)?.error || error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      setBrainActive(false);
      setAllConversations([]);
      setCurrentConvoId(null);
      toast.success("Star AI resetado! Clique em Ativar para recriar.");
    } catch (err: any) {
      toast.error(err.message || "Erro ao resetar Star AI");
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || sending) return;
    const userMsg = message.trim();
    setMessage("");
    setSending(true);

    const tempId = crypto.randomUUID();
    const tempConvo: Conversation = {
      id: tempId, user_message: userMsg, ai_response: null,
      brain_type: brainType, status: "processing",
      created_at: new Date().toISOString(), target_project_id: null,
    };
    setAllConversations(prev => [...prev, tempConvo]);

    try {
      const { data, error } = await supabase.functions.invoke("loveai-brain", {
        body: { action: "send", message: userMsg, brain_type: brainType },
      });
      if (error) {
        if ((data as any)?.code === "no_token") { setLovableConnected(false); setBrainActive(false); }
        throw new Error((data as any)?.error || error.message);
      }
      if (data?.error) {
        if (data?.code === "no_token") { setLovableConnected(false); setBrainActive(false); }
        throw new Error(data.error);
      }

      const conversationId = data.conversation_id || tempId;
      const responseText = data.response || null;
      const finalStatus = data.status === "completed" ? "completed" : data.status === "timeout" ? "timeout" : "failed";

      setAllConversations(prev =>
        prev.map(c => c.id === tempId ? { ...c, id: conversationId, ai_response: responseText, status: finalStatus as ConvoStatus } : c)
      );
      setCurrentConvoId(conversationId);
      if (finalStatus === "timeout") toast.error("Star AI não respondeu a tempo (90s). Tente novamente.");
    } catch (err: any) {
      setAllConversations(prev => prev.map(c => c.id === tempId ? { ...c, status: "failed" } : c));
      toast.error(err.message || "Erro ao processar");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const copyResponse = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Resposta copiada!");
  };

  if (authLoading || !user) {
    return <AppLayout><div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div></AppLayout>;
  }

  // Not connected
  if (lovableConnected === false) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto px-6 py-20 text-center">
          <div className="h-20 w-20 rounded-3xl bg-destructive/10 flex items-center justify-center mx-auto mb-6">
            <LinkIcon className="h-10 w-10 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-3">Lovable não conectado</h1>
          <p className="text-muted-foreground mb-2">Para usar o Star AI, conecte sua conta Lovable primeiro.</p>
          <p className="text-sm text-muted-foreground/70 mb-8">O Star AI utiliza o Lovable como motor de IA — sem gastar créditos.</p>
          <Link to="/lovable/connect" className="inline-flex items-center gap-2 h-12 px-8 rounded-2xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <LinkIcon className="h-4 w-4" /> Conectar Lovable
          </Link>
        </div>
      </AppLayout>
    );
  }

  // Not activated
  if (brainActive === false) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto px-6 py-20 text-center">
          <div className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <BrainIcon className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-3">Star AI</h1>
          <p className="text-muted-foreground mb-2">O Star AI é sua IA pessoal alimentada pelo Lovable.</p>
          <p className="text-sm text-muted-foreground/70 mb-8">Funciona via modos gratuitos — sem gastar créditos.</p>
          <button onClick={setupBrain} disabled={settingUp} className="inline-flex items-center gap-2 h-12 px-8 rounded-2xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
            {settingUp ? <><Loader2 className="h-4 w-4 animate-spin" /> Criando Star AI...</> : <><Power className="h-4 w-4" /> Ativar Star AI</>}
          </button>
        </div>
      </AppLayout>
    );
  }

  // Loading status
  if (brainActive === null) {
    return <AppLayout><div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></AppLayout>;
  }

  const displayConvos = currentConvoId
    ? allConversations.filter(c => c.id === currentConvoId)
    : allConversations.filter(c => c.status === "processing" || allConversations.length <= 5);

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-3rem)] relative">
        {/* History sidebar — overlay on mobile, inline on desktop */}
        {sidebarOpen && (
          <div className="absolute inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}
        <div className={`
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0 lg:w-0 lg:overflow-hidden"}
          absolute lg:relative z-30 lg:z-auto
          w-72 lg:w-64 h-full
          clf-liquid-glass border-r border-border/30
          flex flex-col shrink-0 transition-all duration-200
        `}>
          <div className="p-3 border-b border-border/20 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Histórico</span>
            <div className="flex items-center gap-1">
              <button onClick={() => { setCurrentConvoId(null); setMessage(""); }} className="h-7 w-7 flex items-center justify-center rounded-xl hover:bg-foreground/5 transition-colors" title="Nova conversa">
                <Plus className="h-4 w-4" />
              </button>
              <button onClick={() => setSidebarOpen(false)} className="h-7 w-7 flex items-center justify-center rounded-xl hover:bg-foreground/5 transition-colors lg:hidden">
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
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
                    onClick={() => { setCurrentConvoId(c.id); setBrainType(c.brain_type); setSidebarOpen(false); }}
                    className={`w-full text-left px-2.5 py-2 rounded-xl text-xs truncate transition-all ${
                      currentConvoId === c.id ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:bg-foreground/5"
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
          <div className="border-b border-border/40 px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="h-8 w-8 flex items-center justify-center rounded-xl hover:bg-foreground/5 transition-colors shrink-0">
              {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
            </button>
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <BrainIcon className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Star AI</p>
              <p className="text-[11px] text-muted-foreground">🟢 Ativo</p>
            </div>

            <button
              onClick={resetBrain}
              title="Resetar Star AI (recriar projeto)"
              className="h-8 w-8 flex items-center justify-center rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            {/* Brain type selector */}
            <div className="flex items-center gap-1 ml-auto flex-wrap justify-end">
              {brainTypes.map(bt => (
                <button
                  key={bt.id}
                  onClick={() => setBrainType(bt.id)}
                  title={bt.desc}
                  className={`h-8 px-3 rounded-2xl text-[11px] font-medium flex items-center gap-1.5 transition-all ${
                    brainType === bt.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "clf-liquid-glass text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <bt.icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{bt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
            {displayConvos.length === 0 && !currentConvoId && (
              <div className="text-center py-12 sm:py-20">
                <BrainIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground/20" />
                <p className="font-medium mb-1">Inicie uma conversa</p>
                <p className="text-sm text-muted-foreground mb-4">Envie uma mensagem e o Star AI processará via Lovable (sem créditos).</p>
                <div className="flex flex-wrap gap-2 justify-center text-xs text-muted-foreground">
                  {brainTypes.map(bt => (
                    <span key={bt.id} className="px-3 py-1.5 rounded-2xl clf-liquid-glass">
                      <bt.icon className="h-3 w-3 inline mr-1" />{bt.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(currentConvoId ? [allConversations.find(c => c.id === currentConvoId)].filter(Boolean) as Conversation[] : displayConvos).map((convo) => (
              <div key={convo.id} className="space-y-3 max-w-4xl mx-auto">
                {/* User message */}
                <div className="flex justify-end">
                  <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-br-md bg-primary text-primary-foreground px-4 py-3">
                    <p className="text-sm whitespace-pre-wrap">{convo.user_message}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] opacity-60">{brainTypes.find(b => b.id === convo.brain_type)?.label || convo.brain_type}</span>
                      <span className="text-[10px] opacity-40">{new Date(convo.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                </div>
                {/* AI response */}
                <div className="flex justify-start">
                  <div className="max-w-[90%] sm:max-w-[85%] rounded-2xl rounded-bl-md clf-liquid-glass px-4 sm:px-5 py-3 sm:py-4">
                    {convo.status === "processing" && (
                      <div className="flex items-center gap-3 text-primary">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm font-medium">Processando (até 90s)...</span>
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
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/30">
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
          <div className="border-t border-border/40 px-4 sm:px-6 py-3 shrink-0">
            <div className="max-w-4xl mx-auto flex items-end gap-2 sm:gap-3">
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Pergunte ao Star AI (${brainTypes.find(b => b.id === brainType)?.label})...`}
                rows={1}
                disabled={sending}
                className="flex-1 min-h-[44px] max-h-[160px] py-3 px-4 resize-none text-sm rounded-2xl clf-liquid-glass focus:outline-none focus:ring-2 focus:ring-primary/30"
                style={{ height: "auto", overflow: "hidden" }}
                onInput={(e) => {
                  const t = e.currentTarget;
                  t.style.height = "auto";
                  t.style.height = Math.min(t.scrollHeight, 160) + "px";
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!message.trim() || sending}
                className="h-11 w-11 flex items-center justify-center shrink-0 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
            {sending && (
              <p className="text-center text-xs text-muted-foreground mt-2 animate-pulse">
                ⏳ Processando no Star AI (até 90s)...
              </p>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
