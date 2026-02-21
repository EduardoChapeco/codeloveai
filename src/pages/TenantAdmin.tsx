import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";
import { useSEO } from "@/hooks/useSEO";
import {
  Building2, Users, Key, Wallet, Palette, Globe, FileText,
  Loader2, Save, Pencil, Trash2, Plus, Eye, EyeOff,
  RefreshCw, Copy, BarChart3, Shield
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import AppLayout from "@/components/AppLayout";

interface TenantMember {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  profile?: { name: string; email: string };
}

interface TenantToken {
  id: string;
  user_id: string;
  token: string;
  is_active: boolean;
  created_at: string;
  user_name?: string;
  user_email?: string;
}

interface WalletInfo {
  balance: number;
  total_credited: number;
  total_debited: number;
}

interface WalletTransaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
}

type Tab = "brand" | "users" | "tokens" | "finances";

// Add member state
interface AddMemberState {
  email: string;
  role: string;
}

// Generate token state
interface GenTokenState {
  email: string;
  plan: string;
}

export default function TenantAdmin() {
  const { user, loading: authLoading } = useAuth();
  const { tenant, isTenantAdmin, isGlobalAdmin, tenantLoading } = useTenant();
  useSEO({ title: `Admin - ${tenant?.name || "Tenant"}` });
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") || "brand") as Tab;

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [tokens, setTokens] = useState<TenantToken[]>([]);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [wlSub, setWlSub] = useState<{
    status: string; period: string; amount_cents: number;
    starts_at: string; expires_at: string; plan_name?: string;
  } | null>(null);
  
  const [topupPix, setTopupPix] = useState<{ code: string; qr_base64?: string } | null>(null);
  const [addMember, setAddMember] = useState<AddMemberState>({ email: "", role: "tenant_member" });
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addMemberLoading, setAddMemberLoading] = useState(false);
  const [genTokenOpen, setGenTokenOpen] = useState(false);
  const [genToken, setGenToken] = useState<GenTokenState>({ email: "", plan: "days_30" });
  const [genTokenLoading, setGenTokenLoading] = useState(false);
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState("");

  // Brand form
  const [brandForm, setBrandForm] = useState({
    name: "", logo_url: "", favicon_url: "", primary_color: "#0A84FF",
    secondary_color: "#5E5CE6", accent_color: "#5E5CE6",
    meta_title: "", meta_description: "", terms_template: "",
    domain_custom: "",
  });
  const [savingBrand, setSavingBrand] = useState(false);

  // Access check
  const canAccess = isTenantAdmin || isGlobalAdmin;

  useEffect(() => {
    if (!authLoading && !tenantLoading) {
      if (!user) navigate("/login");
      else if (!canAccess) navigate("/dashboard");
    }
  }, [user, canAccess, authLoading, tenantLoading, navigate]);

  useEffect(() => {
    if (tenant && canAccess) {
      setBrandForm({
        name: tenant.name, logo_url: tenant.logo_url || "",
        favicon_url: tenant.favicon_url || "",
        primary_color: tenant.primary_color, secondary_color: tenant.secondary_color,
        accent_color: tenant.accent_color || "#5E5CE6",
        meta_title: tenant.meta_title || "", meta_description: tenant.meta_description || "",
        terms_template: tenant.terms_template || "",
        domain_custom: tenant.domain_custom || "",
      });
      fetchAll();
    }
  }, [tenant, canAccess]);

  const fetchAll = async () => {
    if (!tenant) return;
    setLoading(true);

    const [membersRes, tokensRes, walletRes, txRes, wlSubRes] = await Promise.all([
      supabase.from("tenant_users").select("*").eq("tenant_id", tenant.id),
      supabase.from("tokens").select("*").eq("tenant_id", tenant.id).order("created_at", { ascending: false }),
      supabase.from("tenant_wallets").select("balance, total_credited, total_debited").eq("tenant_id", tenant.id).maybeSingle(),
      supabase.from("tenant_wallet_transactions").select("*").eq("tenant_id", tenant.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("white_label_subscriptions").select("status, period, amount_cents, starts_at, expires_at, plan_id").eq("tenant_id", tenant.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    // Enrich members with profiles
    const memberList = membersRes.data || [];
    if (memberList.length > 0) {
      const userIds = memberList.map(m => m.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, name, email").in("user_id", userIds);
      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
      setMembers(memberList.map(m => ({ ...m, profile: profileMap.get(m.user_id) })));
    } else {
      setMembers([]);
    }

    // Enrich tokens with user info
    const tokenList = tokensRes.data || [];
    if (tokenList.length > 0) {
      const userIds = [...new Set(tokenList.map(t => t.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, name, email").in("user_id", userIds);
      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
      setTokens(tokenList.map(t => ({
        ...t,
        user_name: profileMap.get(t.user_id)?.name || "?",
        user_email: profileMap.get(t.user_id)?.email || "?",
      })));
    } else {
      setTokens([]);
    }

    setWallet(walletRes.data as WalletInfo | null);
    setTransactions((txRes.data || []) as WalletTransaction[]);
    
    // WL subscription info
    if (wlSubRes.data) {
      const sub = wlSubRes.data as any;
      // Optionally fetch plan name
      let planName = "";
      if (sub.plan_id) {
        const { data: plan } = await supabase.from("white_label_plans").select("name").eq("id", sub.plan_id).maybeSingle();
        planName = plan?.name || "";
      }
      setWlSub({ ...sub, plan_name: planName });
    }
    
    setLoading(false);
  };

  const saveBrand = async () => {
    if (!tenant) return;
    setSavingBrand(true);
    try {
      const { error } = await supabase.from("tenants").update({
        name: brandForm.name,
        logo_url: brandForm.logo_url || null,
        favicon_url: brandForm.favicon_url || null,
        primary_color: brandForm.primary_color,
        secondary_color: brandForm.secondary_color,
        accent_color: brandForm.accent_color,
        meta_title: brandForm.meta_title || null,
        meta_description: brandForm.meta_description || null,
        terms_template: brandForm.terms_template || null,
        domain_custom: brandForm.domain_custom || null,
      }).eq("id", tenant.id);
      if (error) throw error;
      toast.success("Marca atualizada! Recarregue para ver as mudanças.");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSavingBrand(false);
    }
  };

  const updateMemberRole = async (memberId: string, newRole: string) => {
    const { error } = await supabase.from("tenant_users").update({ role: newRole as any }).eq("id", memberId);
    if (error) return toast.error(error.message);
    toast.success("Papel atualizado!");
    fetchAll();
  };

  const removeMember = async (memberId: string) => {
    if (!confirm("Remover este membro do tenant?")) return;
    const { error } = await supabase.from("tenant_users").delete().eq("id", memberId);
    if (error) return toast.error(error.message);
    toast.success("Membro removido!");
    fetchAll();
  };

  const revokeToken = async (tokenId: string) => {
    await supabase.from("tokens").update({ is_active: false }).eq("id", tokenId);
    toast.success("Token revogado!");
    fetchAll();
  };

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    toast.success("Token copiado!");
  };

  const handleTopup = async () => {
    const amount = Number(topupAmount);
    if (!tenant || amount < 5) return toast.error("Mínimo R$5,00");
    const { data, error } = await supabase.functions.invoke("tenant-topup", {
      body: { tenant_id: tenant.id, amount_brl: amount, payment_method: "pix" }
    });
    if (error || data?.error) return toast.error(data?.error || "Erro ao gerar recarga");
    
    setTopupPix({ code: data.pix_code, qr_base64: data.pix_qr_base64 });
    setTopupOpen(false);
    toast.success("PIX gerado! Pague para creditar.");
  };

  const handleGenerateToken = async () => {
    if (!tenant || !wallet) return;
    setGenTokenLoading(true);
    const cost = Number(tenant.token_cost);
    if (wallet.balance < cost && cost > 0) {
      setGenTokenLoading(false);
      return toast.error("Saldo insuficiente");
    }

    const { data: profiles } = await supabase.from("profiles").select("user_id").eq("email", genToken.email.trim().toLowerCase()).maybeSingle();
    if (!profiles) {
      setGenTokenLoading(false);
      return toast.error("Usuário não encontrado");
    }

    const { data, error } = await supabase.functions.invoke("admin-token-actions", {
      body: {
        action: "generate",
        email: genToken.email.trim().toLowerCase(),
        name: genToken.email.split("@")[0],
        plan: genToken.plan,
        user_id: profiles.user_id,
        tenant_id: tenant.id
      }
    });

    setGenTokenLoading(false);
    if (error || data?.error) return toast.error(data?.error || "Erro ao gerar token");
    
    setGenTokenOpen(false);
    setGenToken({ email: "", plan: "days_30" });
    toast.success("Token gerado com sucesso!");
    fetchAll();
  };

  const handleAddMember = async () => {
    if (!tenant || !addMember.email) return toast.error("Informe o email");
    setAddMemberLoading(true);
    
    const { data: profile } = await supabase.from("profiles").select("user_id").eq("email", addMember.email.trim().toLowerCase()).maybeSingle();
    if (!profile) {
      setAddMemberLoading(false);
      return toast.error("Usuário não encontrado. O usuário precisa ter uma conta.");
    }

    // Check if already member
    const { data: existing } = await supabase.from("tenant_users").select("id").eq("user_id", profile.user_id).eq("tenant_id", tenant.id).maybeSingle();
    if (existing) {
      setAddMemberLoading(false);
      return toast.error("Usuário já é membro deste tenant");
    }

    const { error } = await supabase.from("tenant_users").insert({
      tenant_id: tenant.id,
      user_id: profile.user_id,
      role: addMember.role as any,
      is_primary: false,
    });

    setAddMemberLoading(false);
    if (error) return toast.error(error.message);
    
    setAddMemberOpen(false);
    setAddMember({ email: "", role: "tenant_member" });
    toast.success("Membro adicionado!");
    fetchAll();
  };

  if (authLoading || tenantLoading || loading) {
    return <AppLayout><div className="min-h-full flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="min-h-full">
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
          {/* Header */}
          <div>
            <p className="lv-overline mb-1">Admin do Tenant</p>
            <h1 className="lv-heading-lg">{tenant?.name || "Tenant"}</h1>
            <p className="lv-caption">/{tenant?.slug} {tenant?.domain_custom && `• ${tenant.domain_custom}`}</p>
          </div>

          {/* WL Subscription Status */}
          {wlSub && (
            <div className="lv-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="lv-body-strong flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  Plano White Label: {wlSub.plan_name || "—"}
                </p>
                <p className="lv-caption">
                  {wlSub.period === "yearly" ? "Anual" : "Mensal"} • R${(wlSub.amount_cents / 100).toFixed(2)} •
                  {" "}{format(new Date(wlSub.starts_at), "dd/MM/yyyy")} → {format(new Date(wlSub.expires_at), "dd/MM/yyyy")}
                </p>
              </div>
              <span className={`lv-badge ${
                wlSub.status === "active" && new Date(wlSub.expires_at) > new Date()
                  ? "lv-badge-success" : "lv-badge-muted"
              }`}>
                {wlSub.status === "active" && new Date(wlSub.expires_at) > new Date() ? "Ativo" : "Expirado"}
              </span>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 flex-wrap">
            {([
              { id: "brand", label: "Marca & Domínio", icon: Palette },
              { id: "users", label: "Usuários", icon: Users },
              { id: "tokens", label: "Tokens", icon: Key },
              { id: "finances", label: "Financeiro", icon: Wallet },
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

          {/* ─── BRAND TAB ─── */}
          {tab === "brand" && (
            <div className="lv-card space-y-4">
              <p className="lv-overline">Identidade Visual</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="lv-caption block mb-1">Nome</label>
                  <input className="lv-input w-full" value={brandForm.name} onChange={e => setBrandForm({ ...brandForm, name: e.target.value })} />
                </div>
                <div>
                  <label className="lv-caption block mb-1">Domínio Custom</label>
                  <input className="lv-input w-full" value={brandForm.domain_custom} onChange={e => setBrandForm({ ...brandForm, domain_custom: e.target.value })} placeholder="app.seusite.com" />
                  {tenant?.domain_custom && !tenant.is_domain_approved && (
                    <p className="text-xs text-amber-500 mt-1">⏳ Domínio aguardando aprovação do admin global</p>
                  )}
                  {tenant?.domain_custom && tenant.is_domain_approved && (
                    <p className="text-xs text-green-600 mt-1">✅ Domínio aprovado e ativo</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="lv-caption block mb-1">Cor Primária</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={brandForm.primary_color} onChange={e => setBrandForm({ ...brandForm, primary_color: e.target.value })} className="h-9 w-9 rounded cursor-pointer" />
                    <input className="lv-input flex-1" value={brandForm.primary_color} onChange={e => setBrandForm({ ...brandForm, primary_color: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="lv-caption block mb-1">Cor Secundária</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={brandForm.secondary_color} onChange={e => setBrandForm({ ...brandForm, secondary_color: e.target.value })} className="h-9 w-9 rounded cursor-pointer" />
                    <input className="lv-input flex-1" value={brandForm.secondary_color} onChange={e => setBrandForm({ ...brandForm, secondary_color: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="lv-caption block mb-1">Cor Accent</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={brandForm.accent_color} onChange={e => setBrandForm({ ...brandForm, accent_color: e.target.value })} className="h-9 w-9 rounded cursor-pointer" />
                    <input className="lv-input flex-1" value={brandForm.accent_color} onChange={e => setBrandForm({ ...brandForm, accent_color: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="lv-caption block mb-1">Logo URL</label>
                  <input className="lv-input w-full" value={brandForm.logo_url} onChange={e => setBrandForm({ ...brandForm, logo_url: e.target.value })} placeholder="https://..." />
                </div>
                <div>
                  <label className="lv-caption block mb-1">Favicon URL</label>
                  <input className="lv-input w-full" value={brandForm.favicon_url} onChange={e => setBrandForm({ ...brandForm, favicon_url: e.target.value })} placeholder="https://..." />
                </div>
              </div>
              <div>
                <label className="lv-caption block mb-1">Meta Title (SEO)</label>
                <input className="lv-input w-full" value={brandForm.meta_title} onChange={e => setBrandForm({ ...brandForm, meta_title: e.target.value })} />
              </div>
              <div>
                <label className="lv-caption block mb-1">Meta Description (SEO)</label>
                <textarea className="lv-input w-full h-20 resize-none" value={brandForm.meta_description} onChange={e => setBrandForm({ ...brandForm, meta_description: e.target.value })} />
              </div>
              <div>
                <label className="lv-caption block mb-1">Template de Termos</label>
                <textarea className="lv-input w-full h-32 resize-none" value={brandForm.terms_template} onChange={e => setBrandForm({ ...brandForm, terms_template: e.target.value })} placeholder="Termos personalizados do tenant..." />
              </div>
              <button onClick={saveBrand} disabled={savingBrand} className="lv-btn-primary h-10 px-6 text-sm flex items-center gap-2">
                {savingBrand ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar Marca
              </button>
            </div>
          )}

          {/* ─── USERS TAB ─── */}
          {tab === "users" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="lv-body-strong">{members.length} membro(s)</p>
                <button onClick={() => setAddMemberOpen(true)} className="lv-btn-primary h-9 px-4 text-xs flex items-center gap-2">
                  <Plus className="h-3.5 w-3.5" /> Adicionar Membro
                </button>
              </div>
              <div className="space-y-3">
                {members.map(m => (
                  <div key={m.id} className="lv-card flex items-center justify-between">
                    <div>
                      <p className="lv-body-strong">{m.profile?.name || "?"}</p>
                      <p className="lv-caption">{m.profile?.email || m.user_id}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        className="lv-input h-8 text-xs"
                        value={m.role}
                        onChange={e => updateMemberRole(m.id, e.target.value)}
                      >
                        <option value="tenant_member">Membro</option>
                        <option value="tenant_support">Suporte</option>
                        <option value="tenant_admin">Admin</option>
                        <option value="tenant_owner">Owner</option>
                      </select>
                      <button onClick={() => removeMember(m.id)} className="lv-btn-icon h-8 w-8 text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {members.length === 0 && <p className="lv-caption text-center py-8">Nenhum membro encontrado.</p>}
              </div>
            </div>
          )}

          {/* ─── TOKENS TAB ─── */}
          {tab === "tokens" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="lv-body-strong">{tokens.length} token(s)</p>
                <div className="flex items-center gap-3">
                  {wallet && (
                    <p className="lv-caption">Saldo: R${Number(wallet.balance).toFixed(2)} • Custo/token: R${Number(tenant?.token_cost || 0).toFixed(2)}</p>
                  )}
                  <button
                    onClick={() => setTopupOpen(true)}
                    className="lv-btn-secondary h-9 px-4 text-xs flex items-center gap-2"
                  >
                    <Wallet className="h-3.5 w-3.5" /> Recarregar
                  </button>
                  <button
                    onClick={() => setGenTokenOpen(true)}
                    className="lv-btn-primary h-9 px-4 text-xs flex items-center gap-2"
                  >
                    <Plus className="h-3.5 w-3.5" /> Gerar Token
                  </button>
                </div>
              </div>
              {topupPix && (
                <div className="lv-card bg-muted/30 border-primary/20 mb-4">
                  <div className="flex items-start gap-4">
                    <div className="bg-white p-2 rounded-lg">
                      {topupPix.qr_base64 && <img src={`data:image/png;base64,${topupPix.qr_base64}`} alt="QR Code PIX" className="w-32 h-32" />}
                    </div>
                    <div className="flex-1">
                      <p className="lv-body-strong text-sm mb-1">Pagamento PIX Gerado</p>
                      <p className="lv-caption mb-3">Escaneie o QR Code ou copie o código abaixo para creditar seu saldo.</p>
                      <div className="flex gap-2">
                        <input className="lv-input text-xs flex-1" readOnly value={topupPix.code} />
                        <button onClick={() => { navigator.clipboard.writeText(topupPix.code); toast.success("Copiado!"); }} className="lv-btn-secondary h-9 px-3">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <button onClick={() => setTopupPix(null)} className="lv-btn-icon h-6 w-6"><Trash2 className="h-3 w-3" /></button>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                {tokens.map(t => (
                  <div key={t.id} className="lv-card-sm flex items-center justify-between">
                    <div>
                      <p className="lv-body-strong">{t.user_name}</p>
                      <p className="lv-caption">{t.user_email}</p>
                      <p className="lv-caption font-mono text-[10px]">{t.token.slice(0, 20)}...</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`lv-badge ${t.is_active ? "lv-badge-success" : "lv-badge-muted"}`}>
                        {t.is_active ? "Ativo" : "Revogado"}
                      </span>
                      <button onClick={() => copyToken(t.token)} className="lv-btn-icon h-8 w-8">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      {t.is_active && (
                        <button onClick={() => revokeToken(t.id)} className="lv-btn-icon h-8 w-8 text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {tokens.length === 0 && <p className="lv-caption text-center py-8">Nenhum token gerado.</p>}
              </div>
            </div>
          )}

          {/* ─── FINANCES TAB ─── */}
          {tab === "finances" && (
            <div className="space-y-6">
              {/* Wallet summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="lv-card text-center">
                  <p className="lv-caption">Saldo</p>
                  <p className="lv-stat text-2xl">R${wallet ? Number(wallet.balance).toFixed(2) : "0.00"}</p>
                </div>
                <div className="lv-card text-center">
                  <p className="lv-caption">Total Creditado</p>
                  <p className="lv-stat text-2xl">R${wallet ? Number(wallet.total_credited).toFixed(2) : "0.00"}</p>
                </div>
                <div className="lv-card text-center">
                  <p className="lv-caption">Total Debitado</p>
                  <p className="lv-stat text-2xl">R${wallet ? Number(wallet.total_debited).toFixed(2) : "0.00"}</p>
                </div>
              </div>

              {/* Transactions */}
              <div className="lv-card">
                <p className="lv-overline mb-4">Extrato</p>
                <div className="space-y-2">
                  {transactions.map(tx => (
                    <div key={tx.id} className="lv-card-sm flex items-center justify-between">
                      <div>
                        <p className="lv-body-strong">{tx.description || tx.type}</p>
                        <p className="lv-caption">{format(new Date(tx.created_at), "dd/MM/yyyy HH:mm")}</p>
                      </div>
                      <p className={`lv-stat text-lg ${Number(tx.amount) >= 0 ? "text-green-600" : "text-destructive"}`}>
                        {Number(tx.amount) >= 0 ? "+" : ""}R${Number(tx.amount).toFixed(2)}
                      </p>
                    </div>
                  ))}
                  {transactions.length === 0 && <p className="lv-caption text-center py-4">Nenhuma transação.</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Add Member Sheet */}
      <Sheet open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Adicionar Membro</SheetTitle>
            <SheetDescription>Adicione um usuário existente como membro deste tenant.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div>
              <label className="lv-caption block mb-1">Email do usuário *</label>
              <input className="lv-input w-full" value={addMember.email} onChange={e => setAddMember({ ...addMember, email: e.target.value })} placeholder="usuario@email.com" />
            </div>
            <div>
              <label className="lv-caption block mb-1">Papel</label>
              <select className="lv-input w-full" value={addMember.role} onChange={e => setAddMember({ ...addMember, role: e.target.value })}>
                <option value="tenant_member">Membro</option>
                <option value="tenant_support">Suporte</option>
                <option value="tenant_admin">Admin</option>
              </select>
            </div>
            <button onClick={handleAddMember} disabled={addMemberLoading} className="lv-btn-primary w-full h-10 text-sm flex items-center justify-center gap-2">
              {addMemberLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Adicionar
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Generate Token Sheet */}
      <Sheet open={genTokenOpen} onOpenChange={setGenTokenOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Gerar Token</SheetTitle>
            <SheetDescription>Gere um token para um membro do tenant. Custo: R${Number(tenant?.token_cost || 0).toFixed(2)} por token.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div>
              <label className="lv-caption block mb-1">Email do usuário *</label>
              <input className="lv-input w-full" value={genToken.email} onChange={e => setGenToken({ ...genToken, email: e.target.value })} placeholder="usuario@email.com" />
            </div>
            <div>
              <label className="lv-caption block mb-1">Plano</label>
              <select className="lv-input w-full" value={genToken.plan} onChange={e => setGenToken({ ...genToken, plan: e.target.value })}>
                <option value="test_5h">Teste 5h</option>
                <option value="test_1d">Teste 1 dia</option>
                <option value="days_15">15 dias</option>
                <option value="days_30">30 dias</option>
                <option value="days_90">90 dias</option>
              </select>
            </div>
            {wallet && (
              <div className="lv-card-sm bg-muted/50">
                <p className="lv-caption">Saldo disponível: <strong className="text-foreground">R${Number(wallet.balance).toFixed(2)}</strong></p>
                <p className="lv-caption">Custo por token: <strong className="text-foreground">R${Number(tenant?.token_cost || 0).toFixed(2)}</strong></p>
              </div>
            )}
            <button onClick={handleGenerateToken} disabled={genTokenLoading} className="lv-btn-primary w-full h-10 text-sm flex items-center justify-center gap-2">
              {genTokenLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
              Gerar Token
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Topup Sheet */}
      <Sheet open={topupOpen} onOpenChange={setTopupOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Recarregar Saldo</SheetTitle>
            <SheetDescription>Adicione créditos ao wallet do tenant via PIX.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div>
              <label className="lv-caption block mb-1">Valor (R$) *</label>
              <input type="number" className="lv-input w-full" value={topupAmount} onChange={e => setTopupAmount(e.target.value)} min={5} step={1} placeholder="50" />
              <p className="lv-caption mt-1">Mínimo: R$5,00</p>
            </div>
            {wallet && (
              <div className="lv-card-sm bg-muted/50">
                <p className="lv-caption">Saldo atual: <strong className="text-foreground">R${Number(wallet.balance).toFixed(2)}</strong></p>
              </div>
            )}
            <button onClick={handleTopup} className="lv-btn-primary w-full h-10 text-sm flex items-center justify-center gap-2">
              <Wallet className="h-4 w-4" /> Gerar PIX
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}