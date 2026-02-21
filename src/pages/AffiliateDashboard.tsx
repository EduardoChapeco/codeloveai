import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAffiliate } from "@/hooks/useAuth";
import { Copy, Link as LinkIcon, LogOut, Coins, Users, Shield, Download, DollarSign, FileText, CreditCard, Save } from "lucide-react";
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

const planLabels: Record<string, string> = {
  "1_day": "1 Dia", "7_days": "7 Dias", "1_month": "1 Mês", "12_months": "12 Meses",
};

const invoiceStatusLabel: Record<string, string> = {
  open: "EM ABERTO", closed: "FECHADA", paid: "PAGA", cancelled: "CANCELADA",
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
      else if (!isAffiliate) navigate("/dashboard");
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

    // Fetch invoices
    supabase.from("affiliate_invoices").select("*")
      .eq("affiliate_id", affiliateData.id)
      .order("week_start", { ascending: false })
      .then(({ data }) => setInvoices(data || []));

    // Fetch bank info
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

  const magicLink = affiliateData ? `${window.location.origin}/ref/${affiliateData.affiliate_code}` : "";

  const daysRemaining = subscription
    ? Math.max(0, Math.ceil((new Date(subscription.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const totalCommission = referrals.reduce((sum, r) => sum + Number((r as any).commission_amount || 0), 0);
  const openInvoicesTotal = invoices.filter(i => i.status === "open" || i.status === "closed").reduce((sum, i) => sum + Number(i.total_commission), 0);
  const paidTotal = invoices.filter(i => i.status === "paid").reduce((sum, i) => sum + Number(i.total_commission), 0);

  if (authLoading || affLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="ep-subtitle">CARREGANDO...</p>
    </div>;
  }

  return (
    <AppLayout>
    <div className="min-h-screen bg-background">

      <div className="max-w-4xl mx-auto px-8 py-12 space-y-8">
        <div>
          <p className="ep-subtitle mb-2">PAINEL DO AFILIADO</p>
          <h1 className="ep-section-title">{affiliateData?.display_name || "AFILIADO"}</h1>
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-2 flex-wrap">
          {([["overview", "VISÃO GERAL"], ["financeiro", "FINANCEIRO"], ["indicacoes", "INDICAÇÕES"], ["banco", "DADOS BANCÁRIOS"]] as [AffTab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setAffTab(t)}
              className={`ep-btn-secondary h-10 px-6 text-[9px] ${affTab === t ? "bg-foreground text-background" : ""}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {affTab === "overview" && (
          <>
            {/* Counters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="ep-card text-center">
                <Coins className="h-6 w-6 mx-auto mb-2 text-foreground" />
                <p className="ep-value text-3xl">{coins?.balance || 0}</p>
                <p className="ep-subtitle mt-1">CODECOINS</p>
              </div>
              <div className="ep-card text-center">
                <Users className="h-6 w-6 mx-auto mb-2 text-foreground" />
                <p className="ep-value text-3xl">{referrals.filter(r => r.confirmed).length}</p>
                <p className="ep-subtitle mt-1">VENDAS CONFIRMADAS</p>
              </div>
              <div className="ep-card text-center">
                <DollarSign className="h-6 w-6 mx-auto mb-2 text-foreground" />
                <p className="ep-value text-2xl text-green-600">R${totalCommission.toFixed(2)}</p>
                <p className="ep-subtitle mt-1">COMISSÃO TOTAL</p>
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
                Código: <strong>{affiliateData?.affiliate_code}</strong> · Comissão: <strong>30%</strong> · Desconto próprio: <strong>{affiliateData?.discount_percent}%</strong>
              </p>
            </div>

            {/* WhatsApp Templates */}
            <div className="ep-card">
              <p className="ep-subtitle mb-4">MENSAGENS RÁPIDAS (WHATSAPP)</p>
              <div className="space-y-3">
                {[
                  { label: "Convite Geral", text: `🚀 Quer enviar mensagens ilimitadas no Lovable sem gastar créditos? Conheça o CodeLove AI!\n\n✅ Sem descontar créditos\n✅ 24/7 sem parar\n✅ Ativação imediata\n\n🔗 Acesse: ${magicLink}` },
                  { label: "Promoção", text: `⚡ PROMOÇÃO CODELOVE AI!\n\nA partir de R$9,99 você tem acesso ilimitado ao Lovable.\nSem gastar nenhum crédito da sua conta!\n\n👉 ${magicLink}` },
                  { label: "Dev para Dev", text: `Fala dev! 👋\n\nTô usando uma extensão sensacional pro Lovable que permite envios ilimitados. Testei e tá funcionando muito bem.\n\nDá uma olhada: ${magicLink}` },
                ].map((tmpl, i) => (
                  <div key={i} className="ep-card-sm">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-foreground">{tmpl.label}</p>
                      <div className="flex gap-2">
                        <button onClick={() => copyToClipboard(tmpl.text)} className="ep-btn-secondary h-7 px-2 text-[8px]">
                          <Copy className="h-3 w-3" />
                        </button>
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(tmpl.text)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ep-btn-primary h-7 px-3 text-[8px] inline-flex items-center"
                        >
                          ENVIAR
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
              <div className="ep-card text-center">
                <p className="ep-subtitle mb-2">A RECEBER</p>
                <p className="ep-value text-2xl text-yellow-600">R${openInvoicesTotal.toFixed(2)}</p>
              </div>
              <div className="ep-card text-center">
                <p className="ep-subtitle mb-2">JÁ RECEBIDO</p>
                <p className="ep-value text-2xl text-green-600">R${paidTotal.toFixed(2)}</p>
              </div>
              <div className="ep-card text-center">
                <p className="ep-subtitle mb-2">COMISSÃO TOTAL</p>
                <p className="ep-value text-2xl">R${totalCommission.toFixed(2)}</p>
              </div>
            </div>

            {!bankInfoSaved && (
              <div className="ep-card border-yellow-500/30">
                <p className="text-sm font-bold text-foreground mb-1">⚠ Cadastre seus dados bancários</p>
                <p className="text-xs text-muted-foreground">Para receber suas comissões via PIX, cadastre seus dados na aba "Dados Bancários".</p>
              </div>
            )}

            {/* Invoices */}
            <div className="ep-card">
              <p className="ep-subtitle mb-4">FATURAS SEMANAIS</p>
              {invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground font-medium">Nenhuma fatura ainda. As faturas são geradas automaticamente a cada venda.</p>
              ) : (
                <div className="space-y-3">
                  {invoices.map((inv) => (
                    <div key={inv.id} className={`${inv.status === "cancelled" ? "opacity-50" : ""}`}>
                      <div
                        className="ep-card-sm flex items-center justify-between cursor-pointer"
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
                          <p className="text-sm font-bold text-foreground">
                            Semana {inv.week_start} → {inv.week_end}
                          </p>
                          <p className="text-xs text-muted-foreground">
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
                          <span className={`ep-badge text-[8px] ${
                            inv.status === "open" ? "ep-badge-live" :
                            inv.status === "closed" ? "bg-yellow-500/20 text-yellow-700" :
                            inv.status === "paid" ? "bg-green-500/20 text-green-700" :
                            "ep-badge-offline"
                          }`}>
                            {invoiceStatusLabel[inv.status] || inv.status}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{expandedInvoice === inv.id ? "▲" : "▼"}</span>
                        </div>
                      </div>

                      {/* Expanded invoice detail */}
                      {expandedInvoice === inv.id && (
                        <div className="mt-2 ml-4 space-y-2">
                          <div className="ep-card-sm bg-muted/30">
                            <p className="text-[10px] font-bold text-foreground mb-2 tracking-widest">DETALHES DA FATURA</p>
                            {invoiceItems.length === 0 ? (
                              <p className="text-xs text-muted-foreground">Nenhum detalhe disponível (vendas anteriores à atualização).</p>
                            ) : (
                              <div className="space-y-2">
                                {invoiceItems.map((item) => (
                                  <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                                    <div>
                                      <p className="text-xs font-bold text-foreground">{item.client_email || "—"}</p>
                                      <p className="text-[10px] text-muted-foreground">
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
                                  <span className="text-xs font-bold text-foreground">TOTAL</span>
                                  <span className="text-xs font-bold text-foreground">R${Number(inv.total_commission).toFixed(2)}</span>
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
            <div className="ep-card">
              <p className="ep-subtitle mb-4">INDICAÇÕES ({referrals.length})</p>
              {referrals.length > 0 ? (
                <div className="space-y-2">
                  {referrals.map((r) => (
                    <div key={r.id} className="ep-card-sm flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-foreground">
                          {r.referred_email || r.referred_user_id.slice(0, 8) + "..."}
                        </p>
                        {r.referred_name && (
                          <p className="text-xs text-muted-foreground font-medium">{r.referred_name}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(r.created_at), "dd/MM/yyyy HH:mm")}
                          {r.subscription_plan && ` · ${planLabels[r.subscription_plan] || r.subscription_plan}`}
                          {r.sale_amount && r.sale_amount > 0 && ` · Venda: R$${Number(r.sale_amount).toFixed(2)}`}
                          {r.commission_amount && r.commission_amount > 0 && ` · Comissão: R$${Number(r.commission_amount).toFixed(2)}`}
                        </p>
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

            {/* CodeCoins History */}
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
          </>
        )}

        {/* Dados Bancários */}
        {affTab === "banco" && (
          <div className="ep-card">
            <p className="ep-subtitle mb-4">DADOS PARA RECEBIMENTO (PIX)</p>
            <p className="text-xs text-muted-foreground font-medium mb-6">
              Cadastre seus dados bancários para receber as comissões semanais via PIX.
              O admin fechará a fatura semanal e realizará o pagamento.
            </p>
            <div className="space-y-4 max-w-md">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">TIPO DA CHAVE PIX</label>
                <select value={pixKeyType} onChange={(e) => setPixKeyType(e.target.value)}
                  className="ep-input h-10 rounded-[14px] text-xs px-3 bg-muted border border-border w-full">
                  <option value="cpf">CPF</option>
                  <option value="cnpj">CNPJ</option>
                  <option value="email">E-mail</option>
                  <option value="phone">Telefone</option>
                  <option value="random">Chave Aleatória</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">CHAVE PIX</label>
                <input value={pixKey} onChange={(e) => setPixKey(e.target.value)}
                  placeholder="Sua chave PIX..."
                  className="ep-input h-10 rounded-[14px] text-xs px-3 border border-border w-full" />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">NOME DO TITULAR</label>
                <input value={holderName} onChange={(e) => setHolderName(e.target.value)}
                  placeholder="Nome completo do titular..."
                  className="ep-input h-10 rounded-[14px] text-xs px-3 border border-border w-full" />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">BANCO (OPCIONAL)</label>
                <input value={bankName} onChange={(e) => setBankName(e.target.value)}
                  placeholder="Nome do banco..."
                  className="ep-input h-10 rounded-[14px] text-xs px-3 border border-border w-full" />
              </div>
              <button onClick={saveBankInfo} className="ep-btn-primary h-12 px-8 text-[9px]">
                <Save className="h-4 w-4 mr-2" /> SALVAR DADOS BANCÁRIOS
              </button>
            </div>
          </div>
        )}

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
    </AppLayout>
  );
}
