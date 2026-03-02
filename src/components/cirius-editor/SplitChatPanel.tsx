import { useState, useRef, useCallback, useEffect } from "react";
import {
  MessageCircle, Trash2, Clock, Code, CheckSquare, Info, Shield,
  Paperclip, Camera, ArrowUp, X, Sparkles
} from "lucide-react";
import PRDCard from "./PRDCard";
import type { ChatMessage, ActiveMode } from "./types";

interface Props {
  messages: ChatMessage[];
  onSend: (msg: string) => void;
  isGenerating: boolean;
  activeMode: ActiveMode;
  setActiveMode: (m: ActiveMode) => void;
  onClear: () => void;
  onApprovePrd?: (prd: any) => void;
  approvingPrd?: boolean;
  approvedPrdId?: string | null;
}

const SUGGESTIONS = [
  { icon: "✨", text: "Criar hero section" },
  { icon: "🎨", text: "Ajustar cores" },
  { icon: "📱", text: "Tornar responsivo" },
];

export default function SplitChatPanel({ messages, onSend, isGenerating, activeMode, setActiveMode, onClear, onApprovePrd, approvingPrd, approvedPrdId }: Props) {
  const [text, setText] = useState("");
  const [modesOpen, setModesOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "history" | "versions">("chat");
  const [contextFiles, setContextFiles] = useState<string[]>([]);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const msgsRef = useRef<HTMLDivElement>(null);

  const scrollBottom = useCallback(() => {
    if (msgsRef.current) setTimeout(() => msgsRef.current!.scrollTop = msgsRef.current!.scrollHeight, 50);
  }, []);

  useEffect(() => { scrollBottom(); }, [messages, scrollBottom]);

  const handleInput = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 100) + "px";
  }, []);

  const doSend = useCallback(() => {
    if (!text.trim() || isGenerating) return;
    onSend(text);
    setText("");
    if (taRef.current) taRef.current.style.height = "auto";
  }, [text, isGenerating, onSend]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); }
    if (e.key === "Escape") setModesOpen(false);
  }, [doSend, setModesOpen]);

  const removeCtx = (f: string) => setContextFiles(prev => prev.filter(x => x !== f));

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  return (
    <div className="sp-chat-panel">
      {/* Header */}
      <div className="sp-chat-header">
        <div className="sp-ch-title">
          <MessageCircle size={14} style={{ color: "var(--indigo-l)" }} />
          Chat com IA
          <span className="ce-chip" style={{ fontSize: 10, padding: "1px 6px", background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.22)", color: "var(--indigo-l)" }}>
            Cirius Brain
          </span>
        </div>
        <div className="sp-ch-actions">
          <button className="gl ico xs" onClick={onClear} title="Limpar"><Trash2 size={11} /></button>
          <button className="gl ico xs" title="Histórico"><Clock size={11} /></button>
        </div>
      </div>

      {/* Tabs */}
      <div className="sp-chat-tabs">
        {(["chat", "history", "versions"] as const).map(tab => (
          <button key={tab} className={`sp-ctab ${activeTab === tab ? "on" : ""}`} onClick={() => setActiveTab(tab)}>
            {tab === "chat" && <MessageCircle size={12} />}
            {tab === "history" && <Clock size={12} />}
            {tab === "versions" && <Sparkles size={12} />}
            {tab === "chat" ? "Chat" : tab === "history" ? "Histórico" : "Versões"}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="sp-messages" ref={msgsRef}>
        {messages.length === 0 && (
          <div className="sp-msg sp-msg-ai" style={{ animationDelay: "0s" }}>
            <div className="sp-msg-avatar sp-ai-av">C</div>
            <div className="sp-msg-body">
              <div className="sp-msg-bubble">
                Olá! Sou o Cirius Brain. Descreva o que deseja criar e vou gerar o código para você.
              </div>
              <div className="sp-suggestions">
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} className="sp-sug-btn" onClick={() => { setText(s.text); taRef.current?.focus(); }}>
                    {s.text}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map(m => {
          // Detect PRD messages (assistant messages with prd_json metadata)
          const prdData = m.role === "assistant" && m.prdData ? m.prdData : null;

          if (prdData) {
            return (
              <div key={m.id} className="sp-msg sp-msg-ai">
                <div className="sp-msg-avatar sp-ai-av">C</div>
                <div className="sp-msg-body">
                  <PRDCard
                    prd={prdData}
                    onApprove={() => onApprovePrd?.(prdData)}
                    isApproving={!!approvingPrd}
                    isApproved={approvedPrdId === m.id}
                  />
                  <div className="sp-msg-time">{formatTime(m.timestamp)}</div>
                </div>
              </div>
            );
          }

          return (
            <div key={m.id} className={`sp-msg ${m.role === "user" ? "sp-msg-user" : "sp-msg-ai"}`}>
              <div className={`sp-msg-avatar ${m.role === "user" ? "sp-user-av" : "sp-ai-av"}`}>
                {m.role === "assistant" ? "C" : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                )}
              </div>
              <div className="sp-msg-body">
                <div className="sp-msg-bubble">{m.content}</div>
                <div className="sp-msg-time">{formatTime(m.timestamp)}</div>
              </div>
            </div>
          );
        })}

        {isGenerating && (
          <div className="sp-msg sp-msg-ai">
            <div className="sp-msg-avatar sp-ai-av">C</div>
            <div className="sp-msg-body">
              <div className="sp-typing-bubble">
                <div className="sp-typing-dot" />
                <div className="sp-typing-dot" />
                <div className="sp-typing-dot" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="sp-chat-input-area">
        <div className={`sp-ci-wrap ${isGenerating ? "disabled" : ""}`}>
          {/* Mode strip */}
          <div className={`sp-ci-modes ${modesOpen ? "open" : ""}`}>
            <button className={`sp-ci-mbtn ${activeMode === "build" ? "on c-indigo" : ""}`} onClick={() => setActiveMode("build")}>
              <Code size={11} /> Build
            </button>
            <button className={`sp-ci-mbtn ${activeMode === "task" ? "on c-orange" : ""}`} onClick={() => setActiveMode("task")}>
              <CheckSquare size={11} /> Tarefa
            </button>
            <button className={`sp-ci-mbtn ${activeMode === "debug" ? "on c-blue" : ""}`} onClick={() => setActiveMode("debug")}>
              <Info size={11} /> Debug
            </button>
            <div className="sp-ci-msep" />
            <button className="sp-ci-mbtn">
              <Shield size={11} /> Review
            </button>
          </div>

          {/* Context pills */}
          {contextFiles.length > 0 && (
            <div className="sp-ci-context">
              {contextFiles.map(f => (
                <span key={f} className="sp-ctx-pill">
                  <Code size={9} /> {f}
                  <span className="sp-ctx-x" onClick={() => removeCtx(f)}>✕</span>
                </span>
              ))}
            </div>
          )}

          {/* Textarea */}
          <textarea
            ref={taRef}
            className="sp-ci-textarea"
            placeholder="Descreva o que quer criar ou alterar..."
            value={text}
            onChange={e => { setText(e.target.value); handleInput(); }}
            onFocus={() => setModesOpen(true)}
            onKeyDown={handleKey}
            rows={1}
            disabled={isGenerating}
          />

          {/* Toolbar */}
          <div className="sp-ci-toolbar">
            <div className="sp-ci-tl">
              <button className="sp-ci-tbtn ico"><Paperclip size={11} /></button>
              <button className="sp-ci-tbtn ico" onClick={() => setContextFiles(prev => [...prev, "Hero.tsx"])}><Code size={11} /></button>
              <button className="sp-ci-tbtn ico"><Camera size={11} /></button>
            </div>
            <div className="sp-ci-tr">
              <span style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--text-quaternary)" }}>⌘↵</span>
              <button className="sp-ci-send" onClick={doSend} disabled={isGenerating || !text.trim()}>
                <ArrowUp size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
