import { useState, useRef, useCallback } from "react";
import { Code, CheckSquare, Link2, Shield, Info, MessageCircle, Paperclip, Pencil, Mic, ArrowUp, ListOrdered, X } from "lucide-react";
import type { ActiveMode } from "@/components/cirius-editor/types";

interface Props {
  modesOpen: boolean;
  setModesOpen: (v: boolean) => void;
  activeMode: ActiveMode;
  setActiveMode: (m: ActiveMode) => void;
  queueCount: number;
  onClearQueue: () => void;
  onSend: (msg: string) => void;
  onCmdOpen: () => void;
  onChainOpen: () => void;
}

export default function BottomIsland({ modesOpen, setModesOpen, activeMode, setActiveMode, queueCount, onClearQueue, onSend, onCmdOpen, onChainOpen }: Props) {
  const [text, setText] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  const handleInput = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 96) + "px";
  }, []);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (text.trim()) { onSend(text); setText(""); if (taRef.current) taRef.current.style.height = "auto"; }
    }
    if (e.key === "Escape") setModesOpen(false);
  }, [text, onSend, setModesOpen]);

  return (
    <div className="ce-bottom">
      {/* Queue Pill */}
      {queueCount > 0 && (
        <div className="ce-queue-pill">
          <ListOrdered size={12} />
          {queueCount} na fila
          <button className="gl xs" onClick={onClearQueue}><X size={10} /> Limpar</button>
        </div>
      )}

      <div className="bi-wrap">
        {/* Mode Strip */}
        <div className={`bi-modes ${modesOpen ? "open" : ""}`}>
          <button className={`md-btn ${activeMode === "build" ? "on c-indigo" : ""}`} onClick={() => setActiveMode("build")}>
            <Code size={12} /> Build
          </button>
          <button className={`md-btn ${activeMode === "task" ? "on c-orange" : ""}`} onClick={() => setActiveMode("task")}>
            <CheckSquare size={12} /> Tarefa
          </button>
          <button className="md-btn" onClick={onChainOpen}>
            <Link2 size={12} /> Encadeado
          </button>
          <div className="md-sep" />
          <button className="md-btn">
            <Shield size={12} /> Review
          </button>
          <button className={`md-btn ${activeMode === "debug" ? "on c-blue" : ""}`} onClick={() => setActiveMode("debug")}>
            <Info size={12} /> Debug
          </button>
          <div className="md-sep" />
          <button className="md-btn" onClick={onCmdOpen}>
            <MessageCircle size={12} /> BLE
          </button>
        </div>

        {/* Input */}
        <div style={{ padding: "9px 10px 4px" }}>
          <textarea
            ref={taRef}
            className="bi-textarea"
            placeholder="Descreva o que quer criar..."
            value={text}
            onChange={(e) => { setText(e.target.value); handleInput(); }}
            onFocus={() => setModesOpen(true)}
            onKeyDown={handleKey}
            rows={1}
          />
        </div>

        {/* Toolbar */}
        <div className="bi-toolbar">
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button className="bi-tbtn ico"><Paperclip size={12} /></button>
            <button className="bi-tbtn" onClick={onCmdOpen}>
              <Code size={12} /> Código
              <kbd style={{ fontSize: 10, opacity: 0.5, marginLeft: 4, fontFamily: "var(--mono)" }}>⌘K</kbd>
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button className="bi-tbtn ico"><Pencil size={12} /></button>
            <button className="bi-tbtn ico"><Mic size={12} /></button>
            <button className="bi-send" onClick={() => { if (text.trim()) { onSend(text); setText(""); if (taRef.current) taRef.current.style.height = "auto"; } }}>
              <ArrowUp size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
