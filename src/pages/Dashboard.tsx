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
  id: string;
  key: string;
  active: boolean;
  plan: string;
  plan_type: string;
  status: string;
  expires_at: string | null;
  daily_messages: number | null;
  messages_used_today: number;
}

interface Token {
  id: string;
  token: string;
  is_active: boolean;
}

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

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;

    // Fire ALL dashboard queries in parallel for fast load
    const loadAll = async () => {
      const [profileRes, licenseRes, tokensRes, extRes, lovableRes] = await Promise.all([
        supabase.from("profiles").select("name, email").eq("user_id", user.id).single(),
        supabase.from("licenses")
          .select("id, key, active, plan, plan_type, status, expires_at, daily_messages, messages_used_today")
          .eq("user_id", user.id).eq("active", true)
          .order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("tokens").select("*").eq("user_id", user.id),
        // Fetch the best extension file for the user's plan
        (async () => {
          // Get user's active license to find plan_id
          const { data: lic } = await supabase
            .from("licenses")
            .select("plan_id, plan")
            .eq("user_id", user.id)
            .eq("active", true)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          // Find extensions linked to user's plan
          let targetExtId: string | null = null;
          let extName = "";
          if (lic?.plan_id) {
            // Get plan_extensions sorted by catalog display_order desc (highest tier first)
            const { data: pe } = await supabase
              .from("plan_extensions")
              .select("extension_id, extension_catalog(id, name, display_order)")
              .eq("plan_id", lic.plan_id);
            if (pe && pe.length > 0) {
              // Pick the highest-tier extension (highest display_order = most premium)
              const sorted = pe.sort((a: any, b: any) =>
                (b.extension_catalog?.display_order || 0) - (a.extension_catalog?.display_order || 0)
              );
              targetExtId = sorted[0].extension_id;
              extName = (sorted[0] as any).extension_catalog?.name || "";
            }
          }

          if (targetExtId) {
            const { data: ef } = await supabase
              .from("extension_files")
              .select("file_url, version, instructions")
              .eq("extension_id", targetExtId)
              .eq("is_latest", true)
              .maybeSingle();
            return ef ? { ...ef, ext_name: extName } : null;
          }

          // Fallback: get any latest file
          const { data: ef } = await supabase
            .from("extension_files")
            .select("file_url, version, instructions")
            .eq("is_latest", true)
            .limit(1)
            .maybeSingle();
          return ef;
        })(),
        supabase.from("lovable_accounts").select("status").eq("user_id", user.id).maybeSingle(),
      ]);

      setProfile(profileRes.data);
      if (licenseRes.data) setLicense(licenseRes.data as unknown as MemberLicense);

      const tokenList = tokensRes.data || [];
      setTokens(tokenList);
      setTokensLoaded(true);

      // SSO bridge for active legacy token
      const activeToken = tokenList.find((t: Token) => t.is_active);
      if (activeToken) {
        const email = user.email || "";
        const name = user.user_metadata?.name || email.split("@")[0] || "";
        supabase.auth.getSession().then(({ data: sessionData }) => {
          const jwt = sessionData?.session?.access_token;
          if (jwt) {
            localStorage.setItem('clf_token', jwt);
            localStorage.setItem('clf_email', email);
            localStorage.setItem('clf_name', name);
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

  // Auto-provision: admins get lifetime, regular users get free 10msg license
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
          // Admin gets lifetime master access
          const { data, error } = await supabase.functions.invoke("admin-token-actions", {
            body: {
              action: "generate",
              email: user.email,
              name: user.user_metadata?.name || user.email?.split("@")[0] || "Usuário",
              plan: "lifetime",
              user_id: user.id,
            },
          });
          if (!error && data?.token) {
            setTokens([{ id: "auto", token: data.token, is_active: true }]);
            toast.success("Acesso Master Vitalício ativado! 👑");
          }
        } else {
          // Regular user gets free 10msg/day license via edge function
          const { data, error } = await supabase.functions.invoke("auto-onboard", {
            body: {},
          });
          if (!error && data?.license_id) {
            // Reload license
            const { data: newLic } = await supabase.from("licenses")
              .select("id, key, active, plan, plan_type, status, expires_at, daily_messages, messages_used_today")
              .eq("id", data.license_id).maybeSingle();
            if (newLic) setLicense(newLic as unknown as MemberLicense);
            toast.success("Plano Grátis ativado — 10 mensagens/dia! 🎉");
          }
        }
        localStorage.setItem(tokenKey, "true");
      } catch { /* retry next time */ }
      setTokenGenerating(false);
    };
    provision();
  }, [user, tokensLoaded, tokens, tokenGenerating, license, isAdmin, adminLoading]);

  // Detect extension
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

  // Notes count
  useEffect(() => {
    if (!user) return;
    supabase.from("notes").select("id", { count: "exact", head: true }).eq("user_id", user.id)
      .then(({ count }) => setNotesCount(count || 0));
  }, [user]);

  const activeTokens = tokens.filter(t => t.is_active);

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    toast.success("Token copiado!");
  };

  const getStatusDisplay = () => {
    if (license) {
      const expiryDate = license.expires_at ? new Date(license.expires_at) : null;
      const isExpired = expiryDate && expiryDate < new Date();
      
      return {
        title: license.plan || "Plano Ativo",
        desc: isExpired ? `Expirado em ${format(expiryDate!, "dd/MM/yyyy")}` : 
              expiryDate ? `Ativo até ${format(expiryDate, "dd/MM/yyyy")}` : "Ilimitado",
        badge: isExpired ? "Expirado" : "Ativo",
        variant: isExpired ? "destructive" : "success",
        usage: license.daily_messages ? `${license.messages_used_today || 0} / ${license.daily_messages} msgs/dia` : null
      };
    }
    
    if (activeTokens.length > 0) {
      return {
        title: "Token Ativo",
        desc: "Seu token de acesso está ativo (gerado via admin/sistema)",
        badge: "Ativo",
        variant: "success",
        usage: null
      };
    }

    if (tokenGenerating) {
      return {
        title: "Processando...",
        desc: "Gerando seu acesso, por favor aguarde",
        badge: "...",
        variant: "primary",
        usage: null
      };
    }

    return {
      title: "Sem Acesso",
      desc: "Você ainda não possui um plano ativo",
      badge: "Inativo",
      variant: "secondary",
      usage: null
    };
  };

  const status = getStatusDisplay();

  if (authLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="lv-overline">Carregando...</p>
    </div>;
  }

  return (
    <AppLayout>
      <div className="min-h-full">
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between animate-fade-in">
            <div>
              <p className="lv-overline mb-1.5">Área do membro</p>
              <h1 className="lv-heading-lg">Dashboard</h1>
              <p className="lv-body-lg mt-1.5">
                {license?.plan_type === 'custom' ? "Plano Profissional Ativo" : "Plataforma — Ferramentas de IA"}
              </p>
            </div>
            {!license && !activeTokens.length && (
              <Link to="/plans" className="lv-btn-primary h-11 px-6 flex items-center gap-2 shadow-lg shadow-primary/20">
                <Zap className="h-4 w-4" /> Ver Planos
              </Link>
            )}
          </div>

          {/* ⚠️ Alerta de baixo saldo de mensagens (free_trial ≤ 2 msgs restantes) */}
          {(() => {
            if (!license || license.plan_type !== 'messages' || !license.daily_messages) return null;
            const remaining = license.daily_messages - (license.messages_used_today || 0);
            if (remaining > 2) return null;
            return (
              <div className="rounded-2xl border border-amber-400/30 bg-amber-500/8 p-4 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-500">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="lv-body-strong text-amber-700 dark:text-amber-400 text-sm">
                      {remaining <= 0 ? 'Você usou todas as suas mensagens gratuitas' : `Apenas ${remaining} mensagem${remaining > 1 ? 'ns' : ''} restante${remaining > 1 ? 's' : ''}`}
                    </p>
                    <p className="lv-caption text-amber-600/80 dark:text-amber-500/80">
                      Faça upgrade para continuar usando sem interrupções
                    </p>
                  </div>
                </div>
                <Link
                  to="/plans"
                  className="lv-btn-primary h-9 px-4 text-xs shrink-0 flex items-center gap-1.5 shadow-lg shadow-primary/20"
                >
                  <Zap className="h-3.5 w-3.5" /> Fazer Upgrade
                </Link>
              </div>
            );
          })()}

          {/* ⚠️ Aviso sobre créditos do Lovable */}
          <div className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-3.5 flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Aviso sobre créditos</p>
              <p className="text-[11px] text-amber-600/70 dark:text-amber-400/70 mt-0.5 leading-relaxed">
                O Lovable pode cobrar créditos em alguns casos durante o uso da extensão. Recomendamos monitorar seu saldo de créditos na plataforma Lovable.
              </p>
            </div>
          </div>

          {/* ━━━ BENTO GRID ━━━ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Status — full width */}
            <div className="clf-liquid-glass md:col-span-2 p-6 lg:p-8">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div className="flex-1">
                  <p className="lv-overline mb-3">Status do acesso</p>
                  <p className="lv-stat text-3xl lg:text-4xl">{status.title}</p>
                  <p className="lv-body mt-2 text-muted-foreground/80">{status.desc}</p>
                  {status.usage && (
                    <div className="mt-6 flex flex-col gap-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Uso Diário</p>
                      <div className="h-2 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden max-w-sm">
                        <div 
                          className="h-full bg-primary shadow-[0_0_12px_rgba(0,113,227,0.4)] transition-all duration-1000" 
                          style={{ width: `${Math.min(100, ((license?.messages_used_today || 0) / (license?.daily_messages || 1)) * 100)}%` }}
                        />
                      </div>
                      <p className="lv-caption font-semibold">{status.usage}</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-3 shrink-0">
                  <span className={`lv-badge px-4 py-1.5 rounded-full ${status.variant === 'success' ? 'lv-badge-success' : status.variant === 'destructive' ? 'bg-destructive/10 text-destructive' : 'lv-badge-primary'}`}>
                    {status.badge}
                  </span>
                  {(license?.status === 'suspended' || (license?.expires_at && new Date(license.expires_at) < new Date())) && (
                    <Link to="/plans" className="lv-btn-primary h-10 px-6 text-[11px] font-bold uppercase tracking-widest shadow-xl">
                      Renovar Agora
                    </Link>
                  )}
                  {/* Botão Upgrade para usuários no plano de trial com mensagens limitadas */}
                  {license?.plan_type === 'messages' && license.daily_messages && (
                    <Link
                      to="/plans"
                      className="lv-btn-secondary h-9 px-4 text-xs flex items-center gap-1.5"
                    >
                      <Zap className="h-3.5 w-3.5" /> Fazer Upgrade
                    </Link>
                  )}
                </div>
              </div>
            </div>


            {/* Extensão */}
            <div className="clf-liquid-glass p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${extensionDetected ? 'bg-green-500/10' : 'bg-primary/10'}`}>
                  <Puzzle className={`h-6 w-6 ${extensionDetected ? 'text-green-600' : 'text-primary'}`} />
                </div>
                <div className="flex-1">
                  <p className="lv-body-strong text-base">
                    {latestExt?.ext_name || "Extensão"}{latestExt ? ` v${latestExt.version}` : ""}
                  </p>
                  <p className="lv-caption">
                    {extensionDetected ? 'Conectada e ativa' : 'Não detectada'}
                  </p>
                </div>
                {extensionDetected && (
                  <span className="lv-badge lv-badge-success scale-110">✓</span>
                )}
              </div>
              {extensionDetected ? (
                <div className="bg-green-500/5 rounded-xl p-3 border border-green-500/10 text-center">
                  <p className="lv-caption text-green-600 font-medium">Extensão detectada no navegador.</p>
                </div>
              ) : (
                <button
                  className="lv-btn-primary w-full h-11 text-sm flex items-center justify-center gap-2 shadow-lg"
                  disabled={!latestExt}
                  onClick={async () => {
                    if (!latestExt) return;
                    const { data } = await supabase.storage.from("extensions").createSignedUrl(latestExt.file_url, 300);
                    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                  }}
                >
                  <Download className="h-4 w-4" /> Baixar Extensão
                </button>
              )}
            </div>

            {/* Notes */}
            <div className="clf-liquid-glass p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                  <StickyNote className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="lv-body-strong text-base">Notas</p>
                  <p className="lv-caption">{notesCount === 0 ? 'Nenhuma nota' : `${notesCount} nota${notesCount > 1 ? 's' : ''}`}</p>
                </div>
              </div>
              <Link to="/notes" className="lv-btn-secondary w-full h-11 px-4 text-sm inline-flex items-center justify-center gap-1.5 shadow-sm">
                <StickyNote className="h-4 w-4" /> {notesCount > 0 ? 'Ver notas' : 'Criar nota'}
              </Link>
            </div>

            {/* Lovable Connection Status */}
            <div className="clf-liquid-glass p-6">
              <div className="flex items-center gap-3 mb-6">
                <div
                  className="h-12 w-12 rounded-2xl flex items-center justify-center shrink-0"
                  style={{
                    background: lovableStatus === "active" ? "rgba(52,199,89,0.12)" :
                      lovableStatus === "expired" ? "rgba(255,59,48,0.10)" : "rgba(0,113,227,0.10)",
                  }}
                >
                  <Link2
                    className="h-6 w-6"
                    style={{
                      color: lovableStatus === "active" ? "#34c759" :
                        lovableStatus === "expired" ? "#ff3b30" : "#0071e3",
                    }}
                  />
                </div>
                <div>
                  <p className="lv-body-strong text-base">Lovable</p>
                  <p className="lv-caption">
                    {lovableStatus === "active" && "Token ativo"}
                    {lovableStatus === "expired" && "Token expirado"}
                    {lovableStatus === "none" && "Não conectado"}
                  </p>
                </div>
              </div>
              {lovableStatus === "active" ? (
                <div className="bg-green-500/5 rounded-xl p-3 border border-green-500/10 text-center">
                  <span className="lv-badge lv-badge-success">✓ Conectado</span>
                </div>
              ) : (
                <Link to="/lovable/connect" className="lv-btn-secondary w-full h-11 px-4 text-sm inline-flex items-center justify-center gap-1.5 shadow-sm">
                  <Link2 className="h-4 w-4" /> {lovableStatus === "expired" ? "Reconectar" : "Conectar"}
                </Link>
              )}
            </div>
          </div>

          {/* Admin shortcuts */}
          {(isTenantAdmin || isAdmin) && (
            <Link to="/admin/tenant" className="clf-liquid-glass p-5 flex items-center justify-between group hover:brightness-[1.03] transition-all">
              <div className="flex items-center gap-4">
                <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 shadow-inner">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="lv-body-strong text-base">Administrar Tenant</p>
                  <p className="lv-caption">Gerencie membros, tokens e configurações</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all">
                Abrir <ChevronRight className="h-4 w-4" />
              </div>
            </Link>
          )}

          {/* SSO Status */}
          {activeTokens.length > 0 && (
            <div className="lv-card-sm bg-accent/50 flex items-center gap-3">
              <Zap className="h-4 w-4 text-primary shrink-0" />
              <p className="lv-caption flex-1">
                <strong className="text-foreground">Login automático ativo</strong> — Seu token foi sincronizado com a extensão.
              </p>
              <span className="lv-badge lv-badge-primary">Sync</span>
            </div>
          )}

          {/* How to use */}
          <div className="clf-liquid-glass p-8">
            <p className="lv-overline mb-6">Como começar</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { step: "01", title: "Baixar", desc: "Faça download da extensão oficial", icon: Download, gradient: "from-blue-500 to-cyan-500" },
                { step: "02", title: "Instalar", desc: "Ative o Modo do Desenvolvedor no Chrome", icon: Monitor, gradient: "from-violet-500 to-purple-500" },
                { step: "03", title: "Conectar", desc: "Vincule sua conta Lovable com segurança", icon: Key, gradient: "from-emerald-500 to-green-500" },
                { step: "04", title: "Pronto", desc: "Inicie o lovable.dev e deixe a mágica acontecer", icon: Zap, gradient: "from-amber-500 to-orange-500" },
              ].map((item) => (
                <div
                  key={item.step}
                  className="rounded-2xl p-6 relative group overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                  style={{
                    background: 'var(--liquid-glass-bg)',
                    backdropFilter: 'blur(20px)',
                    border: '0.5px solid var(--clf-border)',
                  }}
                >
                  <span className="text-[56px] font-black text-foreground/[0.03] absolute -bottom-2 -right-1 leading-none group-hover:text-primary/8 transition-colors duration-500">{item.step}</span>
                  <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${item.gradient} shadow-lg flex items-center justify-center mb-4 text-white group-hover:scale-110 transition-transform duration-300`}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <p className="lv-body-strong text-sm mb-1.5">{item.title}</p>
                  <p className="lv-caption leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
