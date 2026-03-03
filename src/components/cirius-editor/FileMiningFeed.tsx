import { useState } from "react";
import { FileCode, ChevronDown, ChevronUp, CheckCircle2, Pickaxe } from "lucide-react";

interface Props {
  files: Record<string, string>;
  updatedFiles: string[];
}

function getFileExt(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot >= 0 ? path.slice(dot + 1) : "txt";
}

function countLines(content: string): number {
  return content.split("\n").length;
}

const EXT_COLORS: Record<string, string> = {
  tsx: "var(--indigo-l)",
  ts: "var(--blue-l, #93c5fd)",
  css: "var(--pink-l, #f9a8d4)",
  html: "var(--orange-l, #fdba74)",
  json: "var(--yellow-l, #fde68a)",
  md: "var(--green-l)",
};

export default function FileMiningFeed({ files, updatedFiles }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  if (updatedFiles.length === 0) return null;

  return (
    <div className="fm-panel">
      <button className="fm-header" onClick={() => setCollapsed(p => !p)}>
        <Pickaxe size={12} style={{ color: "var(--green-l)" }} />
        <span>Arquivos Extraídos</span>
        <span className="fm-badge">{updatedFiles.length}</span>
        <span style={{ marginLeft: "auto" }}>
          {collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        </span>
      </button>

      {!collapsed && (
        <div className="fm-list">
          {updatedFiles.map((path, i) => {
            const ext = getFileExt(path);
            const content = files[path] || "";
            const lines = countLines(content);
            const color = EXT_COLORS[ext] || "var(--text-tertiary)";

            return (
              <div
                key={path}
                className="fm-card"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="fm-card-left">
                  <CheckCircle2 size={12} style={{ color: "var(--green-l)", flexShrink: 0 }} />
                  <div className="fm-card-info">
                    <span className="fm-card-path">{path}</span>
                    <span className="fm-card-meta">
                      <span className="fm-ext" style={{ color }}>.{ext}</span>
                      <span className="fm-sep">·</span>
                      <span>{lines} linhas</span>
                    </span>
                  </div>
                </div>
                <FileCode size={11} style={{ color, opacity: 0.5, flexShrink: 0 }} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
