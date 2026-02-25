import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";
import { useSEO } from "@/hooks/useSEO";
import {
  Building2, Users, Key, Wallet, Palette, Globe, FileText,
  Loader2, Save, Pencil, Trash2, Plus, Eye, EyeOff,
  RefreshCw, Copy, BarChart3, Shield, Upload, Settings2, Boxes,
  Monitor, Smartphone, ExternalLink, Check
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import AppLayout from "@/components/AppLayout";

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

type Tab = "editor" | "users" | "licenses" | "finances";

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

const DEFAULT_MODULES: Record<string, boolean> = {
  chat: false, deploy: true, preview: true, notes: true,
  split: false, automation: false, whitelabel: false, affiliates: true, community: true,
};

const MODULE_LABELS: Record<string, string> = {
  chat: "Chat AI / Star AI",
  deploy: "Deploy / Publicação",
  preview: "Preview de Projetos",
  notes: "Notas",
  split: "Split View",
  automation: "Automação",
  whitelabel: "White Label",
  affiliates: "Afiliados",
  community: "Comunidade",
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

  // Add member inline
  const [addMemberEmail, setAddMemberEmail] = useState("");
  const [addMemberRole, setAddMemberRole] = useState("tenant_member");
  const [addMemberLoading, setAddMemberLoading] = useState(false);

  // Generate token inline
  const [genTokenEmail, setGenTokenEmail] = useState("");
  const [genTokenPlan, setGenTokenPlan] = useState("daily_token");
  const [genTokenLoading, setGenTokenLoading] = useState(false);

  // Topup inline
  const [topupAmount, setTopupAmount] = useState("");
  const [topupPix, setTopupPix] = useState<{ code: string; qr_base64?: string } | null>(null);

  // Upload states
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);

  const [dbPlans, setDbPlans] = useState<{ id: string; name: string }[]>([]);

  // ── Unified Editor Form ──
  const [form, setForm] = useState({
    name: "", logo_url: "", favicon_url: "",
    primary_color: "#0A84FF", secondary_color: "#5E5CE6", accent_color: "#5E5CE6",
    meta_title: "", meta_description: "", terms_template: "", domain_custom: "",
    theme_preset: "default", font_family: "system", border_radius: 12,
    extension_mode: "security_fix_v2", custom_mode_prompt: "", trial_minutes: 30,
    modules: { ...DEFAULT_MODULES } as Record<string, boolean>,
  });

  const updateForm = (patch: Partial<typeof form>) => {
    setForm(f => ({ ...f, ...patch }));
    setHasChanges(true);
  };

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
        primary_color: tenant.primary_color, secondary_color: tenant.secondary_color,
        accent_color: tenant.accent_color || "#5E5CE6",
        meta_title: tenant.meta_title || "", meta_description: tenant.meta_description || "",
        terms_template: tenant.terms_template || "", domain_custom: tenant.domain_custom || "",
        theme_preset: t.theme_preset || "default", font_family: t.font_family || "system",
        border_radius: t.border_radius ?? 12, extension_mode: t.extension_mode || "security_fix_v2",
        custom_mode_prompt: t.custom_mode_prompt || "", trial_minutes: t.trial_minutes ?? 30,
        modules: typeof t.modules === "object" && t.modules !== null
          ? { ...DEFAULT_MODULES, ...t.modules } : { ...DEFAULT_MODULES },
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

  // ── Save All ──
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
        theme_preset: form.theme_preset, font_family: form.font_family,
        border_radius: form.border_radius, extension_mode: form.extension_mode,
        custom_mode_prompt: form.custom_mode_prompt || null, trial_minutes: form.trial_minutes,
        modules: form.modules,
      } as any).eq("id", tenant.id);
      if (error) throw error;
      toast.success("Tenant atualizado com sucesso!");
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
    if (preset) {
      updateForm({ theme_preset: presetId, primary_color: preset.primary, secondary_color: preset.secondary });
    }
  };

  // ── Member / License / Finance actions ──
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
  const copyLicenseKey = (key: string) => { navigator.clipboard.writeText(key); toast.success("Licença copiada!"); };

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
    return <AppLayout><div className="min-h-full flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></AppLayout>;
  }

  // ── Live Preview Component ──
  const fontFamilyMap: Record<string, string> = {
    system: "system-ui, sans-serif", inter: "'Inter', sans-serif", poppins: "'Poppins', sans-serif",
    "dm-sans": "'DM Sans', sans-serif", "space-grotesk": "'Space Grotesk', sans-serif", nunito: "'Nunito', sans-serif",
  };
  const previewFont = fontFamilyMap[form.font_family] || fontFamilyMap.system;
  const previewRadius = `${form.border_radius}px`;
  const isDarkPreset = form.theme_preset === "midnight" || form.theme_preset === "neon-cyber";
  const previewBg = isDarkPreset ? "#0F172A" : "#FFFFFF";
  const previewText = isDarkPreset ? "#E2E8F0" : "#1E293B";
  const previewMuted = isDarkPreset ? "#334155" : "#F1F5F9";
  const previewMutedText = isDarkPreset ? "#94A3B8" : "#64748B";

  const LivePreview = () => (
    <div
      className="border border-border rounded-2xl overflow-hidden transition-all duration-300"
      style={{
        width: previewDevice === "mobile" ? 375 : "100%",
        maxWidth: previewDevice === "mobile" ? 375 : "100%",
        margin: previewDevice === "mobile" ? "0 auto" : undefined,
        fontFamily: previewFont,
        background: previewBg,
        color: previewText,
      }}
    >
      {/* Nav bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: previewMuted }}>
        {form.logo_url ? (
          <img src={form.logo_url} alt="" className="h-7 w-7 object-contain" style={{ borderRadius: `${Math.min(form.border_radius, 8)}px` }} />
        ) : (
          <div className="h-7 w-7 flex items-center justify-center text-white text-[10px] font-bold" style={{ background: form.primary_color, borderRadius: `${Math.min(form.border_radius, 8)}px` }}>
            {form.name?.[0]?.toUpperCase() || "T"}
          </div>
        )}
        <span className="text-sm font-bold" style={{ color: previewText }}>{form.name || "Tenant"}</span>
        <div className="flex-1" />
        <div className="flex gap-1.5">
          {["Dashboard", "Projetos", "Chat"].map(item => (
            <span key={item} className="text-[10px] px-2 py-1" style={{ color: previewMutedText, borderRadius: previewRadius }}>{item}</span>
          ))}
        </div>
      </div>

      {/* Hero area */}
      <div className="p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold" style={{ color: previewText }}>Bem-vindo ao {form.name || "Tenant"}</h2>
          <p className="text-xs mt-1" style={{ color: previewMutedText }}>{form.meta_description || "Descrição do seu workspace personalizado."}</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button className="px-4 py-2 text-white text-xs font-semibold" style={{ background: form.primary_color, borderRadius: previewRadius }}>
            Botão Primário
          </button>
          <button className="px-4 py-2 text-xs font-semibold border-2" style={{ color: form.secondary_color, borderColor: form.secondary_color, borderRadius: previewRadius, background: "transparent" }}>
            Botão Secundário
          </button>
          <button className="px-4 py-2 text-xs font-semibold" style={{ background: form.accent_color + "20", color: form.accent_color, borderRadius: previewRadius }}>
            Accent
          </button>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Projetos", value: "12", icon: "📁" },
            { label: "Mensagens", value: "847", icon: "💬" },
          ].map(card => (
            <div key={card.label} className="p-3 border" style={{ borderColor: previewMuted, borderRadius: previewRadius, background: previewMuted + "80" }}>
              <p className="text-lg">{card.icon}</p>
              <p className="text-lg font-bold mt-1" style={{ color: form.primary_color }}>{card.value}</p>
              <p className="text-[10px]" style={{ color: previewMutedText }}>{card.label}</p>
            </div>
          ))}
        </div>

        {/* Module badges */}
        <div>
          <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: previewMutedText }}>Módulos Ativos</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(form.modules).filter(([, v]) => v).map(([key]) => (
              <span key={key} className="px-2 py-0.5 text-[9px] font-medium" style={{ background: form.primary_color + "15", color: form.primary_color, borderRadius: previewRadius }}>
                {MODULE_LABELS[key] || key}
              </span>
            ))}
          </div>
        </div>

        {/* Input preview */}
        <div className="p-3 border" style={{ borderColor: previewMuted, borderRadius: previewRadius }}>
          <p className="text-[10px] font-semibold mb-1.5" style={{ color: previewMutedText }}>Input Preview</p>
          <div className="h-8 border px-3 flex items-center text-xs" style={{ borderColor: previewMuted, borderRadius: previewRadius, color: previewMutedText }}>
            Digite algo aqui...
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t text-center" style={{ borderColor: previewMuted }}>
        <p className="text-[9px]" style={{ color: previewMutedText }}>
          {form.domain_custom || `${tenant?.slug}.starble.app`} • {form.meta_title || form.name}
        </p>
      </div>
    </div>
  );

  // ── Section Header ──
  const SectionTitle = ({ icon: Icon, title, description }: { icon: any; title: string; description: string }) => (
    <div className="flex items-start gap-3 mb-4">
      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );

  return (
    <AppLayout>
      <div className="min-h-full">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-5">
          {/* ── Header ── */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Admin do Tenant</p>
              <h1 className="text-xl font-bold text-foreground">{tenant?.name || "Tenant"}</h1>
              <p className="text-xs text-muted-foreground">/{tenant?.slug} {tenant?.domain_custom && `• ${tenant.domain_custom}`}</p>
            </div>
            <div className="flex items-center gap-2">
              {hasChanges && (
                <span className="text-[10px] text-amber-500 font-medium animate-pulse">Alterações não salvas</span>
              )}
              <button onClick={saveAll} disabled={saving || !hasChanges} className={`lv-btn-primary h-9 px-5 text-xs flex items-center gap-2 ${!hasChanges ? "opacity-50 cursor-not-allowed" : ""}`}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Salvar Tudo
              </button>
            </div>
          </div>

          {/* WL Sub Status */}
          {wlSub && (
            <div className="lv-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">{wlSub.plan_name || "White Label"}</span>
                <span className="text-xs text-muted-foreground">
                  {wlSub.period === "yearly" ? "Anual" : "Mensal"} • R${(wlSub.amount_cents / 100).toFixed(2)}
                </span>
              </div>
              <span className={`lv-badge text-[10px] ${wlSub.status === "active" && new Date(wlSub.expires_at) > new Date() ? "lv-badge-success" : "lv-badge-muted"}`}>
                {wlSub.status === "active" && new Date(wlSub.expires_at) > new Date() ? "Ativo" : "Expirado"}
              </span>
            </div>
          )}

          {/* ── Tabs ── */}
          <div className="flex gap-1.5 border-b border-border pb-0">
            {([
              { id: "editor", label: "Editor Visual", icon: Palette },
              { id: "users", label: "Usuários", icon: Users },
              { id: "licenses", label: "Licenças", icon: Key },
              { id: "finances", label: "Financeiro", icon: Wallet },
            ] as const).map(t => (
              <button
                key={t.id}
                onClick={() => setSearchParams({ tab: t.id })}
                className={`px-4 py-2.5 text-xs font-medium flex items-center gap-2 border-b-2 transition-colors -mb-px ${
                  tab === t.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <t.icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            ))}
          </div>

          {/* ═══════ EDITOR TAB ═══════ */}
          {tab === "editor" && (
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6">
              {/* ── Left: Form Sections ── */}
              <div className="space-y-6">
                {/* Identity */}
                <div className="lv-card space-y-4">
                  <SectionTitle icon={Building2} title="Identidade" description="Nome, logo e domínio do tenant." />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5">Nome do Tenant</label>
                      <input className="lv-input w-full h-11 text-sm" value={form.name} onChange={e => updateForm({ name: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5">Domínio Custom</label>
                      <input className="lv-input w-full h-11 text-sm" value={form.domain_custom} onChange={e => updateForm({ domain_custom: e.target.value })} placeholder="app.seusite.com" />
                      {tenant?.domain_custom && !tenant.is_domain_approved && <p className="text-[10px] text-amber-500 mt-1">⏳ Aguardando aprovação</p>}
                      {tenant?.domain_custom && tenant.is_domain_approved && <p className="text-[10px] text-green-600 mt-1">✅ Aprovado</p>}
                    </div>
                  </div>

                  {/* Logo & Favicon */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(["logo", "favicon"] as const).map(type => {
                      const url = type === "logo" ? form.logo_url : form.favicon_url;
                      const uploading = type === "logo" ? uploadingLogo : uploadingFavicon;
                      return (
                        <div key={type}>
                          <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5">{type === "logo" ? "Logo" : "Favicon"}</label>
                          <div className="flex items-center gap-2">
                            {url && <img src={url} alt="" className="h-10 w-10 object-contain rounded-lg border border-border" />}
                            <input className="lv-input flex-1 h-10 text-xs" value={url} onChange={e => updateForm({ [type === "logo" ? "logo_url" : "favicon_url"]: e.target.value })} placeholder="https://..." />
                            <label className="lv-btn-secondary h-10 w-10 p-0 flex items-center justify-center cursor-pointer flex-shrink-0">
                              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                              <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFileUpload(type, e.target.files[0])} />
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Colors */}
                <div className="lv-card space-y-4">
                  <SectionTitle icon={Palette} title="Cores" description="Paleta de cores do tenant. Escolha um preset ou personalize." />
                  {/* Presets */}
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {THEME_PRESETS.map(preset => (
                      <button
                        key={preset.id}
                        onClick={() => applyThemePreset(preset.id)}
                        className={`p-2 rounded-xl border transition-all text-center ${
                          form.theme_preset === preset.id
                            ? "ring-2 ring-primary border-primary/40 scale-105"
                            : "border-border/50 hover:border-primary/30"
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <div className="w-3 h-3 rounded-full" style={{ background: preset.primary }} />
                          <div className="w-3 h-3 rounded-full" style={{ background: preset.secondary }} />
                        </div>
                        <p className="text-[9px] font-medium truncate">{preset.label}</p>
                      </button>
                    ))}
                  </div>
                  {/* Color pickers */}
                  <div className="grid grid-cols-3 gap-3">
                    {([
                      { key: "primary_color", label: "Primária" },
                      { key: "secondary_color", label: "Secundária" },
                      { key: "accent_color", label: "Accent" },
                    ] as const).map(({ key, label }) => (
                      <div key={key}>
                        <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5">{label}</label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={form[key]} onChange={e => updateForm({ [key]: e.target.value })} className="h-10 w-10 rounded-lg cursor-pointer border-0 p-0" />
                          <input className="lv-input flex-1 h-10 text-xs font-mono" value={form[key]} onChange={e => updateForm({ [key]: e.target.value })} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Typography & Layout */}
                <div className="lv-card space-y-4">
                  <SectionTitle icon={Settings2} title="Tipografia & Layout" description="Fonte, raio de borda e configuração visual." />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5">Font Family</label>
                      <select className="lv-input w-full h-11 text-sm" value={form.font_family} onChange={e => updateForm({ font_family: e.target.value })}>
                        {FONT_OPTIONS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5">Border Radius: {form.border_radius}px</label>
                      <input type="range" min={0} max={24} step={1} value={form.border_radius} onChange={e => updateForm({ border_radius: Number(e.target.value) })} className="w-full accent-primary mt-2" />
                      <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                        <span>Sharp 0px</span><span>Round 24px</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Extension Mode */}
                <div className="lv-card space-y-4">
                  <SectionTitle icon={Shield} title="Extensão" description="Modo de operação da extensão e configuração de trial." />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5">Modo da Extensão</label>
                      <select className="lv-input w-full h-11 text-sm" value={form.extension_mode} onChange={e => updateForm({ extension_mode: e.target.value })}>
                        {EXTENSION_MODES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5">Trial: {form.trial_minutes} min</label>
                      <input type="range" min={5} max={120} step={5} value={form.trial_minutes} onChange={e => updateForm({ trial_minutes: Number(e.target.value) })} className="w-full accent-primary mt-2" />
                      <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                        <span>5 min</span><span>120 min</span>
                      </div>
                    </div>
                  </div>
                  {form.extension_mode === "custom" && (
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5">Prompt Custom</label>
                      <textarea className="lv-input w-full h-28 resize-none text-sm" value={form.custom_mode_prompt} onChange={e => updateForm({ custom_mode_prompt: e.target.value })} placeholder="Instrução personalizada para a IA..." />
                    </div>
                  )}
                </div>

                {/* SEO */}
                <div className="lv-card space-y-4">
                  <SectionTitle icon={Globe} title="SEO & Meta" description="Título, descrição e termos de uso." />
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5">Meta Title</label>
                    <input className="lv-input w-full h-11 text-sm" value={form.meta_title} onChange={e => updateForm({ meta_title: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5">Meta Description</label>
                    <textarea className="lv-input w-full h-20 resize-none text-sm" value={form.meta_description} onChange={e => updateForm({ meta_description: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5">Termos de Uso</label>
                    <textarea className="lv-input w-full h-32 resize-none text-sm" value={form.terms_template} onChange={e => updateForm({ terms_template: e.target.value })} placeholder="Termos personalizados..." />
                  </div>
                </div>

                {/* Modules */}
                <div className="lv-card space-y-4">
                  <SectionTitle icon={Boxes} title="Módulos" description="Ative ou desative funcionalidades para os usuários." />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.entries(MODULE_LABELS).map(([key, label]) => (
                      <label key={key} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        form.modules[key]
                          ? "border-primary/30 bg-primary/5"
                          : "border-border/50 hover:border-border"
                      }`}>
                        <span className="text-xs font-medium">{label}</span>
                        <div className={`h-5 w-9 rounded-full relative transition-colors ${form.modules[key] ? "bg-primary" : "bg-muted"}`}
                          onClick={e => { e.preventDefault(); updateForm({ modules: { ...form.modules, [key]: !form.modules[key] } }); }}>
                          <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.modules[key] ? "translate-x-4" : "translate-x-0.5"}`} />
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Right: Live Preview ── */}
              <div className="space-y-3">
                <div className="sticky top-6">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Preview ao Vivo</p>
                    <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
                      <button onClick={() => setPreviewDevice("desktop")} className={`p-1.5 rounded-md transition-colors ${previewDevice === "desktop" ? "bg-background shadow-sm" : ""}`}>
                        <Monitor className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setPreviewDevice("mobile")} className={`p-1.5 rounded-md transition-colors ${previewDevice === "mobile" ? "bg-background shadow-sm" : ""}`}>
                        <Smartphone className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <LivePreview />
                </div>
              </div>
            </div>
          )}

          {/* ═══════ USERS TAB ═══════ */}
          {tab === "users" && (
            <div className="space-y-4 max-w-3xl">
              <p className="lv-body-strong">{members.length} membro(s)</p>

              {/* Inline add member */}
              <div className="lv-card p-3">
                <p className="text-[11px] font-semibold text-muted-foreground mb-2">Adicionar Membro</p>
                <div className="flex items-center gap-2">
                  <input className="lv-input flex-1 h-10 text-sm" placeholder="email@exemplo.com" value={addMemberEmail} onChange={e => setAddMemberEmail(e.target.value)} />
                  <select className="lv-input h-10 text-xs w-36" value={addMemberRole} onChange={e => setAddMemberRole(e.target.value)}>
                    <option value="tenant_member">Membro</option>
                    <option value="tenant_support">Suporte</option>
                    <option value="tenant_admin">Admin</option>
                    <option value="tenant_owner">Owner</option>
                  </select>
                  <button onClick={handleAddMember} disabled={addMemberLoading} className="lv-btn-primary h-10 px-4 text-xs flex items-center gap-2">
                    {addMemberLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Adicionar
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {members.map(m => (
                  <div key={m.id} className="lv-card flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-semibold">{m.profile?.name || "?"}</p>
                      <p className="text-xs text-muted-foreground">{m.profile?.email || m.user_id}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select className="lv-input h-8 text-xs" value={m.role} onChange={e => updateMemberRole(m.id, e.target.value)}>
                        <option value="tenant_member">Membro</option>
                        <option value="tenant_support">Suporte</option>
                        <option value="tenant_admin">Admin</option>
                        <option value="tenant_owner">Owner</option>
                      </select>
                      <button onClick={() => removeMember(m.id)} className="h-8 w-8 flex items-center justify-center rounded-lg text-destructive hover:bg-destructive/10 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {members.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">Nenhum membro encontrado.</p>}
              </div>
            </div>
          )}

          {/* ═══════ LICENSES TAB ═══════ */}
          {tab === "licenses" && (
            <div className="space-y-4 max-w-3xl">
              <p className="lv-body-strong">{licenses.length} licença(s)</p>

              {/* Inline gen token */}
              <div className="lv-card p-3">
                <p className="text-[11px] font-semibold text-muted-foreground mb-2">Gerar Nova Licença</p>
                <div className="flex items-center gap-2">
                  <input className="lv-input flex-1 h-10 text-sm" placeholder="email@exemplo.com" value={genTokenEmail} onChange={e => setGenTokenEmail(e.target.value)} />
                  <select className="lv-input h-10 text-xs w-40" value={genTokenPlan} onChange={e => setGenTokenPlan(e.target.value)}>
                    {dbPlans.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                    <option value="daily_token">Daily Token</option>
                  </select>
                  <button onClick={handleGenerateToken} disabled={genTokenLoading} className="lv-btn-primary h-10 px-4 text-xs flex items-center gap-2">
                    {genTokenLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Key className="h-3.5 w-3.5" />} Gerar
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {licenses.map(l => (
                  <div key={l.id} className="lv-card flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-semibold">{l.user_name}</p>
                      <p className="text-xs text-muted-foreground">{l.user_email} • {l.plan_type}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`lv-badge text-[10px] ${l.active ? "lv-badge-success" : "lv-badge-muted"}`}>
                        {l.active ? "Ativo" : "Inativo"}
                      </span>
                      <button onClick={() => copyLicenseKey(l.key)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
                        <Copy className="h-3 w-3" />
                      </button>
                      {l.active && (
                        <button onClick={() => revokeLicense(l.id)} className="h-8 px-3 text-[10px] rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                          Revogar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {licenses.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">Nenhuma licença encontrada.</p>}
              </div>
            </div>
          )}

          {/* ═══════ FINANCES TAB ═══════ */}
          {tab === "finances" && (
            <div className="space-y-4 max-w-3xl">
              {/* Wallet summary */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Saldo", value: `R$${(wallet?.balance ?? 0).toFixed(2)}`, color: "text-primary" },
                  { label: "Total Creditado", value: `R$${(wallet?.total_credited ?? 0).toFixed(2)}`, color: "text-green-600" },
                  { label: "Total Debitado", value: `R$${(wallet?.total_debited ?? 0).toFixed(2)}`, color: "text-destructive" },
                ].map(item => (
                  <div key={item.label} className="lv-card text-center py-4">
                    <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
                    <p className="text-[10px] text-muted-foreground">{item.label}</p>
                  </div>
                ))}
              </div>

              {/* Inline topup */}
              <div className="lv-card p-3">
                <p className="text-[11px] font-semibold text-muted-foreground mb-2">Recarregar via PIX</p>
                <div className="flex items-center gap-2">
                  <input type="number" className="lv-input flex-1 h-10 text-sm" placeholder="Valor em R$" value={topupAmount} onChange={e => setTopupAmount(e.target.value)} />
                  <button onClick={handleTopup} className="lv-btn-primary h-10 px-4 text-xs flex items-center gap-2">
                    <Wallet className="h-3.5 w-3.5" /> Gerar PIX
                  </button>
                </div>
                {topupPix && (
                  <div className="mt-3 p-3 bg-muted/50 rounded-xl">
                    <p className="text-xs font-semibold mb-1">Código PIX:</p>
                    <div className="flex items-center gap-2">
                      <code className="text-[10px] flex-1 break-all bg-background p-2 rounded">{topupPix.code}</code>
                      <button onClick={() => { navigator.clipboard.writeText(topupPix.code); toast.success("PIX copiado!"); }} className="lv-btn-secondary h-8 w-8 p-0 flex items-center justify-center">
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Transactions */}
              <div className="lv-card">
                <p className="text-[11px] font-semibold text-muted-foreground mb-3">Últimas Transações</p>
                <div className="space-y-1.5">
                  {transactions.slice(0, 20).map(tx => (
                    <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                      <div>
                        <p className="text-xs font-medium">{tx.description || tx.type}</p>
                        <p className="text-[10px] text-muted-foreground">{format(new Date(tx.created_at), "dd/MM/yyyy HH:mm")}</p>
                      </div>
                      <span className={`text-xs font-bold ${tx.amount > 0 ? "text-green-600" : "text-destructive"}`}>
                        {tx.amount > 0 ? "+" : ""}R${Math.abs(tx.amount).toFixed(2)}
                      </span>
                    </div>
                  ))}
                  {transactions.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhuma transação.</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
