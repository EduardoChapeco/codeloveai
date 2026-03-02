import { Folder, Globe, Search, ChevronDown, Maximize2, Columns2 } from "lucide-react";

interface Props {
  projectName: string;
  onDomainClick: () => void;
  onSeoClick: () => void;
  editorMode?: "full" | "split";
  onEditorModeChange?: (mode: "full" | "split") => void;
}

export default function IslandLeft({ projectName, onDomainClick, onSeoClick, editorMode = "full", onEditorModeChange }: Props) {
  return (
    <div className="ce-island">
      <div className="il-logo">C</div>
      <div className="il-sep" />
      <button className="il-proj" onClick={onSeoClick} title="Configurações do projeto">
        <Folder size={13} />
        <span>{projectName}</span>
        <ChevronDown size={11} />
      </button>
      <div className="il-sep" />

      {/* Mode Switch */}
      {onEditorModeChange && (
        <>
          <div className="sp-mode-switch">
            <button
              className={`sp-msw-btn ${editorMode === "full" ? "on" : ""}`}
              onClick={() => onEditorModeChange("full")}
            >
              <Maximize2 size={11} /> Full
            </button>
            <button
              className={`sp-msw-btn ${editorMode === "split" ? "on" : ""}`}
              onClick={() => onEditorModeChange("split")}
            >
              <Columns2 size={11} /> Split
            </button>
          </div>
          <div className="il-sep" />
        </>
      )}

      <button className="gl sm" onClick={onDomainClick}>
        <Globe size={13} />
      </button>
      <button className="gl sm" onClick={onSeoClick}>
        <Search size={13} />
      </button>
    </div>
  );
}
