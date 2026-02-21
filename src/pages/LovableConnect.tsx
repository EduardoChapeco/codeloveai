import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLovableProxy } from "@/hooks/useLovableProxy";
import { supabase } from "@/integrations/supabase/client";
import AppNav from "@/components/AppNav";
import { toast } from "sonner";
import { Loader2, Check, X, Link2, Unlink, Eye, EyeOff, ShieldCheck } from "lucide-react";

export default function LovableConnect() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { saveToken, deleteToken } = useLovableProxy();

  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [account, setAccount] = useState<{ status: string; last_verified_at: string | null } | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login?returnTo=/lovable/connect");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("lovable_accounts")
        .select("status, last_verified_at")
        .eq("user_id", user.id)
        .maybeSingle();
      setAccount(data as any);
      setLoadingAccount(false);
    };
    load();
  }, [user]);

  const handleSave = async () => {
    if (!token.trim()) return toast.error("Insira o token.");
    setSaving(true);
    try {
      await saveToken(token.trim());
      toast.success("Token salvo e verificado com sucesso!");
      setAccount({ status: "active", last_verified_at: new Date().toISOString() });
      setToken("");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar token.");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Desconectar sua conta Lovable?")) return;
    setDisconnecting(true);
    try {
      await deleteToken();
      setAccount(null);
      toast.success("Conta desconectada.");
    } catch {
      toast.error("Erro ao desconectar.");
    } finally {
      setDisconnecting(false);
    }
  };

  if (authLoading || !user) return <div className="min-h-screen bg-background" />;

  const isConnected = account?.status === "active";

  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      <div className="max-w-xl mx-auto px-6 py-10">
        <p className="lv-overline mb-1">Integração</p>
        <h1 className="lv-heading-lg mb-8">Lovable Connect</h1>

        {loadingAccount ? (
          <div className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /></div>
        ) : isConnected ? (
          <div className="space-y-5">
            <div className="lv-card flex items-center gap-4">
              <div className="h-11 w-11 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Check className="h-5 w-5 text-green-500" />
              </div>
              <div className="flex-1">
                <p className="lv-body-strong">Conectado</p>
                <p className="lv-caption">
                  {account?.last_verified_at
                    ? `Verificado em ${new Date(account.last_verified_at).toLocaleString("pt-BR")}`
                    : "Token ativo"}
                </p>
              </div>
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
              Desconectar
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {account?.status === "expired" && (
              <div className="lv-card-sm bg-destructive/10 border-destructive/20 flex items-start gap-3">
                <X className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="lv-caption text-destructive">Seu token expirou. Insira um novo token para reconectar.</p>
              </div>
            )}

            <div className="lv-card space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
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
                  className="lv-input h-11 pr-12 font-mono"
                />
                <button
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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

            <div className="lv-card-sm bg-accent/50 flex items-start gap-3">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="lv-caption space-y-1">
                <p>O token será verificado contra a API Lovable antes de ser salvo.</p>
                <p>Após salvo, ele <strong className="text-foreground">nunca retorna ao navegador</strong> — todas as chamadas são feitas pelo proxy seguro.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
