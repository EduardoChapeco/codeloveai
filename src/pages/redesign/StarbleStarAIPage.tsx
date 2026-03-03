import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Brain, Plus, ArrowUp, Code2, Search, FileText,
  Bug, RefreshCw, Loader2, Sparkles,
} from "lucide-react";

type BrainMode = "code" | "analysis" | "planning" | "debug" | "review";

interface BrainEntry {
  id: string;
  name: string;
  tags: { label: string; color: string }[];
  status: "active" | "paused";
  updatedAt: string;
}

interface BrainMessage {
  id: string;
  role: "ai" | "user";
  text: string;
}

const DEMO_BRAINS: BrainEntry[] = [
  { id: "1", name: "Starble Platform", tags: [{ label: "Produto", color: "ch-blue" }, { label: "Ativo", color: "ch-orange" }], status: "active", updatedAt: "atualizado agora" },
  { id: "2", name: "Your Heart's Home", tags: [{ label: "Landing", color: "ch-purple" }, { label: "Rascunho", color: "ch-gray" }], status: "paused", updatedAt: "2 dias atrás" },
  { id: "3", name: "E-commerce IA", tags: [{ label: "App", color: "ch-teal" }, { label: "Pausado", color: "ch-gray" }], status: "paused", updatedAt: "1 semana atrás" },
];

const BRAIN_TABS = ["Chat", "Contexto", "Arquivos", "Config"];
const MODE_TABS: { id: BrainMode; label: string; icon: typeof Code2 }[] = [
  { id: "code", label: "Código", icon: Code2 },
  { id: "analysis", label: "Análise", icon: Search },
  { id: "planning", label: "Planejamento", icon: FileText },
  { id: "debug", label: "Debug", icon: Bug },
  { id: "review", label: "Revisão", icon: RefreshCw },
];

export default function StarbleStarAIPage() {
  const { user } = useAuth();
  const [activeBrain, setActiveBrain] = useState<BrainEntry>(DEMO_BRAINS[0]);
  const [activeTab, setActiveTab] = useState("Chat");
  const [activeMode, setActiveMode] = useState<BrainMode>("code");
  const [messages, setMessages] = useState<BrainMessage[]>([
    { id: "w", role: "ai", text: "Brain <strong>Starble Platform</strong> online. Estou pronto para ajudar com código, análise e planejamento do seu projeto." },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [generating, setGenerating] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" }), 50);
  };

  const handleSend = () => {
    const msg = inputValue.trim();
    if (!msg || generating) return;
    setGenerating(true);
    setInputValue("");

    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", text: msg }]);
    scrollToBottom();

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "ai",
          text: `Analisando no modo <strong>${activeMode}</strong>:<br><br>Processado com sucesso. Aqui está minha análise sobre "${msg.slice(0, 50)}".`,
        },
      ]);
      setGenerating(false);
      scrollToBottom();
    }, 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "row", height: "100%" }}>
      {/* Left: Brain list */}
      <div className="stai-left">
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 14px 10px", borderBottom: "1px solid var(--b1)", flexShrink: 0,
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>Meus Brains</span>
          <button className="gl ico xs"><Plus size={10} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 8, scrollbarWidth: "none" as any }}>
          {DEMO_BRAINS.map((brain) => (
            <div
              key={brain.id}
              className={`brain-item ${activeBrain.id === brain.id ? "active" : ""}`}
              onClick={() => setActiveBrain(brain)}
            >
              <div className="bi-name">{brain.name}</div>
              <div className="bi-chips">
                {brain.tags.map((t, i) => (
                  <span key={i} className={`chip sm ${t.color}`}>{t.label}</span>
                ))}
              </div>
              <div className="bi-date">{brain.updatedAt}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Brain main */}
      <div className="stai-main">
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
          {generating && (
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
              <ArrowUp size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
