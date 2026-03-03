import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Brain, Plus, ArrowUp, Code2, Search, FileText,
  Bug, RefreshCw, Loader2, Sparkles, Trash2, RotateCcw,
} from "lucide-react";

type BrainMode = "code" | "analysis" | "planning" | "debug" | "review";

interface BrainEntry {
  id: string;
  name: string;
  project_id: string;
  skill: string;
  status: string;
}

interface BrainMessage {
  id: string;
  role: "ai" | "user";
  text: string;
}

const BRAIN_TABS = ["Chat", "Histórico"];
const MODE_TABS: { id: BrainMode; label: string; icon: typeof Code2; skill: string }[] = [
  { id: "code", label: "Código", icon: Code2, skill: "code" },
  { id: "analysis", label: "Análise", icon: Search, skill: "general" },
  { id: "planning", label: "Planejamento", icon: FileText, skill: "general" },
  { id: "debug", label: "Debug", icon: Bug, skill: "code" },
  { id: "review", label: "Revisão", icon: RefreshCw, skill: "code_review" },
];

export default function StarbleStarAIPage() {
  const { user } = useAuth();
  const [brains, setBrains] = useState<BrainEntry[]>([]);
  const [activeBrain, setActiveBrain] = useState<BrainEntry | null>(null);
  const [activeTab, setActiveTab] = useState("Chat");
  const [activeMode, setActiveMode] = useState<BrainMode>("code");
  const [messages, setMessages] = useState<BrainMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creatingBrain, setCreatingBrain] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const chatRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = () => {
    setTimeout(() => chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" }), 50);
  };

  // Load brains on mount
  const loadBrains = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.functions.invoke("brain", {
        body: { action: "status" },
      });
      if (error) throw error;
      if (data?.brains?.length) {
        const mapped: BrainEntry[] = data.brains.map((b: any) => ({
          id: b.id,
          name: b.name || "Star AI",
          project_id: b.project_id,
          skill: b.skill || "general",
          status: b.status || "active",
        }));
        setBrains(mapped);
        if (!activeBrain || !mapped.find(b => b.id === activeBrain.id)) {
          setActiveBrain(mapped[0]);
        }
      } else {
        setBrains([]);
        setActiveBrain(null);
      }
    } catch (e: any) {
      console.error("[AI] Status error:", e);
    } finally {
      setLoading(false);
    }
  }, [user, activeBrain]);

  useEffect(() => { loadBrains(); }, [loadBrains]);

  // Create a new brain
  const handleCreateBrain = async () => {
    if (creatingBrain || !user) return;
    setCreatingBrain(true);
    try {
      const { data, error } = await supabase.functions.invoke("brain", {
        body: { action: "setup", skills: ["general", "code"], name: "Star AI" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Brain criado com sucesso!");
      await loadBrains();
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar Brain");
    } finally {
      setCreatingBrain(false);
    }
  };

  // Load history
  const loadHistory = useCallback(async () => {
    if (!user || !activeBrain) return;
    try {
      const { data } = await supabase.functions.invoke("brain", {
        body: { action: "history", brain_id: activeBrain.id, limit: 30 },
      });
      setHistory(data?.conversations || []);
    } catch { /* ignore */ }
  }, [user, activeBrain]);

  useEffect(() => {
    if (activeTab === "Histórico") loadHistory();
  }, [activeTab, loadHistory]);

  // Poll for response
  const pollForResponse = useCallback(async (conversationId: string) => {
    let attempts = 0;
    const maxAttempts = 30; // 30 * 3s = 90s max

    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = null;
        setGenerating(false);
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === "ai" && last.text.includes("⏳")) {
            return prev.map((m, i) => i === prev.length - 1
              ? { ...m, text: "⚠️ Tempo esgotado. Tente novamente." }
              : m
            );
          }
          return [...prev, { id: `e-${Date.now()}`, role: "ai", text: "⚠️ Tempo esgotado. Tente novamente." }];
        });
        return;
      }

      try {
        const { data } = await supabase.functions.invoke("brain", {
          body: { action: "capture", conversation_id: conversationId },
        });

        if (data?.response) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          setGenerating(false);

          // Format response - convert markdown-ish to HTML
          const formatted = data.response
            .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');

          setMessages(prev => {
            const filtered = prev.filter(m => !(m.role === "ai" && m.text.includes("⏳")));
            return [...filtered, { id: `a-${Date.now()}`, role: "ai", text: formatted }];
          });
          scrollToBottom();
        } else if (data?.status === "failed") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          setGenerating(false);
          setMessages(prev => {
            const filtered = prev.filter(m => !(m.role === "ai" && m.text.includes("⏳")));
            return [...filtered, { id: `e-${Date.now()}`, role: "ai", text: "❌ Falha ao processar. Tente novamente." }];
          });
        }
      } catch { /* continue polling */ }
    }, 3000);
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Send message
  const handleSend = async () => {
    const msg = inputValue.trim();
    if (!msg || generating || !activeBrain) return;

    setGenerating(true);
    setInputValue("");
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: "user", text: msg }]);
    scrollToBottom();

    const modeConfig = MODE_TABS.find(m => m.id === activeMode);
    const skill = modeConfig?.skill || "general";

    try {
      const { data, error } = await supabase.functions.invoke("brain", {
        body: {
          action: "send",
          message: msg,
          brain_type: skill,
          brain_id: activeBrain.id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // If we got an immediate response
      if (data?.response) {
        setGenerating(false);
        const formatted = data.response
          .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
          .replace(/`([^`]+)`/g, '<code>$1</code>')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\n/g, '<br>');

        setMessages(prev => [...prev, { id: `a-${Date.now()}`, role: "ai", text: formatted }]);
        scrollToBottom();
      } else if (data?.conversation_id) {
        // Need to poll for response
        setMessages(prev => [...prev, {
          id: `w-${Date.now()}`, role: "ai",
          text: "⏳ Processando resposta...",
        }]);
        scrollToBottom();
        pollForResponse(data.conversation_id);
      } else {
        throw new Error("Resposta inesperada do Brain");
      }
    } catch (e: any) {
      setGenerating(false);
      const errorMsg = e.message || "Erro ao enviar mensagem";
      toast.error(errorMsg);
      setMessages(prev => [...prev, {
        id: `e-${Date.now()}`, role: "ai",
        text: `❌ ${errorMsg}`,
      }]);
      scrollToBottom();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // No brain state
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: 8 }}>
        <Loader2 size={16} className="animate-spin" style={{ color: "var(--accent)" }} />
        <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Carregando AI...</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "row", height: "100%" }}>
      {/* Left: Brain list */}
      <div className="stai-left">
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 14px 10px", borderBottom: "1px solid var(--b1)", flexShrink: 0,
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>Meus Brains</span>
          <button
            className="gl ico xs"
            onClick={handleCreateBrain}
            disabled={creatingBrain}
          >
            {creatingBrain ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 8, scrollbarWidth: "none" as any }}>
          {brains.length === 0 ? (
            <div style={{ padding: "24px 12px", textAlign: "center" }}>
              <Brain size={28} style={{ color: "var(--text-tertiary)", margin: "0 auto 8px" }} />
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 12 }}>
                Nenhum Brain ativo.
              </p>
              <button
                className="gl sm"
                onClick={handleCreateBrain}
                disabled={creatingBrain}
                style={{ fontSize: 11 }}
              >
                {creatingBrain ? <><Loader2 size={10} className="animate-spin" /> Criando...</> : <><Plus size={10} /> Criar Brain</>}
              </button>
            </div>
          ) : (
            brains.map((brain) => (
              <div
                key={brain.id}
                className={`brain-item ${activeBrain?.id === brain.id ? "active" : ""}`}
                onClick={() => {
                  setActiveBrain(brain);
                  setMessages([{
                    id: "w",
                    role: "ai",
                    text: `Brain <strong>${brain.name}</strong> online. Pronto para ajudar.`,
                  }]);
                }}
              >
                <div className="bi-name">{brain.name}</div>
                <div className="bi-chips">
                  <span className="chip sm ch-blue">{brain.skill}</span>
                  <span className={`chip sm ${brain.status === "active" ? "ch-orange" : "ch-gray"}`}>
                    {brain.status === "active" ? "Ativo" : brain.status}
                  </span>
                </div>
                <div className="bi-date">{brain.project_id?.slice(0, 8)}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right: Brain main */}
      <div className="stai-main">
        {!activeBrain ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 12 }}>
            <Brain size={32} style={{ color: "var(--text-tertiary)" }} />
            <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Crie ou selecione um Brain para começar.</p>
          </div>
        ) : (
          <>
            {/* Brain topbar */}
            <div className="brain-topbar">
              <div className="bt-left">
                <div className="bt-brain-ico"><Brain size={16} style={{ color: "var(--blue-l)" }} /></div>
                <div>
                  <div className="bt-brain-name">{activeBrain.name}</div>
                  <div className="bt-status">
                    <div className="bt-status-dot" />
                    Online
                  </div>
                </div>
              </div>
              <div className="bt-tabs">
                {BRAIN_TABS.map((tab) => (
                  <button
                    key={tab}
                    className={`bt-tab ${activeTab === tab ? "on" : ""}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === "Chat" ? (
              <>
                {/* Chat area */}
                <div
                  ref={chatRef}
                  style={{
                    flex: 1, overflowY: "auto", padding: "20px 20px 16px",
                    scrollbarWidth: "thin", scrollbarColor: "var(--bg-5) transparent",
                    display: "flex", flexDirection: "column", gap: 12,
                  }}
                >
                  {messages.map((msg) => (
                    <div key={msg.id} className={`msg-row ${msg.role === "user" ? "user" : ""}`}>
                      <div className={`msg-av ${msg.role === "ai" ? "av-ai" : "av-user"}`}>
                        {msg.role === "ai" ? "S" : "U"}
                      </div>
                      <div className="msg-content">
                        <div className="msg-bubble" dangerouslySetInnerHTML={{ __html: msg.text }} />
                        <div className="msg-time">agora</div>
                      </div>
                    </div>
                  ))}
                  {generating && !messages.some(m => m.text.includes("⏳")) && (
                    <div className="msg-row">
                      <div className="msg-av av-ai">S</div>
                      <div className="msg-content">
                        <div className="typing">
                          <div className="tydot" /><div className="tydot" /><div className="tydot" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input area */}
                <div className="brain-input-area">
                  <div className="brain-mode-tabs">
                    {MODE_TABS.map((m) => (
                      <button
                        key={m.id}
                        className={`bmt ${activeMode === m.id ? "on" : ""}`}
                        onClick={() => setActiveMode(m.id)}
                      >
                        <m.icon size={12} /> {m.label}
                      </button>
                    ))}
                  </div>
                  <div className="brain-input-box">
                    <textarea
                      ref={textareaRef}
                      className="brain-ta"
                      rows={1}
                      placeholder="Defina o escopo ou faça uma pergunta ao Brain..."
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                    <button className="brain-send" onClick={handleSend} disabled={generating || !inputValue.trim()}>
                      {generating ? <Loader2 size={13} className="animate-spin" /> : <ArrowUp size={13} />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* History tab */
              <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
                {history.length === 0 ? (
                  <p style={{ fontSize: 12, color: "var(--text-tertiary)", textAlign: "center", padding: 24 }}>
                    Nenhuma conversa ainda.
                  </p>
                ) : (
                  history.map((conv: any) => (
                    <div key={conv.id} style={{
                      padding: "10px 12px", borderBottom: "1px solid var(--b1)",
                      cursor: "pointer",
                    }} onClick={() => {
                      setActiveTab("Chat");
                      const msgs: BrainMessage[] = [];
                      if (conv.user_message) msgs.push({ id: `u-${conv.id}`, role: "user", text: conv.user_message });
                      if (conv.ai_response) {
                        const formatted = conv.ai_response
                          .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
                          .replace(/`([^`]+)`/g, '<code>$1</code>')
                          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                          .replace(/\n/g, '<br>');
                        msgs.push({ id: `a-${conv.id}`, role: "ai", text: formatted });
                      }
                      if (msgs.length) setMessages(msgs);
                    }}>
                      <div style={{ fontSize: 12, color: "var(--text-primary)", marginBottom: 4 }}>
                        {conv.user_message?.slice(0, 80) || "..."}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-tertiary)", display: "flex", gap: 8 }}>
                        <span>{conv.brain_type || "general"}</span>
                        <span>{conv.status}</span>
                        <span>{new Date(conv.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
