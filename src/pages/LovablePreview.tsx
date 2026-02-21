import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLovableProxy } from "@/hooks/useLovableProxy";
import AppLayout from "@/components/AppLayout";
import { toast } from "sonner";
import { Loader2, ExternalLink, RefreshCw, Copy, Monitor, Link2, AlertTriangle } from "lucide-react";

export default function LovablePreview() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { invoke, checkConnection } = useLovableProxy();

  const [projectId, setProjectId] = useState(searchParams.get("projectId") || "");
  const [sandboxUrl, setSandboxUrl] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"active" | "expired" | "none" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login?returnTo=/lovable/preview");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    const check = async () => {
      const status = await checkConnection(user.id);
      setConnectionStatus(status);
    };
    check();
  }, [user, checkConnection]);

  const loadPreview = async () => {
    if (!projectId.trim()) return toast.error("Insira o ID do projeto.");
    setLoading(true);
    setSandboxUrl(null);
    setAuthToken(null);
    setErrorMsg(null);

    try {
      // Get auth token for the project
      const tokenData = await invoke({ route: `/projects/${projectId}/auth-token` });
      const token = tokenData?.token || tokenData?.auth_token || "";

      // Get sandbox URL
      let sandboxData = await invoke({ route: `/projects/${projectId}/sandbox/url` });
      let url = sandboxData?.url || sandboxData?.sandbox_url || "";

      // If no URL, try starting the sandbox first
      if (!url) {
        toast.info("Iniciando sandbox do projeto...");
        await invoke({ route: `/projects/${projectId}/sandbox/start`, method: "POST" });
        // Wait a moment then retry
        await new Promise(resolve => setTimeout(resolve, 2000));
        sandboxData = await invoke({ route: `/projects/${projectId}/sandbox/url` });
        url = sandboxData?.url || sandboxData?.sandbox_url || "";
      }

      if (!url) {
        setErrorMsg("Não foi possível obter a URL do sandbox. O projeto pode estar inativo ou o ID pode estar incorreto.");
        return;
      }

      setSandboxUrl(url);
      setAuthToken(token);
    } catch (err: any) {
      setErrorMsg(err?.message || "Falha ao carregar preview. Verifique o ID do projeto.");
    } finally {
      setLoading(false);
    }
  };

  const fullUrl = sandboxUrl && authToken
    ? `${sandboxUrl}/?__lovable_token=${authToken}`
    : sandboxUrl || "";

  if (authLoading || !user) return <div className="min-h-screen bg-background" />;

  if (connectionStatus === "none" || connectionStatus === "expired") {
    return (
      <AppLayout>
        <div className="max-w-xl mx-auto px-6 py-20 text-center">
          {connectionStatus === "expired" ? (
            <>
              <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
              <h2 className="lv-heading-sm mb-2">Token expirado</h2>
              <p className="lv-body mb-6">Reconecte sua conta Lovable para visualizar previews.</p>
            </>
          ) : (
            <>
              <Link2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="lv-heading-sm mb-2">Não conectado</h2>
              <p className="lv-body mb-6">Conecte sua conta Lovable primeiro.</p>
            </>
          )}
          <button onClick={() => navigate("/lovable/connect")} className="lv-btn-primary h-11 px-8 text-sm">
            {connectionStatus === "expired" ? "Reconectar" : "Conectar"}
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col" style={{ height: "calc(100vh - 3rem)" }}>
        {/* Toolbar */}
        <div className="border-b border-border/60 px-6 py-3 flex items-center gap-3 flex-wrap shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Monitor className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="ID do projeto Lovable (UUID)"
              className="lv-input flex-1 h-9 font-mono text-sm"
              onKeyDown={(e) => e.key === "Enter" && loadPreview()}
            />
          </div>
          <button
            onClick={loadPreview}
            disabled={loading || !projectId.trim()}
            className="lv-btn-primary h-9 px-4 text-xs flex items-center gap-1.5"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Carregar
          </button>
          {fullUrl && (
            <>
              <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="lv-btn-secondary h-9 px-3 text-xs flex items-center gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" /> Nova aba
              </a>
              <button onClick={() => { navigator.clipboard.writeText(fullUrl); toast.success("Link copiado!"); }} className="lv-btn-secondary h-9 px-3 text-xs flex items-center gap-1.5">
                <Copy className="h-3.5 w-3.5" /> Copiar
              </button>
            </>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="lv-caption mt-3">Carregando preview...</p>
            </div>
          </div>
        ) : errorMsg ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md px-4">
              <AlertTriangle className="h-10 w-10 mx-auto text-amber-500 mb-3" />
              <p className="lv-body-strong mb-2">Erro ao carregar</p>
              <p className="lv-caption">{errorMsg}</p>
              <button onClick={loadPreview} className="lv-btn-secondary h-9 px-4 text-xs mt-4">
                Tentar novamente
              </button>
            </div>
          </div>
        ) : fullUrl ? (
          <div className="flex-1 relative">
            <iframe
              src={fullUrl}
              className="w-full h-full border-0"
              title="Lovable Preview"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Monitor className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="lv-body-strong mb-1">Preview de Projetos</p>
              <p className="lv-caption">Insira o ID do projeto e clique em Carregar para visualizar</p>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
