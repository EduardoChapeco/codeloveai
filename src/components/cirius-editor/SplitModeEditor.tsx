import { useState, useCallback } from "react";
import SplitTopBar from "./SplitTopBar";
import SplitChatPanel from "./SplitChatPanel";
import SplitResizer from "./SplitResizer";
import SplitPreviewPanel from "./SplitPreviewPanel";
import EditorToasts from "./EditorToasts";
import FileExplorer from "./FileExplorer";
import type { FrameMode, ActiveMode, EditorToast, ChatMessage } from "./types";
import type { EditorMode } from "./SplitTopBar";
import type { BuildStage } from "./BuildProgressCard";

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
}

export default function SplitModeEditor({
  project, previewHtml, livePreviewUrl,
  chatMessages, chatLoading, onSendMsg, onSendChat,
  onEditorModeChange, isLive, toasts,
  onApprovePrd, approvingPrd, approvedPrdId,
  chatMode = "ai-chat", onChatModeChange, sourceFiles,
  buildStages, buildProgress, buildComplete, buildError, deployUrls,
}: Props) {
  const [frameMode, setFrameMode] = useState<FrameMode>("desktop");
  const [activeMode, setActiveMode] = useState<ActiveMode>("build");
  const [chatWidth, setChatWidth] = useState(400);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [showFiles, setShowFiles] = useState(false);

  const projectName = project?.name || "Novo Projeto";
  const files = sourceFiles || project?.source_files_json || {};
  const hasFiles = Object.keys(files).length > 0;

  const handleSend = useCallback((msg: string) => {
    if (chatMode === "ai-chat") {
      onSendChat(msg);
    } else {
      onSendMsg(msg);
    }
  }, [chatMode, onSendMsg, onSendChat]);

  const handleClear = useCallback(() => {}, []);

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
      />

      <div className="sp-body">
        {showFiles && hasFiles && (
          <div className="sp-file-sidebar">
            <FileExplorer files={files} selectedFile={selectedFile} onSelectFile={setSelectedFile} />
          </div>
        )}

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
          />
        </div>

        <SplitResizer onResize={setChatWidth} currentWidth={chatWidth} />

        <SplitPreviewPanel frameMode={frameMode} previewHtml={previewHtml} livePreviewUrl={livePreviewUrl} />
      </div>

      <EditorToasts toasts={toasts} />
    </div>
  );
}
