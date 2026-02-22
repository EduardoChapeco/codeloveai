import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Brain as BrainIcon, Send, Loader2, Sparkles, Code2, Palette, Search, Database,
  Plus, Clock, CheckCircle, XCircle, AlertTriangle, Power, LinkIcon,
  MessageSquare, ChevronLeft, ChevronRight,
} from "lucide-react";

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Current conversation messages
  const currentMessages = useMemo(() => {
    if (!currentConvoId) return allConversations.filter(c => !c.id.includes("-"));
    return allConversations.filter(c => c.id === currentConvoId);
  }, [allConversations, currentConvoId]);

  // History for sidebar - unique conversations from DB (completed ones)
  const historyConvos = useMemo(() => {
    return allConversations.filter(c => c.status === "completed" || c.status === "timeout" || c.status === "failed");
  }, [allConversations]);

  const groupedHistory = useMemo(() => groupByDate(historyConvos), [historyConvos]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login?returnTo=/brain");
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
        setBrainActive(data.active);
        setLovableConnected(data.connected !== false);
      } else {
        const errorMsg = (data as any)?.error || "";
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
      if (error) throw { message: (data as any)?.error || error.message || "Erro ao ativar Brain" };
      if (data?.error) throw { message: data.error };
      setBrainActive(true);
      toast.success(data.already_exists ? "Brain já estava ativo!" : "Brain ativado com sucesso! 🧠");
    } catch (err: any) {
      toast.error(err.message || "Erro ao ativar Brain");
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
        const errData = data as any;
        if (errData?.code === "token_expired") {
          setLovableConnected(false);
          setBrainActive(false);
        }
        throw { message: errData?.error || error.message };
      }
      if (data?.error) {
        if (data?.code === "token_expired") {
          setLovableConnected(false);
          setBrainActive(false);
        }
        throw { message: data.error };
      }

      const conversationId = data.conversation_id;
      const brainProjectId = data.brain_project_id;

      setAllConversations(prev =>
        prev.map(c => c.id === tempId ? { ...c, id: conversationId } : c)
      );
      setCurrentConvoId(conversationId);

      setSending(false);
      setCapturing(true);

      // Client-side polling — check every 4s for up to 180s
      // First 8s: wait without polling (Lovable needs time to start processing)
      await new Promise(r => setTimeout(r, 8000));
      
      const maxPolls = 43; // 43 polls × 4s = 172s + 8s initial = 180s total
      let captured = false;
      for (let i = 0; i < maxPolls; i++) {
        await new Promise(r => setTimeout(r, 4000));
        try {
          const { data: captureData, error: captureError } = await supabase.functions.invoke("loveai-brain", {
            body: { action: "capture", conversation_id: conversationId, brain_project_id: brainProjectId },
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
          // If still "processing", continue polling
        } catch {
          // Network error, retry
        }
      }

      if (!captured) {
        setAllConversations(prev =>
          prev.map(c => c.id === conversationId ? { ...c, status: "timeout" } : c)
        );
        toast.error("Brain não respondeu a tempo (180s). Tente novamente.");
      }
    } catch (err: any) {
      setAllConversations(prev =>
        prev.map(c => c.id === tempId ? { ...c, status: "failed" } : c)
      );
      toast.error(err.message || "Erro ao enviar mensagem");
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

  const copyResponse = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Resposta copiada!");
  };

  if (authLoading || !user) return <div className="min-h-screen bg-background" />;

  if (lovableConnected === false) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto px-6 py-20 text-center">
          <div className="h-20 w-20 rounded-3xl bg-destructive/10 flex items-center justify-center mx-auto mb-6">
            <LinkIcon className="h-10 w-10 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-3">Lovable não conectado</h1>
          <p className="text-muted-foreground mb-2">
            Para usar o LoveAI Brain, você precisa conectar sua conta Lovable primeiro.
          </p>
          <p className="text-sm text-muted-foreground/70 mb-8">
            O Brain utiliza o Lovable como motor de processamento. Conecte seu token nas configurações.
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
          <h1 className="text-2xl font-bold mb-3">LoveAI Brain</h1>
          <p className="text-muted-foreground mb-2">
            O Brain é sua IA pessoal alimentada pelo Lovable.
          </p>
          <p className="text-sm text-muted-foreground/70 mb-8">
            Funciona via Fix V2 — sem gastar créditos do Lovable.
          </p>
          <button onClick={setupBrain} disabled={settingUp} className="lv-btn-primary h-12 px-8 text-sm inline-flex items-center gap-2">
            {settingUp ? <><Loader2 className="h-4 w-4 animate-spin" /> Criando Brain...</> : <><Power className="h-4 w-4" /> Ativar LoveAI Brain</>}
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

  // Active conversations to display
  const displayConvos = currentConvoId
    ? allConversations.filter(c => c.id === currentConvoId)
    : allConversations.filter(c => c.status === "processing");

  return (
    <AppLayout>
      <div className="flex" style={{ height: "calc(100vh - 3rem)" }}>
        {/* Sidebar */}
        <div className={`border-r border-border/60 flex flex-col shrink-0 transition-all duration-200 ${sidebarOpen ? "w-64" : "w-0 overflow-hidden"}`}>
          <div className="p-3 border-b border-border/60 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Histórico</span>
            <button onClick={startNewConversation} className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted transition-colors" title="Nova conversa">
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
                    className={`w-full text-left px-2 py-1.5 rounded-md text-xs truncate transition-colors ${
                      currentConvoId === c.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"
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
          <div className="border-b border-border/60 px-4 py-3 flex items-center gap-3 shrink-0">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
              {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <BrainIcon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">LoveAI Brain</p>
              <p className="text-[11px] text-muted-foreground">🟢 Ativo</p>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              {brainTypes.map(bt => (
                <button
                  key={bt.id}
                  onClick={() => setBrainType(bt.id)}
                  className={`h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                    brainType === bt.id ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <bt.icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{bt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {displayConvos.length === 0 && !currentConvoId && (
              <div className="text-center py-20">
                <BrainIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground/20" />
                <p className="font-medium mb-1">Inicie uma conversa</p>
                <p className="text-sm text-muted-foreground">
                  Envie uma mensagem e o Brain processará via Lovable Fix V2.
                </p>
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
                  <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-muted/60 px-4 py-3">
                    {convo.status === "processing" && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm">Processando...</span>
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
                  placeholder={`Pergunte algo ao Brain (${brainTypes.find(b => b.id === brainType)?.label})...`}
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
                ⏳ Aguardando resposta do Brain (até 180s)...
              </p>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
