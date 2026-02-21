import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLovableProxy } from "@/hooks/useLovableProxy";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
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
      const tokenData = await invoke({ route: `/projects/${projectId}/auth-token` });
      const token = tokenData?.token || tokenData?.auth_token || "";

      const sandboxData = await invoke({ route: `/projects/${projectId}/sandbox/url` });
      const url = sandboxData?.url || sandboxData?.sandbox_url || "";

      if (!url) {
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
      <AppLayout>
      <div className="min-h-screen bg-background">
        <div className="max-w-xl mx-auto px-6 py-20 text-center">
          <p className="lv-overline mb-2">Não conectado</p>
          <p className="lv-body mb-6">Conecte sua conta Lovable primeiro.</p>
          <button onClick={() => navigate("/lovable/connect")} className="lv-btn-primary h-11 px-8 text-sm">Conectar</button>
        </div>
      </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col">
        <div className="border-b border-border/60 px-6 py-3 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Monitor className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="ID do projeto Lovable (UUID)"
              className="lv-input flex-1 h-9 font-mono text-sm"
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
              <p className="lv-body">Insira o ID do projeto e clique em Carregar</p>
            </div>
          </div>
        )}
      </div>
    </div>
    </AppLayout>
  );
}
