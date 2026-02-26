import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLovableProxy } from "@/hooks/useLovableProxy";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send, Loader2, ExternalLink, RefreshCw, BrainCircuit, X,
  Sparkles, Code2, Palette, Search, Copy, ArrowRight, Link2, AlertTriangle,
} from "lucide-react";

type BrainType = "design" | "code" | "scraper" | "custom";

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: string;
  status?: "sending" | "sent" | "error";
}

const brainModes: { id: BrainType; label: string; icon: typeof Sparkles }[] = [
  { id: "design", label: "Design", icon: Palette },
  { id: "code", label: "Code", icon: Code2 },
  { id: "scraper", label: "Scraper", icon: Search },
  { id: "custom", label: "Custom", icon: Sparkles },
];

export default function ProjectEditor() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { invoke } = useLovableProxy();

  const [sandboxUrl, setSandboxUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [projectName, setProjectName] = useState("");

  // Star AI Modal
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

  const loadProjectRef = useRef<(() => void) | null>(null);
  const loadSandboxUrlRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!id || !user) return;
    setTimeout(() => {
      loadProjectRef.current?.();
      loadSandboxUrlRef.current?.();
    }, 0);
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
  loadProjectRef.current = loadProject;

  const loadSandboxUrl = useCallback(async () => {
    if (!id) return;
    setLoadingPreview(true);
    try {
      try {
        await invoke({ route: `/projects/${id}/sandbox/start`, method: "POST", payload: {} });
      } catch { /* may already be running */ }

      const data = await invoke<{ url: string }>({ route: `/projects/${id}/sandbox/url` });
      if (data?.url) {
        setSandboxUrl(data.url);
      } else {
        setSandboxUrl(`https://id-preview--${id}.lovable.app`);
      }
    } catch {
      setSandboxUrl(`https://id-preview--${id}.lovable.app`);
    } finally {
      setLoadingPreview(false);
    }
  }, [id, invoke]);
  loadSandboxUrlRef.current = loadSandboxUrl;

  const sendChatMessage = async () => {
    if (!message.trim() || sending || !id) return;

    const userMsg = message.trim();
    setMessage("");
    setSending(true);

    const tempId = crypto.randomUUID();
    setChatMessages(prev => [...prev, {
      id: tempId,
      role: "user",
      content: userMsg,
      timestamp: new Date().toISOString(),
      status: "sending",
    }]);

    try {
      // Use lovable-proxy edge function (security_fix_v2, chat_only: false)
      const { data: smData, error: smError } = await supabase.functions.invoke("lovable-proxy", {
        body: {
          task: userMsg,
          projectId: id,
        },
      });

      if (smError || smData?.error) {
        throw new Error(smData?.error || smError?.message || "Erro ao enviar mensagem");
      }

      setChatMessages(prev =>
        prev.map(m => m.id === tempId ? { ...m, status: "sent" } : m)
      );

      const aiResponseId = crypto.randomUUID();
      setChatMessages(prev => [...prev, {
        id: aiResponseId,
        role: "ai",
        content: "✅ Mensagem enviada via Security Fix. O Lovable está processando...",
        timestamp: new Date().toISOString(),
        status: "sent",
      }]);

      // Log to conversations table (fire and forget)
      try {
        await supabase.from("loveai_conversations").insert({
          user_id: user!.id,
          target_project_id: id,
          brain_type: "code",
          user_message: userMsg,
          status: "completed",
        });
      } catch { /* silent */ }

      // Reload preview after delay
      setTimeout(() => iframeRef.current?.contentWindow?.location.reload(), 4000);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Erro ao enviar mensagem";
      setChatMessages(prev =>
        prev.map(m => m.id === tempId ? { ...m, status: "error" } : m)
      );
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
      const { data, error } = await supabase.functions.invoke("loveai-brain", {
        body: { action: "send", message: aiPrompt, brain_type: brainType },
      });

      if (error || data?.error) throw { message: data?.error || error?.message };

      const { data: captureData } = await supabase.functions.invoke("loveai-brain", {
        body: { action: "capture", conversation_id: data.conversation_id },
      });

      if (captureData?.response) {
        setAiResponse(captureData.response);
      } else {
        toast.error("Star AI não respondeu a tempo.");
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error(errorMsg);
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiResponseToProject = async () => {
    if (!aiResponse || !id) return;
    setMessage(aiResponse);
    setShowAiModal(false);
    toast.info("Resposta colada no chat. Envie para aplicar ao projeto.");
  };

  const handleChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  };

  if (authLoading || !user) return <div className="min-h-screen bg-background" />;

  return (
    <AppLayout>
      <div className="flex" style={{ height: "calc(100vh - 3rem)" }}>
        {/* Left: Chat */}
        <div className="w-[380px] flex flex-col shrink-0 border-r border-border/60">
          <div className="h-10 border-b border-border/60 px-4 flex items-center justify-between shrink-0">
            <span className="text-xs font-semibold">Editor</span>
            <button onClick={() => setShowAiModal(true)} className="h-7 px-2.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-1.5 text-xs font-medium transition-colors">
              <BrainCircuit className="h-3.5 w-3.5" /> Star AI
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {chatMessages.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">
                <Send className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-xs">Envie instruções para editar o projeto</p>
              </div>
            )}
            {chatMessages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[90%] rounded-xl px-3 py-2 text-xs ${
                  msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.status === "sending" && <Loader2 className="h-3 w-3 animate-spin mt-1 opacity-60" />}
                  {msg.status === "error" && <span className="text-[10px] text-destructive">Erro ao enviar</span>}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="border-t border-border/60 p-3 shrink-0 space-y-2">
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-amber-500/8 border border-amber-500/15">
              <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
              <p className="text-[10px] text-amber-500/90 leading-tight">O Lovable pode cobrar créditos em alguns casos. Use com moderação.</p>
            </div>
            <div className="flex items-end gap-2">
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyDown={handleChatKeyDown}
                placeholder="Enviar instrução ao projeto..."
                rows={1}
                disabled={sending}
                className="flex-1 min-h-[36px] max-h-[100px] py-2 px-3 resize-none text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                onInput={e => {
                  const t = e.currentTarget;
                  t.style.height = "auto";
                  t.style.height = Math.min(t.scrollHeight, 100) + "px";
                }}
              />
              <button
                onClick={sendChatMessage}
                disabled={!message.trim() || sending}
                className="h-9 w-9 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Right: iframe preview */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="h-10 border-b border-border/60 px-4 flex items-center justify-between shrink-0">
            <span className="text-xs font-medium truncate">{projectName || "Preview"}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const editorUrl = `${window.location.origin}/projeto/${id}/editar`;
                  navigator.clipboard.writeText(editorUrl);
                  toast.success("Link copiado!");
                }}
                className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted"
                title="Copiar link do editor"
              >
                <Link2 className="h-3.5 w-3.5" />
              </button>
              <button onClick={loadSandboxUrl} className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted" title="Recarregar preview">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
              {sandboxUrl && (
                <a href={sandboxUrl} target="_blank" rel="noopener noreferrer" className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted" title="Abrir preview em nova aba">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>
          <div className="flex-1 bg-muted/30">
            {loadingPreview ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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

        {/* Star AI Modal */}
        {showAiModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-background border border-border rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-xl">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-sm">Star AI</span>
                </div>
                <button onClick={() => setShowAiModal(false)} className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex gap-2 px-5 pt-3">
                {brainModes.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setAiMode(m.id)}
                    className={`h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                      aiMode === m.id ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <m.icon className="h-3.5 w-3.5" /> {m.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-3">
                <textarea
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  placeholder={`Descreva o que você quer (modo ${aiMode})...`}
                  rows={3}
                  className="w-full min-h-[80px] py-3 px-4 resize-none text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />

                {aiResponse && (
                  <div className="mt-3 rounded-xl bg-muted/60 p-4 max-h-[40vh] overflow-y-auto">
                    <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiResponse}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between px-5 py-3 border-t border-border/60">
                <div className="flex gap-2">
                  {aiResponse && (
                    <>
                      <button onClick={() => { navigator.clipboard.writeText(aiResponse); toast.success("Copiado!"); }} className="h-8 px-3 rounded-lg text-xs font-medium bg-muted hover:bg-muted/80 flex items-center gap-1.5">
                        <Copy className="h-3.5 w-3.5" /> Copiar
                      </button>
                      <button onClick={applyAiResponseToProject} className="h-8 px-3 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5">
                        <ArrowRight className="h-3.5 w-3.5" /> Enviar ao Projeto
                      </button>
                    </>
                  )}
                </div>
                <button
                  onClick={sendAiPrompt}
                  disabled={!aiPrompt.trim() || aiLoading}
                  className="h-8 px-4 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
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
