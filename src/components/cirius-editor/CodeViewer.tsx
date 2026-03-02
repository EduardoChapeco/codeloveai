import { useMemo } from "react";
import { FileCode, Eye, X, Copy, Check } from "lucide-react";
import { useState } from "react";

interface Props {
  files: Record<string, string>;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  onSwitchToPreview: () => void;
}

const LANG_MAP: Record<string, string> = {
  tsx: "TypeScript JSX",
  ts: "TypeScript",
  jsx: "JavaScript JSX",
  js: "JavaScript",
  css: "CSS",
  html: "HTML",
  json: "JSON",
  md: "Markdown",
  toml: "TOML",
};

function getExtension(path: string): string {
  return path.split(".").pop()?.toLowerCase() || "";
}

function highlightLine(line: string, ext: string): JSX.Element {
  if (ext === "css") {
    return <span>{line}</span>;
  }

  // Simple syntax highlighting
  const parts: JSX.Element[] = [];
  let remaining = line;
  let key = 0;

  // Comments
  if (/^\s*\/\//.test(remaining)) {
    return <span key={key} className="cv-cmt">{remaining}</span>;
  }

  // Process keywords, strings, etc.
  const tokenRe = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\b(?:import|export|from|const|let|var|function|return|if|else|class|extends|interface|type|async|await|default|new|this|true|false|null|undefined|void|typeof|as|in|of)\b|\/\/.*$)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRe.exec(remaining)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={key++}>{remaining.slice(lastIndex, match.index)}</span>);
    }
    const token = match[0];
    if (token.startsWith("//")) {
      parts.push(<span key={key++} className="cv-cmt">{token}</span>);
    } else if (token.startsWith('"') || token.startsWith("'") || token.startsWith("`")) {
      parts.push(<span key={key++} className="cv-str">{token}</span>);
    } else {
      parts.push(<span key={key++} className="cv-kw">{token}</span>);
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < remaining.length) {
    parts.push(<span key={key++}>{remaining.slice(lastIndex)}</span>);
  }

  return <>{parts}</>;
}

export default function CodeViewer({ files, selectedFile, onSelectFile, onSwitchToPreview }: Props) {
  const [copied, setCopied] = useState(false);

  const content = selectedFile ? files[selectedFile] || "" : "";
  const lines = useMemo(() => content.split("\n"), [content]);
  const ext = selectedFile ? getExtension(selectedFile) : "";
  const langLabel = LANG_MAP[ext] || ext.toUpperCase();

  // Open file tabs (last 5 opened)
  const tabs = useMemo(() => {
    const allFiles = Object.keys(files);
    const result: string[] = [];
    if (selectedFile) result.push(selectedFile);
    for (const f of allFiles) {
      if (f !== selectedFile && (f.endsWith(".tsx") || f.endsWith(".ts") || f.endsWith(".css"))) {
        result.push(f);
        if (result.length >= 5) break;
      }
    }
    return result;
  }, [files, selectedFile]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="cv-panel">
      {/* Toolbar */}
      <div className="cv-toolbar">
        <div className="cv-tabs">
          {tabs.map(f => {
            const name = f.split("/").pop() || f;
            const isActive = f === selectedFile;
            return (
              <button
                key={f}
                className={`cv-tab ${isActive ? "on" : ""}`}
                onClick={() => onSelectFile(f)}
                title={f}
              >
                <FileCode size={10} />
                <span>{name}</span>
                {isActive && (
                  <span className="cv-tab-close" onClick={(e) => { e.stopPropagation(); onSwitchToPreview(); }}>
                    <X size={8} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="cv-toolbar-right">
          <span className="cv-lang">{langLabel}</span>
          <button className="gl ico xs" onClick={handleCopy} title="Copiar">
            {copied ? <Check size={11} /> : <Copy size={11} />}
          </button>
          <button className="gl ico xs" onClick={onSwitchToPreview} title="Ver preview">
            <Eye size={11} />
          </button>
        </div>
      </div>

      {/* Code area */}
      {!selectedFile ? (
        <div className="cv-empty">
          <FileCode size={20} style={{ color: "var(--text-quaternary)" }} />
          <span>Selecione um arquivo</span>
        </div>
      ) : (
        <div className="cv-code-area">
          {lines.map((line, i) => (
            <div key={i} className="cv-line">
              <span className="cv-ln">{i + 1}</span>
              <span className="cv-content">{highlightLine(line, ext)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
