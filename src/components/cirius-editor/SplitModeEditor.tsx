import { useState, useCallback } from "react";
import SplitTopBar from "./SplitTopBar";
import SplitChatPanel from "./SplitChatPanel";
import SplitResizer from "./SplitResizer";
import SplitPreviewPanel from "./SplitPreviewPanel";
import EditorToasts from "./EditorToasts";
import type { FrameMode, ActiveMode, EditorToast, ChatMessage } from "./types";
import type { EditorMode } from "./SplitTopBar";

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
}

export default function SplitModeEditor({
  project, previewHtml, livePreviewUrl,
  chatMessages, chatLoading, onSendMsg, onSendChat,
  onEditorModeChange, isLive, toasts,
}: Props) {
  const [frameMode, setFrameMode] = useState<FrameMode>("desktop");
  const [activeMode, setActiveMode] = useState<ActiveMode>("build");
  const [chatWidth, setChatWidth] = useState(400);
  const [isGenerating, setIsGenerating] = useState(false);

  const projectName = project?.name || "Novo Projeto";

  const handleSend = useCallback((msg: string) => {
    setIsGenerating(true);
    onSendMsg(msg);
    // Reset after timeout (the parent will handle actual completion)
    setTimeout(() => setIsGenerating(false), 3000);
  }, [onSendMsg]);

  const handleClear = useCallback(() => {
    // Parent handles clearing
  }, []);

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
        <div style={{ width: chatWidth, flexShrink: 0 }}>
          <SplitChatPanel
            messages={chatMessages}
            onSend={handleSend}
            isGenerating={isGenerating || chatLoading}
            activeMode={activeMode}
            setActiveMode={setActiveMode}
            onClear={handleClear}
          />
        </div>

        <SplitResizer onResize={setChatWidth} currentWidth={chatWidth} />

        <SplitPreviewPanel
          frameMode={frameMode}
          previewHtml={previewHtml}
          livePreviewUrl={livePreviewUrl}
        />
      </div>

      <EditorToasts toasts={toasts} />
    </div>
  );
}
