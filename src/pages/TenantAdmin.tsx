import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";
import { useSEO } from "@/hooks/useSEO";
import {
  Building2, Users, Key, Wallet, Palette, Globe, FileText,
  Loader2, Save, Pencil, Trash2, Plus, Eye, EyeOff,
  RefreshCw, Copy, BarChart3, Shield, Upload, Settings2, Boxes
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

interface TenantLicense {
  id: string;
  user_id: string;
  key: string;
  active: boolean;
  plan_type: string;
  status: string;
  expires_at: string | null;
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

interface AddMemberState {
  email: string;
  role: string;
}

interface GenTokenState {
  email: string;
  plan: string;
}

type Tab = "brand" | "customize" | "modules" | "users" | "licenses" | "finances";

const THEME_PRESETS = [
  { id: "default", label: "Default", primary: "#0A84FF", secondary: "#5E5CE6", bg: "#FFFFFF" },
  { id: "midnight", label: "Midnight", primary: "#6366F1", secondary: "#8B5CF6", bg: "#0F172A" },
  { id: "neon-cyber", label: "Neon Cyber", primary: "#06B6D4", secondary: "#22D3EE", bg: "#0C0A09" },
  { id: "forest", label: "Forest", primary: "#22C55E", secondary: "#16A34A", bg: "#FAFAF9" },
  { id: "sunset", label: "Sunset", primary: "#F97316", secondary: "#EF4444", bg: "#FFFBEB" },
  { id: "royal", label: "Royal", primary: "#7C3AED", secondary: "#A855F7", bg: "#FAF5FF" },
  { id: "ocean", label: "Ocean", primary: "#0EA5E9", secondary: "#38BDF8", bg: "#F0F9FF" },
  { id: "rose", label: "Rosé", primary: "#F43F5E", secondary: "#FB7185", bg: "#FFF1F2" },
];

const FONT_OPTIONS = [
  { id: "system", label: "System Default" },
  { id: "inter", label: "Inter" },
  { id: "poppins", label: "Poppins" },
  { id: "dm-sans", label: "DM Sans" },
  { id: "space-grotesk", label: "Space Grotesk" },
  { id: "nunito", label: "Nunito" },
];

const EXTENSION_MODES = [
  { id: "security_fix_v2", label: "Security Fix (Padrão)" },
  { id: "seo_fix", label: "SEO Fix" },
  { id: "error_fix", label: "Error Fix" },
  { id: "custom", label: "Modo Custom" },
];

const DEFAULT_MODULES = {
  chat: false, deploy: true, preview: true, notes: true,
  split: false, automation: false, whitelabel: false, affiliates: true, community: true,
};

export default function TenantAdmin() {
  const { user, loading: authLoading } = useAuth();
  const { tenant, isTenantAdmin, isGlobalAdmin, tenantLoading } = useTenant();
  useSEO({ title: `Admin - ${tenant?.name || "Tenant"}` });
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") || "brand") as Tab;

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [licenses, setLicenses] = useState<TenantLicense[]>([]);
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
  const [genToken, setGenToken] = useState<GenTokenState>({ email: "", plan: "daily_token" });
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

  // Customize form (NEW)
  const [customizeForm, setCustomizeForm] = useState({
    theme_preset: "default",
    font_family: "system",
    border_radius: 12,
    extension_mode: "security_fix_v2",
    custom_mode_prompt: "",
    trial_minutes: 30,
  });
  const [savingCustomize, setSavingCustomize] = useState(false);

  // Modules form (NEW)
  const [modulesForm, setModulesForm] = useState<Record<string, boolean>>(DEFAULT_MODULES);
  const [savingModules, setSavingModules] = useState(false);

  // Logo/Favicon upload
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);

  const fetchAllRef = useRef<(() => void) | null>(null);
  const [dbPlans, setDbPlans] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    supabase.from("plans").select("id, name").eq("is_active", true).order("display_order", { ascending: true })
      .then(({ data }) => setDbPlans(data || []));
  }, []);

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
      // Load customize fields
      setCustomizeForm({
        theme_preset: (tenant as any).theme_preset || "default",
        font_family: (tenant as any).font_family || "system",
        border_radius: (tenant as any).border_radius ?? 12,
        extension_mode: (tenant as any).extension_mode || "security_fix_v2",
        custom_mode_prompt: (tenant as any).custom_mode_prompt || "",
        trial_minutes: (tenant as any).trial_minutes ?? 30,
      });
      // Load modules
      const mods = (tenant as any).modules;
      setModulesForm(typeof mods === "object" && mods !== null ? { ...DEFAULT_MODULES, ...mods } : DEFAULT_MODULES);
      fetchAllRef.current?.();
    }
  }, [tenant, canAccess]);

  const fetchAll = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);

    const [membersRes, walletRes, txRes, wlSubRes] = await Promise.all([
      supabase.from("tenant_users").select("*").eq("tenant_id", tenant.id),
      supabase.from("tenant_wallets").select("balance, total_credited, total_debited").eq("tenant_id", tenant.id).maybeSingle(),
      supabase.from("tenant_wallet_transactions").select("*").eq("tenant_id", tenant.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("white_label_subscriptions").select("status, period, amount_cents, starts_at, expires_at, plan_id").eq("tenant_id", tenant.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const memberList = membersRes.data || [];
    if (memberList.length > 0) {
      const userIds = memberList.map(m => m.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, name, email").in("user_id", userIds);
      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
      setMembers(memberList.map(m => ({ ...m, profile: profileMap.get(m.user_id) })));
    } else {
      setMembers([]);
    }

    const { data: licensesList } = await supabase.from("licenses")
      .select("id, user_id, key, active, plan_type, status, expires_at, created_at")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false });
    const licenseList = licensesList || [];
    if (licenseList.length > 0) {
      const userIds = [...new Set(licenseList.map(l => l.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, name, email").in("user_id", userIds);
      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
      setLicenses(licenseList.map(l => ({
        ...l,
        user_name: profileMap.get(l.user_id)?.name || "?",
        user_email: profileMap.get(l.user_id)?.email || "?",
      })));
    } else {
      setLicenses([]);
    }

    setWallet(walletRes.data as WalletInfo | null);
    setTransactions((txRes.data || []) as WalletTransaction[]);
    
    if (wlSubRes.data) {
      const sub = wlSubRes.data as any;
      let planName = "";
      if (sub.plan_id) {
        const { data: plan } = await supabase.from("white_label_plans").select("name").eq("id", sub.plan_id).maybeSingle();
        planName = plan?.name || "";
      }
      setWlSub({ ...sub, plan_name: planName });
    }
    
    setLoading(false);
  }, [tenant]);
  fetchAllRef.current = fetchAll;

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
      toast.success("Marca atualizada!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSavingBrand(false);
    }
  };

  const saveCustomize = async () => {
    if (!tenant) return;
    setSavingCustomize(true);
    try {
      const { error } = await supabase.from("tenants").update({
        theme_preset: customizeForm.theme_preset,
        font_family: customizeForm.font_family,
        border_radius: customizeForm.border_radius,
        extension_mode: customizeForm.extension_mode,
        custom_mode_prompt: customizeForm.custom_mode_prompt || null,
        trial_minutes: customizeForm.trial_minutes,
      } as any).eq("id", tenant.id);
      if (error) throw error;
      toast.success("Personalização salva!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSavingCustomize(false);
    }
  };

  const saveModules = async () => {
    if (!tenant) return;
    setSavingModules(true);
    try {
      const { error } = await supabase.from("tenants").update({
        modules: modulesForm,
      } as any).eq("id", tenant.id);
      if (error) throw error;
      toast.success("Módulos atualizados!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSavingModules(false);
    }
  };

  const handleFileUpload = async (type: "logo" | "favicon", file: File) => {
    if (!tenant) return;
    const setter = type === "logo" ? setUploadingLogo : setUploadingFavicon;
    setter(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${tenant.id}/${type}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("tenant-assets").upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from("tenant-assets").getPublicUrl(path);
      const url = urlData.publicUrl;
      if (type === "logo") {
        setBrandForm(f => ({ ...f, logo_url: url }));
      } else {
        setBrandForm(f => ({ ...f, favicon_url: url }));
      }
      toast.success(`${type === "logo" ? "Logo" : "Favicon"} enviado!`);
    } catch (err: any) {
      toast.error(err.message || "Erro no upload");
    } finally {
      setter(false);
    }
  };

  const applyThemePreset = (presetId: string) => {
    const preset = THEME_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setBrandForm(f => ({ ...f, primary_color: preset.primary, secondary_color: preset.secondary }));
      setCustomizeForm(f => ({ ...f, theme_preset: presetId }));
    }
  };

  // Shared functions
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

  const revokeLicense = async (licenseId: string) => {
    await supabase.from("licenses").update({ active: false, status: "suspended" }).eq("id", licenseId);
    toast.success("Licença revogada!");
    fetchAll();
  };

  const copyLicenseKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success("Licença copiada!");
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
    toast.success("PIX gerado!");
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
    if (!profiles) { setGenTokenLoading(false); return toast.error("Usuário não encontrado"); }
    const { data, error } = await supabase.functions.invoke("admin-token-actions", {
      body: { action: "generate", email: genToken.email.trim().toLowerCase(), name: genToken.email.split("@")[0], plan: genToken.plan, user_id: profiles.user_id, tenant_id: tenant.id }
    });
    setGenTokenLoading(false);
    if (error || data?.error) return toast.error(data?.error || "Erro ao gerar token");
    setGenTokenOpen(false);
    setGenToken({ email: "", plan: "daily_token" });
    toast.success("Licença gerada!");
    fetchAll();
  };

  const handleAddMember = async () => {
    if (!tenant || !addMember.email) return toast.error("Informe o email");
    setAddMemberLoading(true);
    const { data: profile } = await supabase.from("profiles").select("user_id").eq("email", addMember.email.trim().toLowerCase()).maybeSingle();
    if (!profile) { setAddMemberLoading(false); return toast.error("Usuário não encontrado."); }
    const { data: existing } = await supabase.from("tenant_users").select("id").eq("user_id", profile.user_id).eq("tenant_id", tenant.id).maybeSingle();
    if (existing) { setAddMemberLoading(false); return toast.error("Já é membro"); }
    const { error } = await supabase.from("tenant_users").insert({ tenant_id: tenant.id, user_id: profile.user_id, role: addMember.role as any, is_primary: false });
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

  // Preview card for theme
  const previewStyle = {
    fontFamily: customizeForm.font_family === "system" ? "var(--font)" : customizeForm.font_family,
    borderRadius: `${customizeForm.border_radius}px`,
  };

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
              { id: "brand", label: "Marca", icon: Palette },
              { id: "customize", label: "Personalizar", icon: Settings2 },
              { id: "modules", label: "Módulos", icon: Boxes },
              { id: "users", label: "Usuários", icon: Users },
              { id: "licenses", label: "Licenças", icon: Key },
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
                    <p className="text-xs text-amber-500 mt-1">⏳ Domínio aguardando aprovação</p>
                  )}
                  {tenant?.domain_custom && tenant.is_domain_approved && (
                    <p className="text-xs text-green-600 mt-1">✅ Domínio aprovado e ativo</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {(["primary_color", "secondary_color", "accent_color"] as const).map(key => (
                  <div key={key}>
                    <label className="lv-caption block mb-1">
                      {key === "primary_color" ? "Cor Primária" : key === "secondary_color" ? "Cor Secundária" : "Cor Accent"}
                    </label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={brandForm[key]} onChange={e => setBrandForm({ ...brandForm, [key]: e.target.value })} className="h-9 w-9 rounded cursor-pointer" />
                      <input className="lv-input flex-1" value={brandForm[key]} onChange={e => setBrandForm({ ...brandForm, [key]: e.target.value })} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Logo & Favicon with upload */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="lv-caption block mb-1">Logo</label>
                  <div className="flex items-center gap-2">
                    <input className="lv-input flex-1" value={brandForm.logo_url} onChange={e => setBrandForm({ ...brandForm, logo_url: e.target.value })} placeholder="https://..." />
                    <label className="lv-btn-secondary h-9 px-3 text-xs flex items-center gap-1 cursor-pointer">
                      {uploadingLogo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFileUpload("logo", e.target.files[0])} />
                    </label>
                  </div>
                  {brandForm.logo_url && <img src={brandForm.logo_url} alt="Logo" className="h-10 mt-2 rounded object-contain" />}
                </div>
                <div>
                  <label className="lv-caption block mb-1">Favicon</label>
                  <div className="flex items-center gap-2">
                    <input className="lv-input flex-1" value={brandForm.favicon_url} onChange={e => setBrandForm({ ...brandForm, favicon_url: e.target.value })} placeholder="https://..." />
                    <label className="lv-btn-secondary h-9 px-3 text-xs flex items-center gap-1 cursor-pointer">
                      {uploadingFavicon ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFileUpload("favicon", e.target.files[0])} />
                    </label>
                  </div>
                  {brandForm.favicon_url && <img src={brandForm.favicon_url} alt="Favicon" className="h-8 mt-2 rounded object-contain" />}
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
                <textarea className="lv-input w-full h-32 resize-none" value={brandForm.terms_template} onChange={e => setBrandForm({ ...brandForm, terms_template: e.target.value })} placeholder="Termos personalizados..." />
              </div>
              <button onClick={saveBrand} disabled={savingBrand} className="lv-btn-primary h-10 px-6 text-sm flex items-center gap-2">
                {savingBrand ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar Marca
              </button>
            </div>
          )}

          {/* ─── CUSTOMIZE TAB (NEW) ─── */}
          {tab === "customize" && (
            <div className="space-y-6">
              {/* Theme Presets */}
              <div className="lv-card space-y-4">
                <p className="lv-overline">Tema Preset</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {THEME_PRESETS.map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => applyThemePreset(preset.id)}
                      className={`p-3 rounded-xl border transition-all text-left ${
                        customizeForm.theme_preset === preset.id
                          ? "ring-2 ring-primary border-primary/40"
                          : "border-border/50 hover:border-primary/30"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-4 h-4 rounded-full" style={{ background: preset.primary }} />
                        <div className="w-4 h-4 rounded-full" style={{ background: preset.secondary }} />
                      </div>
                      <p className="text-xs font-semibold">{preset.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Font + Border Radius */}
              <div className="lv-card space-y-4">
                <p className="lv-overline">Tipografia & Layout</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="lv-caption block mb-1">Font Family</label>
                    <select
                      className="lv-input w-full"
                      value={customizeForm.font_family}
                      onChange={e => setCustomizeForm({ ...customizeForm, font_family: e.target.value })}
                    >
                      {FONT_OPTIONS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="lv-caption block mb-1">Border Radius: {customizeForm.border_radius}px</label>
                    <input
                      type="range" min={0} max={24} step={1}
                      value={customizeForm.border_radius}
                      onChange={e => setCustomizeForm({ ...customizeForm, border_radius: Number(e.target.value) })}
                      className="w-full accent-primary"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                      <span>0px</span><span>12px</span><span>24px</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Extension Mode */}
              <div className="lv-card space-y-4">
                <p className="lv-overline">Modo da Extensão</p>
                <select
                  className="lv-input w-full"
                  value={customizeForm.extension_mode}
                  onChange={e => setCustomizeForm({ ...customizeForm, extension_mode: e.target.value })}
                >
                  {EXTENSION_MODES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
                {customizeForm.extension_mode === "custom" && (
                  <div>
                    <label className="lv-caption block mb-1">Prompt Custom</label>
                    <textarea
                      className="lv-input w-full h-28 resize-none"
                      value={customizeForm.custom_mode_prompt}
                      onChange={e => setCustomizeForm({ ...customizeForm, custom_mode_prompt: e.target.value })}
                      placeholder="Instrução personalizada para a IA..."
                    />
                  </div>
                )}
              </div>

              {/* Trial Minutes */}
              <div className="lv-card space-y-4">
                <p className="lv-overline">Trial</p>
                <div>
                  <label className="lv-caption block mb-1">Minutos de Trial: {customizeForm.trial_minutes}</label>
                  <input
                    type="range" min={5} max={120} step={5}
                    value={customizeForm.trial_minutes}
                    onChange={e => setCustomizeForm({ ...customizeForm, trial_minutes: Number(e.target.value) })}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>5 min</span><span>60 min</span><span>120 min</span>
                  </div>
                </div>
              </div>

              {/* Live Preview */}
              <div className="lv-card space-y-3">
                <p className="lv-overline">Preview em Tempo Real</p>
                <div className="p-4 border border-border/50 rounded-xl" style={previewStyle}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 flex items-center justify-center text-white text-xs font-bold" style={{ background: brandForm.primary_color, borderRadius: `${Math.min(customizeForm.border_radius, 12)}px` }}>
                      {brandForm.name?.[0] || "S"}
                    </div>
                    <span className="text-sm font-bold">{brandForm.name || "Tenant"}</span>
                  </div>
                  <div className="flex gap-2 mb-3">
                    <button className="px-4 py-2 text-white text-xs font-medium" style={{ background: brandForm.primary_color, borderRadius: `${customizeForm.border_radius}px` }}>
                      Botão Primário
                    </button>
                    <button className="px-4 py-2 text-xs font-medium border" style={{ color: brandForm.secondary_color, borderColor: brandForm.secondary_color, borderRadius: `${customizeForm.border_radius}px` }}>
                      Botão Secundário
                    </button>
                  </div>
                  <div className="p-3 bg-muted/30" style={{ borderRadius: `${customizeForm.border_radius}px` }}>
                    <p className="text-xs text-muted-foreground">Card de exemplo com o border radius configurado.</p>
                  </div>
                </div>
              </div>

              <button onClick={saveCustomize} disabled={savingCustomize} className="lv-btn-primary h-10 px-6 text-sm flex items-center gap-2">
                {savingCustomize ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar Personalização
              </button>
            </div>
          )}

          {/* ─── MODULES TAB (NEW) ─── */}
          {tab === "modules" && (
            <div className="lv-card space-y-4">
              <p className="lv-overline">Módulos Ativos</p>
              <p className="lv-caption mb-2">Ative ou desative funcionalidades para os usuários deste tenant.</p>
              <div className="space-y-3">
                {Object.entries({
                  chat: "Chat AI",
                  deploy: "Deploy / Publicação",
                  preview: "Preview de Projetos",
                  notes: "Notas",
                  split: "Split View",
                  automation: "Automação",
                  whitelabel: "White Label",
                  affiliates: "Afiliados",
                  community: "Comunidade",
                }).map(([key, label]) => (
                  <label key={key} className="flex items-center justify-between p-3 rounded-xl border border-border/50 hover:bg-muted/20 transition-colors cursor-pointer">
                    <span className="text-sm font-medium">{label}</span>
                    <input
                      type="checkbox"
                      checked={!!modulesForm[key]}
                      onChange={e => setModulesForm({ ...modulesForm, [key]: e.target.checked })}
                      className="h-4 w-4 accent-primary rounded"
                    />
                  </label>
                ))}
              </div>
              <button onClick={saveModules} disabled={savingModules} className="lv-btn-primary h-10 px-6 text-sm flex items-center gap-2 mt-4">
                {savingModules ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar Módulos
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
                      <select className="lv-input h-8 text-xs" value={m.role} onChange={e => updateMemberRole(m.id, e.target.value)}>
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

          {/* ─── LICENSES TAB ─── */}
          {tab === "licenses" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="lv-body-strong">{licenses.length} licença(s)</p>
                <div className="flex items-center gap-3">
                  {wallet && (
                    <p className="lv-caption">Saldo: R${Number(wallet.balance).toFixed(2)} • Custo: R${Number(tenant?.token_cost || 0).toFixed(2)}</p>
                  )}
                  <button onClick={() => setTopupOpen(true)} className="lv-btn-secondary h-9 px-4 text-xs flex items-center gap-2">
                    <Wallet className="h-3.5 w-3.5" /> Recarregar
                  </button>
                  <button onClick={() => setGenTokenOpen(true)} className="lv-btn-primary h-9 px-4 text-xs flex items-center gap-2">
                    <Plus className="h-3.5 w-3.5" /> Gerar Licença
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
                      <p className="lv-caption mb-3">Escaneie o QR Code ou copie o código.</p>
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
                {licenses.map(l => (
                  <div key={l.id} className="lv-card-sm flex items-center justify-between">
                    <div>
                      <p className="lv-body-strong">{l.user_name}</p>
                      <p className="lv-caption">{l.user_email}</p>
                      <p className="lv-caption font-mono text-[10px]">{l.key.slice(0, 20)}...</p>
                      <p className="lv-caption text-[10px]">{l.plan_type} • Exp: {l.expires_at ? format(new Date(l.expires_at), "dd/MM/yyyy") : "—"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`lv-badge ${l.active && l.status === "active" ? "lv-badge-success" : "lv-badge-muted"}`}>
                        {l.active && l.status === "active" ? "Ativo" : l.status}
                      </span>
                      <button onClick={() => copyLicenseKey(l.key)} className="lv-btn-icon h-8 w-8"><Copy className="h-3.5 w-3.5" /></button>
                      {l.active && (
                        <button onClick={() => revokeLicense(l.id)} className="lv-btn-icon h-8 w-8 text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                      )}
                    </div>
                  </div>
                ))}
                {licenses.length === 0 && <p className="lv-caption text-center py-8">Nenhuma licença gerada.</p>}
              </div>
            </div>
          )}

          {/* ─── FINANCES TAB ─── */}
          {tab === "finances" && (
            <div className="space-y-6">
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

      {/* Generate License Sheet */}
      <Sheet open={genTokenOpen} onOpenChange={setGenTokenOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Gerar Licença</SheetTitle>
            <SheetDescription>Custo: R${Number(tenant?.token_cost || 0).toFixed(2)} por licença.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div>
              <label className="lv-caption block mb-1">Email do usuário *</label>
              <input className="lv-input w-full" value={genToken.email} onChange={e => setGenToken({ ...genToken, email: e.target.value })} placeholder="usuario@email.com" />
            </div>
            <div>
              <label className="lv-caption block mb-1">Tipo de Plano</label>
              <select className="lv-input w-full" value={genToken.plan} onChange={e => setGenToken({ ...genToken, plan: e.target.value })}>
                <optgroup label="Padrão">
                  <option value="daily_token">Token Diário (24h)</option>
                  <option value="messages">Mensal (Mensagens)</option>
                  <option value="hourly">Por Hora</option>
                </optgroup>
                {dbPlans.length > 0 && (
                  <optgroup label="SaaS v2">
                    {dbPlans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </optgroup>
                )}
              </select>
            </div>
            {wallet && (
              <div className="lv-card-sm bg-muted/50">
                <p className="lv-caption">Saldo: <strong className="text-foreground">R${Number(wallet.balance).toFixed(2)}</strong></p>
              </div>
            )}
            <button onClick={handleGenerateToken} disabled={genTokenLoading} className="lv-btn-primary w-full h-10 text-sm flex items-center justify-center gap-2">
              {genTokenLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
              Gerar Licença
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Topup Sheet */}
      <Sheet open={topupOpen} onOpenChange={setTopupOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Recarregar Saldo</SheetTitle>
            <SheetDescription>Adicione créditos via PIX.</SheetDescription>
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
