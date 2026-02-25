import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Copy, Loader2, DollarSign, Users, TrendingUp, FileText, Building2, Save, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface BankInfo {
  id: string;
  holder_name: string;
  pix_key_type: string;
  pix_key: string;
  bank_name: string | null;
}

interface WlAffData {
  id: string;
  code: string;
  display_name: string;
  commission_percent: number;
  is_active: boolean;
}

interface WlReferral {
  id: string;
  tenant_id: string;
  setup_commission_cents: number;
  subscription_commission_cents: number;
  total_recurring_earned_cents: number;
  created_at: string;
}

interface WlInvoice {
  id: string;
  week_start: string;
  week_end: string;
  total_sales: number;
  total_commission_cents: number;
  status: string;
  paid_at: string | null;
}

export default function WlAffiliateDashboard() {
  const { user, loading: authLoading } = useAuthContext();
  const navigate = useNavigate();
  const [wlAff, setWlAff] = useState<WlAffData | null>(null);
  const [referrals, setReferrals] = useState<WlReferral[]>([]);
  const [invoices, setInvoices] = useState<WlInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [bankInfo, setBankInfo] = useState<BankInfo | null>(null);
  const [bankForm, setBankForm] = useState({ holder_name: "", pix_key_type: "cpf", pix_key: "", bank_name: "" });
  const [savingBank, setSavingBank] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/login"); return; }

    const load = async () => {
      const [affRes, refRes, invRes, bankRes] = await Promise.all([
        supabase
          .from("white_label_affiliates")
          .select("id, code, display_name, commission_percent, is_active")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("white_label_referrals")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("white_label_affiliate_invoices")
          .select("*")
          .eq("user_id", user.id)
          .order("week_start", { ascending: false })
          .limit(20),
        supabase
          .from("white_label_affiliate_bank_info")
          .select("id, holder_name, pix_key_type, pix_key, bank_name")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      setWlAff(affRes.data as WlAffData | null);
      setReferrals((refRes.data as WlReferral[]) || []);
      setInvoices((invRes.data as WlInvoice[]) || []);
      if (bankRes.data) {
        const b = bankRes.data as BankInfo;
        setBankInfo(b);
        setBankForm({ holder_name: b.holder_name, pix_key_type: b.pix_key_type, pix_key: b.pix_key, bank_name: b.bank_name || "" });
      }
      setLoading(false);
    };
    load();
  }, [user, authLoading, navigate]);

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!wlAff) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto py-20 text-center">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h1 className="lv-heading-lg mb-3">Você não é afiliado White Label</h1>
          <p className="lv-body">
            Para se tornar afiliado WL e ganhar comissões recorrentes,
            entre em contato com o administrador.
          </p>
        </div>
      </AppLayout>
    );
  }

  const totalEarned = referrals.reduce((s, r) => s + (r.setup_commission_cents + r.subscription_commission_cents + r.total_recurring_earned_cents), 0);
  const totalTenants = referrals.length;
  const pendingInvoices = invoices.filter(i => i.status === "open" || i.status === "pending");
  const siteBase = import.meta.env.VITE_SITE_URL || "https://starble.lovable.app";
  const refLink = `${siteBase}/white-label/ref/${wlAff.code}`;

  const formatCents = (c: number) => `R$${(c / 100).toFixed(2).replace(".", ",")}`;

  const saveBank = async () => {
    if (!wlAff || !user) return;
    if (!bankForm.holder_name || !bankForm.pix_key) {
      toast.error("Preencha nome e chave PIX");
      return;
    }
    setSavingBank(true);
    try {
      const payload = {
        affiliate_id: wlAff.id,
        user_id: user.id,
        holder_name: bankForm.holder_name,
        pix_key_type: bankForm.pix_key_type,
        pix_key: bankForm.pix_key,
        bank_name: bankForm.bank_name || null,
      };
      if (bankInfo) {
        const { error } = await supabase.from("white_label_affiliate_bank_info").update(payload).eq("id", bankInfo.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("white_label_affiliate_bank_info").insert(payload);
        if (error) throw error;
      }
      toast.success("Dados bancários salvos!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSavingBank(false);
    }
  };
  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto py-8 px-4 space-y-8">
        {/* Header */}
        <div>
          <p className="lv-overline mb-1">Afiliado White Label</p>
          <h1 className="lv-heading-xl">{wlAff.display_name}</h1>
        </div>

        {/* Link de referência */}
        <div className="lv-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="lv-body-strong mb-1">Seu link de indicação</p>
            <code className="text-xs bg-muted px-3 py-1.5 rounded block truncate">{refLink}</code>
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(refLink); toast.success("Link copiado!"); }}
            className="lv-btn-primary h-9 px-4 text-xs flex items-center gap-2 shrink-0"
          >
            <Copy className="h-3.5 w-3.5" /> Copiar
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="lv-card-sm text-center">
            <Users className="h-5 w-5 mx-auto text-primary mb-2" />
            <p className="lv-stat text-2xl">{totalTenants}</p>
            <p className="lv-caption">White Labels indicados</p>
          </div>
          <div className="lv-card-sm text-center">
            <DollarSign className="h-5 w-5 mx-auto text-primary mb-2" />
            <p className="lv-stat text-2xl">{formatCents(totalEarned)}</p>
            <p className="lv-caption">Total ganho</p>
          </div>
          <div className="lv-card-sm text-center">
            <TrendingUp className="h-5 w-5 mx-auto text-primary mb-2" />
            <p className="lv-stat text-2xl">{wlAff.commission_percent}%</p>
            <p className="lv-caption">Sua comissão</p>
          </div>
          <div className="lv-card-sm text-center">
            <FileText className="h-5 w-5 mx-auto text-primary mb-2" />
            <p className="lv-stat text-2xl">{pendingInvoices.length}</p>
            <p className="lv-caption">Faturas abertas</p>
          </div>
        </div>

        {/* Referrals */}
        <div>
          <h2 className="lv-heading-sm mb-4">White Labels indicados</h2>
          {referrals.length === 0 ? (
            <p className="lv-caption text-center py-8">Nenhuma indicação ainda. Compartilhe seu link!</p>
          ) : (
            <div className="space-y-3">
              {referrals.map(r => (
                <div key={r.id} className="lv-card flex items-center justify-between">
                  <div>
                    <p className="lv-body-strong">Tenant {r.tenant_id.substring(0, 8)}...</p>
                    <p className="lv-caption">{format(new Date(r.created_at), "dd/MM/yyyy")}</p>
                  </div>
                  <div className="text-right">
                    <p className="lv-body-strong">{formatCents(r.setup_commission_cents + r.subscription_commission_cents)}</p>
                    <p className="lv-caption">Setup + Assinatura</p>
                    {r.total_recurring_earned_cents > 0 && (
                      <p className="lv-caption text-primary">+{formatCents(r.total_recurring_earned_cents)} recorrente</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Invoices */}
        <div>
          <h2 className="lv-heading-sm mb-4">Faturas semanais</h2>
          {invoices.length === 0 ? (
            <p className="lv-caption text-center py-8">Nenhuma fatura gerada ainda.</p>
          ) : (
            <div className="space-y-3">
              {invoices.map(inv => (
                <div key={inv.id} className="lv-card flex items-center justify-between">
                  <div>
                    <p className="lv-body-strong">
                      {format(new Date(inv.week_start), "dd/MM")} — {format(new Date(inv.week_end), "dd/MM/yyyy")}
                    </p>
                    <p className="lv-caption">{inv.total_sales} venda(s)</p>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <p className="lv-stat text-lg">{formatCents(inv.total_commission_cents)}</p>
                    <span className={`lv-badge ${
                      inv.status === "paid" ? "lv-badge-success" :
                      inv.status === "open" ? "lv-badge-primary" : "lv-badge-muted"
                    }`}>
                      {inv.status === "paid" ? "Pago" : inv.status === "open" ? "Aberto" : inv.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bank Info (PIX) */}
        <div>
          <h2 className="lv-heading-sm mb-4 flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> Dados para Saque (PIX)
          </h2>
          <div className="lv-card space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="lv-caption block mb-1">Nome do titular *</label>
                <input
                  className="lv-input w-full"
                  value={bankForm.holder_name}
                  onChange={e => setBankForm({ ...bankForm, holder_name: e.target.value })}
                  placeholder="Nome completo"
                />
              </div>
              <div>
                <label className="lv-caption block mb-1">Banco (opcional)</label>
                <input
                  className="lv-input w-full"
                  value={bankForm.bank_name}
                  onChange={e => setBankForm({ ...bankForm, bank_name: e.target.value })}
                  placeholder="Ex: Nubank, Itaú..."
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="lv-caption block mb-1">Tipo da chave PIX *</label>
                <select
                  className="lv-input w-full"
                  value={bankForm.pix_key_type}
                  onChange={e => setBankForm({ ...bankForm, pix_key_type: e.target.value })}
                >
                  <option value="cpf">CPF</option>
                  <option value="cnpj">CNPJ</option>
                  <option value="email">Email</option>
                  <option value="phone">Telefone</option>
                  <option value="random">Chave aleatória</option>
                </select>
              </div>
              <div>
                <label className="lv-caption block mb-1">Chave PIX *</label>
                <input
                  className="lv-input w-full"
                  value={bankForm.pix_key}
                  onChange={e => setBankForm({ ...bankForm, pix_key: e.target.value })}
                  placeholder="Sua chave PIX"
                />
              </div>
            </div>
            <button
              onClick={saveBank}
              disabled={savingBank}
              className="lv-btn-primary h-10 px-6 text-sm flex items-center gap-2"
            >
              {savingBank ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {bankInfo ? "Atualizar dados" : "Salvar dados"}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
