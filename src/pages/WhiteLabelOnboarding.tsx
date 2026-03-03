import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSEO } from "@/hooks/useSEO";
import { toast } from "sonner";
import { Building2, Palette, CreditCard, CheckCircle, ChevronLeft, ChevronRight, Upload, MessageSquare, Clock } from "lucide-react";
import AppLayout from "@/components/AppLayout";

// WLState interface and defaultState
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
  tenantId: null, paymentId: null,
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
  const previewRef = useRef<HTMLIFrameElement>(null);

  const updatePreviewIframe = useCallback(() => {
    const iframe = previewRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage({ type: "updatePreview", config: { appName: state.branding.platformName || "Meu Booster", logoUrl: state.branding.logoUrl || null, primaryColor: state.branding.primaryColor, secondaryColor: state.branding.secondaryColor, planType: state.billing.planType } }, "*");
  }, [state.branding, state.billing.planType]);

  useEffect(() => { if (state.step === 2) updatePreviewIframe(); }, [state.branding, state.billing.planType, state.step, updatePreviewIframe]);
  useEffect(() => { if (!authLoading && !user) navigate("/login"); }, [user, authLoading, navigate]);
  useEffect(() => { localStorage.setItem("wl_onboarding_state", JSON.stringify(state)); }, [state]);

  const update = <K extends keyof WLState>(key: K, val: WLState[K]) => setState((s) => ({ ...s, [key]: val }));
  const updateCompany = (field: string, val: string) => update("company", { ...state.company, [field]: val });
  const updateBranding = (field: string, val: string) => update("branding", { ...state.branding, [field]: val });
  const goNext = () => update("step", Math.min(state.step + 1, 5) as any);
  const goBack = () => update("step", Math.max(state.step - 1, 1) as any);

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

  const createTenant = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { data: tenant, error } = await supabase.from("tenants").insert({
        name: state.company.name, slug: state.branding.subdomain, domain: state.branding.subdomain,
        logo_url: state.branding.logoUrl || null, primary_color: state.branding.primaryColor, secondary_color: state.branding.secondaryColor,
        plan_type: state.billing.planType, branding: { appName: state.branding.platformName, primaryColor: state.branding.primaryColor, secondaryColor: state.branding.secondaryColor, logoUrl: state.branding.logoUrl },
        status: "pending", setup_paid: false,
      }).select("id").single();
      if (error) throw error;
      await supabase.from("tenant_users").insert({ tenant_id: tenant.id, user_id: user.id, role: "tenant_owner", is_primary: false });
      update("tenantId", tenant.id);
      goNext();
    } catch (err: any) { toast.error(err.message || "Erro ao criar White Label"); }
    setSaving(false);
  };

  const processPayment = async () => {
    if (!state.tenantId) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-wl-setup", { body: { tenantId: state.tenantId, mpPaymentId: state.paymentId || "simulated", mpAccessToken: state.billing.mpAccessToken } });
      if (error) throw error;
      if (data?.success) { toast.success("White Label ativado!"); goNext(); }
      else { toast.error(data?.error || "Erro ao processar pagamento"); }
    } catch (err: any) { toast.error(err.message || "Erro"); }
    setSaving(false);
  };

  if (authLoading) return <div className="min-h-screen" style={{ background: 'var(--bg-0)' }} />;

  const stepLabels = ["Empresa", "Visual", "Cobrança", "Pagamento", "Pronto"];
  const progressPct = (state.step / 5) * 100;

  return (
    <AppLayout>
      <div className="rd-page-content" style={{ maxWidth: 640 }}>
        <div className="rd-page-head">
          <h1>Criar White Label</h1>
          <p>Configure sua plataforma personalizada em 5 passos.</p>
        </div>

        {/* Progress */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            {stepLabels.map((label, i) => (
              <span key={label} className="caption-sm" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: state.step > i ? 'var(--blue-l)' : state.step === i + 1 ? 'var(--text-primary)' : 'var(--text-quaternary)' }}>{label}</span>
            ))}
          </div>
          <div className="rd-progress"><div className="rd-progress-bar blue" style={{ width: `${progressPct}%` }} /></div>
        </div>

        {/* Step 1 */}
        {state.step === 1 && (
          <div className="rd-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="label-lg">Dados da Empresa</div>
            <div><div className="caption-sm" style={{ marginBottom: 6 }}>Nome da empresa *</div><input className="rd-input" value={state.company.name} onChange={e => updateCompany("name", e.target.value)} placeholder="Minha Agência" /></div>
            <div><div className="caption-sm" style={{ marginBottom: 6 }}>CNPJ</div><input className="rd-input" value={state.company.cnpj} onChange={e => updateCompany("cnpj", e.target.value)} placeholder="00.000.000/0000-00" /></div>
            <div className="rd-grid-2">
              <div><div className="caption-sm" style={{ marginBottom: 6 }}>Site</div><input className="rd-input" value={state.company.site} onChange={e => updateCompany("site", e.target.value)} placeholder="https://..." /></div>
              <div><div className="caption-sm" style={{ marginBottom: 6 }}>Telefone</div><input className="rd-input" value={state.company.phone} onChange={e => updateCompany("phone", e.target.value)} placeholder="(11) 99999-9999" /></div>
            </div>
            <div><div className="caption-sm" style={{ marginBottom: 6 }}>Segmento</div><select className="rd-input" value={state.company.segment} onChange={e => updateCompany("segment", e.target.value)}><option value="">Selecione</option>{segments.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button onClick={goNext} disabled={!state.company.name} className="gl primary">Próximo <ChevronRight size={14} /></button></div>
          </div>
        )}

        {/* Step 2 */}
        {state.step === 2 && (
          <div className="rd-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="label-lg">Personalização Visual</div>
            <div><div className="caption-sm" style={{ marginBottom: 6 }}>Nome da plataforma *</div><input className="rd-input" value={state.branding.platformName} onChange={e => updateBranding("platformName", e.target.value)} placeholder="DevTool Pro" /></div>
            <div>
              <div className="caption-sm" style={{ marginBottom: 6 }}>Logo</div>
              <label className="gl sm" style={{ cursor: 'pointer' }}><Upload size={14} /> Enviar logo<input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} style={{ display: 'none' }} /></label>
              {state.branding.logoUrl && <img src={state.branding.logoUrl} alt="Logo" style={{ height: 40, marginTop: 8, borderRadius: 'var(--r2)' }} />}
            </div>
            <div className="rd-grid-2">
              <div><div className="caption-sm" style={{ marginBottom: 6 }}>Cor primária</div><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="color" value={state.branding.primaryColor} onChange={e => updateBranding("primaryColor", e.target.value)} style={{ width: 40, height: 40, borderRadius: 'var(--r2)', cursor: 'pointer', border: 'none' }} /><input className="rd-input" value={state.branding.primaryColor} onChange={e => updateBranding("primaryColor", e.target.value)} style={{ flex: 1 }} /></div></div>
              <div><div className="caption-sm" style={{ marginBottom: 6 }}>Cor secundária</div><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="color" value={state.branding.secondaryColor} onChange={e => updateBranding("secondaryColor", e.target.value)} style={{ width: 40, height: 40, borderRadius: 'var(--r2)', cursor: 'pointer', border: 'none' }} /><input className="rd-input" value={state.branding.secondaryColor} onChange={e => updateBranding("secondaryColor", e.target.value)} style={{ flex: 1 }} /></div></div>
            </div>
            <div>
              <div className="caption-sm" style={{ marginBottom: 6 }}>Subdomínio</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input className="rd-input" style={{ flex: 1 }} value={state.branding.subdomain} onChange={e => { updateBranding("subdomain", e.target.value); checkSubdomain(e.target.value); }} placeholder="minha-marca" /><span className="caption-sm">.Starble.app</span></div>
              {checkingSubdomain && <div className="caption-sm" style={{ marginTop: 4 }}>Verificando...</div>}
              {subdomainAvailable === true && <div className="caption-sm" style={{ marginTop: 4, color: 'var(--green-l)' }}>Disponível</div>}
              {subdomainAvailable === false && <div className="caption-sm" style={{ marginTop: 4, color: 'var(--red-l)' }}>Já está em uso</div>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div className="caption-sm" style={{ marginBottom: 8, textAlign: 'center' }}>Preview da extensão</div>
              <div style={{ borderRadius: 'var(--r4)', overflow: 'hidden', border: '1px solid var(--b1)', width: '100%', maxWidth: 400 }}>
                <iframe ref={previewRef} src="/wl-preview.html" title="Preview" style={{ width: '100%', height: 500, border: 'none' }} onLoad={updatePreviewIframe} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={goBack} className="gl"><ChevronLeft size={14} /> Voltar</button>
              <button onClick={goNext} disabled={!state.branding.platformName || !state.branding.subdomain} className="gl primary">Próximo <ChevronRight size={14} /></button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {state.step === 3 && (
          <div className="rd-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="label-lg">Modelo de Cobrança</div>
            <div className="rd-grid-2">
              <button onClick={() => update("billing", { ...state.billing, planType: "messages" })} className="rd-card" style={{ textAlign: 'center', cursor: 'pointer', borderColor: state.billing.planType === "messages" ? 'rgba(59,130,246,0.4)' : undefined, background: state.billing.planType === "messages" ? 'rgba(59,130,246,0.05)' : undefined }}>
                <MessageSquare size={20} style={{ color: 'var(--blue)', margin: '0 auto 8px' }} /><div className="label-lg" style={{ fontSize: 12 }}>Por mensagens/dia</div>
              </button>
              <button onClick={() => update("billing", { ...state.billing, planType: "hourly" })} className="rd-card" style={{ textAlign: 'center', cursor: 'pointer', borderColor: state.billing.planType === "hourly" ? 'rgba(59,130,246,0.4)' : undefined, background: state.billing.planType === "hourly" ? 'rgba(59,130,246,0.05)' : undefined }}>
                <Clock size={20} style={{ color: 'var(--blue)', margin: '0 auto 8px' }} /><div className="label-lg" style={{ fontSize: 12 }}>Por horas/mês</div>
              </button>
            </div>
            <div><div className="caption-sm" style={{ marginBottom: 6 }}>Mercado Pago Access Token</div><input className="rd-input" type="password" value={state.billing.mpAccessToken} onChange={e => update("billing", { ...state.billing, mpAccessToken: e.target.value })} placeholder="APP_USR-..." /><div className="caption-sm" style={{ marginTop: 4 }}>Para receber pagamentos dos seus usuários</div></div>
            <div className="rd-alert info">Starble cobra 40% do preço do plano por usuário ativo (R$7,96/dia ou R$59,96/mês).</div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={goBack} className="gl"><ChevronLeft size={14} /> Voltar</button>
              <button onClick={createTenant} disabled={saving} className="gl primary">{saving ? "Criando..." : "Próximo"} <ChevronRight size={14} /></button>
            </div>
          </div>
        )}

        {/* Step 4 */}
        {state.step === 4 && (
          <div className="rd-card" style={{ textAlign: 'center', padding: 40 }}>
            <div className="rd-ico-box ib-blue" style={{ width: 56, height: 56, margin: '0 auto 16px', borderRadius: 'var(--r4)' }}><CreditCard size={24} /></div>
            <div className="title-lg" style={{ marginBottom: 8 }}>Pagamento do Setup</div>
            <div className="rd-stat-value" style={{ marginBottom: 4 }}>R$ 299,00</div>
            <div className="caption-sm" style={{ marginBottom: 24 }}>Pagamento único</div>
            <p className="body-text" style={{ marginBottom: 24, maxWidth: 360, margin: '0 auto 24px' }}>Após a confirmação, sua plataforma será ativada automaticamente.</p>
            <button onClick={processPayment} disabled={saving} className="gl primary lg" style={{ marginBottom: 8 }}>{saving ? "Processando..." : "Confirmar pagamento"}</button>
            <div><button onClick={goBack} className="gl ghost sm">Voltar</button></div>
          </div>
        )}

        {/* Step 5 */}
        {state.step === 5 && (
          <div className="rd-card" style={{ textAlign: 'center', padding: 40 }}>
            <div className="rd-ico-box ib-green" style={{ width: 64, height: 64, margin: '0 auto 16px', borderRadius: 'var(--r4)' }}><CheckCircle size={28} /></div>
            <div className="title-lg" style={{ marginBottom: 12 }}>Seu White Label está pronto!</div>
            <div className="rd-alert info" style={{ marginBottom: 24, justifyContent: 'center' }}>
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--blue-l)' }}>{state.branding.subdomain}.Starble.app</span>
            </div>
            <button onClick={() => { localStorage.removeItem("wl_onboarding_state"); navigate("/tenant/dashboard"); }} className="gl primary lg">Acessar meu painel</button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
