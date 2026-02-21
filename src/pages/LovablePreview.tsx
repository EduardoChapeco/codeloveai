import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLovableProxy } from "@/hooks/useLovableProxy";
import { supabase } from "@/integrations/supabase/client";
import AppNav from "@/components/AppNav";
import { toast } from "sonner";
import { Loader2, ExternalLink, RefreshCw, Copy, Monitor } from "lucide-react";

export default function LovablePreview() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { invoke } = useLovableProxy();

  const [projectId, setProjectId] = useState(searchParams.get("projectId") || "");
  const [sandboxUrl, setSandboxUrl] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login?returnTo=/lovable/preview");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    const check = async () => {
      const { data } = await supabase
        .from("lovable_accounts")
        .select("status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      setConnected(!!data);
    };
    check();
  }, [user]);

  const loadPreview = async () => {
    if (!projectId.trim()) return toast.error("Insira o ID do projeto.");
    setLoading(true);
    setSandboxUrl(null);
    setAuthToken(null);

    try {
      // Get auth token
      const tokenData = await invoke({ route: `/projects/${projectId}/auth-token` });
      const token = tokenData?.token || tokenData?.auth_token || "";

      // Get sandbox URL
      const sandboxData = await invoke({ route: `/projects/${projectId}/sandbox/url` });
      const url = sandboxData?.url || sandboxData?.sandbox_url || "";

      if (!url) {
        // Try starting sandbox
        await invoke({ route: `/projects/${projectId}/sandbox/start`, method: "POST" });
        const retryData = await invoke({ route: `/projects/${projectId}/sandbox/url` });
        const retryUrl = retryData?.url || retryData?.sandbox_url || "";
        if (retryUrl) {
          setSandboxUrl(retryUrl);
          setAuthToken(token);
        } else {
          toast.error("Não foi possível obter a URL do sandbox.");
        }
      } else {
        setSandboxUrl(url);
        setAuthToken(token);
      }
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "Falha ao carregar preview"));
    } finally {
      setLoading(false);
    }
  };

  const fullUrl = sandboxUrl && authToken
    ? `${sandboxUrl}/?__lovable_token=${authToken}`
    : sandboxUrl || "";

  if (authLoading || !user) return <div className="min-h-screen bg-background" />;

  if (connected === false) {
    return (
      <div className="min-h-screen bg-background">
        <AppNav />
        <div className="max-w-xl mx-auto px-8 py-20 text-center">
          <p className="ep-subtitle mb-2">NÃO CONECTADO</p>
          <p className="text-sm text-muted-foreground mb-6">Conecte sua conta Lovable primeiro.</p>
          <button onClick={() => navigate("/lovable/connect")} className="ep-btn-primary h-11 px-8">CONECTAR</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppNav />
      <div className="flex-1 flex flex-col">
        {/* Controls */}
        <div className="border-b border-border px-8 py-4 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Monitor className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="ID do projeto Lovable (UUID)"
              className="flex-1 bg-muted/50 border border-border/50 rounded-[10px] px-4 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/20"
            />
          </div>
          <button
            onClick={loadPreview}
            disabled={loading || !projectId.trim()}
            className="ep-btn-primary h-9 px-5 text-[9px] flex items-center gap-1.5 disabled:opacity-40"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            CARREGAR
          </button>
          {fullUrl && (
            <>
              <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="ep-btn-secondary h-9 px-4 text-[9px] flex items-center gap-1.5">
                <ExternalLink className="h-3 w-3" /> NOVA ABA
              </a>
              <button onClick={() => { navigator.clipboard.writeText(fullUrl); toast.success("Link copiado!"); }} className="ep-btn-secondary h-9 px-4 text-[9px] flex items-center gap-1.5">
                <Copy className="h-3 w-3" /> COPIAR
              </button>
            </>
          )}
        </div>

        {/* Preview */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
              <p className="text-sm text-muted-foreground">Insira o ID do projeto e clique em Carregar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
