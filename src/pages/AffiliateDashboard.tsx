import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAffiliate } from "@/hooks/useAuth";
import { Copy, Link as LinkIcon, LogOut, Coins, Users, Shield, Download } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Referral {
  id: string;
  referred_user_id: string;
  confirmed: boolean;
  created_at: string;
}

interface CoinTransaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
}

export default function AffiliateDashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { isAffiliate, affiliateData, loading: affLoading } = useIsAffiliate();
  const navigate = useNavigate();
  const [coins, setCoins] = useState<{ balance: number; total_earned: number; total_spent: number } | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [weeklyCount, setWeeklyCount] = useState(0);
  const [subscription, setSubscription] = useState<any>(null);
  const [tokens, setTokens] = useState<any[]>([]);

  useEffect(() => {
    if (!authLoading && !affLoading) {
      if (!user) navigate("/login");
      else if (!isAffiliate) navigate("/dashboard");
    }
  }, [user, isAffiliate, authLoading, affLoading, navigate]);

  useEffect(() => {
    if (!user || !affiliateData) return;

    // Fetch codecoins
    supabase.from("codecoins").select("*").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setCoins(data));

    // Fetch referrals
    supabase.from("affiliate_referrals").select("*").eq("affiliate_id", affiliateData.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setReferrals(data || []);
        // Count confirmed this week
        const now = new Date();
        const monday = new Date(now);
        monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
        monday.setHours(0, 0, 0, 0);
        const weekConfirmed = (data || []).filter(
          (r) => r.confirmed && new Date(r.created_at) >= monday
        ).length;
        setWeeklyCount(weekConfirmed);
      });

    // Fetch transactions
    supabase.from("codecoin_transactions").select("*").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(20)
      .then(({ data }) => setTransactions(data || []));

    // Fetch active subscription
    supabase.from("subscriptions").select("*").eq("user_id", user.id)
      .eq("status", "active").order("expires_at", { ascending: false }).limit(1)
      .then(({ data }) => setSubscription(data?.[0] || null));

    // Fetch tokens
    supabase.from("tokens").select("*").eq("user_id", user.id).eq("is_active", true)
      .then(({ data }) => setTokens(data || []));
  }, [user, affiliateData]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  const magicLink = affiliateData ? `${window.location.origin}/ref/${affiliateData.affiliate_code}` : "";

  const daysRemaining = subscription
    ? Math.max(0, Math.ceil((new Date(subscription.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  if (authLoading || affLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="ep-subtitle">CARREGANDO...</p>
    </div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-20 bg-background border-b border-border px-8 py-5 flex items-center justify-between">
        <Link to="/" className="ep-label text-sm tracking-[0.3em]">CODELOVE AI</Link>
        <div className="flex items-center gap-4">
          <span className="ep-badge ep-badge-live">AFILIADO</span>
          <Link to="/dashboard" className="ep-btn-secondary h-10 px-4 text-[9px]">DASHBOARD</Link>
          <button onClick={signOut} className="ep-btn-icon h-10 w-10 rounded-[14px]">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-8 py-12 space-y-8">
        <div>
          <p className="ep-subtitle mb-2">PAINEL DO AFILIADO</p>
          <h1 className="ep-section-title">{affiliateData?.display_name || "AFILIADO"}</h1>
        </div>

        {/* Counters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="ep-card text-center">
            <Coins className="h-6 w-6 mx-auto mb-2 text-foreground" />
            <p className="ep-value text-3xl">{coins?.balance || 0}</p>
            <p className="ep-subtitle mt-1">CODECOINS</p>
          </div>
          <div className="ep-card text-center">
            <Users className="h-6 w-6 mx-auto mb-2 text-foreground" />
            <p className="ep-value text-3xl">{weeklyCount}/2</p>
            <p className="ep-subtitle mt-1">INDICAÇÕES ESTA SEMANA</p>
          </div>
          <div className="ep-card text-center">
            <Shield className="h-6 w-6 mx-auto mb-2 text-foreground" />
            <p className="ep-value text-3xl">{daysRemaining}</p>
            <p className="ep-subtitle mt-1">DIAS RESTANTES</p>
          </div>
        </div>

        {/* Magic Link */}
        <div className="ep-card">
          <p className="ep-subtitle mb-4">SEU LINK DE INDICAÇÃO</p>
          <div className="flex items-center gap-3">
            <code className="font-mono text-xs bg-muted px-4 py-3 rounded-[8px] flex-1 truncate">
              {magicLink}
            </code>
            <button onClick={() => copyToClipboard(magicLink)} className="ep-btn-secondary h-12 px-4 text-[9px]">
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground font-medium mt-3">
            Código: <strong>{affiliateData?.affiliate_code}</strong> · Desconto: <strong>{affiliateData?.discount_percent}%</strong>
          </p>
        </div>

        {/* Token */}
        <div className="ep-card">
          <p className="ep-subtitle mb-4">TOKEN DE ATIVAÇÃO</p>
          {tokens.length > 0 ? tokens.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-4 mb-2">
              <code className="font-mono text-sm bg-muted px-4 py-3 rounded-[8px] flex-1 truncate">{t.token}</code>
              <button onClick={() => copyToClipboard(t.token)} className="ep-btn-icon h-12 w-12 rounded-[16px]">
                <Copy className="h-4 w-4" />
              </button>
            </div>
          )) : (
            <p className="text-sm text-muted-foreground font-medium">Nenhum token ativo. Aguarde ativação pelo admin.</p>
          )}
        </div>

        {/* Referrals */}
        <div className="ep-card">
          <p className="ep-subtitle mb-4">INDICAÇÕES ({referrals.length})</p>
          {referrals.length > 0 ? (
            <div className="space-y-2">
              {referrals.map((r) => (
                <div key={r.id} className="ep-card-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium font-mono">{r.referred_user_id.slice(0, 8)}...</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(r.created_at), "dd/MM/yyyy")}</p>
                  </div>
                  <span className={`ep-badge ${r.confirmed ? "ep-badge-live" : "ep-badge-offline"}`}>
                    {r.confirmed ? "CONFIRMADO" : "PENDENTE"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground font-medium">Nenhuma indicação ainda.</p>
          )}
        </div>

        {/* Transactions */}
        <div className="ep-card">
          <p className="ep-subtitle mb-4">HISTÓRICO DE CODECOINS</p>
          {transactions.length > 0 ? (
            <div className="space-y-2">
              {transactions.map((t) => (
                <div key={t.id} className="ep-card-sm flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-foreground">{t.description}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(t.created_at), "dd/MM/yyyy HH:mm")}</p>
                  </div>
                  <span className={`text-sm font-bold ${t.amount > 0 ? "text-green-600" : "text-red-500"}`}>
                    {t.amount > 0 ? "+" : ""}{t.amount}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground font-medium">Nenhuma transação ainda.</p>
          )}
        </div>

        {/* Buy with discount */}
        <div className="ep-card">
          <p className="ep-subtitle mb-4">COMPRAR COM DESCONTO</p>
          <p className="text-sm text-muted-foreground font-medium mb-4">
            Como afiliado, você tem <strong>{affiliateData?.discount_percent}% de desconto</strong> em todos os planos.
          </p>
          <Link to="/#plans" className="ep-btn-primary inline-flex text-[9px]">VER PLANOS</Link>
        </div>
      </div>
    </div>
  );
}
