import { useState, useCallback, useRef, useEffect } from "react";
import SplitTopBar from "./SplitTopBar";
import SplitChatPanel from "./SplitChatPanel";
import SplitResizer from "./SplitResizer";
import SplitPreviewPanel from "./SplitPreviewPanel";
import EditorToasts from "./EditorToasts";
import FileExplorer from "./FileExplorer";
import CodeViewer from "./CodeViewer";
import TerminalPanel, { type TerminalLine } from "./TerminalPanel";
import type { FrameMode, ActiveMode, EditorToast, ChatMessage, Bubble } from "./types";
import type { TaskItem } from "./ChatTaskCard";
import type { EditorMode } from "./SplitTopBar";
import type { BuildStage } from "./BuildProgressCard";
import { Terminal, AlertCircle, CheckCircle2 } from "lucide-react";

interface Props {
  project: any;
  previewHtml: string | null;
  livePreviewUrl: string | null;
  chatMessages: ChatMessage[];
  chatLoading: boolean;
  onSendMsg: (msg: string) => void;
  onSendChat: (msg: string) => void;
  onEditorModeChange: (mode: EditorMode) => void;
  isLive: boolean;
  toasts: EditorToast[];
  onApprovePrd?: (prd: any) => void;
  approvingPrd?: boolean;
  approvedPrdId?: string | null;
  chatMode?: "build" | "ai-chat";
  onChatModeChange?: (mode: "build" | "ai-chat") => void;
  sourceFiles?: Record<string, string>;
  buildStages?: BuildStage[];
  buildProgress?: number;
  buildComplete?: boolean;
  buildError?: boolean;
  deployUrls?: { github?: string; vercel?: string; netlify?: string };
  bubbles?: Bubble[];
  onRemoveBubble?: (id: string) => void;
  streamingText?: string;
  updatedFiles?: string[];
  terminalLines?: TerminalLine[];
  onClearTerminal?: () => void;
  taskItems?: TaskItem[];
  onRetryTask?: (taskId: string) => void;
}

export default function SplitModeEditor({
  project, previewHtml, livePreviewUrl,
  chatMessages, chatLoading, onSendMsg, onSendChat,
  onEditorModeChange, isLive, toasts,
  onApprovePrd, approvingPrd, approvedPrdId,
  chatMode = "ai-chat", onChatModeChange, sourceFiles,
  buildStages, buildProgress, buildComplete, buildError, deployUrls,
  bubbles, onRemoveBubble, streamingText, updatedFiles,
  terminalLines = [], onClearTerminal,
  taskItems, onRetryTask,
}: Props) {
  const [frameMode, setFrameMode] = useState<FrameMode>("desktop");
  const [activeMode, setActiveMode] = useState<ActiveMode>("build");
  const [chatWidth, setChatWidth] = useState(400);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [showFiles, setShowFiles] = useState(true);
  const [rightPanel, setRightPanel] = useState<"preview" | "code">("preview");
  const [showTerminal, setShowTerminal] = useState(false);

  const projectName = project?.name || "Novo Projeto";
  const files = sourceFiles || project?.source_files_json || {};
  const hasFiles = Object.keys(files).length > 0;

  // Auto-select first file if none selected
  useEffect(() => {
    if (!selectedFile && hasFiles) {
      const firstFile = Object.keys(files).find(f => f.endsWith(".tsx") || f.endsWith(".ts")) || Object.keys(files)[0];
      if (firstFile) setSelectedFile(firstFile);
    }
  }, [files, selectedFile, hasFiles]);

  // Auto-show terminal on errors
  useEffect(() => {
    if (terminalLines.some(l => l.type === "error")) setShowTerminal(true);
  }, [terminalLines]);

  const handleSend = useCallback((msg: string) => {
    if (chatMode === "ai-chat") onSendChat(msg);
    else onSendMsg(msg);
  }, [chatMode, onSendMsg, onSendChat]);

  const handleClear = useCallback(() => {}, []);

  const errorCount = terminalLines.filter(l => l.type === "error").length;
  const fileCount = Object.keys(files).length;

  return (
    <div className="sp-root dark">
      <SplitTopBar
        projectName={projectName}
        frameMode={frameMode}
        onFrameChange={setFrameMode}
        editorMode="split"
        onEditorModeChange={onEditorModeChange}
        isLive={isLive}
        onPublish={() => {}}
        onHistoryClick={() => {}}
        onShareClick={() => {}}
        rightPanel={rightPanel}
        onRightPanelChange={setRightPanel}
        showFiles={showFiles}
        onToggleFiles={() => setShowFiles(p => !p)}
        fileCount={fileCount}
      />

      <div className="sp-body">
        {/* Chat panel */}
        <div style={{ width: chatWidth, flexShrink: 0 }}>
          <SplitChatPanel
            messages={chatMessages}
            onSend={handleSend}
            isGenerating={chatLoading}
            activeMode={activeMode}
            setActiveMode={setActiveMode}
            onClear={handleClear}
            onApprovePrd={onApprovePrd}
            approvingPrd={approvingPrd}
            approvedPrdId={approvedPrdId}
            chatMode={chatMode}
            onChatModeChange={onChatModeChange}
            buildStages={buildStages}
            buildProgress={buildProgress}
            buildComplete={buildComplete}
            buildError={buildError}
            deployUrls={deployUrls}
            projectName={projectName}
            bubbles={bubbles}
            onRemoveBubble={onRemoveBubble}
            streamingText={streamingText}
            updatedFiles={updatedFiles}
            taskItems={taskItems}
            onRetryTask={onRetryTask}
          />
        </div>

        {/* File sidebar — between chat and preview */}
        {showFiles && hasFiles && (
          <div className="sp-file-sidebar">
            <FileExplorer files={files} selectedFile={selectedFile} onSelectFile={(f) => { setSelectedFile(f); setRightPanel("code"); }} />
          </div>
        )}

        <SplitResizer onResize={setChatWidth} currentWidth={chatWidth} />

        {/* Right side: preview/code + terminal */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* Main content */}
          <div style={{ flex: 1, minHeight: 0 }}>
            {rightPanel === "preview" ? (
              <SplitPreviewPanel frameMode={frameMode} previewHtml={previewHtml} livePreviewUrl={livePreviewUrl} />
            ) : (
              <CodeViewer
                files={files}
                selectedFile={selectedFile}
                onSelectFile={setSelectedFile}
                onSwitchToPreview={() => setRightPanel("preview")}
              />
            )}
          </div>

          {/* Terminal */}
          {showTerminal && (
            <TerminalPanel
              lines={terminalLines}
              onClear={onClearTerminal}
              onToggle={() => setShowTerminal(false)}
            />
          )}

          {/* Status bar */}
          <div className="sp-bottom-bar">
            <div className="sp-bb-left">
              <button className={`sp-bb-btn ${showTerminal ? "on" : ""}`} onClick={() => setShowTerminal(p => !p)}>
                <Terminal size={10} />
                Terminal
                {terminalLines.length > 0 && (
                  <span style={{ fontFamily: "var(--mono)" }}>({terminalLines.length})</span>
                )}
              </button>
              {errorCount > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: 3, color: "var(--red-l)" }}>
                  <AlertCircle size={10} /> {errorCount} erro(s)
                </span>
              )}
            </div>
            <div className="sp-bb-right">
              {chatLoading && (
                <span style={{ color: "var(--indigo-l)", display: "flex", alignItems: "center", gap: 4 }}>
                  <span className="stat-dot" style={{ background: "var(--indigo)", width: 4, height: 4 }} />
                  Gerando...
                </span>
              )}
              {buildComplete && (
                <span style={{ color: "var(--green-l)", display: "flex", alignItems: "center", gap: 4 }}>
                  <CheckCircle2 size={10} /> Build completo
                </span>
              )}
              <span style={{ fontFamily: "var(--mono)" }}>{fileCount} arquivo(s)</span>
              {selectedFile && (
                <span style={{ fontFamily: "var(--mono)", color: "var(--indigo-l)" }}>{selectedFile}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <EditorToasts toasts={toasts} />
    </div>
  );
}
