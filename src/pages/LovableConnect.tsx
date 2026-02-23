import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLovableProxy } from "@/hooks/useLovableProxy";
import AppLayout from "@/components/AppLayout";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Check, X, Unlink, ShieldCheck, Zap, RefreshCw, Plug, FolderOpen, Eye, Key, Copy } from "lucide-react";

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

  // CLF1 token state
  const [clfToken, setClfToken] = useState<string | null>(null);
  const [clfExpiresAt, setClfExpiresAt] = useState<string | null>(null);
  const [generatingClf, setGeneratingClf] = useState(false);

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

  // Load existing CLF1 token
  useEffect(() => {
    if (!user) return;
    const loadClfToken = async () => {
      const { data } = await supabase
        .from("licenses")
        .select("key, expires_at")
        .eq("user_id", user.id)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        const row = data as unknown as { key: string; expires_at: string | null };
        setClfToken(row.key);
        setClfExpiresAt(row.expires_at);
      }
    };
    loadClfToken();
  }, [user]);

  // Generate CLF1 token
  const generateClfToken = useCallback(async () => {
    if (!user || generatingClf) return;
    setGeneratingClf(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-clf-token", {
        body: { plan: "pro", expiresIn: 365 * 24 * 60 * 60 * 1000 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setClfToken(data.token);
      setClfExpiresAt(data.expires_at);
      toast.success("Token CLF1 gerado com sucesso!");
    } catch (err: unknown) {
      toast.error((err as { message?: string })?.message || "Erro ao gerar token CLF1.");
    } finally {
      setGeneratingClf(false);
    }
  }, [user, generatingClf]);

  const copyToken = useCallback(() => {
    if (clfToken) {
      navigator.clipboard.writeText(clfToken);
      toast.success("Token copiado!");
    }
  }, [clfToken]);

  // handleAutoToken for Lovable connection
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
  useEffect(() => {
    const ALLOWED_ORIGINS = [
      window.location.origin,
      "https://lovable.dev",
      "https://www.lovable.dev",
    ];
    const handler = (event: MessageEvent) => {
      if (
        event.origin &&
        !ALLOWED_ORIGINS.includes(event.origin) &&
        !event.origin.endsWith(".lovable.dev")
      ) {
        return;
      }

      if (event.data?.type === "clf_lovable_token" && event.data.token) {
        console.log("[Starble] clf_lovable_token received");
        handleAutoToken(event.data.token);
        return;
      }

      if (event.data?.type === "clf_token_bridge" && event.data.idToken) {
        console.log("[Starble] clf_token_bridge received — idToken present");
        handleAutoToken(event.data.idToken);
        // Only generate CLF1 if user has no active token yet
        if (!clfToken) generateClfToken();
      }
    };
    window.addEventListener("message", handler);

    // Also listen for CustomEvent on document
    const customHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.idToken) {
        console.log("[Starble] clf_token_bridge CustomEvent received");
        handleAutoToken(detail.idToken);
        // Only generate CLF1 if user has no active token yet
        if (!clfToken) generateClfToken();
      }
    };
    document.addEventListener("clf_token_bridge", customHandler);

    return () => {
      window.removeEventListener("message", handler);
      document.removeEventListener("clf_token_bridge", customHandler);
    };
  }, [connectionStatus, saving, handleAutoToken, generateClfToken, clfToken]);

  // Detect extension presence
  useEffect(() => {
    const handleExtensionPresence = (event: MessageEvent) => {
      if (event.data?.type === "clf_pong" || event.data?.type === "clf_extension_ready" || event.data?.type === "clf_lovable_token") {
        setExtensionDetected(true);
      }
    };
    window.addEventListener("message", handleExtensionPresence);

    const detectExtension = () => {
      if ((window as unknown as { __StarbleAI?: boolean }).__StarbleAI) {
        setExtensionDetected(true);
        return;
      }
      window.postMessage({ type: "clf_ping" }, "*");
    };
    
    detectExtension();
    const t = setTimeout(detectExtension, 800);
    return () => {
      clearTimeout(t);
      window.removeEventListener("message", handleExtensionPresence);
    };
  }, []);

  const requestTokenFromExtension = useCallback(() => {
    setAutoCapturing(true);
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
        ) : (
          <div className="space-y-6">
            {/* 1. Status de conexão */}
            <div className="lv-card flex items-center gap-4">
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${isConnected ? 'bg-green-500/10' : 'bg-destructive/10'}`}>
                {isConnected ? <Check className="h-5 w-5 text-green-500" /> : <X className="h-5 w-5 text-destructive" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="lv-body-strong">{isConnected ? "Conectado com sucesso" : "Não conectado"}</p>
                <p className="lv-caption">
                  {isConnected && lastVerified
                    ? `Verificado em ${new Date(lastVerified).toLocaleString("pt-BR")}`
                    : isConnected ? "Token ativo" : "Acesse lovable.dev para conectar"}
                </p>
              </div>
              {isConnected && <span className="lv-badge lv-badge-success">Ativo</span>}
            </div>

            {/* 2. Token CLF1 da Extensão */}
            <div className="lv-card space-y-4">
              <div className="flex items-center gap-3">
                <Key className="h-5 w-5 text-primary" />
                <p className="lv-body-strong">Token CLF1 da Extensão</p>
              </div>
              
              {clfToken ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-muted/50 rounded-lg px-3 py-2 truncate font-mono">
                      {clfToken.substring(0, 20)}...
                    </code>
                    <button onClick={copyToken} className="lv-btn-secondary h-9 px-3 flex items-center gap-1.5 shrink-0">
                      <Copy className="h-3.5 w-3.5" />
                      Copiar
                    </button>
                  </div>
                  <div className="flex items-center justify-between items-end">
                    <p className="lv-caption text-xs">
                      Expira em: <span className="text-foreground">{clfExpiresAt ? new Date(clfExpiresAt).toLocaleDateString("pt-BR") : "—"}</span>
                    </p>
                  </div>
                  <button
                    onClick={generateClfToken}
                    disabled={generatingClf}
                    className="lv-btn-secondary w-full h-10 flex items-center justify-center gap-2 text-sm border-dashed"
                  >
                    {generatingClf ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Gerar novo token
                  </button>
                </div>
              ) : (
                <button
                  onClick={generateClfToken}
                  disabled={generatingClf}
                  className="lv-btn-primary w-full h-11 flex items-center justify-center gap-2"
                >
                  {generatingClf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
                  Gerar Token CLF1
                </button>
              )}
            </div>

            {/* 3. Atalhos */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => navigate("/lovable/projects")}
                className="lv-card flex flex-col items-center text-center hover:bg-accent/50 transition-colors cursor-pointer p-4"
              >
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                  <FolderOpen className="h-5 w-5 text-primary" />
                </div>
                <p className="lv-body-strong text-sm">Meus Projetos</p>
                <p className="lv-caption text-xs">Gerenciar e fazer deploys</p>
              </button>
              <button
                onClick={() => navigate("/lovable/preview")}
                className="lv-card flex flex-col items-center text-center hover:bg-accent/50 transition-colors cursor-pointer p-4"
              >
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                  <Eye className="h-5 w-5 text-primary" />
                </div>
                <p className="lv-body-strong text-sm">Preview</p>
                <p className="lv-caption text-xs">Visualizar projetos ao vivo</p>
              </button>
            </div>

            {/* 4. Aviso de segurança */}
            <div className="lv-card-sm bg-accent/30 flex items-start gap-3 border-none">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p className="lv-caption text-xs leading-relaxed">
                Seu token é armazenado de forma segura no servidor e <strong className="text-foreground">nunca</strong> é exposto no navegador após salvo.
              </p>
            </div>

            {/* 5. Botão Desconectar conta */}
            <div className="pt-4">
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="lv-btn-secondary w-full h-11 flex items-center justify-center gap-2 text-destructive hover:bg-destructive/10 border-destructive/20"
              >
                {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
                Desconectar conta
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
