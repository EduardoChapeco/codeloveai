import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Copy, Loader2, DollarSign, Users, TrendingUp, FileText, Building2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

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

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/login"); return; }

    const load = async () => {
      const [affRes, refRes, invRes] = await Promise.all([
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
      ]);

      setWlAff(affRes.data as WlAffData | null);
      setReferrals((refRes.data as WlReferral[]) || []);
      setInvoices((invRes.data as WlInvoice[]) || []);
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
  const refLink = `${window.location.origin}/white-label/ref/${wlAff.code}`;

  const formatCents = (c: number) => `R$${(c / 100).toFixed(2).replace(".", ",")}`;

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
      </div>
    </AppLayout>
  );
}
