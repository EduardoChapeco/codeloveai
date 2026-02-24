import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLovableProxy } from "@/hooks/useLovableProxy";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send, Loader2, ExternalLink, RefreshCw, BrainCircuit, X,
  Sparkles, Code2, Palette, Search, Copy, ArrowRight,
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

  useEffect(() => {
    if (!id || !user) return;
    loadProject();
    loadSandboxUrl();
  }, [id, user, loadProject, loadSandboxUrl]);

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
    try {
      // Start sandbox first
      try {
        await invoke({ route: `/projects/${id}/sandbox/start`, method: "POST", payload: {} });
      } catch { /* may already be running */ }

      const data = await invoke<{ url: string }>({ route: `/projects/${id}/sandbox/url` });
      if (data?.url) {
        setSandboxUrl(data.url);
      } else {
        // Fallback to preview URL pattern
        setSandboxUrl(`https://id-preview--${id}.lovable.app`);
      }
    } catch {
      setSandboxUrl(`https://id-preview--${id}.lovable.app`);
    } finally {
      setLoadingPreview(false);
    }
  }, [id, invoke]);

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
      const msgId = `umsg_${Date.now().toString(36)}${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
      const aiMsgId = `aimsg_${Date.now().toString(36)}${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

      await invoke({
        route: `/projects/${id}/chat`,
        method: "POST",
        payload: {
          id: msgId,
          message: userMsg,
          intent: "security_fix_v2",
          chat_only: false,
          ai_message_id: aiMsgId,
          thread_id: "main",
          view: "code",
          view_description: "User is editing the project via Starble editor.",
          model: null,
          files: [],
          optimisticImageUrls: [],
          selected_elements: [],
          debug_mode: false,
          session_replay: "[]",
          client_logs: [],
          network_requests: [],
          runtime_errors: [],
          integration_metadata: { browser: { preview_viewport_width: 1536, preview_viewport_height: 730 } },
        },
      });

      setChatMessages(prev =>
        prev.map(m => m.id === tempId ? { ...m, status: "sent" } : m)
      );

      // Save to loveai_conversations
      await supabase.from("loveai_conversations").insert({
        user_id: user!.id,
        target_project_id: id,
        brain_type: "code",
        user_message: userMsg,
        status: "processing",
      });

      // Poll for AI response via latest-message
      const aiResponseId = crypto.randomUUID();
      setChatMessages(prev => [...prev, {
        id: aiResponseId,
        role: "ai",
        content: "Processando...",
        timestamp: new Date().toISOString(),
        status: "sending",
      }]);

      let captured = false;
      const maxPolls = 20; // 20 * 3s = 60s timeout
      await new Promise(r => setTimeout(r, 5000)); // Initial wait

      for (let i = 0; i < maxPolls; i++) {
        try {
          const latestMsg = await invoke<{ content?: string; is_streaming?: boolean; role?: string }>({
            route: `/projects/${id}/latest-message`,
          });

          if (latestMsg && !latestMsg.is_streaming && latestMsg.content && latestMsg.role === "assistant") {
            setChatMessages(prev =>
              prev.map(m => m.id === aiResponseId
                ? { ...m, content: latestMsg.content!, status: "sent" }
                : m
              )
            );
            captured = true;

            // Update conversation status
            await supabase.from("loveai_conversations")
              .update({ status: "completed", ai_response: latestMsg.content })
              .eq("user_id", user!.id)
              .eq("target_project_id", id)
              .order("created_at", { ascending: false })
              .limit(1);

            break;
          }
        } catch {
          // Network error, continue polling
        }
        await new Promise(r => setTimeout(r, 3000));
      }

      if (!captured) {
        setChatMessages(prev =>
          prev.map(m => m.id === aiResponseId
            ? { ...m, content: "Tempo esgotado — a resposta pode ainda estar processando.", status: "error" }
            : m
          )
        );
      }

      // Reload iframe to show changes
      setTimeout(() => iframeRef.current?.contentWindow?.location.reload(), 2000);
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
        {/* Left: iframe preview */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-border/60">
          <div className="h-10 border-b border-border/60 px-4 flex items-center justify-between shrink-0">
            <span className="text-xs font-medium truncate">{projectName || "Preview"}</span>
            <div className="flex items-center gap-2">
              <button onClick={loadSandboxUrl} className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
              {sandboxUrl && (
                <a href={sandboxUrl} target="_blank" rel="noopener noreferrer" className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted">
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
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                title="Project Preview"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Não foi possível carregar o preview
              </div>
            )}
          </div>
        </div>

        {/* Right: Chat */}
        <div className="w-[380px] flex flex-col shrink-0">
          <div className="h-10 border-b border-border/60 px-4 flex items-center justify-between shrink-0">
            <span className="text-xs font-semibold">Chat do Projeto</span>
            <button onClick={() => setShowAiModal(true)} className="h-7 px-2.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-1.5 text-xs font-medium transition-colors">
              <BrainCircuit className="h-3.5 w-3.5" /> Star AI
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {chatMessages.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">
                <Send className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-xs">Envie mensagens diretas ao projeto via Fix V2</p>
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

          <div className="border-t border-border/60 p-3 shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyDown={handleChatKeyDown}
                placeholder="Enviar comando ao projeto..."
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
                  {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BrainCircuit className="h-3.5 w-3.5" />}
                  {aiLoading ? "Processando..." : "Processar com Star AI"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
