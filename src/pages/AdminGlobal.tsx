import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { useSEO } from "@/hooks/useSEO";
import { useTenant } from "@/contexts/TenantContext";
import { THEME_PRESETS } from "@/lib/tenant-themes";
import {
  Building2, Plus, Pencil, Trash2, DollarSign, Wallet, Users,
  BarChart3, CheckCircle, XCircle, Loader2, Save, ArrowLeft,
  Globe, Palette, FileText, Eye, EyeOff, RefreshCw, Shield, BookOpen, LogIn
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import AppLayout from "@/components/AppLayout";

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  domain_custom: string | null;
  is_domain_approved: boolean;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  meta_title: string | null;
  meta_description: string | null;
  terms_template: string | null;
  commission_percent: number;
  token_cost: number;
  is_active: boolean;
  created_at: string;
  theme_preset: string;
  font_family: string;
  border_radius: string;
}

interface LedgerEntry {
  id: string;
  tenant_id: string;
  payment_id: string | null;
  entry_type: string;
  amount: number;
  description: string;
  created_at: string;
}

interface TenantWallet {
  tenant_id: string;
  balance: number;
  total_credited: number;
  total_debited: number;
}

interface AdminCommission {
  id: string;
  tenant_id: string;
  sale_amount: number;
  commission_percent: number;
  commission_amount: number;
  created_at: string;
  payment_id: string | null;
}

type Tab = "tenants" | "finances" | "commissions" | "wallets" | "ledger" | "operations";

export default function AdminGlobal() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  useSEO({ title: "Admin Global" });
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") || "tenants") as Tab;

  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [wallets, setWallets] = useState<TenantWallet[]>([]);
  const [commissions, setCommissions] = useState<AdminCommission[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Create/Edit tenant sheet
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<TenantRow | null>(null);
  const [form, setForm] = useState({
    name: "", slug: "", domain_custom: "", logo_url: "", favicon_url: "",
    primary_color: "#0A84FF", secondary_color: "#5E5CE6", accent_color: "#5E5CE6",
    meta_title: "", meta_description: "", terms_template: "",
    commission_percent: 30, token_cost: 0, is_active: true, is_domain_approved: false,
    theme_preset: "apple-glass", font_family: "system", border_radius: "1rem",
  });
  const [saving, setSaving] = useState(false);

  // Wallet credit sheet
  const [creditSheetOpen, setCreditSheetOpen] = useState(false);
  const [creditTenantId, setCreditTenantId] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditDescription, setCreditDescription] = useState("");

  useEffect(() => {
    if (!authLoading && !adminLoading) {
      if (!user) navigate("/login");
      else if (!isAdmin) navigate("/dashboard");
    }
  }, [user, isAdmin, authLoading, adminLoading, navigate]);

  const fetchAll = async () => {
    setLoading(true);
    const [tenantsRes, walletsRes, commissionsRes, ledgerRes] = await Promise.all([
      supabase.from("tenants").select("*").order("created_at", { ascending: true }),
      supabase.from("tenant_wallets").select("*"),
      supabase.from("admin_commissions").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("ledger_entries").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    setTenants(tenantsRes.data || []);
    setWallets(walletsRes.data || []);
    setCommissions(commissionsRes.data || []);
    setLedgerEntries((ledgerRes.data as LedgerEntry[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) fetchAll();
  }, [isAdmin]);

  const openCreate = () => {
    setEditingTenant(null);
    setForm({
      name: "", slug: "", domain_custom: "", logo_url: "", favicon_url: "",
      primary_color: "#0A84FF", secondary_color: "#5E5CE6", accent_color: "#5E5CE6",
      meta_title: "", meta_description: "", terms_template: "",
      commission_percent: 30, token_cost: 0, is_active: true, is_domain_approved: false,
      theme_preset: "apple-glass", font_family: "system", border_radius: "1rem",
    });
    setSheetOpen(true);
  };

  const openEdit = (t: TenantRow) => {
    setEditingTenant(t);
    setForm({
      name: t.name, slug: t.slug, domain_custom: t.domain_custom || "",
      logo_url: t.logo_url || "", favicon_url: t.favicon_url || "",
      primary_color: t.primary_color, secondary_color: t.secondary_color,
      accent_color: t.accent_color || "#5E5CE6",
      meta_title: t.meta_title || "", meta_description: t.meta_description || "",
      terms_template: t.terms_template || "",
      commission_percent: t.commission_percent, token_cost: t.token_cost,
      is_active: t.is_active, is_domain_approved: t.is_domain_approved,
      theme_preset: t.theme_preset || "apple-glass",
      font_family: t.font_family || "system",
      border_radius: t.border_radius || "1rem",
    });
    setSheetOpen(true);
  };

  const saveTenant = async () => {
    if (!form.name || !form.slug) return toast.error("Nome e slug são obrigatórios.");
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        slug: form.slug.toLowerCase().replace(/[^a-z0-9_-]/g, ""),
        domain_custom: form.domain_custom || null,
        logo_url: form.logo_url || null,
        favicon_url: form.favicon_url || null,
        primary_color: form.primary_color,
        secondary_color: form.secondary_color,
        accent_color: form.accent_color,
        meta_title: form.meta_title || null,
        meta_description: form.meta_description || null,
        terms_template: form.terms_template || null,
        commission_percent: form.commission_percent,
        token_cost: form.token_cost,
        is_active: form.is_active,
        is_domain_approved: form.is_domain_approved,
        theme_preset: form.theme_preset,
        font_family: form.font_family,
        border_radius: form.border_radius,
      };

      if (editingTenant) {
        const { error } = await supabase.from("tenants").update(payload).eq("id", editingTenant.id);
        if (error) throw error;
        toast.success("Tenant atualizado!");
      } else {
        const { data: newTenant, error } = await supabase.from("tenants").insert(payload).select("id").single();
        if (error) throw error;
        // Create wallet for new tenant
        await supabase.from("tenant_wallets").insert({ tenant_id: newTenant.id, balance: 0, total_credited: 0, total_debited: 0 });
        toast.success("Tenant criado!");
      }
      setSheetOpen(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar tenant");
    } finally {
      setSaving(false);
    }
  };

  const toggleTenantActive = async (id: string, currentActive: boolean) => {
    await supabase.from("tenants").update({ is_active: !currentActive }).eq("id", id);
    toast.success(currentActive ? "Tenant desativado" : "Tenant ativado");
    fetchAll();
  };

  const toggleDomainApproved = async (id: string, current: boolean) => {
    await supabase.from("tenants").update({ is_domain_approved: !current }).eq("id", id);
    toast.success(current ? "Domínio desaprovado" : "Domínio aprovado!");
    fetchAll();
  };

  const impersonateTenant = (tenantSlug: string) => {
    window.open(`/admin?tenant=${tenantSlug}`, "_blank");
  };

  const creditWallet = async () => {
    if (!creditTenantId || !creditAmount || Number(creditAmount) <= 0) return toast.error("Preencha todos os campos");
    const amount = Number(creditAmount);
    const { data: wallet } = await supabase.from("tenant_wallets").select("balance, total_credited").eq("tenant_id", creditTenantId).maybeSingle();
    if (!wallet) return toast.error("Wallet não encontrado");

    await supabase.from("tenant_wallets").update({
      balance: wallet.balance + amount,
      total_credited: wallet.total_credited + amount,
    }).eq("tenant_id", creditTenantId);

    await supabase.from("tenant_wallet_transactions").insert({
      tenant_id: creditTenantId,
      amount,
      type: "credit",
      description: creditDescription || "Crédito manual pelo admin global",
    });

    toast.success(`R$${amount.toFixed(2)} creditado!`);
    setCreditSheetOpen(false);
    setCreditAmount("");
    setCreditDescription("");
    fetchAll();
  };

  const getWallet = (tenantId: string) => wallets.find(w => w.tenant_id === tenantId);
  const getTenantName = (tenantId: string) => tenants.find(t => t.id === tenantId)?.name || "?";

  const totalRevenue = commissions.reduce((s, c) => s + c.commission_amount, 0);
  const totalSales = commissions.reduce((s, c) => s + c.sale_amount, 0);

  if (authLoading || adminLoading || loading) {
    return <AppLayout><div className="min-h-full flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="min-h-full">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="lv-overline mb-1">Administração Global</p>
              <h1 className="lv-heading-lg">White Label</h1>
            </div>
            <button onClick={() => navigate("/admin")} className="lv-btn-secondary h-9 px-4 text-xs flex items-center gap-2">
              <ArrowLeft className="h-3.5 w-3.5" /> Admin Tenant
            </button>
          </div>

          {/* Tab navigation */}
          <div className="flex gap-2 flex-wrap">
            {([
              { id: "tenants", label: "Tenants", icon: Building2 },
              { id: "finances", label: "Faturamento", icon: BarChart3 },
              { id: "commissions", label: "Comissões", icon: DollarSign },
              { id: "wallets", label: "Wallets", icon: Wallet },
              { id: "ledger", label: "Ledger", icon: BookOpen },
              { id: "operations", label: "Operações", icon: Shield },
            ] as const).map(t => (
              <button
                key={t.id}
                onClick={() => setSearchParams({ tab: t.id })}
                className={`lv-btn-secondary h-9 px-4 text-xs flex items-center gap-2 ${tab === t.id ? "lv-btn-primary" : ""}`}
              >
                <t.icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            ))}
          </div>

          {/* ─── TENANTS TAB ─── */}
          {tab === "tenants" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="lv-body-strong">{tenants.length} tenant(s)</p>
                <button onClick={openCreate} className="lv-btn-primary h-9 px-4 text-xs flex items-center gap-2">
                  <Plus className="h-3.5 w-3.5" /> Novo Tenant
                </button>
              </div>

              <div className="space-y-3">
                {tenants.map(t => {
                  const wallet = getWallet(t.id);
                  return (
                    <div key={t.id} className="lv-card">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          {t.logo_url ? (
                            <img src={t.logo_url} alt={t.name} className="h-10 w-10 rounded-xl object-cover" />
                          ) : (
                            <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: t.primary_color + "20" }}>
                              <Building2 className="h-5 w-5" style={{ color: t.primary_color }} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="lv-body-strong truncate">{t.name}</p>
                            <p className="lv-caption truncate">/{t.slug} {t.domain_custom && `• ${t.domain_custom}`}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`lv-badge ${t.is_active ? "lv-badge-success" : "lv-badge-muted"}`}>
                            {t.is_active ? "Ativo" : "Inativo"}
                          </span>
                          {t.domain_custom && (
                            <button
                              onClick={() => toggleDomainApproved(t.id, t.is_domain_approved)}
                              className={`lv-badge cursor-pointer ${t.is_domain_approved ? "lv-badge-success" : "lv-badge-muted"}`}
                              title={t.is_domain_approved ? "Domínio aprovado - clique para desaprovar" : "Domínio pendente - clique para aprovar"}
                            >
                              <Globe className="h-3 w-3 mr-1 inline" />
                              {t.is_domain_approved ? "DNS ✓" : "DNS ✗"}
                            </button>
                          )}
                          <button onClick={() => impersonateTenant(t.slug)} className="lv-btn-icon h-8 w-8" title="Impersonar tenant">
                            <LogIn className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => openEdit(t)} className="lv-btn-icon h-8 w-8">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => toggleTenantActive(t.id, t.is_active)} className="lv-btn-icon h-8 w-8">
                            {t.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                        <div className="rounded-lg bg-muted/50 p-3">
                          <p className="lv-caption">Comissão Admin</p>
                          <p className="lv-stat text-lg">{t.commission_percent}%</p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-3">
                          <p className="lv-caption">Custo Token</p>
                          <p className="lv-stat text-lg">R${Number(t.token_cost).toFixed(2)}</p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-3">
                          <p className="lv-caption">Saldo Wallet</p>
                          <p className="lv-stat text-lg">R${wallet ? Number(wallet.balance).toFixed(2) : "0.00"}</p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-3 flex items-center gap-2">
                          <div className="h-4 w-4 rounded-full" style={{ backgroundColor: t.primary_color }} />
                          <div className="h-4 w-4 rounded-full" style={{ backgroundColor: t.secondary_color }} />
                          <span className="lv-caption">Cores</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─── FINANCES TAB ─── */}
          {tab === "finances" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="lv-card text-center">
                  <p className="lv-caption">Total Vendas</p>
                  <p className="lv-stat text-2xl">R${totalSales.toFixed(2)}</p>
                </div>
                <div className="lv-card text-center">
                  <p className="lv-caption">Comissões Admin</p>
                  <p className="lv-stat text-2xl text-green-600">R${totalRevenue.toFixed(2)}</p>
                </div>
                <div className="lv-card text-center">
                  <p className="lv-caption">Tenants Ativos</p>
                  <p className="lv-stat text-2xl">{tenants.filter(t => t.is_active).length}</p>
                </div>
              </div>

              {/* Per-tenant breakdown */}
              <div className="lv-card">
                <p className="lv-overline mb-4">Faturamento por Tenant</p>
                <div className="space-y-3">
                  {tenants.map(t => {
                    const tenantCommissions = commissions.filter(c => c.tenant_id === t.id);
                    const tenantSales = tenantCommissions.reduce((s, c) => s + c.sale_amount, 0);
                    const tenantAdminRev = tenantCommissions.reduce((s, c) => s + c.commission_amount, 0);
                    return (
                      <div key={t.id} className="lv-card-sm flex items-center justify-between">
                        <div>
                          <p className="lv-body-strong">{t.name}</p>
                          <p className="lv-caption">{tenantCommissions.length} vendas</p>
                        </div>
                        <div className="text-right">
                          <p className="lv-body-strong">R${tenantSales.toFixed(2)}</p>
                          <p className="lv-caption text-green-600">+R${tenantAdminRev.toFixed(2)} comissão</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ─── COMMISSIONS TAB ─── */}
          {tab === "commissions" && (
            <div className="space-y-4">
              <p className="lv-body-strong">{commissions.length} comissão(ões) registradas</p>
              <div className="space-y-2">
                {commissions.map(c => (
                  <div key={c.id} className="lv-card-sm flex items-center justify-between">
                    <div>
                      <p className="lv-body-strong">{getTenantName(c.tenant_id)}</p>
                      <p className="lv-caption">Venda: R${Number(c.sale_amount).toFixed(2)} • {c.commission_percent}%</p>
                      <p className="lv-caption">{format(new Date(c.created_at), "dd/MM/yyyy HH:mm")}</p>
                    </div>
                    <div className="text-right">
                      <p className="lv-stat text-lg text-green-600">+R${Number(c.commission_amount).toFixed(2)}</p>
                      {c.payment_id && <p className="lv-caption">#{c.payment_id}</p>}
                    </div>
                  </div>
                ))}
                {commissions.length === 0 && <p className="lv-caption text-center py-8">Nenhuma comissão registrada ainda.</p>}
              </div>
            </div>
          )}

          {/* ─── WALLETS TAB ─── */}
          {tab === "wallets" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="lv-body-strong">{wallets.length} wallet(s)</p>
                <button onClick={() => setCreditSheetOpen(true)} className="lv-btn-primary h-9 px-4 text-xs flex items-center gap-2">
                  <Plus className="h-3.5 w-3.5" /> Creditar Saldo
                </button>
              </div>

              <div className="space-y-3">
                {wallets.map(w => (
                  <div key={w.tenant_id} className="lv-card flex items-center justify-between">
                    <div>
                      <p className="lv-body-strong">{getTenantName(w.tenant_id)}</p>
                      <p className="lv-caption">Creditado: R${Number(w.total_credited).toFixed(2)} • Debitado: R${Number(w.total_debited).toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="lv-stat text-xl">R${Number(w.balance).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── LEDGER TAB ─── */}
          {tab === "ledger" && (
            <div className="space-y-4">
              <p className="lv-body-strong">{ledgerEntries.length} entrada(s) no ledger</p>
              <div className="space-y-2">
                {ledgerEntries.map(e => (
                  <div key={e.id} className="lv-card-sm flex items-center justify-between">
                    <div>
                      <p className="lv-body-strong">{getTenantName(e.tenant_id)}</p>
                      <p className="lv-caption">{e.entry_type} • {e.description}</p>
                      <p className="lv-caption">{format(new Date(e.created_at), "dd/MM/yyyy HH:mm")}</p>
                    </div>
                    <div className="text-right">
                      <p className={`lv-stat text-lg ${e.entry_type === "admin_commission" ? "text-green-600" : ""}`}>
                        R${Number(e.amount).toFixed(2)}
                      </p>
                      {e.payment_id && <p className="lv-caption">#{e.payment_id}</p>}
                    </div>
                  </div>
                ))}
                {ledgerEntries.length === 0 && <p className="lv-caption text-center py-8">Nenhuma entrada no ledger ainda.</p>}
              </div>
            </div>
          )}

          {/* ─── OPERATIONS TAB ─── */}
          {tab === "operations" && (
            <div className="space-y-6">
              {/* Impersonate */}
              <div className="lv-card">
                <p className="lv-overline mb-4">Impersonar Tenant</p>
                <p className="lv-caption mb-4">Abra o painel admin no contexto de um tenant específico.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {tenants.filter(t => t.is_active).map(t => (
                    <button
                      key={t.id}
                      onClick={() => impersonateTenant(t.slug)}
                      className="lv-card-sm flex items-center gap-3 hover:bg-muted/50 transition-colors cursor-pointer text-left"
                    >
                      <LogIn className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="lv-body-strong truncate">{t.name}</p>
                        <p className="lv-caption truncate">/{t.slug}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Domain Approvals */}
              <div className="lv-card">
                <p className="lv-overline mb-4">Aprovação de Domínios</p>
                <div className="space-y-3">
                  {tenants.filter(t => t.domain_custom).map(t => (
                    <div key={t.id} className="lv-card-sm flex items-center justify-between">
                      <div>
                        <p className="lv-body-strong">{t.name}</p>
                        <p className="lv-caption">{t.domain_custom}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`lv-badge ${t.is_domain_approved ? "lv-badge-success" : "lv-badge-muted"}`}>
                          {t.is_domain_approved ? "Aprovado" : "Pendente"}
                        </span>
                        <button
                          onClick={() => toggleDomainApproved(t.id, t.is_domain_approved)}
                          className={`lv-btn-secondary h-8 px-3 text-xs ${!t.is_domain_approved ? "lv-btn-primary" : ""}`}
                        >
                          {t.is_domain_approved ? "Revogar" : "Aprovar"}
                        </button>
                      </div>
                    </div>
                  ))}
                  {tenants.filter(t => t.domain_custom).length === 0 && (
                    <p className="lv-caption text-center py-4">Nenhum tenant com domínio customizado.</p>
                  )}
                </div>
              </div>

              {/* RLS Healthcheck */}
              <div className="lv-card">
                <p className="lv-overline mb-4">Segurança & Auditoria</p>
                <div className="space-y-2">
                  <div className="lv-card-sm flex items-center justify-between">
                    <div>
                      <p className="lv-body-strong">Tenants Ativos</p>
                      <p className="lv-caption">Com domínio aprovado</p>
                    </div>
                    <p className="lv-stat text-lg">{tenants.filter(t => t.is_active && t.is_domain_approved).length}/{tenants.filter(t => t.is_active).length}</p>
                  </div>
                  <div className="lv-card-sm flex items-center justify-between">
                    <div>
                      <p className="lv-body-strong">Wallets com Saldo</p>
                    </div>
                    <p className="lv-stat text-lg">{wallets.filter(w => Number(w.balance) > 0).length}/{wallets.length}</p>
                  </div>
                  <div className="lv-card-sm flex items-center justify-between">
                    <div>
                      <p className="lv-body-strong">Entradas no Ledger</p>
                    </div>
                    <p className="lv-stat text-lg">{ledgerEntries.length}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Tenant Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingTenant ? "Editar Tenant" : "Novo Tenant"}</SheetTitle>
            <SheetDescription>{editingTenant ? "Atualize as configurações do tenant." : "Crie um novo white label."}</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div>
              <label className="lv-caption block mb-1">Nome *</label>
              <input className="lv-input w-full" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Meu SaaS" />
            </div>
            <div>
              <label className="lv-caption block mb-1">Slug * (URL)</label>
              <input className="lv-input w-full" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="meu-saas" />
            </div>
            <div>
              <label className="lv-caption block mb-1">Domínio Custom</label>
              <input className="lv-input w-full" value={form.domain_custom} onChange={e => setForm({ ...form, domain_custom: e.target.value })} placeholder="app.meusaas.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="lv-caption block mb-1">Cor Primária</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.primary_color} onChange={e => setForm({ ...form, primary_color: e.target.value })} className="h-9 w-9 rounded cursor-pointer" />
                  <input className="lv-input flex-1" value={form.primary_color} onChange={e => setForm({ ...form, primary_color: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="lv-caption block mb-1">Cor Secundária</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.secondary_color} onChange={e => setForm({ ...form, secondary_color: e.target.value })} className="h-9 w-9 rounded cursor-pointer" />
                  <input className="lv-input flex-1" value={form.secondary_color} onChange={e => setForm({ ...form, secondary_color: e.target.value })} />
                </div>
              </div>
            </div>
            {/* Accent color */}
            <div>
              <label className="lv-caption block mb-1">Cor Accent</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.accent_color} onChange={e => setForm({ ...form, accent_color: e.target.value })} className="h-9 w-9 rounded cursor-pointer" />
                <input className="lv-input flex-1" value={form.accent_color} onChange={e => setForm({ ...form, accent_color: e.target.value })} />
              </div>
            </div>
            {/* Theme Preset */}
            <div>
              <label className="lv-caption block mb-2">Tema Visual</label>
              <div className="grid grid-cols-2 gap-2">
                {THEME_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setForm({ ...form, theme_preset: preset.id })}
                    className={`rounded-xl border p-2.5 text-left transition-all ${
                      form.theme_preset === preset.id
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border/60 hover:border-border"
                    }`}
                  >
                    <div className="flex gap-1 mb-1.5">
                      {[preset.preview.bg, preset.preview.card, preset.preview.primary, preset.preview.accent].map((c, i) => (
                        <div key={i} className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <p className="text-xs font-medium text-foreground">{preset.name}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">{preset.description}</p>
                  </button>
                ))}
              </div>
            </div>
            {/* Font Family */}
            <div>
              <label className="lv-caption block mb-1">Fonte</label>
              <select className="lv-input w-full" value={form.font_family} onChange={e => setForm({ ...form, font_family: e.target.value })}>
                <option value="system">System (Apple)</option>
                <option value="inter">Inter</option>
                <option value="poppins">Poppins</option>
                <option value="dm_sans">DM Sans</option>
                <option value="space_grotesk">Space Grotesk</option>
                <option value="nunito">Nunito</option>
              </select>
            </div>
            {/* Border Radius */}
            <div>
              <label className="lv-caption block mb-1">Border Radius</label>
              <select className="lv-input w-full" value={form.border_radius} onChange={e => setForm({ ...form, border_radius: e.target.value })}>
                <option value="0.25rem">Sharp (4px)</option>
                <option value="0.5rem">Small (8px)</option>
                <option value="0.75rem">Medium (12px)</option>
                <option value="1rem">Large (16px)</option>
                <option value="1.5rem">XL (24px)</option>
              </select>
            </div>
            <div>
              <label className="lv-caption block mb-1">Logo URL</label>
              <input className="lv-input w-full" value={form.logo_url} onChange={e => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." />
            </div>
            <div>
              <label className="lv-caption block mb-1">Favicon URL</label>
              <input className="lv-input w-full" value={form.favicon_url} onChange={e => setForm({ ...form, favicon_url: e.target.value })} placeholder="https://..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="lv-caption block mb-1">Comissão Admin (%)</label>
                <input type="number" className="lv-input w-full" value={form.commission_percent} onChange={e => setForm({ ...form, commission_percent: Number(e.target.value) })} min={0} max={100} />
              </div>
              <div>
                <label className="lv-caption block mb-1">Custo Token (R$)</label>
                <input type="number" className="lv-input w-full" value={form.token_cost} onChange={e => setForm({ ...form, token_cost: Number(e.target.value) })} min={0} step={0.01} />
              </div>
            </div>
            <div>
              <label className="lv-caption block mb-1">Meta Title (SEO)</label>
              <input className="lv-input w-full" value={form.meta_title} onChange={e => setForm({ ...form, meta_title: e.target.value })} />
            </div>
            <div>
              <label className="lv-caption block mb-1">Meta Description (SEO)</label>
              <textarea className="lv-input w-full h-20 resize-none" value={form.meta_description} onChange={e => setForm({ ...form, meta_description: e.target.value })} />
            </div>
            <div>
              <label className="lv-caption block mb-1">Template de Termos</label>
              <textarea className="lv-input w-full h-32 resize-none" value={form.terms_template} onChange={e => setForm({ ...form, terms_template: e.target.value })} placeholder="Termos de uso personalizados..." />
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 rounded" />
              <span className="lv-body">Tenant ativo</span>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={form.is_domain_approved} onChange={e => setForm({ ...form, is_domain_approved: e.target.checked })} className="h-4 w-4 rounded" />
              <span className="lv-body">Domínio aprovado</span>
            </div>
            <button onClick={saveTenant} disabled={saving} className="lv-btn-primary w-full h-10 text-sm flex items-center justify-center gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editingTenant ? "Salvar Alterações" : "Criar Tenant"}
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Credit Wallet Sheet */}
      <Sheet open={creditSheetOpen} onOpenChange={setCreditSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Creditar Saldo</SheetTitle>
            <SheetDescription>Adicione saldo ao wallet de um tenant.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div>
              <label className="lv-caption block mb-1">Tenant</label>
              <select className="lv-input w-full" value={creditTenantId} onChange={e => setCreditTenantId(e.target.value)}>
                <option value="">Selecione...</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="lv-caption block mb-1">Valor (R$)</label>
              <input type="number" className="lv-input w-full" value={creditAmount} onChange={e => setCreditAmount(e.target.value)} min={0} step={0.01} />
            </div>
            <div>
              <label className="lv-caption block mb-1">Descrição</label>
              <input className="lv-input w-full" value={creditDescription} onChange={e => setCreditDescription(e.target.value)} placeholder="Crédito manual" />
            </div>
            <button onClick={creditWallet} className="lv-btn-primary w-full h-10 text-sm">Creditar</button>
          </div>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
