import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useEditorUsage } from "@/hooks/useEditorUsage";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import EditorStatusCard from "@/components/editor/EditorStatusCard";
import EditorUsageBar from "@/components/editor/EditorUsageBar";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send, Loader2, ExternalLink, RefreshCw, X,
  Sparkles, Code2, Search, Link2,
  Shield, Bug, Wrench, Zap, BrainCircuit, Copy, ArrowRight, Palette,
} from "lucide-react";

type BrainType = "design" | "code" | "scraper" | "custom";
type ChatMode = "task" | "task_error" | "chat" | "security" | "build_error";

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: string;
  status?: "sending" | "sent" | "error" | "processing";
  mode?: ChatMode;
}

const chatModes: { id: ChatMode; label: string; icon: typeof Zap; desc: string }[] = [
  { id: "task", label: "Task", icon: Zap, desc: "Executa tarefa diretamente" },
  { id: "task_error", label: "Fix Error", icon: Bug, desc: "Corrige erro específico" },
  { id: "security", label: "Security", icon: Shield, desc: "Fix de segurança" },
  { id: "chat", label: "Chat", icon: Send, desc: "Conversa livre" },
  { id: "build_error", label: "Build Fix", icon: Wrench, desc: "Corrige erro de build" },
];

const brainModes: { id: BrainType; label: string; icon: typeof Sparkles }[] = [
  { id: "design", label: "Design", icon: Palette },
  { id: "code", label: "Code", icon: Code2 },
  { id: "scraper", label: "Scraper", icon: Search },
  { id: "custom", label: "Custom", icon: Sparkles },
];

/* ── Liquid Glass inline style helper ── */
const glassCard = {
  background: "var(--liquid-glass-bg, rgba(255,255,255,0.04))",
  backdropFilter: "blur(40px) saturate(200%)",
  WebkitBackdropFilter: "blur(40px) saturate(200%)",
  border: "0.5px solid var(--clf-border)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 12px rgba(0,0,0,0.08)",
} as const;

const glassNav = {
  background: "var(--liquid-glass-bg, rgba(255,255,255,0.04))",
  backdropFilter: "blur(40px) saturate(220%)",
  WebkitBackdropFilter: "blur(40px) saturate(220%)",
  borderBottom: "0.5px solid var(--clf-border)",
} as const;

export default function ProjectEditor() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const usage = useEditorUsage();

  const [sandboxUrl, setSandboxUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [chatMode, setChatMode] = useState<ChatMode>("task");
  const [showStatusCard, setShowStatusCard] = useState(false);

  const [showAiModal, setShowAiModal] = useState(false);
  const [aiMode, setAiMode] = useState<BrainType>("design");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!id || !user) return;
    loadProject();
    loadSandboxUrl();
  }, [id, user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const loadProject = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await supabase
        .from("lovable_projects")
        .select("display_name, name, lovable_project_id")
        .eq("lovable_project_id", id)
        .maybeSingle();
      if (data) setProjectName(data.display_name || data.name || id || "");
    } catch { /* silent */ }
  }, [id]);

  const loadSandboxUrl = useCallback(async () => {
    if (!id) return;
    setLoadingPreview(true);
    setSandboxUrl(`https://id-preview--${id}.lovable.app`);
    setLoadingPreview(false);
  }, [id]);

  const reloadPreview = useCallback(() => {
    if (!id) return;
    setSandboxUrl(null);
    setLoadingPreview(true);
    setTimeout(() => {
      setSandboxUrl(`https://id-preview--${id}.lovable.app`);
      setLoadingPreview(false);
    }, 400);
  }, [id]);

  const handleStatusComplete = useCallback(() => {
    setShowStatusCard(false);
    reloadPreview();
  }, [reloadPreview]);

  const sendChatMessage = async () => {
    if (!message.trim() || sending || !id) return;
    if (!usage.canSend) {
      toast.error("Limite de mensagens atingido. Faça upgrade para o plano Venus.");
      return;
    }

    const userMsg = message.trim();
    setMessage("");
    setSending(true);
    setShowStatusCard(true);

    const tempId = crypto.randomUUID();
    setChatMessages(prev => [...prev, {
      id: tempId, role: "user", content: userMsg,
      timestamp: new Date().toISOString(), status: "sending", mode: chatMode,
    }]);

    try {
      const { data: venusData, error: venusError } = await supabase.functions.invoke("venus-chat", {
        body: { task: userMsg, project_id: id, mode: chatMode },
      });
      if (venusError || !venusData?.ok) throw new Error(venusData?.error || venusError?.message || "Erro ao enviar");

      setChatMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: "sent" } : m));
      usage.increment();

      const modeLabel = chatModes.find(m => m.id === chatMode)?.label || chatMode;
      setChatMessages(prev => [...prev, {
        id: crypto.randomUUID(), role: "ai",
        content: `✅ Task enviada via **${modeLabel}**. Processando alterações...\n\n> MsgID: \`${venusData.msgId?.slice(0, 8)}...\``,
        timestamp: new Date().toISOString(), status: "sent",
      }]);

      try {
        await supabase.from("loveai_conversations").insert({
          user_id: user!.id, target_project_id: id,
          brain_type: chatMode, user_message: userMsg, status: "processing",
        });
      } catch { /* silent */ }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Erro ao enviar";
      setChatMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: "error" } : m));
      setShowStatusCard(false);
      toast.error(errorMsg);
    } finally {
      setSending(false);
    }
  };

  const sendAiPrompt = async () => {
    if (!aiPrompt.trim() || aiLoading) return;
    setAiLoading(true);
    setAiResponse(null);
    try {
      const brainType = aiMode === "custom" ? "general" : aiMode;
      const { data, error } = await supabase.functions.invoke("brain", {
        body: { action: "send", message: aiPrompt, brain_type: brainType },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      if (data?.response) {
        setAiResponse(data.response);
      } else if (data?.conversation_id) {
        toast.info("Star AI processando...");
        let attempts = 0;
        const poll = setInterval(async () => {
          attempts++;
          if (attempts > 12) { clearInterval(poll); toast.error("Timeout"); setAiLoading(false); return; }
          try {
            const { data: cap } = await supabase.functions.invoke("brain", {
              body: { action: "capture", conversation_id: data.conversation_id },
            });
            if (cap?.response) { clearInterval(poll); setAiResponse(cap.response); setAiLoading(false); }
          } catch { /* retry */ }
        }, 5000);
        return;
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setAiLoading(false);
    }
  };

  const handleChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
  };

  if (authLoading || !user) return <div className="min-h-screen bg-background" />;

  return (
    <AppLayout>
      <div className="flex" style={{ height: "calc(100vh - 3rem)" }}>
        {/* ── LEFT: Chat Panel ── */}
        <div className="w-[420px] flex flex-col shrink-0" style={{ borderRight: "0.5px solid var(--clf-border)" }}>
          {/* Header */}
          <div className="h-12 px-4 flex items-center justify-between shrink-0" style={glassNav}>
            <div className="flex items-center gap-2.5">
              <div
                className="h-7 w-7 rounded-xl flex items-center justify-center"
                style={{ background: "hsl(var(--primary) / 0.1)" }}
              >
                <Code2 className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-[13px] font-bold text-foreground tracking-tight">Editor</span>
            </div>
            <button
              onClick={() => setShowAiModal(true)}
              className="h-8 px-3.5 rounded-xl flex items-center gap-1.5 text-xs font-semibold text-foreground
                hover:scale-[1.04] active:scale-[0.97] transition-all"
              style={{
                ...glassCard,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              <BrainCircuit className="h-3.5 w-3.5 text-primary" /> Star AI
            </button>
          </div>

          {/* Mode selector */}
          <div className="flex gap-1.5 px-3 py-2.5 overflow-x-auto" style={{ borderBottom: "0.5px solid var(--clf-border)" }}>
            {chatModes.map(m => (
              <button
                key={m.id}
                onClick={() => setChatMode(m.id)}
                title={m.desc}
                className={`h-8 px-3.5 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap
                  ${chatMode === m.id
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
                style={chatMode === m.id ? {
                  ...glassCard,
                  background: "hsl(var(--primary) / 0.08)",
                  border: "0.5px solid hsl(var(--primary) / 0.2)",
                } : {}}
              >
                <m.icon className="h-3 w-3" /> {m.label}
              </button>
            ))}
          </div>

          {/* Usage bar */}
          <EditorUsageBar
            messagesUsed={usage.messagesUsed}
            messagesLimit={usage.messagesLimit}
            plan={usage.plan}
            percentUsed={usage.percentUsed}
            canSend={usage.canSend}
            isDailyReset={usage.isDailyReset}
          />

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {chatMessages.length === 0 && (
              <div className="text-center py-16">
                <div className="inline-flex p-5 rounded-3xl mb-4" style={glassCard}>
                  <Send className="h-7 w-7 text-muted-foreground/30" />
                </div>
                <p className="text-[13px] font-semibold text-foreground/50">Envie instruções para editar</p>
                <p className="text-[11px] text-muted-foreground/40 mt-1">Processado via Venus API</p>
              </div>
            )}

            {chatMessages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}>
                {msg.role === "ai" ? (
                  <div className="max-w-[92%] p-4 rounded-3xl space-y-2" style={glassCard}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-6 w-6 rounded-lg flex items-center justify-center" style={{ background: "hsl(var(--primary) / 0.1)" }}>
                        <Sparkles className="h-3 w-3 text-primary" />
                      </div>
                      <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Venus AI</span>
                    </div>
                    <div className="prose prose-sm dark:prose-invert max-w-none text-[13px] leading-relaxed">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-[85%] rounded-3xl px-4 py-2.5 text-[13px] bg-primary text-primary-foreground shadow-md shadow-primary/10">
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    {msg.status === "sending" && <Loader2 className="h-3 w-3 animate-spin mt-1.5 opacity-60" />}
                    {msg.status === "error" && <span className="text-[10px] opacity-80 block mt-1">Erro ao enviar</span>}
                  </div>
                )}
              </div>
            ))}

            <EditorStatusCard active={showStatusCard} onComplete={handleStatusComplete} />
            <div ref={chatEndRef} />
          </div>

          {/* Input area */}
          <div className="p-3 shrink-0 space-y-2" style={{ borderTop: "0.5px solid var(--clf-border)" }}>
            <div className="flex items-end gap-2">
              <div className="flex-1 rounded-2xl overflow-hidden" style={glassCard}>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  onKeyDown={handleChatKeyDown}
                  placeholder={usage.canSend
                    ? `Descreva a alteração (${chatModes.find(m => m.id === chatMode)?.label})...`
                    : "Limite atingido — faça upgrade"
                  }
                  rows={1}
                  disabled={sending || !usage.canSend}
                  className="w-full min-h-[42px] max-h-[120px] py-3 px-4 resize-none text-[13px] bg-transparent focus:outline-none placeholder:text-muted-foreground/40 disabled:opacity-40"
                  onInput={e => {
                    const t = e.currentTarget;
                    t.style.height = "auto";
                    t.style.height = Math.min(t.scrollHeight, 120) + "px";
                  }}
                />
              </div>
              <button
                onClick={sendChatMessage}
                disabled={!message.trim() || sending || !usage.canSend}
                className="h-[42px] w-[42px] rounded-2xl bg-primary text-primary-foreground flex items-center justify-center
                  hover:bg-primary/90 disabled:opacity-30 transition-all hover:scale-105 active:scale-95
                  shadow-md shadow-primary/15"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Preview ── */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="h-12 px-4 flex items-center justify-between shrink-0" style={glassNav}>
            <span className="text-[13px] font-semibold truncate text-foreground">{projectName || "Preview"}</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/projeto/${id}/editar`);
                  toast.success("Link copiado!");
                }}
                className="h-8 w-8 rounded-xl flex items-center justify-center hover:bg-muted/50 transition-colors"
                title="Copiar link"
              >
                <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <button
                onClick={reloadPreview}
                className="h-8 w-8 rounded-xl flex items-center justify-center hover:bg-muted/50 transition-colors"
                title="Recarregar"
              >
                <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              {sandboxUrl && (
                <a href={sandboxUrl} target="_blank" rel="noopener noreferrer"
                  className="h-8 w-8 rounded-xl flex items-center justify-center hover:bg-muted/50 transition-colors"
                  title="Abrir em nova aba"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </a>
              )}
            </div>
          </div>

          <div className="flex-1 bg-muted/20">
            {loadingPreview ? (
              <div className="flex items-center justify-center h-full">
                <div className="p-8 rounded-3xl flex flex-col items-center gap-3" style={glassCard}>
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Carregando preview...</span>
                </div>
              </div>
            ) : sandboxUrl ? (
              <iframe
                ref={iframeRef}
                src={sandboxUrl}
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
                title="Project Preview"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Não foi possível carregar o preview
              </div>
            )}
          </div>
        </div>

        {/* ── Star AI Modal ── */}
        {showAiModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
            <div
              className="rounded-3xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl"
              style={{
                ...glassCard,
                boxShadow: "0 24px 80px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)",
              }}
            >
              <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "0.5px solid var(--clf-border)" }}>
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: "hsl(var(--primary) / 0.1)" }}>
                    <BrainCircuit className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-bold text-[15px]">Star AI</span>
                </div>
                <button onClick={() => setShowAiModal(false)} className="h-8 w-8 rounded-xl flex items-center justify-center hover:bg-muted/50 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex gap-2 px-6 pt-4">
                {brainModes.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setAiMode(m.id)}
                    className={`h-9 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all
                      ${aiMode === m.id ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    style={aiMode === m.id ? {
                      ...glassCard,
                      background: "hsl(var(--primary) / 0.08)",
                      border: "0.5px solid hsl(var(--primary) / 0.2)",
                    } : {}}
                  >
                    <m.icon className="h-3.5 w-3.5" /> {m.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4">
                <div className="rounded-2xl overflow-hidden" style={glassCard}>
                  <textarea
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    placeholder={`Descreva o que você quer (modo ${aiMode})...`}
                    rows={3}
                    className="w-full min-h-[80px] py-3 px-4 resize-none text-sm bg-transparent focus:outline-none placeholder:text-muted-foreground/40"
                  />
                </div>

                {aiResponse && (
                  <div className="mt-4 p-5 rounded-3xl max-h-[40vh] overflow-y-auto" style={glassCard}>
                    <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiResponse}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: "0.5px solid var(--clf-border)" }}>
                <div className="flex gap-2">
                  {aiResponse && (
                    <>
                      <button onClick={() => { navigator.clipboard.writeText(aiResponse); toast.success("Copiado!"); }}
                        className="h-9 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:scale-[1.03] transition-all"
                        style={glassCard}>
                        <Copy className="h-3.5 w-3.5" /> Copiar
                      </button>
                      <button onClick={() => { setMessage(aiResponse); setShowAiModal(false); toast.info("Colado no chat"); }}
                        className="h-9 px-4 rounded-xl text-xs font-semibold bg-primary text-primary-foreground flex items-center gap-1.5 hover:scale-[1.03] transition-all shadow-md shadow-primary/15">
                        <ArrowRight className="h-3.5 w-3.5" /> Enviar ao Projeto
                      </button>
                    </>
                  )}
                </div>
                <button
                  onClick={sendAiPrompt}
                  disabled={!aiPrompt.trim() || aiLoading}
                  className="h-9 px-5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 flex items-center gap-1.5 transition-all hover:scale-[1.03] shadow-md shadow-primary/15"
                >
                  {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {aiLoading ? "Gerando..." : "Gerar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
