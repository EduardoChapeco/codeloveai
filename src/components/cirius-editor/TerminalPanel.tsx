import { useState, useRef, useEffect } from "react";
import { Terminal as TerminalIcon, X, ChevronUp, ChevronDown, Trash2, Search } from "lucide-react";

export interface TerminalLine {
  id: string;
  text: string;
  type: "info" | "warn" | "error" | "success" | "system" | "cmd";
  timestamp: number;
}

interface Props {
  lines: TerminalLine[];
  onClear?: () => void;
  visible?: boolean;
  onToggle?: () => void;
}

export default function TerminalPanel({ lines, onClear, visible = true, onToggle }: Props) {
  const [filter, setFilter] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current && !collapsed) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines, collapsed]);

  if (!visible) return null;

  const filtered = filter
    ? lines.filter(l => l.text.toLowerCase().includes(filter.toLowerCase()))
    : lines;

  const typeColor: Record<string, string> = {
    info: "var(--text-secondary)",
    warn: "var(--orange-l)",
    error: "var(--red-l)",
    success: "var(--green-l)",
    system: "var(--indigo-l)",
    cmd: "var(--purple-l)",
  };

  const typePrefix: Record<string, string> = {
    info: "INFO",
    warn: "WARN",
    error: "ERR ",
    success: " OK ",
    system: "SYS ",
    cmd: "CMD ",
  };

  return (
    <div className="term-panel">
      <div className="term-header">
        <div className="term-h-left">
          <TerminalIcon size={12} style={{ color: "var(--indigo-l)" }} />
          <span className="term-title">Terminal</span>
          <span className="term-count">{lines.length}</span>
          {lines.some(l => l.type === "error") && (
            <span className="term-err-badge">{lines.filter(l => l.type === "error").length}</span>
          )}
        </div>
        <div className="term-h-right">
          <div className="term-search-wrap">
            <Search size={10} />
            <input
              className="term-search"
              placeholder="Filtrar..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
          </div>
          {onClear && (
            <button className="gl ico xs" onClick={onClear} title="Limpar">
              <Trash2 size={10} />
            </button>
          )}
          <button className="gl ico xs" onClick={() => setCollapsed(p => !p)} title={collapsed ? "Expandir" : "Recolher"}>
            {collapsed ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
          {onToggle && (
            <button className="gl ico xs" onClick={onToggle} title="Fechar">
              <X size={10} />
            </button>
          )}
        </div>
      </div>

      {!collapsed && (
        <div className="term-body" ref={scrollRef}>
          {filtered.length === 0 && (
            <div className="term-empty">
              <TerminalIcon size={14} style={{ color: "var(--text-quaternary)" }} />
              <span>Nenhum log ainda</span>
            </div>
          )}
          {filtered.map(line => {
            const time = new Date(line.timestamp);
            const ts = `${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}:${time.getSeconds().toString().padStart(2, "0")}`;
            return (
              <div key={line.id} className={`term-line term-${line.type}`}>
                <span className="term-ts">{ts}</span>
                <span className="term-prefix" style={{ color: typeColor[line.type] }}>{typePrefix[line.type]}</span>
                <span className="term-text" style={{ color: typeColor[line.type] }}>{line.text}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
