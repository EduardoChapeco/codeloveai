import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin, useIsAffiliate } from "@/hooks/useAuth";
import { Copy, Download, LogOut, Shield, Users } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Subscription {
  id: string;
  plan: string;
  status: string;
  starts_at: string;
  expires_at: string;
}

interface Token {
  id: string;
  token: string;
  is_active: boolean;
}

export default function Dashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { isAffiliate } = useIsAffiliate();
  const navigate = useNavigate();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [profile, setProfile] = useState<{ name: string; email: string } | null>(null);
  const [latestExt, setLatestExt] = useState<{ file_url: string; version: string; instructions: string } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;

    supabase.from("profiles").select("name, email").eq("user_id", user.id).single()
      .then(({ data }) => setProfile(data));

    supabase.from("subscriptions").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setSubscriptions(data || []));

    supabase.from("tokens").select("*").eq("user_id", user.id)
      .then(({ data }) => setTokens(data || []));

    supabase.from("extension_files").select("file_url, version, instructions")
      .eq("is_latest", true).maybeSingle()
      .then(({ data }) => setLatestExt(data));
  }, [user]);

  const activeSubscription = subscriptions.find((s) => s.status === "active" && new Date(s.expires_at) > new Date());

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    toast.success("Token copiado!");
  };

  const planLabels: Record<string, string> = {
    "1_day": "1 Dia",
    "7_days": "7 Dias",
    "1_month": "1 Mês",
    "12_months": "12 Meses",
  };

  if (authLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="ep-subtitle">CARREGANDO...</p>
    </div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-20 bg-background border-b border-border px-8 py-5 flex items-center justify-between">
        <Link to="/" className="ep-label text-sm tracking-[0.3em]">CODELOVE AI</Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground font-medium">{profile?.name || profile?.email}</span>
          {isAffiliate && (
            <Link to="/affiliate" className="ep-btn-secondary h-10 px-4 text-[9px] flex items-center gap-1">
              <Users className="h-3 w-3" />
              AFILIADO
            </Link>
          )}
          {isAdmin && (
            <Link to="/admin" className="ep-btn-secondary h-10 px-4 text-[9px] flex items-center gap-1">
              <Shield className="h-3 w-3" />
              ADMIN
            </Link>
          )}
          <button onClick={signOut} className="ep-btn-icon h-10 w-10 rounded-[14px]">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-8 py-12 space-y-8">
        <div>
          <p className="ep-subtitle mb-2">ÁREA DO MEMBRO</p>
          <h1 className="ep-section-title">DASHBOARD</h1>
        </div>

        {/* Subscription Status */}
        <div className="ep-card">
          <p className="ep-subtitle mb-4">STATUS DA ASSINATURA</p>
          {activeSubscription ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="ep-value">{planLabels[activeSubscription.plan] || activeSubscription.plan}</p>
                <p className="text-sm text-muted-foreground font-medium mt-2">
                  Expira em {format(new Date(activeSubscription.expires_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
              <span className="ep-badge ep-badge-live">ATIVO</span>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground font-medium">Nenhuma assinatura ativa.</p>
              <Link to="/#plans" className="ep-btn-primary h-10 px-6 text-[9px]">VER PLANOS</Link>
            </div>
          )}
        </div>

        {/* Token */}
        <div className="ep-card">
          <p className="ep-subtitle mb-4">TOKEN DE ATIVAÇÃO</p>
          {tokens.filter((t) => t.is_active).length > 0 ? (
            tokens.filter((t) => t.is_active).map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-4">
                <code className="font-mono text-sm bg-muted px-4 py-3 rounded-[8px] flex-1 truncate">
                  {t.token}
                </code>
                <button onClick={() => copyToken(t.token)} className="ep-btn-icon h-12 w-12 rounded-[16px]">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground font-medium">
              Nenhum token ativo. Aguarde a ativação pelo administrador.
            </p>
          )}
        </div>

        {/* Download */}
        <div className="ep-card">
          <p className="ep-subtitle mb-4">EXTENSÃO {latestExt ? `v${latestExt.version}` : ""}</p>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground font-medium">
              Baixe a extensão para instalar no navegador.
            </p>
            <button
              className="ep-btn-secondary h-10 px-6 text-[9px]"
              disabled={!activeSubscription || !latestExt}
              onClick={async () => {
                if (!latestExt) return;
                const { data } = await supabase.storage.from("extensions").createSignedUrl(latestExt.file_url, 300);
                if (data?.signedUrl) window.open(data.signedUrl, "_blank");
              }}
            >
              <Download className="h-4 w-4" />
              DOWNLOAD
            </button>
          </div>
          {latestExt?.instructions && (
            <div className="bg-muted rounded-[12px] p-4">
              <p className="ep-subtitle text-[9px] mb-2">COMO INSTALAR</p>
              <pre className="text-xs text-muted-foreground font-medium whitespace-pre-wrap">{latestExt.instructions}</pre>
            </div>
          )}
        </div>

        {/* History */}
        <div className="ep-card">
          <p className="ep-subtitle mb-6">HISTÓRICO DE PLANOS</p>
          {subscriptions.length > 0 ? (
            <div className="space-y-3">
              {subscriptions.map((s) => (
                <div key={s.id} className="ep-card-sm flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-foreground">{planLabels[s.plan] || s.plan}</p>
                    <p className="text-xs text-muted-foreground font-medium">
                      {format(new Date(s.starts_at), "dd/MM/yyyy")} — {format(new Date(s.expires_at), "dd/MM/yyyy")}
                    </p>
                  </div>
                  <span className={`ep-badge ${s.status === "active" && new Date(s.expires_at) > new Date() ? "ep-badge-live" : "ep-badge-offline"}`}>
                    {s.status === "active" && new Date(s.expires_at) > new Date() ? "ATIVO" : "EXPIRADO"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground font-medium">Nenhum plano adquirido.</p>
          )}
        </div>
      </div>
    </div>
  );
}
