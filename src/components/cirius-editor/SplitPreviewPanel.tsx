import { useState } from "react";
import { RefreshCw, ExternalLink, Search, Sparkles, Layers } from "lucide-react";
import type { FrameMode } from "./types";

interface Props {
  frameMode: FrameMode;
  previewHtml: string | null;
  livePreviewUrl?: string | null;
  isLoading?: boolean;
  loadingPct?: number;
}

export default function SplitPreviewPanel({ frameMode, previewHtml, livePreviewUrl, isLoading, loadingPct = 0 }: Props) {
  const [iframeKey, setIframeKey] = useState(0);
  const [inspectMode, setInspectMode] = useState(false);

  const reload = () => setIframeKey(k => k + 1);
  const hasLiveUrl = !!livePreviewUrl;
  const hasContent = hasLiveUrl || !!previewHtml;
  const previewUrlText = livePreviewUrl
    ? livePreviewUrl.replace("https://", "").slice(0, 40)
    : "cirius.app/preview";

  return (
    <div className="sp-preview-panel">
      {/* Toolbar */}
      <div className="sp-preview-toolbar">
        <div className="sp-pt-left">
          <button className="gl ico xs" onClick={reload} title="Recarregar">
            <RefreshCw size={11} />
          </button>
        </div>

        <div className="sp-pt-url">
          <span className="sp-pt-url-dot" />
          <span className="sp-pt-url-text">{previewUrlText}</span>
        </div>

        <div className="sp-pt-right">
          {hasLiveUrl && (
            <a href={livePreviewUrl!} target="_blank" rel="noopener noreferrer" className="gl ico xs" title="Abrir em nova aba">
              <ExternalLink size={11} />
            </a>
          )}
          <button
            className={`gl ico xs ${inspectMode ? "blue" : ""}`}
            onClick={() => setInspectMode(!inspectMode)}
            title="Inspecionar"
          >
            <Search size={11} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={`sp-preview-content ${frameMode}`}>
        <div className="sp-preview-outer">
          {/* Loading overlay */}
          {isLoading && (
            <div className="sp-preview-loading">
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Gerando preview...</span>
              <div className="sp-ld-bar">
                <div className="sp-ld-fill" style={{ width: `${loadingPct}%` }} />
              </div>
            </div>
          )}

          {/* Empty state */}
          {!hasContent && !isLoading && (
            <div className="sp-preview-empty">
              <div className="sp-pg-grid" />
              <div className="sp-empty-glow" />
              <div className="sp-empty-icon">
                <Layers size={20} style={{ color: "var(--indigo-l)" }} />
              </div>
              <div className="sp-empty-text">
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Nenhum preview ainda</div>
                <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 6 }}>Envie uma mensagem para começar</div>
              </div>
            </div>
          )}

          {/* Live iframe */}
          {hasLiveUrl && (
            <iframe
              key={iframeKey}
              className="sp-preview-iframe"
              src={livePreviewUrl!}
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              title="Live Preview"
            />
          )}

          {/* Static srcDoc fallback */}
          {!hasLiveUrl && previewHtml && (
            <iframe
              key={iframeKey}
              className="sp-preview-iframe"
              srcDoc={previewHtml}
              sandbox="allow-scripts"
              title="Static Preview"
            />
          )}
        </div>
      </div>
    </div>
  );
}
