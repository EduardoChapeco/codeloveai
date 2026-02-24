import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Globe, Search, Code2, Loader2, X, ExternalLink, Sparkles, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * StarCrawlModal
 *
 * Modal that allows the user to:
 * 1. Paste a URL → Scrape it via the `starcrawl` edge function
 * 2. Review the extracted content summary
 * 3. Auto-generate a Lovable-ready prompt (generate_prompt action)
 * 4. Optionally send the generated prompt as a chat message to the
 *    OrchestratorProjectPanel by calling onUsePrompt()
 */

interface StarCrawlModalProps {
  projectId: string;
  onUsePrompt: (prompt: string) => void;
  onClose: () => void;
}

type CrawlAction = "scrape" | "generate_prompt" | "search";

interface CrawlResult {
  action: CrawlAction;
  url: string;
  content?: string;
  prompt?: string;
  title?: string;
  file_count?: number;
}

export default function StarCrawlModal({ projectId, onUsePrompt, onClose }: StarCrawlModalProps) {
  const [url, setUrl]           = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [action, setAction]     = useState<CrawlAction>("generate_prompt");
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<CrawlResult | null>(null);
  const [showRaw, setShowRaw]   = useState(false);
  const urlRef = useRef<HTMLInputElement>(null);

  const run = useCallback(async () => {
    const targetUrl = action === "search" ? searchQuery.trim() : url.trim();
    if (!targetUrl) {
      toast.error("Informe uma URL ou termo de pesquisa");
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const body =
        action === "search"
          ? { action, options: { query: searchQuery.trim(), limit: 5 } }
          : { action, url: targetUrl };

      const { data, error } = await supabase.functions.invoke("starcrawl", { body });

      if (error) throw error;
      if (!(data as { ok?: boolean })?.ok) throw new Error((data as { error?: string })?.error || "Erro desconhecido");

      const d = data as {
        ok: boolean;
        action: CrawlAction;
        data: {
          markdown?: string;
          html?: string;
          metadata?: { title?: string };
          prompt?: string;
          files?: { url: string }[];
        };
      };

      setResult({
        action,
        url: targetUrl,
        content:    d.data?.markdown || d.data?.html || JSON.stringify(d.data, null, 2),
        prompt:     d.data?.prompt,
        title:      d.data?.metadata?.title,
        file_count: d.data?.files?.length,
      });

      toast.success(
        action === "generate_prompt"
          ? "Prompt Lovable gerado!"
          : action === "search"
          ? "Pesquisa concluída!"
          : "Página extraída com sucesso!"
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [action, url, searchQuery]);

  const usePrompt = () => {
    const text = result?.prompt || result?.content || "";
    if (!text) return;
    onUsePrompt(text);
    onClose();
    toast.success("Prompt enviado para o chat!");
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-2xl rounded-2xl bg-background border border-border shadow-2xl flex flex-col max-h-[90vh]"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border/60 shrink-0">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Globe className="h-4.5 w-4.5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm font-semibold">StarCrawl</p>
              <p className="text-[11px] text-muted-foreground">Extrai site e gera prompt Lovable</p>
            </div>
            <button
              onClick={onClose}
              className="ml-auto h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Action tabs */}
          <div className="flex items-center gap-1 px-5 pt-4 pb-2 shrink-0">
            {([
              { id: "generate_prompt", label: "Gerar Prompt", icon: Sparkles },
              { id: "scrape",          label: "Extrair Página", icon: Code2 },
              { id: "search",          label: "Pesquisar Web",  icon: Search },
            ] as { id: CrawlAction; label: string; icon: typeof Globe }[]).map(tab => (
              <button
                key={tab.id}
                onClick={() => { setAction(tab.id); setResult(null); }}
                className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-colors ${
                  action === tab.id
                    ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                    : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="px-5 pb-4 shrink-0">
            {action === "search" ? (
              <div className="flex gap-2">
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && run()}
                  placeholder="Pesquisar na web... (ex: CRM SaaS landing page)"
                  className="flex-1 h-10 px-3 rounded-xl bg-muted/40 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
                <button
                  onClick={run}
                  disabled={loading}
                  className="h-10 px-4 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-40 transition-colors flex items-center gap-1.5"
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                  Pesquisar
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 h-10 px-3 rounded-xl bg-muted/40 border border-border focus-within:ring-2 focus-within:ring-emerald-500/30">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <input
                    ref={urlRef}
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && run()}
                    placeholder="https://exemplo.com"
                    className="flex-1 bg-transparent text-sm focus:outline-none"
                  />
                  {url && (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <button
                  onClick={run}
                  disabled={loading}
                  className="h-10 px-4 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-40 transition-colors flex items-center gap-1.5"
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
                  {action === "generate_prompt" ? "Gerar" : "Extrair"}
                </button>
              </div>
            )}
            {action === "generate_prompt" && (
              <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
                Extrai o conteúdo e gera um prompt pronto para enviar ao Lovable via orquestrador
              </p>
            )}
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 shrink-0">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
              <p className="text-sm text-muted-foreground">
                {action === "generate_prompt" ? "Extraindo e gerando prompt…" : action === "search" ? "Pesquisando…" : "Extraindo página…"}
              </p>
            </div>
          )}

          {/* Result */}
          {result && !loading && (
            <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
              {/* Meta */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                <Globe className="h-4 w-4 text-emerald-500 shrink-0" />
                <div className="min-w-0">
                  {result.title && <p className="text-xs font-medium truncate">{result.title}</p>}
                  <p className="text-[10px] text-muted-foreground truncate">{result.url}</p>
                </div>
                {result.file_count !== undefined && (
                  <span className="ml-auto text-[10px] bg-muted px-2 py-0.5 rounded-full">{result.file_count} páginas</span>
                )}
              </div>

              {/* Prompt result */}
              {result.prompt && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-emerald-600">Prompt Lovable gerado</p>
                    <button
                      onClick={() => { navigator.clipboard.writeText(result.prompt || ""); toast.success("Copiado!"); }}
                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Copiar
                    </button>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs leading-relaxed font-mono whitespace-pre-wrap max-h-52 overflow-y-auto">
                    {result.prompt}
                  </div>
                </div>
              )}

              {/* Raw content toggle */}
              {result.content && (
                <div>
                  <button
                    onClick={() => setShowRaw(r => !r)}
                    className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showRaw ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {showRaw ? "Ocultar" : "Ver"} conteúdo extraído
                  </button>
                  {showRaw && (
                    <div className="mt-2 p-3 rounded-xl bg-muted/30 border border-border text-xs leading-relaxed max-h-48 overflow-y-auto prose prose-xs dark:prose-invert">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.content.slice(0, 4000)}</ReactMarkdown>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Footer buttons */}
          {result && !loading && (
            <div className="px-5 pb-4 border-t border-border/60 pt-3 flex justify-end gap-2 shrink-0">
              <button
                onClick={onClose}
                className="h-9 px-4 rounded-xl bg-muted text-sm font-medium hover:bg-muted/70 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={usePrompt}
                className="h-9 px-4 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors flex items-center gap-2"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Usar no Chat
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
