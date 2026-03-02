import {
  Folder, FolderOpen, ChevronDown, Globe, Monitor, Tablet, Smartphone,
  Clock, Share2, Layers, Maximize2, Columns2, Code, Eye
} from "lucide-react";
import type { FrameMode } from "./types";

export type EditorMode = "full" | "split";

interface Props {
  projectName: string;
  frameMode: FrameMode;
  onFrameChange: (m: FrameMode) => void;
  editorMode: EditorMode;
  onEditorModeChange: (m: EditorMode) => void;
  isLive: boolean;
  onPublish: () => void;
  onHistoryClick: () => void;
  onShareClick: () => void;
  rightPanel?: "preview" | "code";
  onRightPanelChange?: (p: "preview" | "code") => void;
  showFiles?: boolean;
  onToggleFiles?: () => void;
  fileCount?: number;
}

export default function SplitTopBar({
  projectName, frameMode, onFrameChange, editorMode, onEditorModeChange,
  isLive, onPublish, onHistoryClick, onShareClick,
  rightPanel = "preview", onRightPanelChange,
  showFiles, onToggleFiles, fileCount = 0,
}: Props) {
  const frames: { mode: FrameMode; icon: typeof Monitor; label: string }[] = [
    { mode: "desktop", icon: Monitor, label: "Desktop" },
    { mode: "tablet", icon: Tablet, label: "Tablet" },
    { mode: "mobile", icon: Smartphone, label: "Mobile" },
  ];

  return (
    <div className="sp-topbar">
      {/* Left */}
      <div className="sp-tb-left">
        <div className="sp-tb-logo">C</div>
        <span className="sp-tb-brand">Cirius</span>
        <div className="sp-tb-sep" />

        <button className="sp-tb-proj" onClick={onHistoryClick} title="Configurações do projeto">
          <Folder size={12} />
          <span>{projectName}</span>
          <ChevronDown size={10} />
        </button>

        <div className="sp-tb-sep" />

        {/* File explorer toggle */}
        {onToggleFiles && (
          <button
            className={`sp-msw-btn ${showFiles ? "on" : ""}`}
            onClick={onToggleFiles}
            style={{ gap: 4, padding: "0 8px" }}
          >
            {showFiles ? <FolderOpen size={11} /> : <Folder size={11} />}
            {fileCount > 0 && <span style={{ fontSize: 10, fontFamily: "var(--mono)" }}>{fileCount}</span>}
          </button>
        )}

        <div className="sp-tb-sep" />

        {/* Mode Switch */}
        <div className="sp-mode-switch">
          <button className={`sp-msw-btn ${editorMode === "full" ? "on" : ""}`} onClick={() => onEditorModeChange("full")}>
            <Maximize2 size={11} /> Full
          </button>
          <button className={`sp-msw-btn ${editorMode === "split" ? "on" : ""}`} onClick={() => onEditorModeChange("split")}>
            <Columns2 size={11} /> Split
          </button>
        </div>
      </div>

      {/* Center — Frame/Panel Selector */}
      <div className="sp-tb-center">
        {/* Right panel toggle */}
        {onRightPanelChange && (
          <div className="sp-mode-switch" style={{ marginRight: 12 }}>
            <button
              className={`sp-msw-btn ${rightPanel === "preview" ? "on" : ""}`}
              onClick={() => onRightPanelChange("preview")}
            >
              <Eye size={11} /> Preview
            </button>
            <button
              className={`sp-msw-btn ${rightPanel === "code" ? "on" : ""}`}
              onClick={() => onRightPanelChange("code")}
            >
              <Code size={11} /> Código
            </button>
          </div>
        )}

        {rightPanel === "preview" && frames.map(f => (
          <button
            key={f.mode}
            className={`frm-btn ${frameMode === f.mode ? "on" : ""}`}
            onClick={() => onFrameChange(f.mode)}
          >
            <f.icon size={13} /> {f.label}
          </button>
        ))}
      </div>

      {/* Right */}
      <div className="sp-tb-right">
        {isLive && (
          <div className="sp-tb-stat">
            <span className="stat-dot" />
            Live
          </div>
        )}
        <div className="sp-tb-sep" />
        <button className="gl ico sm" onClick={onHistoryClick}><Clock size={13} /></button>
        <button className="gl ico sm" onClick={onShareClick}><Share2 size={13} /></button>
        <div className="sp-tb-sep" />
        <button className="gl sm primary" onClick={onPublish}>
          <Layers size={12} /> Publicar
        </button>
      </div>
    </div>
  );
}
