import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAffiliate } from "@/hooks/useAuth";
import { Copy, Link as LinkIcon, LogOut, Coins, Users, Shield, Download, DollarSign, FileText, CreditCard, Save, Gift, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import AppLayout from "@/components/AppLayout";

interface Referral {
  id: string;
  referred_user_id: string;
  confirmed: boolean;
  created_at: string;
  commission_amount?: number;
  sale_amount?: number;
  subscription_plan?: string;
  referred_email?: string;
  referred_name?: string;
}

interface InvoiceItem {
  id: string;
  client_email: string;
  client_name: string;
  plan: string;
  sale_amount: number;
  commission_amount: number;
  created_at: string;
}

interface CoinTransaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
}

interface Invoice {
  id: string;
  week_start: string;
  week_end: string;
  total_sales: number;
  total_commission: number;
  status: string;
  paid_at: string | null;
  payment_notes: string;
}

type AffTab = "overview" | "financeiro" | "indicacoes" | "banco";

interface RedeemablePlan {
  id: string;
  name: string;
  price: number;
  billing_cycle: string;
}

function RedeemSection({ affiliateId, userId, confirmedReferrals }: { affiliateId?: string; userId?: string; confirmedReferrals: number }) {
  const [plans, setPlans] = useState<RedeemablePlan[]>([]);
  const [redeemableBalance, setRedeemableBalance] = useState<number | null>(null);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(true);

  useEffect(() => {
    if (!affiliateId || !userId) return;

    // Fetch available plans
    supabase
      .from("plans")
      .select("id, name, price, billing_cycle")
      .eq("is_active", true)
      .eq("is_public", true)
      .gt("price", 0)
      .order("price", { ascending: true })
      .then(({ data }) => setPlans((data || []) as RedeemablePlan[]));

    // Fetch redeemable commissions (approved, older than 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    supabase
      .from("commissions")
      .select("amount")
      .eq("affiliate_id", affiliateId)
      .eq("status", "approved")
      .lte("created_at", sevenDaysAgo)
      .then(({ data }) => {
        const total = (data || []).reduce((sum, c) => sum + Number(c.amount), 0);
        setRedeemableBalance(total);
        setLoadingBalance(false);
      });
  }, [affiliateId, userId]);

  const handleRedeem = async (planId: string) => {
    setRedeeming(planId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/redeem-plan`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ plan_id: planId }),
        }
      );
      const result = await res.json();
      if (res.ok && result.ok) {
        toast.success(result.message);
        // Refresh balance
        if (result.remainingBalance !== undefined) {
          setRedeemableBalance(result.remainingBalance);
        }
      } else {
        toast.error(result.error || "Erro ao resgatar plano");
      }
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setRedeeming(null);
    }
  };

  const billingLabel: Record<string, string> = { daily: "/dia", monthly: "/mês", weekly: "/semana" };

  if (confirmedReferrals === 0) return null;

  return (
    <div className="lv-card">
      <div className="flex items-center gap-2 mb-1">
        <Gift className="h-4 w-4 text-primary" />
        <p className="lv-overline">Trocar comissões por plano</p>
      </div>
      <p className="lv-caption mb-4">
        Use suas comissões acumuladas (após 7 dias) para ativar planos sem pagar.
        {loadingBalance ? "" : ` Saldo resgatável: `}
        {!loadingBalance && (
          <strong className="text-foreground">R${(redeemableBalance || 0).toFixed(2)}</strong>
        )}
      </p>

      {loadingBalance ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando saldo...
        </div>
      ) : (redeemableBalance || 0) <= 0 ? (
        <p className="lv-body text-sm">
          Você ainda não tem comissões resgatáveis. Comissões ficam disponíveis 7 dias após a aprovação.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {plans.map((p) => {
            const priceBRL = p.price / 100;
            const canAfford = (redeemableBalance || 0) >= priceBRL;
            return (
              <div key={p.id} className={`lv-card-sm flex flex-col justify-between ${!canAfford ? "opacity-50" : ""}`}>
                <div>
                  <p className="lv-body-strong text-sm">{p.name}</p>
                  <p className="lv-caption">
                    R${priceBRL.toFixed(2).replace(".", ",")}{billingLabel[p.billing_cycle] || ""}
                  </p>
                </div>
                <button
                  onClick={() => canAfford && handleRedeem(p.id)}
                  disabled={!canAfford || redeeming === p.id}
                  className={`mt-3 h-9 px-4 text-xs rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    canAfford
                      ? "bg-primary text-primary-foreground hover:opacity-90"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  }`}
                >
                  {redeeming === p.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : canAfford ? (
                    <>
                      <Gift className="h-3.5 w-3.5" /> Resgatar
                    </>
                  ) : (
                    "Saldo insuficiente"
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const planLabels: Record<string, string> = {
  "1_day": "1 Dia", "7_days": "7 Dias", "1_month": "1 Mês", "12_months": "12 Meses",
  "individual": "Individual", "agency": "Agência", "whitelabel": "White Label",
  "free": "Grátis", "daily": "Diário", "monthly": "Mensal",
};

const invoiceStatusLabel: Record<string, string> = {
  open: "Em aberto", closed: "Fechada", paid: "Paga", cancelled: "Cancelada",
};

export default function AffiliateDashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { isAffiliate, affiliateData, loading: affLoading } = useIsAffiliate();
  const navigate = useNavigate();
  const [affTab, setAffTab] = useState<AffTab>("overview");
  const [coins, setCoins] = useState<{ balance: number; total_earned: number; total_spent: number } | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [weeklyCount, setWeeklyCount] = useState(0);
  const [subscription, setSubscription] = useState<any>(null);
  const [tokens, setTokens] = useState<any[]>([]);
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);

  // Bank info
  const [pixKeyType, setPixKeyType] = useState("cpf");
  const [pixKey, setPixKey] = useState("");
  const [holderName, setHolderName] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankInfoSaved, setBankInfoSaved] = useState(false);

  useEffect(() => {
    if (!authLoading && !affLoading) {
      if (!user) navigate("/login");
      else if (!isAffiliate) navigate("/home");
    }
  }, [user, isAffiliate, authLoading, affLoading, navigate]);

  useEffect(() => {
    if (!user || !affiliateData) return;

    supabase.from("codecoins").select("*").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setCoins(data));

    supabase.from("affiliate_referrals").select("*").eq("affiliate_id", affiliateData.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setReferrals(data || []);
        const now = new Date();
        const monday = new Date(now);
        monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
        monday.setHours(0, 0, 0, 0);
        const weekConfirmed = (data || []).filter(
          (r) => r.confirmed && new Date(r.created_at) >= monday
        ).length;
        setWeeklyCount(weekConfirmed);
      });

    supabase.from("codecoin_transactions").select("*").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(20)
      .then(({ data }) => setTransactions(data || []));

    supabase.from("subscriptions").select("*").eq("user_id", user.id)
      .eq("status", "active").order("expires_at", { ascending: false }).limit(1)
      .then(({ data }) => setSubscription(data?.[0] || null));

    supabase.from("tokens").select("*").eq("user_id", user.id).eq("is_active", true)
      .then(({ data }) => setTokens(data || []));

    supabase.from("affiliate_invoices").select("*")
      .eq("affiliate_id", affiliateData.id)
      .order("week_start", { ascending: false })
      .then(({ data }) => setInvoices(data || []));

    supabase.from("affiliate_bank_info").select("*").eq("affiliate_id", affiliateData.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPixKeyType(data.pix_key_type || "cpf");
          setPixKey(data.pix_key || "");
          setHolderName(data.holder_name || "");
          setBankName((data as any).bank_name || "");
          setBankInfoSaved(true);
        }
      });
  }, [user, affiliateData]);

  const saveBankInfo = async () => {
    if (!user || !affiliateData) return;
    if (!pixKey.trim() || !holderName.trim()) return toast.error("Preencha chave PIX e nome do titular.");

    if (bankInfoSaved) {
      const { error } = await supabase.from("affiliate_bank_info")
        .update({ pix_key_type: pixKeyType, pix_key: pixKey.trim(), holder_name: holderName.trim(), bank_name: bankName.trim() })
        .eq("affiliate_id", affiliateData.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("affiliate_bank_info")
        .insert({ affiliate_id: affiliateData.id, user_id: user.id, pix_key_type: pixKeyType, pix_key: pixKey.trim(), holder_name: holderName.trim(), bank_name: bankName.trim() });
      if (error) return toast.error(error.message);
      setBankInfoSaved(true);
    }
    toast.success("Dados bancários salvos!");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  const siteBase = import.meta.env.VITE_SITE_URL || "https://starble.lovable.app";
  const magicLink = affiliateData ? `${siteBase}/ref/${affiliateData.affiliate_code}` : "";

  const daysRemaining = subscription
    ? Math.max(0, Math.ceil((new Date(subscription.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const totalCommission = referrals.reduce((sum, r) => sum + Number((r as any).commission_amount || 0), 0);
  const openInvoicesTotal = invoices.filter(i => i.status === "open" || i.status === "closed").reduce((sum, i) => sum + Number(i.total_commission), 0);
  const paidTotal = invoices.filter(i => i.status === "paid").reduce((sum, i) => sum + Number(i.total_commission), 0);

  if (authLoading || affLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="lv-overline">Carregando...</p>
    </div>;
  }

  return (
    <AppLayout>
    <div className="min-h-full">

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-5">
        <div>
          <p className="lv-overline mb-1">Painel do afiliado</p>
          <h1 className="lv-heading-lg">{affiliateData?.display_name || "Afiliado"}</h1>
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-2 flex-wrap">
          {([[ "overview", "Visão geral"], [ "financeiro", "Financeiro"], [ "indicacoes", "Indicações"], [ "banco", "Dados bancários"]] as [AffTab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setAffTab(t)}
              className={`lv-btn-secondary h-9 px-4 text-xs ${affTab === t ? "bg-foreground text-background" : ""}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {affTab === "overview" && (
          <>
            {/* Counters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="lv-card text-center">
                <Coins className="h-5 w-5 mx-auto mb-2 text-primary" />
                <p className="lv-stat text-2xl">{coins?.balance || 0}</p>
                <p className="lv-caption mt-1">CodeCoins</p>
              </div>
              <div className="lv-card text-center">
                <Users className="h-5 w-5 mx-auto mb-2 text-primary" />
                <p className="lv-stat text-2xl">{referrals.filter(r => r.confirmed).length}</p>
                <p className="lv-caption mt-1">Vendas confirmadas</p>
              </div>
              <div className="lv-card text-center">
                <DollarSign className="h-5 w-5 mx-auto mb-2 text-green-500" />
                <p className="lv-stat text-2xl text-green-600">R${totalCommission.toFixed(2)}</p>
                <p className="lv-caption mt-1">Comissão total</p>
              </div>
              <div className="lv-card text-center">
                <Shield className="h-5 w-5 mx-auto mb-2 text-primary" />
                <p className="lv-stat text-2xl">{daysRemaining}</p>
                <p className="lv-caption mt-1">Dias restantes</p>
              </div>
            </div>

            {/* Magic Link */}
            <div className="lv-card">
              <p className="lv-overline mb-3">Seu link de indicação</p>
              <div className="flex items-center gap-3">
                <code className="font-mono text-xs bg-muted/60 px-4 py-3 rounded-lg flex-1 truncate">
                  {magicLink}
                </code>
                <button onClick={() => copyToClipboard(magicLink)} className="lv-btn-secondary h-10 px-4 text-xs flex items-center gap-1.5">
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </button>
              </div>
              <p className="lv-caption mt-3">
                Código: <strong className="text-foreground">{affiliateData?.affiliate_code}</strong> · Comissão: <strong className="text-foreground">30%</strong> · Desconto próprio: <strong className="text-foreground">{affiliateData?.discount_percent}%</strong>
              </p>
            </div>

            {/* WhatsApp Templates */}
            <div className="lv-card">
              <p className="lv-overline mb-4">Mensagens rápidas (WhatsApp)</p>
              <div className="space-y-3">
                {[
                  { label: "Convite Geral", text: `🚀 Quer enviar mensagens ilimitadas no Lovable sem gastar créditos? Conheça o Starble!\n\n✅ Sem descontar créditos\n✅ 24/7 sem parar\n✅ Ativação imediata\n\n🔗 Acesse: ${magicLink}` },
                  { label: "Promoção", text: `⚡ PROMOÇÃO Starble!\n\nA partir de R$9,99 você tem acesso ilimitado ao Lovable.\nSem gastar nenhum crédito da sua conta!\n\n👉 ${magicLink}` },
                  { label: "Dev para Dev", text: `Fala dev! 👋\n\nTô usando uma extensão sensacional pro Lovable que permite envios ilimitados. Testei e tá funcionando muito bem.\n\nDá uma olhada: ${magicLink}` },
                ].map((tmpl, i) => (
                  <div key={i} className="lv-card-sm">
                    <div className="flex items-center justify-between mb-2">
                      <p className="lv-body-strong text-xs">{tmpl.label}</p>
                      <div className="flex gap-2">
                        <button onClick={() => copyToClipboard(tmpl.text)} className="lv-btn-secondary h-7 px-2 text-xs">
                          <Copy className="h-3 w-3" />
                        </button>
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(tmpl.text)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="lv-btn-primary h-7 px-3 text-xs inline-flex items-center"
                        >
                          Enviar
                        </a>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground whitespace-pre-wrap">{tmpl.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Financeiro */}
        {affTab === "financeiro" && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="lv-card text-center">
                <p className="lv-caption mb-2">A receber</p>
                <p className="lv-stat text-2xl text-yellow-600">R${openInvoicesTotal.toFixed(2)}</p>
              </div>
              <div className="lv-card text-center">
                <p className="lv-caption mb-2">Já recebido</p>
                <p className="lv-stat text-2xl text-green-600">R${paidTotal.toFixed(2)}</p>
              </div>
              <div className="lv-card text-center">
                <p className="lv-caption mb-2">Comissão total</p>
                <p className="lv-stat text-2xl">R${totalCommission.toFixed(2)}</p>
              </div>
            </div>

            {!bankInfoSaved && (
              <div className="lv-card border-yellow-500/30">
                <p className="lv-body-strong mb-1">⚠ Cadastre seus dados bancários</p>
                <p className="lv-caption">Para receber suas comissões via PIX, cadastre seus dados na aba "Dados Bancários".</p>
              </div>
            )}

            {/* Invoices */}
            <div className="lv-card">
              <p className="lv-overline mb-4">Faturas semanais</p>
              {invoices.length === 0 ? (
                <p className="lv-body">Nenhuma fatura ainda. As faturas são geradas automaticamente a cada venda.</p>
              ) : (
                <div className="space-y-3">
                  {invoices.map((inv) => (
                    <div key={inv.id} className={`${inv.status === "cancelled" ? "opacity-50" : ""}`}>
                      <div
                        className="lv-card-sm flex items-center justify-between cursor-pointer"
                        onClick={async () => {
                          if (expandedInvoice === inv.id) {
                            setExpandedInvoice(null);
                            return;
                          }
                          setExpandedInvoice(inv.id);
                          const { data } = await supabase
                            .from("affiliate_invoice_items")
                            .select("*")
                            .eq("invoice_id", inv.id)
                            .order("created_at", { ascending: false });
                          setInvoiceItems((data || []) as InvoiceItem[]);
                        }}
                      >
                        <div>
                          <p className="lv-body-strong">
                            Semana {inv.week_start} → {inv.week_end}
                          </p>
                          <p className="lv-caption">
                            {inv.total_sales} venda(s) · R${Number(inv.total_commission).toFixed(2)}
                          </p>
                          {inv.paid_at && (
                            <p className="text-xs text-green-600 mt-1">
                              Pago em {format(new Date(inv.paid_at), "dd/MM/yyyy")}
                              {inv.payment_notes ? ` — ${inv.payment_notes}` : ""}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`lv-badge text-[10px] ${
                            inv.status === "open" ? "lv-badge-primary" :
                            inv.status === "closed" ? "lv-badge-warning" :
                            inv.status === "paid" ? "lv-badge-success" :
                            "lv-badge-muted"
                          }`}>
                            {invoiceStatusLabel[inv.status] || inv.status}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{expandedInvoice === inv.id ? "▲" : "▼"}</span>
                        </div>
                      </div>

                      {/* Expanded invoice detail */}
                      {expandedInvoice === inv.id && (
                        <div className="mt-2 ml-4 space-y-2">
                          <div className="lv-card-sm bg-muted/30">
                            <p className="lv-overline mb-2">Detalhes da fatura</p>
                            {invoiceItems.length === 0 ? (
                              <p className="lv-caption">Nenhum detalhe disponível (vendas anteriores à atualização).</p>
                            ) : (
                              <div className="space-y-2">
                                {invoiceItems.map((item) => (
                                  <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                                    <div>
                                      <p className="lv-body-strong text-xs">{item.client_email || "—"}</p>
                                      <p className="lv-caption">
                                        {item.client_name && `${item.client_name} · `}
                                        {planLabels[item.plan] || item.plan} · Venda: R${Number(item.sale_amount).toFixed(2)}
                                      </p>
                                    </div>
                                    <span className="text-xs font-bold text-green-600">
                                      +R${Number(item.commission_amount).toFixed(2)}
                                    </span>
                                  </div>
                                ))}
                                <div className="flex justify-between pt-2 border-t border-foreground/10">
                                  <span className="lv-body-strong text-xs">Total</span>
                                  <span className="lv-body-strong text-xs">R${Number(inv.total_commission).toFixed(2)}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Indicações */}
        {affTab === "indicacoes" && (
          <>
            <div className="lv-card">
              <p className="lv-overline mb-4">Indicações ({referrals.length})</p>
              {referrals.length > 0 ? (
                <div className="space-y-2">
                  {referrals.map((r) => (
                    <div key={r.id} className="lv-card-sm flex items-center justify-between">
                      <div>
                        <p className="lv-body-strong">
                          {r.referred_email || r.referred_user_id.slice(0, 8) + "..."}
                        </p>
                        {r.referred_name && (
                          <p className="lv-caption">{r.referred_name}</p>
                        )}
                        <p className="lv-caption">
                          {format(new Date(r.created_at), "dd/MM/yyyy HH:mm")}
                          {r.subscription_plan && ` · ${planLabels[r.subscription_plan] || r.subscription_plan}`}
                          {r.sale_amount && r.sale_amount > 0 && ` · Venda: R$${Number(r.sale_amount).toFixed(2)}`}
                          {r.commission_amount && r.commission_amount > 0 && ` · Comissão: R$${Number(r.commission_amount).toFixed(2)}`}
                        </p>
                      </div>
                      <span className={`lv-badge ${r.confirmed ? "lv-badge-success" : "lv-badge-muted"}`}>
                        {r.confirmed ? "Confirmado" : "Pendente"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="lv-body">Nenhuma indicação ainda.</p>
              )}
            </div>

            {/* CodeCoins History */}
            <div className="lv-card">
              <p className="lv-overline mb-4">Histórico de CodeCoins</p>
              {transactions.length > 0 ? (
                <div className="space-y-2">
                  {transactions.map((t) => (
                    <div key={t.id} className="lv-card-sm flex items-center justify-between">
                      <div>
                        <p className="lv-body-strong">{t.description}</p>
                        <p className="lv-caption">{format(new Date(t.created_at), "dd/MM/yyyy HH:mm")}</p>
                      </div>
                      <span className={`text-sm font-bold ${t.amount > 0 ? "text-green-600" : "text-red-500"}`}>
                        {t.amount > 0 ? "+" : ""}{t.amount}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="lv-body">Nenhuma transação ainda.</p>
              )}
            </div>
          </>
        )}

        {/* Dados Bancários */}
        {affTab === "banco" && (
          <div className="lv-card">
            <p className="lv-overline mb-4">Dados para recebimento (PIX)</p>
            <p className="lv-body mb-6">
              Cadastre seus dados bancários para receber as comissões semanais via PIX.
              O admin fechará a fatura semanal e realizará o pagamento.
            </p>
            <div className="space-y-4 max-w-md">
              <div>
                <label className="lv-caption font-medium block mb-1.5">Tipo da chave PIX</label>
                <select value={pixKeyType} onChange={(e) => setPixKeyType(e.target.value)}
                  className="lv-input">
                  <option value="cpf">CPF</option>
                  <option value="cnpj">CNPJ</option>
                  <option value="email">E-mail</option>
                  <option value="phone">Telefone</option>
                  <option value="random">Chave Aleatória</option>
                </select>
              </div>
              <div>
                <label className="lv-caption font-medium block mb-1.5">Chave PIX</label>
                <input value={pixKey} onChange={(e) => setPixKey(e.target.value)}
                  placeholder="Sua chave PIX..."
                  className="lv-input" />
              </div>
              <div>
                <label className="lv-caption font-medium block mb-1.5">Nome do titular</label>
                <input value={holderName} onChange={(e) => setHolderName(e.target.value)}
                  placeholder="Nome completo do titular..."
                  className="lv-input" />
              </div>
              <div>
                <label className="lv-caption font-medium block mb-1.5">Banco (opcional)</label>
                <input value={bankName} onChange={(e) => setBankName(e.target.value)}
                  placeholder="Nome do banco..."
                  className="lv-input" />
              </div>
              <button onClick={saveBankInfo} className="lv-btn-primary h-11 px-6 text-sm flex items-center gap-2">
                <Save className="h-4 w-4" /> Salvar dados bancários
              </button>
            </div>
          </div>
        )}

        {/* Redeem commissions for plans */}
        <RedeemSection
          affiliateId={affiliateData?.id}
          userId={user?.id}
          confirmedReferrals={referrals.filter(r => r.confirmed).length}
        />

        {/* Discount info */}
        <div className="lv-card">
          <p className="lv-overline mb-3">Desconto de afiliado</p>
          {referrals.filter(r => r.confirmed).length > 0 ? (
            <p className="lv-body mb-4">
              Você tem <strong className="text-foreground">{affiliateData?.discount_percent}% de desconto</strong> em todos os planos porque possui indicações ativas!
            </p>
          ) : (
            <p className="lv-body mb-4">
              Indique pelo menos <strong className="text-foreground">1 pessoa que assine um plano pago</strong> para desbloquear seu desconto de <strong className="text-foreground">{affiliateData?.discount_percent}%</strong> em todos os planos.
            </p>
          )}
          <Link to="/planos" className="lv-btn-primary h-10 px-5 text-sm inline-flex items-center">Ver planos</Link>
        </div>
      </div>
    </div>
    </AppLayout>
  );
}
