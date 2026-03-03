import { useState, useRef, useCallback } from "react";
import { MessageCircle, FolderOpen, Brain, Paperclip, Clock, ArrowUp, Sparkles } from "lucide-react";

type ChatMode = "chat" | "build" | "brain";

interface Message {
  id: string;
  role: "ai" | "user";
  text: string;
  actions?: string[];
  suggestions?: string[];
}

const INITIAL_MESSAGE: Message = {
  id: "welcome",
  role: "ai",
  text: "Olá! Sou o <strong>Starble IA</strong>. Posso te ajudar a criar sites, apps e muito mais. Como posso te ajudar hoje?",
  suggestions: ["Criar uma landing page", "Gerar código React", "Analisar meu projeto", "Dicas de design"],
};

const MOCK_RESPONSES = [
  {
    text: "Entendido! Posso criar uma solução completa. Deseja que eu gere o código ou ative o modo construtor?",
    actions: ["Gerar código", "Ativar Construtor", "Criar PRD", "Ver exemplos"],
  },
  {
    text: "Análise concluída:<br><br>✦ Principais pontos identificados<br>✦ Estrutura sugerida criada<br>✦ Próximos passos definidos",
    actions: ["Expandir", "Gerar código", "Exportar"],
  },
];

export default function StarbleChatPage() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [heroVisible, setHeroVisible] = useState(true);
  const [activeMode, setActiveMode] = useState<ChatMode>("chat");
  const [inputMode, setInputMode] = useState<ChatMode>("chat");
  const [modesOpen, setModesOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
  }, []);

  const handleSend = useCallback(() => {
    const msg = inputValue.trim();
    if (!msg || generating) return;

    setGenerating(true);
    setInputValue("");
    setHeroVisible(false);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", text: msg };
    setMessages((prev) => [...prev, userMsg]);
    scrollToBottom();

    // Simulate typing then response
    const resp = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
    setTimeout(() => {
      const aiMsg: Message = {
        id: `a-${Date.now()}`,
        role: "ai",
        text: resp.text,
        actions: resp.actions,
      };
      setMessages((prev) => [...prev, aiMsg]);
      setGenerating(false);
      scrollToBottom();
    }, 1600);
  }, [inputValue, generating, scrollToBottom]);

  const useSuggestion = (text: string) => {
    setInputValue(text);
    textareaRef.current?.focus();
    setModesOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  };

  const selectMode = (mode: ChatMode) => {
    setActiveMode(mode);
    setInputMode(mode);
  };

  const modeClass = (mode: ChatMode) => {
    if (mode === "chat") return "active-orange";
    if (mode === "build") return "active-blue";
    return "active-indigo";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Hero */}
      {heroVisible && (
        <div className="chat-hero">
          <div className="chat-hero-badge">
            <Sparkles size={11} /> Starble IA
          </div>
          <div className="chat-hero-title">
            O que você quer <span>criar</span> hoje?
          </div>
          <div className="chat-hero-sub">
            IA poderosa para criar sites, apps e muito mais.
          </div>
          <div className="chat-mode-row">
            <div
              className={`mode-card ${activeMode === "chat" ? "active" : ""}`}
              onClick={() => selectMode("chat")}
            >
              <div className="mc-ico ib-orange"><MessageCircle size={16} /></div>
              <div className="mc-title">Chat IA</div>
              <div className="mc-desc">Converse e obtenha respostas instantâneas</div>
            </div>
            <div
              className={`mode-card mode-build ${activeMode === "build" ? "active" : ""}`}
              onClick={() => selectMode("build")}
            >
              <div className="mc-ico ib-blue"><FolderOpen size={16} /></div>
              <div className="mc-title">Construtor</div>
              <div className="mc-desc">Crie sites e apps completos com IA</div>
              <span className="mc-badge chip ch-blue">Novo</span>
            </div>
            <div
              className={`mode-card ${activeMode === "brain" ? "active" : ""}`}
              onClick={() => selectMode("brain")}
            >
              <div className="mc-ico ib-indigo"><Brain size={16} /></div>
              <div className="mc-title">Star Brain</div>
              <div className="mc-desc">IA com contexto profundo do projeto</div>
              <span className="mc-badge chip ch-purple">PRO</span>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        ref={messagesRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0 32px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          scrollbarWidth: "thin",
          scrollbarColor: "var(--bg-5) transparent",
        }}
      >
        {messages.map((msg) => (
          <div key={msg.id} className={`msg-row ${msg.role === "user" ? "user" : ""}`}>
            <div className={`msg-av ${msg.role === "ai" ? "av-ai" : "av-user"}`}>
              {msg.role === "ai" ? "S" : "U"}
            </div>
            <div className="msg-content">
              <div className="msg-bubble" dangerouslySetInnerHTML={{ __html: msg.text }} />
              {msg.suggestions && (
                <div className="suggestions">
                  {msg.suggestions.map((s) => (
                    <button key={s} className="sug-btn" onClick={() => useSuggestion(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {msg.actions && (
                <div className="msg-actions">
                  {msg.actions.map((a) => (
                    <button key={a} className="msg-act-btn">{a}</button>
                  ))}
                </div>
              )}
              <div className="msg-time">agora</div>
            </div>
          </div>
        ))}

        {generating && (
          <div className="msg-row">
            <div className="msg-av av-ai">S</div>
            <div className="msg-content">
              <div className="typing">
                <div className="tydot" />
                <div className="tydot" />
                <div className="tydot" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ flexShrink: 0, padding: "12px 32px 18px" }}>
        <div className="chat-input-box">
          <div className={`cib-modes ${modesOpen ? "open" : ""}`}>
            {(["chat", "build", "brain"] as ChatMode[]).map((m) => (
              <button
                key={m}
                className={`cib-mode-btn ${inputMode === m ? modeClass(m) : ""}`}
                onClick={() => setInputMode(m)}
              >
                {m === "chat" && <><MessageCircle size={11} /> Chat IA</>}
                {m === "build" && <><FolderOpen size={11} /> Construtor</>}
                {m === "brain" && <><Brain size={11} /> Brain</>}
              </button>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            className="cib-ta"
            rows={1}
            placeholder="Descreva o que você quer criar ou perguntar..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => setModesOpen(true)}
            onKeyDown={handleKeyDown}
            onInput={handleTextareaInput}
          />
          <div className="cib-toolbar">
            <div className="cib-tl">
              <button className="cib-tbtn ico"><Paperclip size={12} /></button>
              <button className="cib-tbtn"><Clock size={11} /> Histórico</button>
              <button className="cib-tbtn">Prompt</button>
            </div>
            <div className="cib-tr">
              <span style={{ fontSize: 10, color: "var(--text-quaternary)", fontFamily: "var(--mono)" }}>⌘↵</span>
              <button className="cib-send" onClick={handleSend} disabled={generating || !inputValue.trim()}>
                <ArrowUp size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
