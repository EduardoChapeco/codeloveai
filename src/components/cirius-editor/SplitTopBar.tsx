import {
  Folder, FolderOpen, ChevronDown, Globe, Monitor, Tablet, Smartphone,
  Clock, Share2, Layers, Maximize2, Columns2, Code, Eye, Download,
  Github, Database, ExternalLink
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
  onDownload?: () => void;
  rightPanel?: "preview" | "code";
  onRightPanelChange?: (p: "preview" | "code") => void;
  showFiles?: boolean;
  onToggleFiles?: () => void;
  fileCount?: number;
  project?: any;
}

export default function SplitTopBar({
  projectName, frameMode, onFrameChange, editorMode, onEditorModeChange,
  isLive, onPublish, onHistoryClick, onShareClick, onDownload,
  rightPanel = "preview", onRightPanelChange,
  showFiles, onToggleFiles, fileCount = 0,
  project,
}: Props) {
  const frames: { mode: FrameMode; icon: typeof Monitor; label: string }[] = [
    { mode: "desktop", icon: Monitor, label: "Desktop" },
    { mode: "tablet", icon: Tablet, label: "Tablet" },
    { mode: "mobile", icon: Smartphone, label: "Mobile" },
  ];

  const githubUrl = project?.github_url;
  const vercelUrl = project?.vercel_url ? (project.vercel_url.startsWith("http") ? project.vercel_url : `https://${project.vercel_url}`) : null;
  const netlifyUrl = project?.netlify_url ? (project.netlify_url.startsWith("http") ? project.netlify_url : `https://${project.netlify_url}`) : null;
  const supabaseUrl = project?.supabase_url;
  const liveUrl = netlifyUrl || vercelUrl;

  return (
    <div className="sp-topbar">
      {/* Left */}
      <div className="sp-tb-left">
        <div className="sp-tb-logo">C</div>
        <span className="sp-tb-brand sp-hide-compact">Cirius</span>
        <div className="sp-tb-sep sp-hide-compact" />

        <button className="sp-tb-proj" onClick={onHistoryClick} title="Configurações do projeto">
          <Folder size={12} />
          <span className="sp-hide-compact">{projectName}</span>
          <ChevronDown size={10} />
        </button>

        <div className="sp-tb-sep sp-hide-compact" />

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

        <div className="sp-tb-sep sp-hide-compact" />

        {/* Mode Switch */}
        <div className="sp-mode-switch sp-hide-compact">
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
            className={`frm-btn sp-hide-compact ${frameMode === f.mode ? "on" : ""}`}
            onClick={() => onFrameChange(f.mode)}
          >
            <f.icon size={13} /> {f.label}
          </button>
        ))}
      </div>

      {/* Right */}
      <div className="sp-tb-right">
        {/* Quick integration links */}
        {githubUrl && (
          <a href={githubUrl} target="_blank" rel="noopener noreferrer" className="sp-tb-link" title="GitHub">
            <Github size={13} />
          </a>
        )}
        {supabaseUrl && (
          <a href={supabaseUrl} target="_blank" rel="noopener noreferrer" className="sp-tb-link" title="Supabase">
            <Database size={13} />
          </a>
        )}
        {liveUrl && (
          <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="sp-tb-link sp-tb-link-live" title="Site ao vivo">
            <Globe size={13} />
          </a>
        )}

        {isLive && (
          <div className="sp-tb-stat sp-hide-compact">
            <span className="stat-dot" />
            Live
          </div>
        )}
        <div className="sp-tb-sep sp-hide-compact" />
        <button className="gl ico sm sp-hide-compact" onClick={onHistoryClick}><Clock size={13} /></button>
        <button className="gl ico sm sp-hide-compact" onClick={onShareClick}><Share2 size={13} /></button>
        {onDownload && <button className="gl ico sm" onClick={onDownload} title="Download ZIP"><Download size={13} /></button>}
        <div className="sp-tb-sep sp-hide-compact" />
        <button className="gl sm primary" onClick={onPublish}>
          <Layers size={12} /> <span className="sp-hide-compact">Publicar</span>
        </button>
      </div>
    </div>
  );
}
