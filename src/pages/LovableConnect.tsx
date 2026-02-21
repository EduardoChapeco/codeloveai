import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLovableProxy } from "@/hooks/useLovableProxy";
import AppLayout from "@/components/AppLayout";
import { toast } from "sonner";
import { Loader2, Check, X, Unlink, ShieldCheck, Zap, RefreshCw, Plug, FolderOpen, Eye } from "lucide-react";

export default function LovableConnect() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { saveToken, deleteToken, checkConnection } = useLovableProxy();

  const [saving, setSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"active" | "expired" | "none" | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [lastVerified, setLastVerified] = useState<string | null>(null);
  const [extensionDetected, setExtensionDetected] = useState(false);
  const [autoCapturing, setAutoCapturing] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login?returnTo=/lovable/connect");
  }, [user, authLoading, navigate]);

  // Check connection status
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const status = await checkConnection(user.id);
      setConnectionStatus(status);
      if (status === "active") {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data } = await supabase
          .from("lovable_accounts")
          .select("last_verified_at")
          .eq("user_id", user.id)
          .maybeSingle();
        setLastVerified(data?.last_verified_at || null);
      }
      setLoadingAccount(false);
    };
    load();
  }, [user, checkConnection]);

  // ─── handleAutoToken must be declared before the useEffects that use it ───
  const handleAutoToken = useCallback(async (token: string) => {
    if (saving || connectionStatus === "active") return;
    setSaving(true);
    try {
      await saveToken(token);
      toast.success("Conta conectada automaticamente!");
      setConnectionStatus("active");
      setLastVerified(new Date().toISOString());
    } catch (err: unknown) {
      toast.error((err as { message?: string })?.message || "Erro ao salvar token.");
    } finally {
      setSaving(false);
    }
  }, [saving, connectionStatus, saveToken]);

  // Listen for token from extension via postMessage
  // NOTE: The extension content.js runs on lovable.dev (different origin) so we CANNOT
  // block by origin — we need to accept messages from any trusted source.
  useEffect(() => {
    const ALLOWED_ORIGINS = [
      window.location.origin,
      "https://lovable.dev",
      "https://www.lovable.dev",
    ];
    const handler = (event: MessageEvent) => {
      // Accept from same origin OR known Lovable origins
      if (event.origin && !ALLOWED_ORIGINS.includes(event.origin) && !event.origin.endsWith(".lovable.dev")) {
        return;
      }
      if (event.data?.type === "clf_lovable_token" && event.data.token) {
        handleAutoToken(event.data.token);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [connectionStatus, saving, handleAutoToken]);

  // Detect extension presence via clf_pong or clf_extension_ready message
  useEffect(() => {
    const handleExtensionPresence = (event: MessageEvent) => {
      if (event.data?.type === "clf_pong" || event.data?.type === "clf_extension_ready" || event.data?.type === "clf_lovable_token") {
        setExtensionDetected(true);
      }
    };
    window.addEventListener("message", handleExtensionPresence);

    const detectExtension = () => {
      // Check flag set by content.js if running on same page
      if ((window as unknown as { __codeloveAI?: boolean }).__codeloveAI) {
        setExtensionDetected(true);
        return;
      }
      // Send ping — content.js responds with clf_pong
      window.postMessage({ type: "clf_ping" }, "*");
    };
    
    // Try immediately and after a short delay  
    detectExtension();
    const t = setTimeout(detectExtension, 800);
    return () => {
      clearTimeout(t);
      window.removeEventListener("message", handleExtensionPresence);
    };
  }, []);


  const requestTokenFromExtension = useCallback(() => {
    setAutoCapturing(true);
    // Use "*" so the content.js on lovable.dev can receive the request
    window.postMessage({ type: "clf_request_lovable_token" }, "*");
    setTimeout(() => setAutoCapturing(false), 5000);
  }, []);

  const handleDisconnect = async () => {
    if (!confirm("Desconectar sua conta Lovable?")) return;
    setDisconnecting(true);
    try {
      await deleteToken();
      setConnectionStatus("none");
      setLastVerified(null);
      toast.success("Conta desconectada.");
    } catch {
      toast.error("Erro ao desconectar.");
    } finally {
      setDisconnecting(false);
    }
  };

  if (authLoading || !user) return <div className="min-h-screen bg-background" />;

  const isConnected = connectionStatus === "active";
  const isExpired = connectionStatus === "expired";

  return (
    <AppLayout>
      <div className="max-w-xl mx-auto px-6 py-10">
        <p className="lv-overline mb-1">Integração</p>
        <h1 className="lv-heading-lg mb-2">Lovable Connect</h1>
        <p className="lv-caption mb-8">
          Gerencie projetos, deploys e previews conectando automaticamente via extensão.
        </p>

        {loadingAccount ? (
          <div className="text-center py-20">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : isConnected ? (
          <div className="space-y-5">
            <div className="lv-card flex items-center gap-4">
              <div className="h-11 w-11 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                <Check className="h-5 w-5 text-green-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="lv-body-strong">Conectado com sucesso</p>
                <p className="lv-caption">
                  {lastVerified
                    ? `Verificado em ${new Date(lastVerified).toLocaleString("pt-BR")}`
                    : "Token ativo"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => navigate("/lovable/projects")}
                className="lv-card-sm text-center hover:bg-accent/50 transition-colors cursor-pointer"
              >
                <FolderOpen className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="lv-body-strong text-sm">Meus Projetos</p>
                <p className="lv-caption text-xs">Gerenciar e fazer deploys</p>
              </button>
              <button
                onClick={() => navigate("/lovable/preview")}
                className="lv-card-sm text-center hover:bg-accent/50 transition-colors cursor-pointer"
              >
                <Eye className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="lv-body-strong text-sm">Preview</p>
                <p className="lv-caption text-xs">Visualizar projetos ao vivo</p>
              </button>
            </div>

            <div className="lv-card-sm bg-accent/50 flex items-start gap-3">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p className="lv-caption">
                Seu token é armazenado de forma segura no servidor e <strong className="text-foreground">nunca</strong> é exposto no navegador após salvo.
              </p>
            </div>

            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="lv-btn-secondary w-full h-11 flex items-center justify-center gap-2 text-destructive hover:bg-destructive/10"
            >
              {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
              Desconectar conta
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {isExpired && (
              <div className="lv-card-sm bg-destructive/10 border-destructive/20 flex items-start gap-3">
                <X className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="lv-caption text-destructive">
                  Token expirado. Acesse <strong>lovable.dev</strong> com a extensão ativa para reconectar automaticamente.
                </p>
              </div>
            )}

            <div className="lv-card space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="lv-body-strong">Conexão Automática</p>
                  <p className="lv-caption">A extensão captura e sincroniza tudo automaticamente</p>
                </div>
              </div>

              {extensionDetected ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-500">
                    <Plug className="h-4 w-4" />
                    <span className="text-sm font-medium">Extensão detectada</span>
                  </div>
                  <p className="lv-caption">
                    Acesse <strong className="text-foreground">lovable.dev</strong> em outra aba e faça qualquer ação. A extensão capturará o token automaticamente.
                  </p>
                  <button
                    onClick={requestTokenFromExtension}
                    disabled={autoCapturing || saving}
                    className="lv-btn-primary w-full h-11 flex items-center justify-center gap-2"
                  >
                    {autoCapturing || saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    {saving ? "Conectando..." : autoCapturing ? "Buscando token..." : "Capturar token agora"}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="lv-caption">
                    Instale a extensão CodeLove AI para conectar automaticamente.
                  </p>
                  <button
                    onClick={() => navigate("/install")}
                    className="lv-btn-primary w-full h-11 flex items-center justify-center gap-2"
                  >
                    <Plug className="h-4 w-4" />
                    Instalar extensão
                  </button>
                </div>
              )}
            </div>

            <div className="lv-card-sm bg-accent/50 space-y-3">
              <p className="lv-body-strong text-sm">Como funciona</p>
              <ol className="lv-caption space-y-1.5 list-decimal list-inside">
                <li>Instale a extensão <strong className="text-foreground">CodeLove AI</strong></li>
                <li>Acesse <strong className="text-foreground">lovable.dev</strong> normalmente</li>
                <li>A extensão captura e envia o token <strong className="text-foreground">automaticamente</strong></li>
                <li>Pronto — gerencie projetos, deploys e previews</li>
              </ol>
            </div>

            <div className="lv-card-sm bg-accent/50 flex items-start gap-3">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p className="lv-caption">
                O token é verificado antes de ser salvo e <strong className="text-foreground">nunca retorna ao navegador</strong> — todas as chamadas são feitas pelo proxy seguro.
              </p>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
