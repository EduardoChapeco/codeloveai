import { useState } from "react";
import { Sparkles, RefreshCw, ExternalLink } from "lucide-react";
import type { FrameMode } from "@/components/cirius-editor/types";

interface Props {
  frameMode: FrameMode;
  previewHtml: string | null;
  /** Live preview URL from Lovable project (real-time, pre-deploy) */
  livePreviewUrl?: string | null;
}

export default function PreviewArea({ frameMode, previewHtml, livePreviewUrl }: Props) {
  const [iframeKey, setIframeKey] = useState(0);

  const reload = () => setIframeKey(k => k + 1);

  // Priority: live URL > srcDoc > empty
  const hasLiveUrl = !!livePreviewUrl;
  const hasContent = hasLiveUrl || !!previewHtml;

  return (
    <div className={`ce-preview-wrap ${frameMode}`}>
      <div className="ce-preview-outer">
        {hasContent && (
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5">
            {hasLiveUrl && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-medium backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
            )}
            <button
              onClick={reload}
              className="p-1 rounded bg-black/40 hover:bg-black/60 text-white/60 hover:text-white/90 backdrop-blur-sm transition-colors"
              title="Recarregar preview"
            >
              <RefreshCw size={12} />
            </button>
            {hasLiveUrl && (
              <a
                href={livePreviewUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 rounded bg-black/40 hover:bg-black/60 text-white/60 hover:text-white/90 backdrop-blur-sm transition-colors"
                title="Abrir em nova aba"
              >
                <ExternalLink size={12} />
              </a>
            )}
          </div>
        )}

        {hasLiveUrl ? (
          <iframe
            key={iframeKey}
            className="ce-preview-iframe"
            src={livePreviewUrl!}
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            title="Live Preview"
          />
        ) : previewHtml ? (
          <iframe
            key={iframeKey}
            className="ce-preview-iframe"
            srcDoc={previewHtml}
            sandbox="allow-scripts"
            title="Static Preview"
          />
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
