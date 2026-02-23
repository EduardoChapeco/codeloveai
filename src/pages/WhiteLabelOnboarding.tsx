import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSEO } from "@/hooks/useSEO";
import { toast } from "sonner";
import { Building2, Palette, CreditCard, CheckCircle, ChevronLeft, ChevronRight, Upload, Eye, MessageSquare, Clock } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { Progress } from "@/components/ui/progress";

interface WLState {
  step: number;
  company: { name: string; cnpj: string; site: string; phone: string; segment: string };
  branding: { platformName: string; logoUrl: string; primaryColor: string; secondaryColor: string; subdomain: string };
  billing: { planType: string; mpAccessToken: string; plans: { name: string; limit: number; price: number }[] };
  tenantId: string | null;
  paymentId: string | null;
}

const defaultState: WLState = {
  step: 1,
  company: { name: "", cnpj: "", site: "", phone: "", segment: "" },
  branding: { platformName: "", logoUrl: "", primaryColor: "#6C3CE1", secondaryColor: "#5E5CE6", subdomain: "" },
  billing: { planType: "messages", mpAccessToken: "", plans: [{ name: "Básico", limit: 50, price: 29 }, { name: "Pro", limit: 0, price: 79 }] },
  tenantId: null,
  paymentId: null,
};

const segments = ["Agência", "Freelancer", "SaaS", "Educação", "Outro"];

export default function WhiteLabelOnboarding() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  useSEO({ title: "White Label — Onboarding" });

  const [state, setState] = useState<WLState>(() => {
    const saved = localStorage.getItem("wl_onboarding_state");
    return saved ? { ...defaultState, ...JSON.parse(saved) } : defaultState;
  });
  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null);
  const [checkingSubdomain, setCheckingSubdomain] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    localStorage.setItem("wl_onboarding_state", JSON.stringify(state));
  }, [state]);

  const update = <K extends keyof WLState>(key: K, val: WLState[K]) =>
    setState((s) => ({ ...s, [key]: val }));

  const updateCompany = (field: string, val: string) =>
    update("company", { ...state.company, [field]: val });

  const updateBranding = (field: string, val: string) =>
    update("branding", { ...state.branding, [field]: val });

  const checkSubdomain = async (slug: string) => {
    if (!slug || slug.length < 3) { setSubdomainAvailable(null); return; }
    setCheckingSubdomain(true);
    const { data } = await supabase.from("tenants").select("id").eq("slug", slug).maybeSingle();
    setSubdomainAvailable(!data);
    setCheckingSubdomain(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/logo.${ext}`;
    const { error } = await supabase.storage.from("tenant-assets").upload(path, file, { upsert: true });
    if (error) { toast.error("Erro ao enviar logo"); return; }
    const { data } = supabase.storage.from("tenant-assets").getPublicUrl(path);
    updateBranding("logoUrl", data.publicUrl);
    toast.success("Logo enviado!");
  };

  const goNext = () => update("step", Math.min(state.step + 1, 5) as any);
  const goBack = () => update("step", Math.max(state.step - 1, 1) as any);

  const createTenant = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { data: tenant, error } = await supabase.from("tenants").insert({
        name: state.company.name,
        slug: state.branding.subdomain,
        domain: state.branding.subdomain,
        logo_url: state.branding.logoUrl || null,
        primary_color: state.branding.primaryColor,
        secondary_color: state.branding.secondaryColor,
        plan_type: state.billing.planType,
        branding: {
          appName: state.branding.platformName,
          primaryColor: state.branding.primaryColor,
          secondaryColor: state.branding.secondaryColor,
          logoUrl: state.branding.logoUrl,
        },
        status: "pending",
        setup_paid: false,
      }).select("id").single();

      if (error) throw error;

      // Add user as tenant owner
      await supabase.from("tenant_users").insert({
        tenant_id: tenant.id,
        user_id: user.id,
        role: "tenant_owner",
        is_primary: false,
      });

      update("tenantId", tenant.id);
      goNext();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar White Label");
    }
    setSaving(false);
  };

  const processPayment = async () => {
    if (!state.tenantId) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-wl-setup", {
        body: {
          tenantId: state.tenantId,
          mpPaymentId: state.paymentId || "simulated",
          mpAccessToken: state.billing.mpAccessToken,
        },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success("White Label ativado!");
        goNext();
      } else {
        toast.error(data?.error || "Erro ao processar pagamento");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro");
    }
    setSaving(false);
  };

  if (authLoading) return <div className="min-h-screen bg-background" />;

  const stepLabels = ["Empresa", "Visual", "Cobrança", "Pagamento", "Pronto"];

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="lv-heading-lg mb-2">Criar White Label</h1>
        <p className="lv-body mb-8">Configure sua plataforma personalizada em 5 passos.</p>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {stepLabels.map((label, i) => (
              <span key={label} className={`text-[10px] font-bold uppercase tracking-wider ${state.step > i ? "text-primary" : state.step === i + 1 ? "text-foreground" : "text-muted-foreground"}`}>
                {label}
              </span>
            ))}
          </div>
          <Progress value={(state.step / 5) * 100} className="h-1.5" />
        </div>

        {/* Step 1 - Company */}
        {state.step === 1 && (
          <div className="lv-card p-6 space-y-4">
            <h2 className="lv-heading-md">Dados da Empresa</h2>
            <div>
              <label className="lv-caption mb-1.5 block">Nome da empresa *</label>
              <input className="lv-input" value={state.company.name} onChange={(e) => updateCompany("name", e.target.value)} placeholder="Minha Agência" required />
            </div>
            <div>
              <label className="lv-caption mb-1.5 block">CNPJ</label>
              <input className="lv-input" value={state.company.cnpj} onChange={(e) => updateCompany("cnpj", e.target.value)} placeholder="00.000.000/0000-00" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="lv-caption mb-1.5 block">Site</label>
                <input className="lv-input" value={state.company.site} onChange={(e) => updateCompany("site", e.target.value)} placeholder="https://..." />
              </div>
              <div>
                <label className="lv-caption mb-1.5 block">Telefone</label>
                <input className="lv-input" value={state.company.phone} onChange={(e) => updateCompany("phone", e.target.value)} placeholder="(11) 99999-9999" />
              </div>
            </div>
            <div>
              <label className="lv-caption mb-1.5 block">Segmento</label>
              <select className="lv-input" value={state.company.segment} onChange={(e) => updateCompany("segment", e.target.value)}>
                <option value="">Selecione</option>
                {segments.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex justify-end">
              <button onClick={goNext} disabled={!state.company.name} className="lv-btn-primary h-10 px-6">Próximo <ChevronRight className="h-4 w-4 ml-1" /></button>
            </div>
          </div>
        )}

        {/* Step 2 - Branding */}
        {state.step === 2 && (
          <div className="lv-card p-6 space-y-4">
            <h2 className="lv-heading-md">Personalização Visual</h2>
            <div>
              <label className="lv-caption mb-1.5 block">Nome da plataforma *</label>
              <input className="lv-input" value={state.branding.platformName} onChange={(e) => updateBranding("platformName", e.target.value)} placeholder="DevTool Pro" />
            </div>
            <div>
              <label className="lv-caption mb-1.5 block">Logo</label>
              <label className="lv-btn-secondary h-10 px-4 inline-flex items-center gap-2 cursor-pointer">
                <Upload className="h-4 w-4" /> Enviar logo
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </label>
              {state.branding.logoUrl && <img src={state.branding.logoUrl} alt="Logo" className="h-10 mt-2 rounded" />}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="lv-caption mb-1.5 block">Cor primária</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={state.branding.primaryColor} onChange={(e) => updateBranding("primaryColor", e.target.value)} className="h-10 w-10 rounded cursor-pointer border-0" />
                  <input className="lv-input flex-1" value={state.branding.primaryColor} onChange={(e) => updateBranding("primaryColor", e.target.value)} />
                </div>
              </div>
              <div>
                <label className="lv-caption mb-1.5 block">Cor secundária</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={state.branding.secondaryColor} onChange={(e) => updateBranding("secondaryColor", e.target.value)} className="h-10 w-10 rounded cursor-pointer border-0" />
                  <input className="lv-input flex-1" value={state.branding.secondaryColor} onChange={(e) => updateBranding("secondaryColor", e.target.value)} />
                </div>
              </div>
            </div>
            <div>
              <label className="lv-caption mb-1.5 block">Subdomínio</label>
              <div className="flex items-center gap-2">
                <input className="lv-input flex-1" value={state.branding.subdomain} onChange={(e) => { updateBranding("subdomain", e.target.value); checkSubdomain(e.target.value); }} placeholder="minha-marca" />
                <span className="lv-caption">.codelove.app</span>
              </div>
              {checkingSubdomain && <p className="lv-caption mt-1">Verificando...</p>}
              {subdomainAvailable === true && <p className="lv-caption mt-1 text-green-600">✓ Disponível</p>}
              {subdomainAvailable === false && <p className="lv-caption mt-1 text-red-500">✗ Já está em uso</p>}
            </div>

            {/* Preview */}
            <div className="rounded-xl p-4" style={{ background: state.branding.primaryColor }}>
              <div className="flex items-center gap-3">
                {state.branding.logoUrl ? <img src={state.branding.logoUrl} alt="" className="h-6 rounded" /> : null}
                <span className="text-white font-semibold text-sm">{state.branding.platformName || "Sua Plataforma"}</span>
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={goBack} className="lv-btn-secondary h-10 px-6"><ChevronLeft className="h-4 w-4 mr-1" /> Voltar</button>
              <button onClick={goNext} disabled={!state.branding.platformName || !state.branding.subdomain} className="lv-btn-primary h-10 px-6">Próximo <ChevronRight className="h-4 w-4 ml-1" /></button>
            </div>
          </div>
        )}

        {/* Step 3 - Billing */}
        {state.step === 3 && (
          <div className="lv-card p-6 space-y-4">
            <h2 className="lv-heading-md">Modelo de Cobrança</h2>
            <div>
              <label className="lv-caption mb-1.5 block">Como você quer cobrar seus usuários?</label>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => update("billing", { ...state.billing, planType: "messages" })} className={`lv-card-sm text-center ${state.billing.planType === "messages" ? "ring-2 ring-primary" : ""}`}>
                  <MessageSquare className="h-5 w-5 mx-auto mb-2 text-primary" />
                  <p className="lv-body-strong text-xs">Por mensagens/dia</p>
                </button>
                <button onClick={() => update("billing", { ...state.billing, planType: "hourly" })} className={`lv-card-sm text-center ${state.billing.planType === "hourly" ? "ring-2 ring-primary" : ""}`}>
                  <Clock className="h-5 w-5 mx-auto mb-2 text-primary" />
                  <p className="lv-body-strong text-xs">Por horas/mês</p>
                </button>
              </div>
            </div>
            <div>
              <label className="lv-caption mb-1.5 block">Mercado Pago Access Token</label>
              <input className="lv-input" type="password" value={state.billing.mpAccessToken} onChange={(e) => update("billing", { ...state.billing, mpAccessToken: e.target.value })} placeholder="APP_USR-..." />
              <p className="lv-caption mt-1">Para receber pagamentos dos seus usuários</p>
            </div>
            <div className="lv-card-sm bg-accent/50">
              <p className="lv-caption"><strong className="text-foreground">Nota:</strong> CodeLove retém 20% de comissão sobre cada cobrança.</p>
            </div>
            <div className="flex justify-between">
              <button onClick={goBack} className="lv-btn-secondary h-10 px-6"><ChevronLeft className="h-4 w-4 mr-1" /> Voltar</button>
              <button onClick={createTenant} disabled={saving} className="lv-btn-primary h-10 px-6">{saving ? "Criando..." : "Próximo"} <ChevronRight className="h-4 w-4 ml-1" /></button>
            </div>
          </div>
        )}

        {/* Step 4 - Payment */}
        {state.step === 4 && (
          <div className="lv-card p-6 space-y-4 text-center">
            <CreditCard className="h-12 w-12 text-primary mx-auto" />
            <h2 className="lv-heading-md">Pagamento do Setup</h2>
            <div className="lv-card-sm bg-accent/50 inline-block">
              <p className="lv-stat text-2xl">R$ 299,00</p>
              <p className="lv-caption">Pagamento único</p>
            </div>
            <p className="lv-body max-w-sm mx-auto">Após a confirmação, sua plataforma será ativada automaticamente.</p>
            <button onClick={processPayment} disabled={saving} className="lv-btn-primary lv-btn-lg">
              {saving ? "Processando..." : "Confirmar pagamento"}
            </button>
            <button onClick={goBack} className="lv-btn-ghost text-xs block mx-auto mt-2">Voltar</button>
          </div>
        )}

        {/* Step 5 - Confirmation */}
        {state.step === 5 && (
          <div className="lv-card p-6 space-y-4 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="lv-heading-md">Seu White Label está pronto! 🎉</h2>
            <div className="lv-card-sm bg-accent/50">
              <p className="lv-body-strong">URL da sua plataforma:</p>
              <p className="lv-mono text-primary">{state.branding.subdomain}.codelove.app</p>
            </div>
            <button onClick={() => { localStorage.removeItem("wl_onboarding_state"); navigate("/tenant/dashboard"); }} className="lv-btn-primary lv-btn-lg">
              Acessar meu painel
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
