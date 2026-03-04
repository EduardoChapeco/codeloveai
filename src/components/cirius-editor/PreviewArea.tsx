import { useState, useEffect } from "react";
import { Sparkles, RefreshCw, ExternalLink, AlertTriangle } from "lucide-react";
import type { FrameMode } from "@/components/cirius-editor/types";

interface Props {
  frameMode: FrameMode;
  previewHtml: string | null;
  livePreviewUrl?: string | null;
}

export default function PreviewArea({ frameMode, previewHtml, livePreviewUrl }: Props) {
  const [iframeKey, setIframeKey] = useState(0);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const reload = () => { setIframeKey(k => k + 1); setPreviewError(null); };

  // Listen for preview errors from iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "cirius-preview-error") {
        const errMsg = String(e.data.error || "");
        // Skip generic cross-origin "Script error." — not actionable
        if (errMsg === "Script error." || errMsg === "Script error" || !errMsg.trim()) return;
        setPreviewError(`${errMsg} (${e.data.source || "unknown"}:${e.data.line || "?"})`);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Clear errors and force iframe remount on new preview
  useEffect(() => { setPreviewError(null); setIframeKey(k => k + 1); }, [previewHtml, livePreviewUrl]);

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

        {/* Error overlay */}
        {previewError && (
          <div className="absolute bottom-0 left-0 right-0 z-20 bg-red-950/90 border-t-2 border-red-500 text-red-200 px-4 py-3 font-mono text-xs max-h-[30vh] overflow-auto backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
              <span className="font-semibold text-red-300">Preview Error</span>
              <button onClick={reload} className="ml-auto text-red-400 hover:text-red-200 text-[10px] px-2 py-0.5 rounded border border-red-700 hover:border-red-500">Reload</button>
            </div>
            <div className="text-red-100/80">{previewError}</div>
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
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            allow="cross-origin-isolated"
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
