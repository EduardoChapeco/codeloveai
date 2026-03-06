import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  MessageCircle, FolderOpen, Brain, Paperclip, Clock, ArrowUp, Sparkles,
  Plus, Search, Code2, FileText, Bug, RefreshCw, ChevronLeft, Check, CheckCheck,
  Rocket,
} from "lucide-react";

type ChatMode = "chat" | "build" | "brain";
type BrainMode = "code" | "analysis" | "planning" | "debug" | "review";

interface Message {
  id: string;
  role: "ai" | "user";
  text: string;
  time?: string;
  actions?: string[];
  suggestions?: string[];
}

interface BrainConversation {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  unread: number;
  status: "active" | "paused";
  avatar: string;
  avatarColor: string;
}

/* ── Demo data ── */

const INITIAL_MESSAGE: Message = {
  id: "welcome", role: "ai",
  text: "Olá! Sou o <strong>Starble IA</strong>. Posso te ajudar a criar sites, apps e muito mais. Como posso te ajudar hoje?",
  suggestions: ["Criar uma landing page", "Gerar código React", "Analisar meu projeto", "Dicas de design"],
};

const MOCK_RESPONSES = [
  { text: "Entendido! Posso criar uma solução completa. Deseja que eu gere o código ou ative o modo construtor?", actions: ["Gerar código", "Ativar Construtor", "Criar PRD", "Ver exemplos"] },
  { text: "Análise concluída:<br><br>✦ Principais pontos identificados<br>✦ Estrutura sugerida criada<br>✦ Próximos passos definidos", actions: ["Expandir", "Gerar código", "Exportar"] },
];

const BRAIN_CONVERSATIONS: BrainConversation[] = [
  { id: "1", name: "Starble Platform", lastMessage: "Código do componente atualizado com sucesso", time: "agora", unread: 2, status: "active", avatar: "S", avatarColor: "linear-gradient(135deg, var(--orange), #f97316)" },
  { id: "2", name: "Your Heart's Home", lastMessage: "Landing page pronta para deploy", time: "2h", unread: 0, status: "paused", avatar: "Y", avatarColor: "linear-gradient(135deg, var(--pink), #f472b6)" },
  { id: "3", name: "E-commerce IA", lastMessage: "Análise de performance concluída", time: "1d", unread: 0, status: "paused", avatar: "E", avatarColor: "linear-gradient(135deg, var(--teal), #2dd4bf)" },
];

const BRAIN_MESSAGES: Record<string, Message[]> = {
  "1": [
    { id: "b1", role: "ai", text: "Brain <strong>Starble Platform</strong> online. Contexto do projeto carregado com 47 arquivos.", time: "10:30" },
    { id: "b2", role: "user", text: "Analise a estrutura de componentes e sugira melhorias", time: "10:32" },
    { id: "b3", role: "ai", text: "Analisei a estrutura completa. Principais pontos:<br><br>✦ <strong>12 componentes</strong> podem ser simplificados<br>✦ <strong>3 hooks</strong> com lógica duplicada<br>✦ Performance pode melhorar 40% com lazy loading", time: "10:33" },
    { id: "b4", role: "user", text: "Gere o código otimizado do componente principal", time: "10:35" },
    { id: "b5", role: "ai", text: "Código do componente atualizado com sucesso. Apliquei:<br><br>• React.memo nos subcomponentes<br>• useMemo para cálculos pesados<br>• Lazy loading nas rotas secundárias", time: "10:36" },
  ],
  "2": [
    { id: "b6", role: "ai", text: "Brain <strong>Your Heart's Home</strong> carregado. Projeto de landing page emocional.", time: "ontem" },
    { id: "b7", role: "user", text: "Finalize a seção de depoimentos", time: "ontem" },
    { id: "b8", role: "ai", text: "Landing page pronta para deploy. Todas as seções foram finalizadas.", time: "ontem" },
  ],
  "3": [
    { id: "b9", role: "ai", text: "Brain <strong>E-commerce IA</strong> inicializado. 23 endpoints mapeados.", time: "3d atrás" },
    { id: "b10", role: "ai", text: "Análise de performance concluída. Tempo médio de resposta: 120ms.", time: "1d atrás" },
  ],
};

const MODE_TABS: { id: BrainMode; label: string; icon: typeof Code2 }[] = [
  { id: "code", label: "Código", icon: Code2 },
  { id: "analysis", label: "Análise", icon: Search },
  { id: "planning", label: "Plano", icon: FileText },
  { id: "debug", label: "Debug", icon: Bug },
  { id: "review", label: "Revisão", icon: RefreshCw },
];

/* ── Component ── */

export default function StarbleChatPage() {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  /* Chat mode */
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [heroVisible, setHeroVisible] = useState(true);
  const [activeMode, setActiveMode] = useState<ChatMode>("chat");
  const [inputMode, setInputMode] = useState<ChatMode>("chat");
  const [modesOpen, setModesOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* Brain mode */
  const [activeBrainConv, setActiveBrainConv] = useState<string | null>(null);
  const [brainMessages, setBrainMessages] = useState<Record<string, Message[]>>(BRAIN_MESSAGES);
  const [brainMode, setBrainMode] = useState<BrainMode>("code");
  const [brainSearch, setBrainSearch] = useState("");
  const brainChatRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback((ref?: React.RefObject<HTMLDivElement | null>) => {
    const target = ref?.current || messagesRef.current;
    setTimeout(() => target?.scrollTo({ top: target.scrollHeight, behavior: "smooth" }), 50);
  }, []);

  /* ── Build mode: create Cirius project ── */
  const handleBuildSend = useCallback(async (prompt: string) => {
    if (!user) { toast.error("Faça login para continuar"); return; }
    setGenerating(true);
    setHeroVisible(false);

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", text: prompt, time: "agora" };
    setMessages((prev) => [...prev, userMsg]);
    scrollToBottom();

    const aiMsg: Message = { id: `a-${Date.now()}`, role: "ai", text: "Criando seu projeto... <strong>Aguarde</strong>, você será redirecionado ao editor.", time: "agora" };
    setMessages((prev) => [...prev, aiMsg]);
    scrollToBottom();

    try {
      const name = `Projeto ${new Date().toLocaleDateString("pt-BR")}`;
      const { data, error } = await supabase.functions.invoke("cirius-generate", {
        body: {
          action: "start",
          user_prompt: prompt,
          project_name: name,
          config: { deploy_github: true, deploy_vercel: false, create_supabase: false, no_brains: false },
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao iniciar geração");
      toast.success("Projeto iniciado!");
      const pid = data.project_id;
      if (pid) navigate(`/cirius/editor/${pid}`);
      else navigate("/projects");
    } catch (e) {
      toast.error((e as Error).message || "Erro ao gerar projeto");
      setMessages((prev) => [...prev, { id: `e-${Date.now()}`, role: "ai", text: `❌ Erro: ${(e as Error).message}`, time: "agora" }]);
      scrollToBottom();
    } finally {
      setGenerating(false);
    }
  }, [user, navigate, scrollToBottom]);

  /* ── Regular chat send ── */
  const handleSend = useCallback(() => {
    const msg = inputValue.trim();
    if (!msg || generating) return;

    // If in build mode, create project instead
    if (activeMode === "build") {
      setInputValue("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      handleBuildSend(msg);
      return;
    }

    setGenerating(true);
    setInputValue("");
    setHeroVisible(false);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", text: msg, time: "agora" };
    setMessages((prev) => [...prev, userMsg]);
    scrollToBottom();

    const resp = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
    setTimeout(() => {
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "ai", text: resp.text, actions: resp.actions, time: "agora" }]);
      setGenerating(false);
      scrollToBottom();
    }, 1600);
  }, [inputValue, generating, activeMode, handleBuildSend, scrollToBottom]);

  /* ── Brain chat send ── */
  const handleBrainSend = useCallback(() => {
    if (!activeBrainConv) return;
    const msg = inputValue.trim();
    if (!msg || generating) return;
    setGenerating(true);
    setInputValue("");

    setBrainMessages((prev) => ({
      ...prev,
      [activeBrainConv]: [...(prev[activeBrainConv] || []), { id: `bu-${Date.now()}`, role: "user", text: msg, time: "agora" }],
    }));
    scrollToBottom(brainChatRef);

    setTimeout(() => {
      setBrainMessages((prev) => ({
        ...prev,
        [activeBrainConv]: [...(prev[activeBrainConv] || []), {
          id: `ba-${Date.now()}`, role: "ai",
          text: `Processado no modo <strong>${brainMode}</strong>. Análise de "${msg.slice(0, 40)}" concluída.`,
          time: "agora",
        }],
      }));
      setGenerating(false);
      scrollToBottom(brainChatRef);
    }, 1500);
  }, [activeBrainConv, inputValue, generating, brainMode, scrollToBottom]);

  const useSuggestion = (text: string) => {
    setInputValue(text);
    textareaRef.current?.focus();
    setModesOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (activeMode === "brain" && activeBrainConv) handleBrainSend();
      else handleSend();
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
    if (mode !== "brain") setActiveBrainConv(null);
  };

  const modeClass = (mode: ChatMode) => {
    if (mode === "chat") return "active-orange";
    if (mode === "build") return "active-blue";
    return "active-indigo";
  };

  const filteredConvs = BRAIN_CONVERSATIONS.filter((c) =>
    !brainSearch || c.name.toLowerCase().includes(brainSearch.toLowerCase())
  );

  const activeBrainData = BRAIN_CONVERSATIONS.find((c) => c.id === activeBrainConv);
  const currentBrainMessages = activeBrainConv ? (brainMessages[activeBrainConv] || []) : [];

  /* ── Brain Mode: WhatsApp-style UI ── */
  if (activeMode === "brain") {
    return (
      <div style={{ display: "flex", flexDirection: "row", height: "100%" }}>
        {/* Conversation list (WhatsApp left panel) */}
        <div className="wa-conv-list">
          <div className="wa-conv-header">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button className="gl ico xs ghost" onClick={() => selectMode("chat")}>
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--tp)" }}>Star Brain</span>
            </div>
            <button className="gl ico xs"><Plus size={11} /></button>
          </div>

          {/* Search */}
          <div style={{ padding: "0 10px 8px" }}>
            <div style={{ position: "relative" }}>
              <Search size={12} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--tq)" }} />
              <input
                className="rd-input"
                value={brainSearch}
                onChange={(e) => setBrainSearch(e.target.value)}
                placeholder="Pesquisar brains..."
                style={{ paddingLeft: 30, height: 32, fontSize: 12 }}
              />
            </div>
          </div>

          {/* Conversations */}
          <div className="wa-conv-scroll">
            {filteredConvs.map((conv) => (
              <div
                key={conv.id}
                className={`wa-conv-item ${activeBrainConv === conv.id ? "active" : ""}`}
                onClick={() => setActiveBrainConv(conv.id)}
              >
                <div className="wa-conv-avatar" style={{ background: conv.avatarColor }}>
                  {conv.avatar}
                </div>
                <div className="wa-conv-body">
                  <div className="wa-conv-top">
                    <span className="wa-conv-name">{conv.name}</span>
                    <span className="wa-conv-time">{conv.time}</span>
                  </div>
                  <div className="wa-conv-bottom">
                    <span className="wa-conv-last">
                      <CheckCheck size={12} style={{ color: "var(--blue-l)", flexShrink: 0 }} />
                      {conv.lastMessage}
                    </span>
                    {conv.unread > 0 && <span className="wa-conv-unread">{conv.unread}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat area or empty state */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {!activeBrainConv ? (
            /* Empty state */
            <div style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 12,
              background: "var(--bg-0)",
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: "var(--r4)",
                background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(59,130,246,0.1))",
                border: "1px solid rgba(99,102,241,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Brain size={28} style={{ color: "var(--indigo-l)" }} />
              </div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--tp)" }}>Star Brain</p>
              <p style={{ fontSize: 12, color: "var(--tt)", maxWidth: 280, textAlign: "center", lineHeight: 1.6 }}>
                Selecione uma conversa para continuar ou crie um novo Brain para seu projeto
              </p>
            </div>
          ) : (
            <>
              {/* Brain topbar */}
              <div className="wa-chat-topbar">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="wa-conv-avatar" style={{ background: activeBrainData?.avatarColor, width: 32, height: 32, fontSize: 12 }}>
                    {activeBrainData?.avatar}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--tp)" }}>{activeBrainData?.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--green-l)" }}>
                      <div style={{
                        width: 5, height: 5, borderRadius: "50%", background: "var(--green)",
                        animation: "pulse 2s ease infinite",
                      }} />
                      Online
                    </div>
                  </div>
                </div>
                {/* Brain mode tabs in topbar */}
                <div style={{ display: "flex", gap: 3 }}>
                  {MODE_TABS.map((m) => (
                    <button
                      key={m.id}
                      className={`bmt ${brainMode === m.id ? "on" : ""}`}
                      onClick={() => setBrainMode(m.id)}
                      style={{ height: 26, fontSize: 11 }}
                    >
                      <m.icon size={11} /> {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Messages (WhatsApp style) */}
              <div ref={brainChatRef} className="wa-chat-messages">
                {currentBrainMessages.map((msg) => (
                  <div key={msg.id} className={`wa-msg ${msg.role === "user" ? "wa-msg-out" : "wa-msg-in"}`}>
                    <div className={`wa-msg-bubble ${msg.role === "user" ? "wa-bubble-out" : "wa-bubble-in"}`}>
                      <div dangerouslySetInnerHTML={{ __html: msg.text }} />
                      <span className="wa-msg-time">
                        {msg.time || "agora"}
                        {msg.role === "user" && <CheckCheck size={12} />}
                      </span>
                    </div>
                  </div>
                ))}
                {generating && (
                  <div className="wa-msg wa-msg-in">
                    <div className="wa-msg-bubble wa-bubble-in">
                      <div className="typing">
                        <div className="tydot" /><div className="tydot" /><div className="tydot" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="wa-chat-input-area">
                <div className="brain-input-box">
                  <textarea
                    ref={textareaRef}
                    className="brain-ta"
                    rows={1}
                    placeholder={`Mensagem para ${activeBrainData?.name}...`}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onInput={handleTextareaInput}
                  />
                  <button className="brain-send" onClick={handleBrainSend} disabled={generating || !inputValue.trim()}>
                    <ArrowUp size={13} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ── Regular Chat / Build mode ── */
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Hero */}
      {heroVisible && (
        <div className="chat-hero">
          <div className="chat-hero-badge"><Sparkles size={11} /> Starble IA</div>
          <div className="chat-hero-title">O que você quer <span>criar</span> hoje?</div>
          <div className="chat-hero-sub">IA poderosa para criar sites, apps e muito mais.</div>
          <div className="chat-mode-row">
            <div className={`mode-card ${activeMode === "chat" ? "active" : ""}`} onClick={() => selectMode("chat")}>
              <div className="mc-ico ib-orange"><MessageCircle size={16} /></div>
              <div className="mc-title">Chat IA</div>
              <div className="mc-desc">Converse e obtenha respostas instantâneas</div>
            </div>
            <div
              className={`mode-card mode-build ${activeMode === "build" ? "active" : ""} ${!isAdmin ? "mode-disabled" : ""}`}
              onClick={() => {
                if (!isAdmin) {
                  toast.info("Em breve! Seu novo criador de vibecoding favorito! 🚀");
                  return;
                }
                selectMode("build");
              }}
              style={!isAdmin ? { opacity: 0.55, cursor: "default" } : undefined}
            >
              <div className="mc-ico ib-blue"><Rocket size={16} /></div>
              <div className="mc-title">Novo Projeto</div>
              <div className="mc-desc">{isAdmin ? "Descreva sua ideia e a IA constrói" : "Em breve! 🚀"}</div>
              <span className="mc-badge chip ch-blue">{isAdmin ? "Novo" : "Em breve"}</span>
            </div>
            <div className="mode-card" onClick={() => selectMode("brain")}>
              <div className="mc-ico ib-indigo"><Brain size={16} /></div>
              <div className="mc-title">Star Brain</div>
              <div className="mc-desc">IA com contexto profundo do projeto</div>
              <span className="mc-badge chip ch-purple">PRO</span>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={messagesRef} style={{
        flex: 1, overflowY: "auto", padding: "0 32px 20px",
        display: "flex", flexDirection: "column", gap: 12,
        scrollbarWidth: "thin", scrollbarColor: "var(--bg-5) transparent",
      }}>
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
                    <button key={s} className="sug-btn" onClick={() => useSuggestion(s)}>{s}</button>
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
              <div className="typing"><div className="tydot" /><div className="tydot" /><div className="tydot" /></div>
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
                className={`cib-mode-btn ${inputMode === m ? modeClass(m) : ""} ${m === "build" && !isAdmin ? "mode-disabled" : ""}`}
                onClick={() => {
                  if (m === "build" && !isAdmin) {
                    toast.info("Em breve! Seu novo criador de vibecoding favorito! 🚀");
                    return;
                  }
                  selectMode(m);
                }}
                style={m === "build" && !isAdmin ? { opacity: 0.5 } : undefined}
              >
                {m === "chat" && <><MessageCircle size={11} /> Chat IA</>}
                {m === "build" && <><Rocket size={11} /> {isAdmin ? "Novo Projeto" : "Em breve"}</>}
                {m === "brain" && <><Brain size={11} /> Brain</>}
              </button>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            className="cib-ta"
            rows={1}
            placeholder={activeMode === "build" ? "Descreva o projeto que você quer criar..." : "Descreva o que você quer criar ou perguntar..."}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => setModesOpen(true)}
            onKeyDown={handleKeyDown}
            onInput={handleTextareaInput}
          />
          <div className="cib-toolbar">
            <div className="cib-tl">
              <button className="cib-tbtn ico" onClick={() => { toast.info("Upload de mídia em breve!"); }}>
                <Paperclip size={12} />
              </button>
              <button className="cib-tbtn" onClick={() => {
                try {
                  setHeroVisible(false);
                  setMessages((prev) => [
                    ...prev,
                    { id: `sys-${Date.now()}`, role: "ai", text: "📋 <strong>Histórico</strong>: suas últimas conversas aparecerão aqui em breve. Por enquanto, o histórico é mantido na sessão atual.", time: "agora" },
                  ]);
                  scrollToBottom();
                } catch (err) {
                  console.error("Error loading history:", err);
                  toast.error("Erro ao carregar histórico");
                }
              }}>
                <Clock size={11} /> Histórico
              </button>
              <button className="cib-tbtn" onClick={() => {
                try {
                  const prompts = [
                    "Crie uma landing page moderna com hero, features e CTA",
                    "Gere um dashboard admin com gráficos e tabelas",
                    "Crie um formulário de cadastro com validação",
                    "Monte uma página de preços com 3 planos",
                  ];
                  const random = prompts[Math.floor(Math.random() * prompts.length)];
                  setInputValue(random);
                  textareaRef.current?.focus();
                } catch (err) {
                  console.error("Error setting prompt:", err);
                  toast.error("Erro ao carregar prompt");
                }
              }}>
                Prompt
              </button>
            </div>
            <div className="cib-tr">
              <span style={{ fontSize: 10, color: "var(--tq)", fontFamily: "var(--mono)" }}>⌘↵</span>
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
