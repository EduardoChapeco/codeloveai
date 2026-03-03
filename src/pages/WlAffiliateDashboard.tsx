import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Copy, Loader2, DollarSign, Users, TrendingUp, FileText, Building2, Save, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface BankInfo { id: string; holder_name: string; pix_key_type: string; pix_key: string; bank_name: string | null; }
interface WlAffData { id: string; code: string; display_name: string; commission_percent: number; is_active: boolean; }
interface WlReferral { id: string; tenant_id: string; setup_commission_cents: number; subscription_commission_cents: number; total_recurring_earned_cents: number; created_at: string; }
interface WlInvoice { id: string; week_start: string; week_end: string; total_sales: number; total_commission_cents: number; status: string; paid_at: string | null; }

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
        supabase.from("white_label_affiliates").select("id, code, display_name, commission_percent, is_active").eq("user_id", user.id).maybeSingle(),
        supabase.from("white_label_referrals").select("*").order("created_at", { ascending: false }),
        supabase.from("white_label_affiliate_invoices").select("*").eq("user_id", user.id).order("week_start", { ascending: false }).limit(20),
        supabase.from("white_label_affiliate_bank_info").select("id, holder_name, pix_key_type, pix_key, bank_name").eq("user_id", user.id).maybeSingle(),
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
    return <AppLayout><div className="flex items-center justify-center" style={{ minHeight: '60vh' }}><Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--text-tertiary)' }} /></div></AppLayout>;
  }

  if (!wlAff) {
    return (
      <AppLayout>
        <div className="rd-page-content" style={{ maxWidth: 600, textAlign: 'center', paddingTop: 80 }}>
          <div className="rd-ico-box ib-purple" style={{ width: 56, height: 56, margin: '0 auto 16px', borderRadius: 'var(--r4)' }}><Building2 size={24} /></div>
          <h1 className="title-xl" style={{ marginBottom: 12 }}>Você não é afiliado White Label</h1>
          <p className="body-text">Para se tornar afiliado WL e ganhar comissões recorrentes, entre em contato com o administrador.</p>
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
    if (!bankForm.holder_name || !bankForm.pix_key) { toast.error("Preencha nome e chave PIX"); return; }
    setSavingBank(true);
    try {
      const payload = { affiliate_id: wlAff.id, user_id: user.id, holder_name: bankForm.holder_name, pix_key_type: bankForm.pix_key_type, pix_key: bankForm.pix_key, bank_name: bankForm.bank_name || null };
      if (bankInfo) { const { error } = await supabase.from("white_label_affiliate_bank_info").update(payload).eq("id", bankInfo.id); if (error) throw error; }
      else { const { error } = await supabase.from("white_label_affiliate_bank_info").insert(payload); if (error) throw error; }
      toast.success("Dados bancários salvos!");
    } catch (err: any) { toast.error(err.message || "Erro ao salvar"); }
    finally { setSavingBank(false); }
  };

  return (
    <AppLayout>
      <div className="rd-page-content" style={{ maxWidth: 960 }}>
        <div className="rd-page-head">
          <div className="sec-label">Afiliado White Label</div>
          <h1>{wlAff.display_name}</h1>
        </div>

        {/* Link de referência */}
        <div className="rd-card" style={{ marginBottom: 14, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="label-lg" style={{ marginBottom: 4 }}>Seu link de indicação</div>
            <code style={{ fontSize: 11, fontFamily: 'var(--mono)', background: 'var(--bg-4)', padding: '6px 12px', borderRadius: 'var(--r2)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{refLink}</code>
          </div>
          <button onClick={() => { navigator.clipboard.writeText(refLink); toast.success("Link copiado!"); }} className="gl orange sm" style={{ flexShrink: 0 }}>
            <Copy size={13} /> Copiar
          </button>
        </div>

        {/* Stats */}
        <div className="rd-grid-4" style={{ marginBottom: 14 }}>
          {[
            { icon: Users, label: "White Labels indicados", value: totalTenants, color: "ib-blue" },
            { icon: DollarSign, label: "Total ganho", value: formatCents(totalEarned), color: "ib-green" },
            { icon: TrendingUp, label: "Sua comissão", value: `${wlAff.commission_percent}%`, color: "ib-orange" },
            { icon: FileText, label: "Faturas abertas", value: pendingInvoices.length, color: "ib-indigo" },
          ].map((s, i) => (
            <div key={i} className="rd-stat-card" style={{ textAlign: 'center' }}>
              <div className={`rd-ico-box ${s.color}`} style={{ margin: '0 auto 12px' }}><s.icon size={18} /></div>
              <div className="rd-stat-value" style={{ fontSize: 22 }}>{s.value}</div>
              <div className="caption-sm" style={{ marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Referrals */}
        <div className="rd-card" style={{ marginBottom: 14 }}>
          <div className="sec-label" style={{ marginBottom: 16 }}>White Labels indicados</div>
          {referrals.length === 0 ? (
            <p className="body-text" style={{ textAlign: 'center', padding: '24px 0' }}>Nenhuma indicação ainda. Compartilhe seu link!</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {referrals.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--b1)' }}>
                  <div>
                    <div className="label-lg">Tenant {r.tenant_id.substring(0, 8)}...</div>
                    <div className="caption-sm">{format(new Date(r.created_at), "dd/MM/yyyy")}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="label-lg">{formatCents(r.setup_commission_cents + r.subscription_commission_cents)}</div>
                    <div className="caption-sm">Setup + Assinatura</div>
                    {r.total_recurring_earned_cents > 0 && <div className="caption-sm" style={{ color: 'var(--green-l)' }}>+{formatCents(r.total_recurring_earned_cents)} recorrente</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Invoices */}
        <div className="rd-card" style={{ marginBottom: 14 }}>
          <div className="sec-label" style={{ marginBottom: 16 }}>Faturas semanais</div>
          {invoices.length === 0 ? (
            <p className="body-text" style={{ textAlign: 'center', padding: '24px 0' }}>Nenhuma fatura gerada ainda.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {invoices.map(inv => (
                <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--b1)' }}>
                  <div>
                    <div className="label-lg">{format(new Date(inv.week_start), "dd/MM")} — {format(new Date(inv.week_end), "dd/MM/yyyy")}</div>
                    <div className="caption-sm">{inv.total_sales} venda(s)</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="label-lg">{formatCents(inv.total_commission_cents)}</span>
                    <span className={`chip sm ${inv.status === "paid" ? "ch-green" : inv.status === "open" ? "ch-blue" : "ch-gray"}`}>
                      {inv.status === "paid" ? "Pago" : inv.status === "open" ? "Aberto" : inv.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bank Info */}
        <div className="rd-card">
          <div className="sec-label" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CreditCard size={14} /> Dados para Saque (PIX)
          </div>
          <div className="rd-grid-2" style={{ marginBottom: 16 }}>
            <div>
              <div className="caption-sm" style={{ marginBottom: 6 }}>Nome do titular *</div>
              <input className="rd-input" value={bankForm.holder_name} onChange={e => setBankForm({ ...bankForm, holder_name: e.target.value })} placeholder="Nome completo" />
            </div>
            <div>
              <div className="caption-sm" style={{ marginBottom: 6 }}>Banco (opcional)</div>
              <input className="rd-input" value={bankForm.bank_name} onChange={e => setBankForm({ ...bankForm, bank_name: e.target.value })} placeholder="Ex: Nubank, Itaú..." />
            </div>
          </div>
          <div className="rd-grid-2" style={{ marginBottom: 16 }}>
            <div>
              <div className="caption-sm" style={{ marginBottom: 6 }}>Tipo da chave PIX *</div>
              <select className="rd-input" value={bankForm.pix_key_type} onChange={e => setBankForm({ ...bankForm, pix_key_type: e.target.value })}>
                <option value="cpf">CPF</option><option value="cnpj">CNPJ</option><option value="email">Email</option><option value="phone">Telefone</option><option value="random">Chave aleatória</option>
              </select>
            </div>
            <div>
              <div className="caption-sm" style={{ marginBottom: 6 }}>Chave PIX *</div>
              <input className="rd-input" value={bankForm.pix_key} onChange={e => setBankForm({ ...bankForm, pix_key: e.target.value })} placeholder="Sua chave PIX" />
            </div>
          </div>
          <button onClick={saveBank} disabled={savingBank} className="gl orange">
            {savingBank ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {bankInfo ? "Atualizar dados" : "Salvar dados"}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
