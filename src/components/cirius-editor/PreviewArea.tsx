import { Sparkles } from "lucide-react";
import type { FrameMode } from "@/pages/CiriusEditor";

interface Props {
  frameMode: FrameMode;
  previewHtml: string | null;
}

export default function PreviewArea({ frameMode, previewHtml }: Props) {
  return (
    <div className={`ce-preview-wrap ${frameMode}`}>
      <div className="ce-preview-outer">
        {previewHtml ? (
          <iframe className="ce-preview-iframe" srcDoc={previewHtml} sandbox="allow-scripts allow-same-origin" />
        ) : (
          <div className="ce-empty">
            <div className="ce-empty-ico">
              <Sparkles size={22} className="text-[var(--indigo-l)]" />
            </div>
            <div className="ce-empty-title">Cirius Editor</div>
            <div className="ce-empty-sub">Digite sua ideia no campo abaixo</div>
          </div>
        )}
      </div>
    </div>
  );
}
