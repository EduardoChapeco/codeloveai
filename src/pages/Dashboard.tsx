import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { useSEO } from "@/hooks/useSEO";
import { useTenant } from "@/contexts/TenantContext";
import {
  Copy, Download, Shield, CheckCircle, Clock,
  ChevronRight, Zap, Monitor, Key, Building2, Puzzle, StickyNote, Link2, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import AppLayout from "@/components/AppLayout";

interface MemberLicense {
  id: string; key: string; active: boolean; plan: string; plan_type: string;
  status: string; expires_at: string | null; daily_messages: number | null; messages_used_today: number;
}
interface Token { id: string; token: string; is_active: boolean; }

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { tenant, isTenantAdmin } = useTenant();
  const brandName = tenant?.name || "Starble";
  useSEO({ title: "Dashboard" });
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [tokensLoaded, setTokensLoaded] = useState(false);
  const [extensionDetected, setExtensionDetected] = useState(false);
  const [notesCount, setNotesCount] = useState(0);
  const [lovableStatus, setLovableStatus] = useState<"active" | "expired" | "none">("none");
  const [tokenGenerating, setTokenGenerating] = useState(false);
  const navigate = useNavigate();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [license, setLicense] = useState<MemberLicense | null>(null);
  const [profile, setProfile] = useState<{ name: string; email: string } | null>(null);
  const [latestExt, setLatestExt] = useState<{ file_url: string; version: string; instructions: string; ext_name?: string } | null>(null);

  useEffect(() => { if (!authLoading && !user) navigate("/login"); }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    const loadAll = async () => {
      const [profileRes, licenseRes, tokensRes, extRes, lovableRes] = await Promise.all([
        supabase.from("profiles").select("name, email").eq("user_id", user.id).single(),
        supabase.from("licenses")
          .select("id, key, active, plan, plan_type, status, expires_at, daily_messages, messages_used_today")
          .eq("user_id", user.id).eq("active", true)
          .order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("tokens").select("*").eq("user_id", user.id),
        (async () => {
          const { data: lic } = await supabase.from("licenses").select("plan_id, plan").eq("user_id", user.id).eq("active", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
          let targetExtId: string | null = null; let extName = "";
          if (lic?.plan_id) {
            const { data: pe } = await supabase.from("plan_extensions").select("extension_id, extension_catalog(id, name, display_order)").eq("plan_id", lic.plan_id);
            if (pe && pe.length > 0) {
              const sorted = pe.sort((a: any, b: any) => (b.extension_catalog?.display_order || 0) - (a.extension_catalog?.display_order || 0));
              targetExtId = sorted[0].extension_id; extName = (sorted[0] as any).extension_catalog?.name || "";
            }
          }
          if (targetExtId) {
            const { data: ef } = await supabase.from("extension_files").select("file_url, version, instructions").eq("extension_id", targetExtId).eq("is_latest", true).maybeSingle();
            return ef ? { ...ef, ext_name: extName } : null;
          }
          const { data: ef } = await supabase.from("extension_files").select("file_url, version, instructions").eq("is_latest", true).limit(1).maybeSingle();
          return ef;
        })(),
        supabase.from("lovable_accounts").select("status").eq("user_id", user.id).maybeSingle(),
      ]);
      setProfile(profileRes.data);
      if (licenseRes.data) setLicense(licenseRes.data as unknown as MemberLicense);
      const tokenList = tokensRes.data || [];
      setTokens(tokenList); setTokensLoaded(true);
      const activeToken = tokenList.find((t: Token) => t.is_active);
      if (activeToken) {
        const email = user.email || "";
        const name = user.user_metadata?.name || email.split("@")[0] || "";
        supabase.auth.getSession().then(({ data: sessionData }) => {
          const jwt = sessionData?.session?.access_token;
          if (jwt) {
            localStorage.setItem('clf_token', jwt); localStorage.setItem('clf_email', email); localStorage.setItem('clf_name', name);
            window.postMessage({ type: 'clf_sso_token', token: jwt, email, name }, window.location.origin);
          }
        });
      }
      setLatestExt(extRes as any);
      if (lovableRes.data?.status === "active") setLovableStatus("active");
      else if (lovableRes.data?.status === "expired" || lovableRes.data?.status === "error") setLovableStatus("expired");
      else setLovableStatus("none");
    };
    loadAll();
  }, [user]);

  useEffect(() => {
    if (!user || !tokensLoaded || tokenGenerating || adminLoading) return;
    const hasActiveToken = tokens.some((t) => t.is_active);
    const hasActiveLicense = license?.active;
    if (hasActiveToken || hasActiveLicense) return;
    const tokenKey = `clf_auto_license_v4_${user.id}`;
    if (localStorage.getItem(tokenKey) === "true") return;
    setTokenGenerating(true);
    const provision = async () => {
      try {
        if (isAdmin) {
          const { data, error } = await supabase.functions.invoke("admin-token-actions", { body: { action: "generate", email: user.email, name: user.user_metadata?.name || user.email?.split("@")[0] || "Usuário", plan: "lifetime", user_id: user.id } });
          if (!error && data?.token) { setTokens([{ id: "auto", token: data.token, is_active: true }]); toast.success("Acesso Master Vitalício ativado!"); }
        } else {
          const { data, error } = await supabase.functions.invoke("auto-onboard", { body: {} });
          if (!error && data?.license_id) {
            const { data: newLic } = await supabase.from("licenses").select("id, key, active, plan, plan_type, status, expires_at, daily_messages, messages_used_today").eq("id", data.license_id).maybeSingle();
            if (newLic) setLicense(newLic as unknown as MemberLicense);
            toast.success("Free Master ativado — 30 dias grátis, tudo liberado!");
          }
        }
        localStorage.setItem(tokenKey, "true");
      } catch { /* retry next time */ }
      setTokenGenerating(false);
    };
    provision();
  }, [user, tokensLoaded, tokens, tokenGenerating, license, isAdmin, adminLoading]);

  useEffect(() => {
    const detect = () => {
      if ((window as unknown as Record<string, unknown>).__StarbleAI) { setExtensionDetected(true); return; }
      const handler = () => setExtensionDetected(true);
      window.addEventListener("clf_extension_present", handler);
      window.postMessage({ type: "clf_ping" }, window.location.origin);
      setTimeout(() => window.removeEventListener("clf_extension_present", handler), 2000);
    };
    setTimeout(detect, 500);
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from("notes").select("id", { count: "exact", head: true }).eq("user_id", user.id).then(({ count }) => setNotesCount(count || 0));
  }, [user]);

  const activeTokens = tokens.filter(t => t.is_active);
  const copyToken = (token: string) => { navigator.clipboard.writeText(token); toast.success("Token copiado!"); };

  const getStatusDisplay = () => {
    if (license) {
      const expiryDate = license.expires_at ? new Date(license.expires_at) : null;
      const isExpired = expiryDate && expiryDate < new Date();
      return {
        title: license.plan || "Plano Ativo",
        desc: isExpired ? `Expirado em ${format(expiryDate!, "dd/MM/yyyy")}` : expiryDate ? `Ativo até ${format(expiryDate, "dd/MM/yyyy")}` : "Ilimitado",
        badge: isExpired ? "Expirado" : "Ativo", variant: isExpired ? "destructive" : "success",
        usage: license.daily_messages ? `${license.messages_used_today || 0} / ${license.daily_messages} msgs/dia` : null,
      };
    }
    if (activeTokens.length > 0) return { title: "Token Ativo", desc: "Seu token de acesso está ativo", badge: "Ativo", variant: "success", usage: null };
    if (tokenGenerating) return { title: "Processando...", desc: "Gerando seu acesso", badge: "...", variant: "primary", usage: null };
    return { title: "Sem Acesso", desc: "Você ainda não possui um plano ativo", badge: "Inativo", variant: "secondary", usage: null };
  };

  const status = getStatusDisplay();

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-0)' }}>
      <p className="sec-label">Carregando...</p>
    </div>;
  }

  return (
    <AppLayout>
      <div style={{ background: 'var(--bg-0)', minHeight: '100%' }}>
        <div className="rd-page-content" style={{ maxWidth: 960 }}>
          {/* Header */}
          <div className="rd-page-head">
            <div className="sec-label">Área do membro</div>
            <h1>Dashboard</h1>
            <p>{license?.plan_type === 'custom' ? "Plano Profissional Ativo" : "Plataforma — Ferramentas de IA"}</p>
          </div>

          {/* Warning */}
          <div className="rd-alert warning" style={{ marginBottom: 20 }}>
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 12 }}>Aviso sobre créditos</div>
              <div style={{ fontSize: 11, opacity: .7, marginTop: 2 }}>
                O Lovable pode cobrar créditos em alguns casos durante o uso da extensão. Recomendamos monitorar seu saldo.
              </div>
            </div>
          </div>

          {/* Status card — full width */}
          <div className="rd-stat-card" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="rd-stat-label">Status do acesso</div>
              <div className="rd-stat-value">{status.title}</div>
              <div className="body-text" style={{ marginTop: 4 }}>{status.desc}</div>
              {status.usage && (
                <div style={{ marginTop: 12 }}>
                  <div className="sec-label" style={{ marginBottom: 8 }}>Uso Diário</div>
                  <div className="rd-progress" style={{ maxWidth: 320 }}>
                    <div className="rd-progress-bar blue" style={{ width: `${Math.min(100, ((license?.messages_used_today || 0) / (license?.daily_messages || 1)) * 100)}%` }} />
                  </div>
                  <div className="caption-sm" style={{ marginTop: 6, fontWeight: 600 }}>{status.usage}</div>
                </div>
              )}
            </div>
            <div style={{ position: 'absolute', top: 20, right: 20 }}>
              <span className={`chip sm ${status.variant === 'success' ? 'ch-green' : status.variant === 'destructive' ? 'ch-red' : 'ch-blue'}`}>
                {status.badge}
              </span>
              {(license?.status === 'suspended' || (license?.expires_at && new Date(license.expires_at) < new Date())) && (
                <Link to="/plans" className="gl sm orange" style={{ marginTop: 8, display: 'inline-flex' }}>Renovar</Link>
              )}
            </div>
          </div>

          {/* Bento grid */}
          <div className="rd-grid-2" style={{ marginBottom: 14 }}>
            {/* Extension */}
            <div className="rd-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div className={`rd-ico-box ${extensionDetected ? 'ib-green' : 'ib-blue'}`}>
                  <Puzzle size={18} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="label-lg">{latestExt?.ext_name || "Extensão"}{latestExt ? ` v${latestExt.version}` : ""}</div>
                  <div className="caption-sm">{extensionDetected ? 'Conectada e ativa' : 'Não detectada'}</div>
                </div>
                {extensionDetected && <span className="chip ch-green sm"><CheckCircle size={10} /></span>}
              </div>
              {extensionDetected ? (
                <div className="rd-alert success" style={{ justifyContent: 'center' }}>
                  <CheckCircle size={12} /> Extensão detectada no navegador.
                </div>
              ) : (
                <button className="gl orange" style={{ width: '100%' }}
                  disabled={!latestExt}
                  onClick={async () => {
                    if (!latestExt) return;
                    const { data } = await supabase.storage.from("extensions").createSignedUrl(latestExt.file_url, 300);
                    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                  }}>
                  <Download size={13} /> Baixar Extensão
                </button>
              )}
            </div>

            {/* Notes */}
            <div className="rd-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div className="rd-ico-box ib-indigo"><StickyNote size={18} /></div>
                <div>
                  <div className="label-lg">Notas</div>
                  <div className="caption-sm">{notesCount === 0 ? 'Nenhuma nota' : `${notesCount} nota${notesCount > 1 ? 's' : ''}`}</div>
                </div>
              </div>
              <Link to="/notes" className="gl" style={{ width: '100%', justifyContent: 'center' }}>
                <StickyNote size={13} /> {notesCount > 0 ? 'Ver notas' : 'Criar nota'}
              </Link>
            </div>

            {/* Lovable Connection */}
            <div className="rd-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div className={`rd-ico-box ${lovableStatus === 'active' ? 'ib-green' : lovableStatus === 'expired' ? 'ib-red' : 'ib-blue'}`}>
                  <Link2 size={18} />
                </div>
                <div>
                  <div className="label-lg">Lovable</div>
                  <div className="caption-sm">
                    {lovableStatus === "active" && "Token ativo"}
                    {lovableStatus === "expired" && "Token expirado"}
                    {lovableStatus === "none" && "Não conectado"}
                  </div>
                </div>
              </div>
              {lovableStatus === "active" ? (
                <div className="rd-alert success" style={{ justifyContent: 'center' }}>
                  <CheckCircle size={12} /> Conectado
                </div>
              ) : (
                <Link to="/lovable/connect" className="gl blue" style={{ width: '100%', justifyContent: 'center' }}>
                  <Link2 size={13} /> {lovableStatus === "expired" ? "Reconectar" : "Conectar"}
                </Link>
              )}
            </div>
          </div>

          {/* Admin shortcuts */}
          {(isTenantAdmin || isAdmin) && (
            <div className="rd-grid-2" style={{ marginBottom: 14 }}>
              <Link to="/admin/tenant" className="rd-link-card">
                <div className="rd-ico-box ib-orange"><Building2 size={18} /></div>
                <div style={{ flex: 1 }}>
                  <div className="label-lg">Administrar Tenant</div>
                  <div className="caption-sm">Personalização, membros e licenças</div>
                </div>
                <ChevronRight size={14} className="rd-lc-arrow" />
              </Link>
              <Link to="/admin/tenant?tab=crm" className="rd-link-card">
                <div className="rd-ico-box ib-green"><Zap size={18} /></div>
                <div style={{ flex: 1 }}>
                  <div className="label-lg">CRM & WhatsApp</div>
                  <div className="caption-sm">Contatos, campanhas e disparo automático</div>
                </div>
                <ChevronRight size={14} className="rd-lc-arrow" />
              </Link>
            </div>
          )}

          {/* White Label promo */}
          {!isTenantAdmin && !isAdmin && (
            <Link to="/whitelabel" className="rd-link-card" style={{ marginBottom: 14 }}>
              <div className="rd-ico-box ib-purple"><Building2 size={18} /></div>
              <div style={{ flex: 1 }}>
                <div className="label-lg">Crie seu White Label</div>
                <div className="caption-sm">Lance sua plataforma de IA com sua marca.</div>
              </div>
              <ChevronRight size={14} className="rd-lc-arrow" />
            </Link>
          )}

          {/* SSO Status */}
          {activeTokens.length > 0 && (
            <div className="rd-alert info" style={{ marginBottom: 14 }}>
              <Zap size={13} />
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>Login automático ativo</strong> — Seu token foi sincronizado com a extensão.
              </div>
              <span className="chip ch-blue sm" style={{ marginLeft: 'auto' }}>Sync</span>
            </div>
          )}

          {/* How to use */}
          <div className="rd-card-full">
            <div className="sec-label" style={{ marginBottom: 16 }}>Como começar</div>
            <div className="rd-grid-4">
              {[
                { step: "01", title: "Baixar", desc: "Faça download da extensão oficial", icon: Download, color: "ib-blue" },
                { step: "02", title: "Instalar", desc: "Ative o Modo do Desenvolvedor no Chrome", icon: Monitor, color: "ib-purple" },
                { step: "03", title: "Conectar", desc: "Vincule sua conta Lovable com segurança", icon: Key, color: "ib-green" },
                { step: "04", title: "Pronto", desc: "Inicie o lovable.dev e deixe a mágica acontecer", icon: Zap, color: "ib-orange" },
              ].map((item) => (
                <div key={item.step} className="rd-card" style={{ position: 'relative', overflow: 'hidden' }}>
                  <span style={{ position: 'absolute', bottom: -4, right: 4, fontSize: 48, fontWeight: 900, opacity: 0.03, lineHeight: 1 }}>{item.step}</span>
                  <div className={`rd-ico-box ${item.color}`} style={{ marginBottom: 12 }}>
                    <item.icon size={18} />
                  </div>
                  <div className="label-lg" style={{ marginBottom: 4 }}>{item.title}</div>
                  <div className="caption-sm">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}