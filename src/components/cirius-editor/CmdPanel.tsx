import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, Code, Search, X, ArrowUp, Loader2 } from "lucide-react";
import type { CmdMode, ChatMessage } from "@/components/cirius-editor/types";

interface Props {
  mode: CmdMode;
  onModeChange: (m: CmdMode) => void;
  onClose: () => void;
  sourceFiles?: Record<string, string> | null;
  chatMessages: ChatMessage[];
  onChatSend: (msg: string) => void;
  chatLoading?: boolean;
}

export default function CmdPanel({ mode, onModeChange, onClose, sourceFiles, chatMessages, onChatSend, chatLoading }: Props) {
  const [activeFile, setActiveFile] = useState(0);
  const [search, setSearch] = useState("");
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // Build file list from source files
  const allFiles = sourceFiles
    ? Object.entries(sourceFiles).map(([path, content]) => ({
        path,
        name: path.split("/").pop() || path,
        content: content as string,
        color: path.endsWith(".css") ? "var(--teal-l)" : path.endsWith(".json") ? "var(--orange-l)" : path.endsWith(".html") ? "var(--red-l)" : "var(--blue-l)",
      }))
    : [];

  // Filter files by search
  const files = search
    ? allFiles.filter(f => f.path.toLowerCase().includes(search.toLowerCase()))
    : allFiles;

  const currentFile = files[activeFile] || files[0];
  const lines = currentFile?.content?.split("\n") || [];

  // Scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages.length]);

  // Focus chat input when switching to chat mode
  useEffect(() => {
    if (mode === "chat") chatInputRef.current?.focus();
  }, [mode]);

  const handleChatKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (chatInput.trim() && !chatLoading) {
        onChatSend(chatInput.trim());
        setChatInput("");
      }
    }
  }, [chatInput, chatLoading, onChatSend]);

  return (
    <div className="cmd-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cmd-panel">
        {/* Top */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--b1)" }}>
          <div style={{ display: "flex", gap: 4 }}>
            <button className={`cmd-mbtn ${mode === "chat" ? "on" : ""}`} onClick={() => onModeChange("chat")}>
              <MessageCircle size={12} style={{ marginRight: 4 }} /> Chat BLE
            </button>
            <button className={`cmd-mbtn ${mode === "code" ? "on" : ""}`} onClick={() => onModeChange("code")}>
              <Code size={12} style={{ marginRight: 4 }} /> Código
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {mode === "code" && (
              <div style={{ position: "relative" }}>
                <Search size={12} style={{ position: "absolute", left: 8, top: 7, color: "var(--text-quaternary)" }} />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setActiveFile(0); }}
                  placeholder="Buscar arquivo..."
                  style={{
                    height: 26, width: 180, paddingLeft: 26, paddingRight: 8,
                    fontSize: 12, fontFamily: "var(--font)",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid var(--b1)", borderRadius: "var(--r2)",
                    color: "var(--text-primary)", outline: "none",
                  }}
                />
              </div>
            )}
            <button className="sd-close" onClick={onClose} style={{ fontSize: 10 }}>ESC</button>
          </div>
        </div>

        {mode === "code" ? (
          files.length === 0 ? (
            <div style={{ height: 420, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
              {sourceFiles ? "Nenhum arquivo encontrado" : "Nenhum arquivo gerado ainda"}
            </div>
          ) : (
            <>
              {/* File tabs - scrollable */}
              <div style={{ display: "flex", borderBottom: "1px solid var(--b0)", background: "var(--bg-1)", overflowX: "auto", scrollbarWidth: "none" }}>
                {files.map((f, i) => (
                  <button key={f.path} className={`cmd-ftab ${activeFile === i ? "on" : ""}`} onClick={() => setActiveFile(i)}>
                    <span style={{ width: 6, height: 6, borderRadius: 3, background: f.color, flexShrink: 0 }} />
                    <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</span>
                  </button>
                ))}
              </div>
              {/* Full file path */}
              {currentFile && (
                <div style={{ padding: "4px 14px", fontSize: 10, color: "var(--text-quaternary)", fontFamily: "var(--mono)", borderBottom: "1px solid var(--b0)", background: "var(--bg-1)" }}>
                  {currentFile.path}
                </div>
              )}
              {/* Code */}
              <div className="cmd-code-area">
                {lines.map((line, i) => (
                  <div key={i} className="cmd-line">
                    <span className="ln-num">{i + 1}</span>
                    <span>{highlightLine(line)}</span>
                  </div>
                ))}
              </div>
            </>
          )
        ) : (
          /* Chat mode */
          <div style={{ display: "flex", flexDirection: "column", height: 420 }}>
            <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
              {chatMessages.length === 0 && (
                <div style={{
                  padding: "10px 12px", borderRadius: "4px var(--r3) var(--r3) var(--r3)",
                  background: "var(--bg-3)", border: "1px solid var(--b1)",
                  fontSize: 12.5, maxWidth: "85%", color: "var(--text-secondary)",
                }}>
                  Olá! Sou o BLE, seu assistente de código. Como posso ajudar com este projeto?
                </div>
              )}
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                    padding: "10px 12px",
                    borderRadius: msg.role === "user" ? "var(--r3) 4px var(--r3) var(--r3)" : "4px var(--r3) var(--r3) var(--r3)",
                    background: msg.role === "user"
                      ? "linear-gradient(135deg, rgba(99,102,241,0.18), rgba(168,85,247,0.12))"
                      : "var(--bg-3)",
                    border: msg.role === "user"
                      ? "1px solid rgba(99,102,241,0.22)"
                      : "1px solid var(--b1)",
                    fontSize: 12.5,
                    maxWidth: "85%",
                    color: "var(--text-secondary)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {msg.content}
                </div>
              ))}
              {chatLoading && (
                <div style={{
                  padding: "10px 12px", borderRadius: "4px var(--r3) var(--r3) var(--r3)",
                  background: "var(--bg-3)", border: "1px solid var(--b1)",
                  fontSize: 12.5, maxWidth: "85%", color: "var(--text-tertiary)",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <Loader2 size={14} className="animate-spin" /> Pensando...
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            {/* Chat input */}
            <div style={{ padding: "8px 12px", borderTop: "1px solid var(--b1)", display: "flex", alignItems: "flex-end", gap: 8 }}>
              <textarea
                ref={chatInputRef}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleChatKey}
                placeholder="Pergunte sobre o código..."
                rows={1}
                style={{
                  flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid var(--b1)",
                  borderRadius: "var(--r2)", padding: "7px 10px", fontSize: 12.5,
                  fontFamily: "var(--font)", color: "var(--text-primary)", outline: "none",
                  resize: "none", minHeight: 32, maxHeight: 80,
                }}
              />
              <button
                onClick={() => { if (chatInput.trim() && !chatLoading) { onChatSend(chatInput.trim()); setChatInput(""); } }}
                disabled={!chatInput.trim() || chatLoading}
                className="bi-send"
                style={{ opacity: chatInput.trim() && !chatLoading ? 1 : 0.4 }}
              >
                <ArrowUp size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function highlightLine(line: string): JSX.Element {
  if (/^\s*\/\//.test(line)) {
    return <span className="cmt">{line}</span>;
  }
  const match = line.match(/^\s*(import|export|default|const|function|return|class|let|var|if|else|from|async|await)/);
  if (match) {
    const idx = line.indexOf(match[1]);
    return (
      <span>
        {line.slice(0, idx)}
        <span className="kw">{match[1]}</span>
        {highlightRest(line.slice(idx + match[1].length))}
      </span>
    );
  }
  return <span>{highlightRest(line)}</span>;
}

function highlightRest(s: string): JSX.Element {
  const parts = s.split(/(["'`][^"'`]*["'`])/g);
  return (
    <span>
      {parts.map((p, i) =>
        /^["'`]/.test(p) ? <span key={i} className="str">{p}</span> : <span key={i}>{p}</span>
      )}
    </span>
  );
}
