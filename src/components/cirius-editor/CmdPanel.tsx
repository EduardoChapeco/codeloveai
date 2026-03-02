import { useState } from "react";
import { MessageCircle, Code, Search, X } from "lucide-react";
import type { CmdMode } from "@/pages/CiriusEditor";

interface Props {
  mode: CmdMode;
  onModeChange: (m: CmdMode) => void;
  onClose: () => void;
  sourceFiles?: Record<string, string> | null;
}

const demoFiles = [
  { name: "App.tsx", color: "var(--blue-l)" },
  { name: "Hero.tsx", color: "var(--blue-l)" },
  { name: "index.css", color: "var(--teal-l)" },
  { name: "package.json", color: "var(--orange-l)" },
];

const demoCode = `import React from 'react';
import { Hero } from './components/Hero';
import { Features } from './components/Features';
import './index.css';

// Main application component
export default function App() {
  return (
    <div className="app">
      <Hero />
      <Features />
    </div>
  );
}`;

export default function CmdPanel({ mode, onModeChange, onClose, sourceFiles }: Props) {
  const [activeFile, setActiveFile] = useState(0);
  const [search, setSearch] = useState("");

  const files = sourceFiles ? Object.keys(sourceFiles).slice(0, 8).map(name => ({
    name: name.split("/").pop() || name,
    color: name.endsWith(".css") ? "var(--teal-l)" : name.endsWith(".json") ? "var(--orange-l)" : "var(--blue-l)",
  })) : demoFiles;

  const code = sourceFiles
    ? Object.values(sourceFiles)[activeFile] || ""
    : demoCode;

  const lines = code.split("\n").slice(0, 50);

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
            <div style={{ position: "relative" }}>
              <Search size={12} style={{ position: "absolute", left: 8, top: 7, color: "var(--text-quaternary)" }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                style={{
                  height: 26, width: 160, paddingLeft: 26, paddingRight: 8,
                  fontSize: 12, fontFamily: "var(--font)",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid var(--b1)", borderRadius: "var(--r2)",
                  color: "var(--text-primary)", outline: "none",
                }}
              />
            </div>
            <button className="sd-close" onClick={onClose} style={{ fontSize: 10 }}>ESC</button>
          </div>
        </div>

        {mode === "code" ? (
          <>
            {/* File tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid var(--b0)", background: "var(--bg-1)" }}>
              {files.map((f, i) => (
                <button key={i} className={`cmd-ftab ${activeFile === i ? "on" : ""}`} onClick={() => setActiveFile(i)}>
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: f.color }} />
                  {f.name}
                </button>
              ))}
            </div>
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
        ) : (
          /* Chat mode */
          <div style={{ height: 420, padding: 16, display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
            <div style={{
              padding: "10px 12px", borderRadius: "4px var(--r3) var(--r3) var(--r3)",
              background: "var(--bg-3)", border: "1px solid var(--b1)",
              fontSize: 12.5, maxWidth: "85%", color: "var(--text-secondary)",
            }}>
              Olá! Sou o BLE, seu assistente de código. Como posso ajudar?
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function highlightLine(line: string): JSX.Element {
  // Simple syntax highlighting
  const parts: JSX.Element[] = [];
  const keywords = /\b(import|from|export|default|function|return|const|let|var|class|if|else)\b/g;
  const strings = /(["'`])(?:(?!\1).)*\1/g;
  const comments = /\/\/.*/g;

  if (comments.test(line)) {
    return <span className="cmt">{line}</span>;
  }

  // Simple approach: just return the line with basic highlights
  let result = line;
  if (/^\s*(import|export|const|function|return|class)/.test(line)) {
    const match = line.match(/^\s*(import|export|default|const|function|return|class)/);
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
  }
  return <span>{highlightRest(line)}</span>;
}

function highlightRest(s: string): JSX.Element {
  // Highlight strings
  const parts = s.split(/(["'`][^"'`]*["'`])/g);
  return (
    <span>
      {parts.map((p, i) =>
        /^["'`]/.test(p) ? <span key={i} className="str">{p}</span> : <span key={i}>{p}</span>
      )}
    </span>
  );
}
