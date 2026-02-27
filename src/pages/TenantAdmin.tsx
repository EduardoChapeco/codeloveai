import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";
import { useSEO } from "@/hooks/useSEO";
import { THEME_PRESETS as TENANT_THEME_PRESETS } from "@/lib/tenant-themes";
import {
  Building2, Users, Key, Wallet, Palette, Globe, FileText,
  Loader2, Save, Pencil, Trash2, Plus, Eye, EyeOff,
  RefreshCw, Copy, BarChart3, Shield, Upload, Settings2, Boxes,
  Monitor, Smartphone, ExternalLink, Check, Sparkles, Zap,
  CreditCard, ArrowUpRight, ChevronRight, CircleDot, Crown
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import AppLayout from "@/components/AppLayout";
import ActivityDashboard from "@/components/admin/ActivityDashboard";
import CrmPanel from "@/components/admin/CrmPanel";

// ── Types ──
interface TenantMember {
  id: string; user_id: string; role: string; created_at: string;
  profile?: { name: string; email: string };
}
interface TenantLicense {
  id: string; user_id: string; key: string; active: boolean;
  plan_type: string; status: string; expires_at: string | null;
  created_at: string; user_name?: string; user_email?: string;
}
interface WalletInfo { balance: number; total_credited: number; total_debited: number; }
interface WalletTransaction { id: string; amount: number; type: string; description: string; created_at: string; }

type Tab = "editor" | "users" | "licenses" | "finances" | "activity" | "crm";

const THEME_PRESETS = TENANT_THEME_PRESETS.map((preset) => ({
  id: preset.id,
  label: preset.name,
  primary: preset.preview.primary,
  secondary: preset.preview.accent,
  bg: preset.preview.bg,
}));

const DEFAULT_THEME_PRESET_ID = THEME_PRESETS[0]?.id ?? "apple-glass";
const DEFAULT_PRIMARY_COLOR = THEME_PRESETS[0]?.primary ?? "#0A84FF";
const DEFAULT_SECONDARY_COLOR = THEME_PRESETS[0]?.secondary ?? "#5E5CE6";

const FONT_OPTIONS = [
  { id: "system", label: "System Default" },
  { id: "inter", label: "Inter" },
  { id: "poppins", label: "Poppins" },
  { id: "dm_sans", label: "DM Sans" },
  { id: "space_grotesk", label: "Space Grotesk" },
  { id: "nunito", label: "Nunito" },
];

const normalizeFontFamily = (value: string | null | undefined) => {
  if (!value) return "system";
  if (value === "dm-sans") return "dm_sans";
  if (value === "space-grotesk") return "space_grotesk";
  return value;
};

const toRadiusNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.min(24, value));
  if (typeof value === "string") { const n = Number.parseFloat(value); if (Number.isFinite(n)) return Math.max(0, Math.min(24, n)); }
  return 12;
};

const EXTENSION_MODES = [
  { id: "security_fix_v2", label: "Security Fix", desc: "Análise e correção de vulnerabilidades" },
  { id: "seo_fix", label: "SEO Fix", desc: "Otimização para mecanismos de busca" },
  { id: "error_fix", label: "Error Fix", desc: "Detecção e correção de erros" },
  { id: "custom", label: "Modo Custom", desc: "Instrução personalizada para a IA" },
];

const DEFAULT_MODULES: Record<string, boolean> = {
  chat: false, deploy: true, preview: true, notes: true,
  split: false, automation: false, whitelabel: false, affiliates: true, community: true,
};

const MODULE_META: Record<string, { label: string; icon: any; desc: string }> = {
  chat: { label: "Chat AI", icon: Sparkles, desc: "Assistente inteligente integrado" },
  deploy: { label: "Deploy", icon: Zap, desc: "Publicação de projetos" },
  preview: { label: "Preview", icon: Eye, desc: "Visualização de projetos" },
  notes: { label: "Notas", icon: FileText, desc: "Anotações e documentos" },
  split: { label: "Split View", icon: Monitor, desc: "Edição dividida" },
  automation: { label: "Automação", icon: RefreshCw, desc: "Fluxos automatizados" },
  whitelabel: { label: "White Label", icon: Crown, desc: "Gestão de marca" },
  affiliates: { label: "Afiliados", icon: Users, desc: "Programa de indicações" },
  community: { label: "Comunidade", icon: Globe, desc: "Fórum e interações" },
};

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  tenant_owner: { label: "Owner", color: "text-amber-400" },
  tenant_admin: { label: "Admin", color: "text-primary" },
  tenant_support: { label: "Suporte", color: "text-cyan-400" },
  tenant_member: { label: "Membro", color: "text-muted-foreground" },
};

export default function TenantAdmin() {
  const { user, loading: authLoading } = useAuth();
  const { tenant, isTenantAdmin, isGlobalAdmin, tenantLoading } = useTenant();
  useSEO({ title: `Admin - ${tenant?.name || "Tenant"}` });
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") || "editor") as Tab;

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [licenses, setLicenses] = useState<TenantLicense[]>([]);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [wlSub, setWlSub] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [hasChanges, setHasChanges] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [addMemberEmail, setAddMemberEmail] = useState("");
  const [addMemberRole, setAddMemberRole] = useState("tenant_member");
  const [addMemberLoading, setAddMemberLoading] = useState(false);
  const [genTokenEmail, setGenTokenEmail] = useState("");
  const [genTokenPlan, setGenTokenPlan] = useState("daily_token");
  const [genTokenLoading, setGenTokenLoading] = useState(false);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupPix, setTopupPix] = useState<{ code: string; qr_base64?: string } | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [dbPlans, setDbPlans] = useState<{ id: string; name: string }[]>([]);

  const [form, setForm] = useState({
    name: "", logo_url: "", favicon_url: "",
    primary_color: DEFAULT_PRIMARY_COLOR, secondary_color: DEFAULT_SECONDARY_COLOR, accent_color: DEFAULT_SECONDARY_COLOR,
    meta_title: "", meta_description: "", terms_template: "", domain_custom: "",
    theme_preset: DEFAULT_THEME_PRESET_ID, font_family: "system", border_radius: 12,
    extension_mode: "security_fix_v2", custom_mode_prompt: "", trial_minutes: 30,
    modules: { ...DEFAULT_MODULES } as Record<string, boolean>,
  });

  const updateForm = (patch: Partial<typeof form>) => { setForm(f => ({ ...f, ...patch })); setHasChanges(true); };
  const canAccess = isTenantAdmin || isGlobalAdmin;
  const fetchAllRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    supabase.from("plans").select("id, name").eq("is_active", true).order("display_order", { ascending: true })
      .then(({ data }) => setDbPlans(data || []));
  }, []);

  useEffect(() => {
    if (!authLoading && !tenantLoading) {
      if (!user) navigate("/login");
      else if (!canAccess) navigate("/dashboard");
    }
  }, [user, canAccess, authLoading, tenantLoading, navigate]);

  useEffect(() => {
    if (tenant && canAccess) {
      const t = tenant as any;
      setForm({
        name: tenant.name, logo_url: tenant.logo_url || "", favicon_url: tenant.favicon_url || "",
        primary_color: tenant.primary_color || DEFAULT_PRIMARY_COLOR, secondary_color: tenant.secondary_color || DEFAULT_SECONDARY_COLOR,
        accent_color: tenant.accent_color || tenant.secondary_color || DEFAULT_SECONDARY_COLOR,
        meta_title: tenant.meta_title || "", meta_description: tenant.meta_description || "",
        terms_template: tenant.terms_template || "", domain_custom: tenant.domain_custom || "",
        theme_preset: t.theme_preset || DEFAULT_THEME_PRESET_ID,
        font_family: normalizeFontFamily(t.font_family),
        border_radius: toRadiusNumber(t.border_radius),
        modules: typeof t.modules === "object" && t.modules !== null ? { ...DEFAULT_MODULES, ...t.modules } : { ...DEFAULT_MODULES },
        extension_mode: t.extension_mode || "security_fix_v2",
        custom_mode_prompt: t.custom_mode_prompt || "",
        trial_minutes: t.trial_minutes ?? 30,
      });
      setHasChanges(false);
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
    } else setMembers([]);

    const { data: licensesList } = await supabase.from("licenses")
      .select("id, user_id, key, active, plan_type, status, expires_at, created_at")
      .eq("tenant_id", tenant.id).order("created_at", { ascending: false });
    const licenseList = licensesList || [];
    if (licenseList.length > 0) {
      const userIds = [...new Set(licenseList.map(l => l.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, name, email").in("user_id", userIds);
      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
      setLicenses(licenseList.map(l => ({
        ...l, user_name: profileMap.get(l.user_id)?.name || "?", user_email: profileMap.get(l.user_id)?.email || "?",
      })));
    } else setLicenses([]);

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

  const saveAll = async () => {
    if (!tenant) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("tenants").update({
        name: form.name,
        logo_url: form.logo_url || null, favicon_url: form.favicon_url || null,
        primary_color: form.primary_color, secondary_color: form.secondary_color,
        accent_color: form.accent_color,
        meta_title: form.meta_title || null, meta_description: form.meta_description || null,
        terms_template: form.terms_template || null, domain_custom: form.domain_custom || null,
        theme_preset: form.theme_preset,
        font_family: normalizeFontFamily(form.font_family),
        border_radius: `${Math.max(0, Math.min(24, form.border_radius))}px`,
        extension_mode: form.extension_mode,
        custom_mode_prompt: form.custom_mode_prompt || null, trial_minutes: form.trial_minutes,
        modules: form.modules,
      } as any).eq("id", tenant.id);
      if (error) throw error;
      toast.success("Configurações salvas com sucesso!");
      setHasChanges(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
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
      updateForm({ [type === "logo" ? "logo_url" : "favicon_url"]: urlData.publicUrl });
      toast.success(`${type === "logo" ? "Logo" : "Favicon"} enviado!`);
    } catch (err: any) {
      toast.error(err.message || "Erro no upload");
    } finally {
      setter(false);
    }
  };

  const applyThemePreset = (presetId: string) => {
    const preset = THEME_PRESETS.find(p => p.id === presetId);
    if (preset) updateForm({ theme_preset: presetId, primary_color: preset.primary, secondary_color: preset.secondary });
  };

  const updateMemberRole = async (memberId: string, newRole: string) => {
    const { error } = await supabase.from("tenant_users").update({ role: newRole as any }).eq("id", memberId);
    if (error) return toast.error(error.message);
    toast.success("Papel atualizado!"); fetchAll();
  };
  const removeMember = async (memberId: string) => {
    if (!confirm("Remover este membro?")) return;
    const { error } = await supabase.from("tenant_users").delete().eq("id", memberId);
    if (error) return toast.error(error.message);
    toast.success("Membro removido!"); fetchAll();
  };
  const revokeLicense = async (licenseId: string) => {
    await supabase.from("licenses").update({ active: false, status: "suspended" }).eq("id", licenseId);
    toast.success("Licença revogada!"); fetchAll();
  };
  const copyLicenseKey = (key: string) => { navigator.clipboard.writeText(key); toast.success("Chave copiada!"); };

  const handleAddMember = async () => {
    if (!tenant || !addMemberEmail) return toast.error("Informe o email");
    setAddMemberLoading(true);
    const { data: profile } = await supabase.from("profiles").select("user_id").eq("email", addMemberEmail.trim().toLowerCase()).maybeSingle();
    if (!profile) { setAddMemberLoading(false); return toast.error("Usuário não encontrado."); }
    const { data: existing } = await supabase.from("tenant_users").select("id").eq("user_id", profile.user_id).eq("tenant_id", tenant.id).maybeSingle();
    if (existing) { setAddMemberLoading(false); return toast.error("Já é membro"); }
    const { error } = await supabase.from("tenant_users").insert({ tenant_id: tenant.id, user_id: profile.user_id, role: addMemberRole as any, is_primary: false });
    setAddMemberLoading(false);
    if (error) return toast.error(error.message);
    setAddMemberEmail(""); toast.success("Membro adicionado!"); fetchAll();
  };

  const handleGenerateToken = async () => {
    if (!tenant || !wallet) return;
    setGenTokenLoading(true);
    const cost = Number(tenant.token_cost);
    if (wallet.balance < cost && cost > 0) { setGenTokenLoading(false); return toast.error("Saldo insuficiente"); }
    const { data: profiles } = await supabase.from("profiles").select("user_id").eq("email", genTokenEmail.trim().toLowerCase()).maybeSingle();
    if (!profiles) { setGenTokenLoading(false); return toast.error("Usuário não encontrado"); }
    const { data, error } = await supabase.functions.invoke("admin-token-actions", {
      body: { action: "generate", email: genTokenEmail.trim().toLowerCase(), name: genTokenEmail.split("@")[0], plan: genTokenPlan, user_id: profiles.user_id, tenant_id: tenant.id }
    });
    setGenTokenLoading(false);
    if (error || data?.error) return toast.error(data?.error || "Erro ao gerar token");
    setGenTokenEmail(""); toast.success("Licença gerada!"); fetchAll();
  };

  const handleTopup = async () => {
    const amount = Number(topupAmount);
    if (!tenant || amount < 5) return toast.error("Mínimo R$5,00");
    const { data, error } = await supabase.functions.invoke("tenant-topup", {
      body: { tenant_id: tenant.id, amount_brl: amount, payment_method: "pix" }
    });
    if (error || data?.error) return toast.error(data?.error || "Erro ao gerar recarga");
    setTopupPix({ code: data.pix_code, qr_base64: data.pix_qr_base64 });
    toast.success("PIX gerado!");
  };

  if (authLoading || tenantLoading || loading) {
    return (
      <AppLayout>
        <div className="min-h-full flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
            <p className="text-xs text-muted-foreground">Carregando painel...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const previewUrlRef = useRef("");

  const buildPreviewUrl = useCallback(() => {
    const params = new URLSearchParams();
    params.set("_preview", "1");
    if (form.name) params.set("name", form.name);
    if (form.theme_preset) params.set("preset", form.theme_preset);
    if (form.primary_color) params.set("primary", form.primary_color.replace("#", ""));
    if (form.secondary_color) params.set("secondary", form.secondary_color.replace("#", ""));
    if (form.accent_color) params.set("accent", form.accent_color.replace("#", ""));
    params.set("radius", String(form.border_radius));
    if (form.font_family && form.font_family !== "system") params.set("font", form.font_family);
    if (form.logo_url) params.set("logo", form.logo_url);
    return `/?${params.toString()}`;
  }, [form.name, form.theme_preset, form.primary_color, form.secondary_color, form.accent_color, form.border_radius, form.font_family, form.logo_url]);

  // Only rebuild preview URL on first load or manual refresh
  const [stablePreviewUrl, setStablePreviewUrl] = useState(() => buildPreviewUrl());
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Send live updates via postMessage instead of reloading iframe
  useEffect(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: "tenant-preview-update",
        payload: {
          name: form.name,
          preset: form.theme_preset,
          primary: form.primary_color,
          secondary: form.secondary_color,
          accent: form.accent_color,
          radius: form.border_radius,
          font: form.font_family,
          logo: form.logo_url,
        },
      }, "*");
    }
  }, [form.name, form.theme_preset, form.primary_color, form.secondary_color, form.accent_color, form.border_radius, form.font_family, form.logo_url]);

  const refreshPreview = () => {
    setStablePreviewUrl(buildPreviewUrl());
    setPreviewKey(k => k + 1);
  };

  // ── Glass Card wrapper ──
  const GlassCard = ({ children, className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div
      className={`relative rounded-2xl border border-white/[0.06] overflow-hidden ${className}`}
      style={{
        background: "var(--liquid-glass-bg)",
        backdropFilter: "blur(40px) saturate(180%)",
        WebkitBackdropFilter: "blur(40px) saturate(180%)",
        boxShadow: "var(--clf-shadow-glass), var(--light-specular)",
      }}
      {...props}
    >
      {children}
    </div>
  );

  // ── Section Header ──
  const SectionHeader = ({ icon: Icon, title, description, badge }: { icon: any; title: string; description: string; badge?: string }) => (
    <div className="flex items-start gap-4 mb-6">
      <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0 border border-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-foreground tracking-tight">{title}</h3>
          {badge && (
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">{badge}</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
      </div>
    </div>
  );

  const TABS = [
    { id: "editor" as Tab, label: "Editor Visual", icon: Palette, desc: "Personalização" },
    { id: "crm" as Tab, label: "CRM", icon: Users, desc: "Contatos & Campanhas" },
    { id: "users" as Tab, label: "Usuários", icon: Key, desc: `${members.length} membros` },
    { id: "licenses" as Tab, label: "Licenças", icon: Key, desc: `${licenses.length} ativas` },
    { id: "finances" as Tab, label: "Financeiro", icon: Wallet, desc: wallet ? `R$${wallet.balance.toFixed(2)}` : "—" },
    { id: "activity" as Tab, label: "Atividade", icon: BarChart3, desc: "Logs & métricas" },
  ];

  return (
    <AppLayout>
      <div className="min-h-full">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

          {/* ══════ HEADER ══════ */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              {form.logo_url ? (
                <img src={form.logo_url} alt="" className="h-12 w-12 rounded-2xl object-contain border border-white/[0.06] bg-background/50" />
              ) : (
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold text-foreground tracking-tight">{tenant?.name || "Tenant"}</h1>
                <p className="text-xs text-muted-foreground font-mono">/{tenant?.slug}{tenant?.domain_custom ? ` • ${tenant.domain_custom}` : ""}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {hasChanges && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-[11px] text-amber-500 font-medium">Alterações pendentes</span>
                </div>
              )}
              <button
                onClick={saveAll}
                disabled={saving || !hasChanges}
                className={`h-10 px-6 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all duration-200 ${
                  hasChanges
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98]"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                }`}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar
              </button>
            </div>
          </div>

          {/* WL Subscription Banner */}
          {wlSub && (
            <GlassCard className="p-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))]/20 to-[hsl(var(--primary))]/5 flex items-center justify-center">
                    <Crown className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{wlSub.plan_name || "White Label"}</p>
                    <p className="text-xs text-muted-foreground">
                      {wlSub.period === "yearly" ? "Plano Anual" : "Plano Mensal"} • R${(wlSub.amount_cents / 100).toFixed(2)}/período
                    </p>
                  </div>
                </div>
                <div className={`px-3 py-1.5 rounded-full text-[11px] font-semibold ${
                  wlSub.status === "active" && new Date(wlSub.expires_at) > new Date()
                    ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                    : "bg-destructive/10 text-destructive border border-destructive/20"
                }`}>
                  {wlSub.status === "active" && new Date(wlSub.expires_at) > new Date() ? "● Ativo" : "● Expirado"}
                </div>
              </div>
            </GlassCard>
          )}

          {/* Tab Navigation */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setSearchParams({ tab: t.id })}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  tab === t.id
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/[0.03] border border-transparent"
                }`}>
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
                {t.desc && <span className="text-[10px] text-muted-foreground ml-1 hidden sm:inline">{t.desc}</span>}
              </button>
            ))}
          </div>

          {/* ═══════════════ EDITOR TAB ═══════════════ */}
          {tab === "editor" && (
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_440px] gap-6">
              <div className="space-y-6">

                {/* ── Identity ── */}
                <GlassCard className="p-6">
                  <SectionHeader icon={Building2} title="Identidade" description="Nome, logo, favicon e domínio personalizado do seu tenant." />
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Nome</label>
                        <input
                          className="w-full h-12 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 transition-all"
                          value={form.name} onChange={e => updateForm({ name: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Domínio</label>
                        <input
                          className="w-full h-12 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 transition-all font-mono"
                          value={form.domain_custom} onChange={e => updateForm({ domain_custom: e.target.value })} placeholder="app.seusite.com"
                        />
                        {tenant?.domain_custom && !tenant.is_domain_approved && (
                          <p className="text-[10px] text-amber-500 mt-1.5 flex items-center gap-1"><CircleDot className="h-3 w-3" /> Aguardando aprovação</p>
                        )}
                        {tenant?.domain_custom && tenant.is_domain_approved && (
                          <p className="text-[10px] text-emerald-500 mt-1.5 flex items-center gap-1"><Check className="h-3 w-3" /> Domínio aprovado</p>
                        )}
                      </div>
                    </div>

                    {/* Logo & Favicon */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {(["logo", "favicon"] as const).map(type => {
                        const url = type === "logo" ? form.logo_url : form.favicon_url;
                        const uploading = type === "logo" ? uploadingLogo : uploadingFavicon;
                        return (
                          <div key={type}>
                            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                              {type === "logo" ? "Logo" : "Favicon"}
                            </label>
                            <div className="flex items-center gap-3">
                              <div className="h-14 w-14 rounded-xl border border-white/[0.08] bg-white/[0.03] flex items-center justify-center overflow-hidden flex-shrink-0">
                                {url ? (
                                  <img src={url} alt="" className="h-full w-full object-contain p-1" />
                                ) : (
                                  <Upload className="h-4 w-4 text-muted-foreground/40" />
                                )}
                              </div>
                              <div className="flex-1 space-y-1.5">
                                <input
                                  className="w-full h-9 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] text-foreground font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
                                  value={url} onChange={e => updateForm({ [type === "logo" ? "logo_url" : "favicon_url"]: e.target.value })} placeholder="URL ou upload →"
                                />
                                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[10px] font-semibold cursor-pointer hover:bg-primary/15 transition-colors">
                                  {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                                  Upload
                                  <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFileUpload(type, e.target.files[0])} />
                                </label>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </GlassCard>

                {/* ── Colors ── */}
                <GlassCard className="p-6">
                  <SectionHeader icon={Palette} title="Paleta de Cores" description="Escolha um tema predefinido ou personalize as cores manualmente." badge={`${THEME_PRESETS.length} temas`} />

                  {/* Presets Grid */}
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5 mb-6">
                    {THEME_PRESETS.map(preset => (
                      <button
                        key={preset.id}
                        onClick={() => applyThemePreset(preset.id)}
                        className={`group relative p-3 rounded-xl border transition-all duration-200 ${
                          form.theme_preset === preset.id
                            ? "ring-2 ring-primary border-primary/30 scale-105 shadow-lg shadow-primary/10"
                            : "border-white/[0.06] hover:border-white/[0.15] hover:scale-[1.03]"
                        }`}
                        style={form.theme_preset !== preset.id ? { background: "var(--liquid-glass-bg)" } : { background: "var(--liquid-glass-bg)" }}
                      >
                        <div className="flex items-center justify-center gap-1.5 mb-2">
                          <div className="w-4 h-4 rounded-full shadow-inner" style={{ background: preset.primary }} />
                          <div className="w-4 h-4 rounded-full shadow-inner" style={{ background: preset.secondary }} />
                        </div>
                        <p className="text-[9px] font-semibold truncate text-center">{preset.label}</p>
                        {form.theme_preset === preset.id && (
                          <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                            <Check className="h-2.5 w-2.5 text-primary-foreground" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Custom Color Pickers */}
                  <div className="grid grid-cols-3 gap-4">
                    {([
                      { key: "primary_color" as const, label: "Primária" },
                      { key: "secondary_color" as const, label: "Secundária" },
                      { key: "accent_color" as const, label: "Accent" },
                    ]).map(({ key, label }) => (
                      <div key={key} className="space-y-2">
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
                        <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                          <input type="color" value={form[key]} onChange={e => updateForm({ [key]: e.target.value })} className="h-9 w-9 rounded-lg cursor-pointer border-0 p-0 bg-transparent" />
                          <input
                            className="flex-1 h-9 px-2 bg-transparent border-0 text-xs font-mono text-foreground focus:outline-none"
                            value={form[key]} onChange={e => updateForm({ [key]: e.target.value })}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </GlassCard>

                {/* ── Typography & Layout ── */}
                <GlassCard className="p-6">
                  <SectionHeader icon={Settings2} title="Tipografia & Layout" description="Fonte, border-radius e configuração visual global." />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Fonte</label>
                      <select
                        className="w-full h-12 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all appearance-none cursor-pointer"
                        value={form.font_family} onChange={e => updateForm({ font_family: e.target.value })}
                      >
                        {FONT_OPTIONS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                        Border Radius
                        <span className="ml-2 text-foreground font-bold">{form.border_radius}px</span>
                      </label>
                      <div className="mt-3 space-y-2">
                        <input type="range" min={0} max={24} step={1} value={form.border_radius} onChange={e => updateForm({ border_radius: Number(e.target.value) })} className="w-full accent-primary h-1.5" />
                        <div className="flex justify-between text-[9px] text-muted-foreground">
                          <span>Sharp</span><span>Round</span>
                        </div>
                      </div>
                      {/* Preview boxes */}
                      <div className="flex items-center gap-3 mt-3">
                        <div className="h-10 w-16 bg-primary/15 border border-primary/20" style={{ borderRadius: form.border_radius }} />
                        <div className="h-8 w-8 bg-primary/15 border border-primary/20" style={{ borderRadius: Math.min(form.border_radius, 12) }} />
                        <div className="h-6 px-3 bg-primary/15 border border-primary/20 flex items-center" style={{ borderRadius: Math.min(form.border_radius, 8) }}>
                          <span className="text-[9px] text-primary font-medium">Btn</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </GlassCard>

                {/* ── Extension Mode ── */}
                <GlassCard className="p-6">
                  <SectionHeader icon={Shield} title="Extensão" description="Modo de operação e configuração de trial para novos usuários." />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                    {EXTENSION_MODES.map(m => (
                      <button
                        key={m.id}
                        onClick={() => updateForm({ extension_mode: m.id })}
                        className={`p-4 rounded-xl border text-left transition-all duration-200 ${
                          form.extension_mode === m.id
                            ? "border-primary/30 bg-primary/10 ring-1 ring-primary/20"
                            : "border-white/[0.06] hover:border-white/[0.12] bg-white/[0.02]"
                        }`}
                      >
                        <p className={`text-xs font-bold mb-1 ${form.extension_mode === m.id ? "text-primary" : "text-foreground"}`}>{m.label}</p>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">{m.desc}</p>
                      </button>
                    ))}
                  </div>
                  {form.extension_mode === "custom" && (
                    <textarea
                      className="w-full h-28 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] resize-none text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all mb-5"
                      value={form.custom_mode_prompt} onChange={e => updateForm({ custom_mode_prompt: e.target.value })} placeholder="Instrução personalizada para a IA..."
                    />
                  )}
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                      Duração do Trial
                      <span className="ml-2 text-foreground font-bold">{form.trial_minutes} min</span>
                    </label>
                    <input type="range" min={5} max={120} step={5} value={form.trial_minutes} onChange={e => updateForm({ trial_minutes: Number(e.target.value) })} className="w-full accent-primary h-1.5" />
                    <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                      <span>5 min</span><span>120 min</span>
                    </div>
                  </div>
                </GlassCard>

                {/* ── SEO ── */}
                <GlassCard className="p-6">
                  <SectionHeader icon={Globe} title="SEO & Meta" description="Otimize a presença do seu tenant nos mecanismos de busca." />
                  <div className="space-y-4">
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Título</label>
                      <input className="w-full h-12 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" value={form.meta_title} onChange={e => updateForm({ meta_title: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Descrição</label>
                      <textarea className="w-full h-24 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] resize-none text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" value={form.meta_description} onChange={e => updateForm({ meta_description: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Termos de Uso</label>
                      <textarea className="w-full h-36 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] resize-none text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" value={form.terms_template} onChange={e => updateForm({ terms_template: e.target.value })} placeholder="Termos personalizados..." />
                    </div>
                  </div>
                </GlassCard>

                {/* ── Modules ── */}
                <GlassCard className="p-6">
                  <SectionHeader icon={Boxes} title="Módulos" description="Ative ou desative funcionalidades para os usuários do seu tenant." badge={`${Object.values(form.modules).filter(Boolean).length} ativos`} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(MODULE_META).map(([key, meta]) => {
                      const Icon = meta.icon;
                      const active = form.modules[key];
                      return (
                        <button
                          key={key}
                          onClick={() => updateForm({ modules: { ...form.modules, [key]: !active } })}
                          className={`group flex items-start gap-3 p-4 rounded-xl border text-left transition-all duration-200 ${
                            active
                              ? "border-primary/25 bg-primary/[0.07]"
                              : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
                          }`}
                        >
                          <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                            active ? "bg-primary/15 text-primary" : "bg-white/[0.05] text-muted-foreground"
                          }`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-bold ${active ? "text-primary" : "text-foreground"}`}>{meta.label}</p>
                            <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">{meta.desc}</p>
                          </div>
                          <div className={`h-5 w-9 rounded-full relative flex-shrink-0 transition-colors mt-0.5 ${active ? "bg-primary" : "bg-muted"}`}>
                            <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${active ? "translate-x-4" : "translate-x-0.5"}`} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </GlassCard>
              </div>

              {/* ══════ RIGHT: LIVE PREVIEW ══════ */}
              <div className="space-y-3">
                <div className="sticky top-6">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs font-bold text-foreground">Preview ao Vivo</p>
                      <p className="text-[10px] text-muted-foreground">Visualize as mudanças em tempo real</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={refreshPreview} className="h-8 w-8 rounded-lg border border-white/[0.06] bg-white/[0.03] flex items-center justify-center hover:bg-white/[0.06] transition-colors" title="Recarregar">
                        <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <div className="flex items-center gap-0.5 p-1 rounded-lg border border-white/[0.06] bg-white/[0.03]">
                        <button onClick={() => setPreviewDevice("desktop")} className={`p-1.5 rounded-md transition-all ${previewDevice === "desktop" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                          <Monitor className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setPreviewDevice("mobile")} className={`p-1.5 rounded-md transition-all ${previewDevice === "mobile" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                          <Smartphone className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <GlassCard
                    className="transition-all duration-300"
                    style={{
                      width: previewDevice === "mobile" ? 375 : "100%",
                      maxWidth: previewDevice === "mobile" ? 375 : "100%",
                      height: previewDevice === "mobile" ? 667 : 620,
                      margin: previewDevice === "mobile" ? "0 auto" : undefined,
                    }}
                  >
                    <iframe
                      ref={iframeRef}
                      key={previewKey}
                      src={stablePreviewUrl}
                      className="w-full h-full border-0"
                      title="Tenant Preview"
                      style={{
                        transform: previewDevice === "desktop" ? "scale(0.65)" : "scale(0.85)",
                        transformOrigin: "top left",
                        width: previewDevice === "desktop" ? "154%" : "118%",
                        height: previewDevice === "desktop" ? "154%" : "118%",
                      }}
                    />
                  </GlassCard>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════ USERS TAB ═══════════════ */}
          {tab === "users" && (
            <div className="max-w-4xl space-y-6">
              {/* Add Member */}
              <GlassCard className="p-6">
                <SectionHeader icon={Plus} title="Adicionar Membro" description="Convide um novo membro pelo email cadastrado na plataforma." />
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Email</label>
                    <input className="w-full h-12 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" placeholder="email@exemplo.com" value={addMemberEmail} onChange={e => setAddMemberEmail(e.target.value)} />
                  </div>
                  <div className="w-40">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Papel</label>
                    <select className="w-full h-12 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all appearance-none cursor-pointer" value={addMemberRole} onChange={e => setAddMemberRole(e.target.value)}>
                      <option value="tenant_member">Membro</option>
                      <option value="tenant_support">Suporte</option>
                      <option value="tenant_admin">Admin</option>
                      <option value="tenant_owner">Owner</option>
                    </select>
                  </div>
                  <button onClick={handleAddMember} disabled={addMemberLoading} className="h-12 px-6 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-2 hover:shadow-lg hover:shadow-primary/25 transition-all active:scale-[0.98]">
                    {addMemberLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Adicionar
                  </button>
                </div>
              </GlassCard>

              {/* Members List */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">{members.length} membro(s)</p>
                {members.map(m => {
                  const roleInfo = ROLE_LABELS[m.role] || ROLE_LABELS.tenant_member;
                  return (
                    <GlassCard key={m.id} className="p-4 flex items-center justify-between hover:border-white/[0.12] transition-all">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center text-sm font-bold text-primary">
                          {(m.profile?.name || "?")[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{m.profile?.name || "?"}</p>
                          <p className="text-[11px] text-muted-foreground">{m.profile?.email || m.user_id}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <select
                          className="h-9 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-foreground focus:outline-none cursor-pointer appearance-none"
                          value={m.role} onChange={e => updateMemberRole(m.id, e.target.value)}
                        >
                          <option value="tenant_member">Membro</option>
                          <option value="tenant_support">Suporte</option>
                          <option value="tenant_admin">Admin</option>
                          <option value="tenant_owner">Owner</option>
                        </select>
                        <span className={`text-[10px] font-bold ${roleInfo.color}`}>{roleInfo.label}</span>
                        <button onClick={() => removeMember(m.id)} className="h-9 w-9 flex items-center justify-center rounded-lg text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-all">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </GlassCard>
                  );
                })}
                {members.length === 0 && (
                  <GlassCard className="p-12 text-center">
                    <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Nenhum membro encontrado</p>
                  </GlassCard>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════ LICENSES TAB ═══════════════ */}
          {tab === "licenses" && (
            <div className="max-w-4xl space-y-6">
              {/* Generate License */}
              <GlassCard className="p-6">
                <SectionHeader icon={Key} title="Gerar Nova Licença" description="Crie uma licença vinculada a um usuário existente." />
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Email do Usuário</label>
                    <input className="w-full h-12 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" placeholder="email@exemplo.com" value={genTokenEmail} onChange={e => setGenTokenEmail(e.target.value)} />
                  </div>
                  <div className="w-44">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Plano</label>
                    <select className="w-full h-12 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all appearance-none cursor-pointer" value={genTokenPlan} onChange={e => setGenTokenPlan(e.target.value)}>
                      {dbPlans.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                      <option value="daily_token">Daily Token</option>
                    </select>
                  </div>
                  <button onClick={handleGenerateToken} disabled={genTokenLoading} className="h-12 px-6 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-2 hover:shadow-lg hover:shadow-primary/25 transition-all active:scale-[0.98]">
                    {genTokenLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
                    Gerar
                  </button>
                </div>
              </GlassCard>

              {/* Licenses List */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">{licenses.length} licença(s)</p>
                {licenses.map(l => (
                  <GlassCard key={l.id} className="p-4 flex items-center justify-between hover:border-white/[0.12] transition-all">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${l.active ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
                        <Key className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{l.user_name}</p>
                        <p className="text-[11px] text-muted-foreground">{l.user_email} • {l.plan_type}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                        l.active
                          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                          : "bg-muted text-muted-foreground border border-border"
                      }`}>
                        {l.active ? "Ativa" : "Inativa"}
                      </span>
                      <button onClick={() => copyLicenseKey(l.key)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white/[0.06] transition-colors" title="Copiar chave">
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      {l.active && (
                        <button onClick={() => revokeLicense(l.id)} className="h-8 px-3 rounded-lg text-[10px] font-semibold bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                          Revogar
                        </button>
                      )}
                    </div>
                  </GlassCard>
                ))}
                {licenses.length === 0 && (
                  <GlassCard className="p-12 text-center">
                    <Key className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Nenhuma licença encontrada</p>
                  </GlassCard>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════ FINANCES TAB ═══════════════ */}
          {tab === "finances" && (
            <div className="max-w-4xl space-y-6">
              {/* Wallet Summary */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Saldo Disponível", value: `R$${(wallet?.balance ?? 0).toFixed(2)}`, icon: Wallet, gradient: "from-primary/15 to-primary/5", textColor: "text-primary" },
                  { label: "Total Creditado", value: `R$${(wallet?.total_credited ?? 0).toFixed(2)}`, icon: ArrowUpRight, gradient: "from-emerald-500/15 to-emerald-500/5", textColor: "text-emerald-500" },
                  { label: "Total Debitado", value: `R$${(wallet?.total_debited ?? 0).toFixed(2)}`, icon: CreditCard, gradient: "from-destructive/15 to-destructive/5", textColor: "text-destructive" },
                ].map(item => (
                  <GlassCard key={item.label} className="p-5">
                    <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center mb-3`}>
                      <item.icon className={`h-5 w-5 ${item.textColor}`} />
                    </div>
                    <p className={`text-2xl font-bold ${item.textColor} tracking-tight`}>{item.value}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{item.label}</p>
                  </GlassCard>
                ))}
              </div>

              {/* Topup */}
              <GlassCard className="p-6">
                <SectionHeader icon={CreditCard} title="Recarregar Saldo" description="Adicione créditos via PIX instantâneo." />
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Valor (R$)</label>
                    <input type="number" className="w-full h-12 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" placeholder="Mínimo R$5,00" value={topupAmount} onChange={e => setTopupAmount(e.target.value)} />
                  </div>
                  <button onClick={handleTopup} className="h-12 px-6 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-2 hover:shadow-lg hover:shadow-primary/25 transition-all active:scale-[0.98]">
                    <Wallet className="h-4 w-4" /> Gerar PIX
                  </button>
                </div>
                {topupPix && (
                  <div className="mt-5 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <p className="text-xs font-semibold text-foreground mb-2">Código PIX Copia e Cola:</p>
                    <div className="flex items-center gap-2">
                      <code className="text-[10px] flex-1 break-all bg-white/[0.04] p-3 rounded-lg font-mono text-foreground/80">{topupPix.code}</code>
                      <button onClick={() => { navigator.clipboard.writeText(topupPix.code); toast.success("PIX copiado!"); }} className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/15 transition-colors flex-shrink-0">
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </GlassCard>

              {/* Transactions */}
              <GlassCard className="p-6">
                <SectionHeader icon={BarChart3} title="Extrato" description="Últimas movimentações financeiras do tenant." />
                <div className="space-y-0">
                  {transactions.slice(0, 20).map((tx, i) => (
                    <div key={tx.id} className={`flex items-center justify-between py-3.5 ${i < transactions.length - 1 ? "border-b border-white/[0.04]" : ""}`}>
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${tx.amount > 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-destructive/10 text-destructive"}`}>
                          {tx.amount > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <CreditCard className="h-3.5 w-3.5" />}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-foreground">{tx.description || tx.type}</p>
                          <p className="text-[10px] text-muted-foreground">{format(new Date(tx.created_at), "dd/MM/yyyy HH:mm")}</p>
                        </div>
                      </div>
                      <span className={`text-sm font-bold tabular-nums ${tx.amount > 0 ? "text-emerald-500" : "text-destructive"}`}>
                        {tx.amount > 0 ? "+" : ""}R${Math.abs(tx.amount).toFixed(2)}
                      </span>
                    </div>
                  ))}
                  {transactions.length === 0 && (
                    <div className="text-center py-10">
                      <BarChart3 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">Nenhuma transação registrada</p>
                    </div>
                  )}
                </div>
              </GlassCard>
            </div>
          )}

          {/* ═══════════════ CRM TAB ═══════════════ */}
          {tab === "crm" && tenant && user && (
            <CrmPanel tenantId={tenant.id} userId={user.id} />
          )}

          {/* ═══════════════ ACTIVITY TAB ═══════════════ */}
          {tab === "activity" && (
            <ActivityDashboard isGlobalAdmin={isGlobalAdmin} tenantId={tenant?.id} />
          )}
        </div>
      </div>
    </AppLayout>
  );
}
