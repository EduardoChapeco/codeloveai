import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLovableProxy } from "@/hooks/useLovableProxy";
import AppLayout from "@/components/AppLayout";
import { toast } from "sonner";
import { Loader2, Check, X, Link2, Unlink, Eye, EyeOff, ShieldCheck, ExternalLink, Info } from "lucide-react";

export default function LovableConnect() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { saveToken, deleteToken, checkConnection } = useLovableProxy();

  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"active" | "expired" | "none" | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [lastVerified, setLastVerified] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login?returnTo=/lovable/connect");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const status = await checkConnection(user.id);
      setConnectionStatus(status);
      if (status === "active") {
        // Get last verified date
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

  const handleSave = async () => {
    if (!token.trim()) return toast.error("Insira o token.");
    setSaving(true);
    try {
      await saveToken(token.trim());
      toast.success("Token salvo e verificado com sucesso!");
      setConnectionStatus("active");
      setLastVerified(new Date().toISOString());
      setToken("");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar token.");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Desconectar sua conta Lovable? Você precisará inserir um novo token para reconectar.")) return;
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
          Conecte sua conta Lovable para gerenciar projetos, fazer deploys e acessar previews diretamente desta plataforma.
        </p>

        {loadingAccount ? (
          <div className="text-center py-20">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : isConnected ? (
          <div className="space-y-5">
            {/* Connected status card */}
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

            {/* Quick actions */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => navigate("/lovable/projects")}
                className="lv-card-sm text-center hover:bg-accent/50 transition-colors cursor-pointer"
              >
                <p className="lv-body-strong text-sm">📂 Meus Projetos</p>
                <p className="lv-caption text-xs">Gerenciar e fazer deploys</p>
              </button>
              <button
                onClick={() => navigate("/lovable/preview")}
                className="lv-card-sm text-center hover:bg-accent/50 transition-colors cursor-pointer"
              >
                <p className="lv-body-strong text-sm">👁️ Preview</p>
                <p className="lv-caption text-xs">Visualizar projetos ao vivo</p>
              </button>
            </div>

            {/* Security notice */}
            <div className="lv-card-sm bg-accent/50 flex items-start gap-3">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p className="lv-caption">
                Seu token é armazenado de forma segura no servidor e <strong className="text-foreground">nunca</strong> é exposto no navegador após salvo. Todas as chamadas à API são feitas pelo proxy seguro.
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
            {/* Expired token alert */}
            {isExpired && (
              <div className="lv-card-sm bg-destructive/10 border-destructive/20 flex items-start gap-3">
                <X className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="lv-caption text-destructive">
                  Seu token expirou. Gere um novo token no painel Lovable e insira abaixo para reconectar.
                </p>
              </div>
            )}

            {/* How to get token instructions */}
            <div className="lv-card space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Link2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="lv-body-strong">Conectar Token</p>
                  <p className="lv-caption">Insira seu Bearer token da API Lovable</p>
                </div>
              </div>

              <div className="relative">
                <input
                  type={showToken ? "text" : "password"}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Bearer token..."
                  className="lv-input h-11 pr-12 font-mono w-full"
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                />
                <button
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              <button
                onClick={handleSave}
                disabled={saving || !token.trim()}
                className="lv-btn-primary w-full h-11 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Verificar e salvar
              </button>
            </div>

            {/* Instructions */}
            <div className="lv-card-sm bg-accent/50 space-y-3">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-primary shrink-0" />
                <p className="lv-body-strong text-sm">Como obter seu token</p>
              </div>
              <ol className="lv-caption space-y-1.5 list-decimal list-inside">
                <li>Acesse <strong className="text-foreground">lovable.dev</strong> e faça login</li>
                <li>Abra as <strong className="text-foreground">DevTools</strong> do navegador (F12)</li>
                <li>Na aba <strong className="text-foreground">Network</strong>, faça qualquer ação no Lovable</li>
                <li>Encontre uma requisição para <code className="text-xs bg-muted px-1 rounded">api.lovable.dev</code></li>
                <li>Copie o valor do header <code className="text-xs bg-muted px-1 rounded">Authorization: Bearer ...</code></li>
              </ol>
            </div>

            {/* Security */}
            <div className="lv-card-sm bg-accent/50 flex items-start gap-3">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="lv-caption space-y-1">
                <p>O token será verificado contra a API Lovable antes de ser salvo.</p>
                <p>Após salvo, ele <strong className="text-foreground">nunca retorna ao navegador</strong> — todas as chamadas são feitas pelo proxy seguro no servidor.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
