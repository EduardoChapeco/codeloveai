import { useEffect, useState, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin, useIsAffiliate } from "@/hooks/useAuth";
import { useSEO } from "@/hooks/useSEO";
import { useTenant } from "@/contexts/TenantContext";
import { Copy, Download, LogOut, Shield, Users, MessageSquare, Send, CheckCircle, XCircle, Clock, X, ChevronRight, Zap, Monitor, Key, ArrowRight, Building2, Puzzle, StickyNote, Link2, CloudLightning } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import AppLayout from "@/components/AppLayout";

interface Subscription {
  id: string;
  plan: string;
  status: string;
  starts_at: string;
  expires_at: string;
}

interface Token {
  id: string;
  token: string;
  is_active: boolean;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  subscription_id: string | null;
}

export default function Dashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { tenant, isTenantAdmin } = useTenant();
  const brandName = tenant?.name || "CodeLove AI";
  useSEO({ title: "Dashboard" });
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { isAffiliate } = useIsAffiliate();
  const [tokensLoaded, setTokensLoaded] = useState(false);
  const [extensionDetected, setExtensionDetected] = useState(false);
  const [notesCount, setNotesCount] = useState(0);
  const [lovableStatus, setLovableStatus] = useState<"active" | "expired" | "none">("none");
  
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [profile, setProfile] = useState<{ name: string; email: string } | null>(null);
  const [latestExt, setLatestExt] = useState<{ file_url: string; version: string; instructions: string } | null>(null);
  

  // Payment feedback
  const paymentStatus = searchParams.get("payment");

  // Chat
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  // Clear payment param after showing
  useEffect(() => {
    if (paymentStatus) {
      const timer = setTimeout(() => {
        setSearchParams({}, { replace: true });
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [paymentStatus, setSearchParams]);

  useEffect(() => {
    if (!user) return;

    supabase.from("profiles").select("name, email").eq("user_id", user.id).single()
      .then(({ data }) => setProfile(data));

    supabase.from("subscriptions").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setSubscriptions(data || []));

    supabase.from("tokens").select("*").eq("user_id", user.id)
      .then(({ data }) => {
        const tokenList = data || [];
        setTokens(tokenList);
        setTokensLoaded(true);
        // SSO Bridge: notify extension with Supabase session JWT (NOT license token)
        const activeToken = tokenList.find((t: Token) => t.is_active);
        if (activeToken) {
          const email = user.email || "";
          const name = user.user_metadata?.name || email.split("@")[0] || "";
          // Store Supabase JWT for extension API calls (auth to edge functions)
          supabase.auth.getSession().then(({ data: sessionData }) => {
            const jwt = sessionData?.session?.access_token;
            if (jwt) {
              localStorage.setItem('clf_token', jwt);
              localStorage.setItem('clf_email', email);
              localStorage.setItem('clf_name', name);
              window.postMessage({
                type: 'clf_sso_token',
                token: jwt,
                email: email,
                name: name,
              }, window.location.origin);
            }
          });
        }
      });

    supabase.from("extension_files").select("file_url, version, instructions")
      .eq("is_latest", true).maybeSingle()
      .then(({ data }) => setLatestExt(data));

    // Lovable account status
    supabase.from("lovable_accounts").select("status").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data?.status === "active") setLovableStatus("active");
        else if (data?.status === "expired" || data?.status === "error") setLovableStatus("expired");
        else setLovableStatus("none");
      });

    // Find admin user for chat
    supabase.from("user_roles").select("user_id").eq("role", "admin").limit(1)
      .then(({ data }) => {
        if (data?.[0]) setAdminUserId(data[0].user_id);
      });
  }, [user]);

  // Auto-generate 1000-day token for admin ONLY ONCE (persisted via localStorage + DB check)
  useEffect(() => {
    if (!user || adminLoading || !isAdmin || !tokensLoaded) return;
    const hasActiveToken = tokens.some((t) => t.is_active);
    if (hasActiveToken) return;

    // Prevent re-generation across page reloads using localStorage
    const adminTokenKey = `clf_admin_token_created_${user.id}`;
    if (localStorage.getItem(adminTokenKey) === "true") return;

    const generateAdminToken = async () => {
      try {
        // Double-check DB one more time to avoid race conditions
        const { data: existingTokens } = await supabase
          .from("tokens")
          .select("id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .limit(1);
        if (existingTokens && existingTokens.length > 0) {
          localStorage.setItem(adminTokenKey, "true");
          return;
        }

        const { data, error } = await supabase.functions.invoke("admin-token-actions", {
          body: {
            action: "generate",
            email: user.email,
            name: user.user_metadata?.name || user.email?.split("@")[0] || "Admin",
            plan: "days_1000",
            user_id: user.id,
          },
        });
        if (!error && data?.token) {
          setTokens([{ id: "admin-auto", token: data.token, is_active: true }]);
          // SSO Bridge
          // Store Supabase JWT for extension (not license token)
          supabase.auth.getSession().then(({ data: sessionData }) => {
            const jwt = sessionData?.session?.access_token;
            if (jwt) {
              localStorage.setItem('clf_token', jwt);
              localStorage.setItem('clf_email', user.email || '');
              localStorage.setItem('clf_name', user.user_metadata?.name || '');
              window.postMessage({ type: 'clf_sso_token', token: jwt, email: user.email, name: user.user_metadata?.name || '' }, window.location.origin);
            }
          });
          toast.success("Token admin de 1000 dias gerado automaticamente!");
        }
        localStorage.setItem(adminTokenKey, "true");
      } catch {
        // Don't set the flag on error so it can retry next time
      }
    };
    generateAdminToken();
  }, [user, isAdmin, adminLoading, tokensLoaded, tokens]);

  // Detect extension presence
  useEffect(() => {
    const detect = () => {
      if ((window as unknown as Record<string, unknown>).__codeloveAI) { setExtensionDetected(true); return; }
      const handler = () => setExtensionDetected(true);
      window.addEventListener("clf_extension_present", handler);
      window.postMessage({ type: "clf_ping" }, window.location.origin);
      setTimeout(() => window.removeEventListener("clf_extension_present", handler), 2000);
    };
    setTimeout(detect, 500);
  }, []);

  // Fetch notes count for summary card
  useEffect(() => {
    if (!user) return;
    supabase.from("notes").select("id", { count: "exact", head: true }).eq("user_id", user.id)
      .then(({ count }) => setNotesCount(count || 0));
  }, [user]);

  // Auto-onboard removed

  // Fetch chat messages
  const fetchMessages = async () => {
    if (!user || !adminUserId) return;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${adminUserId}),and(sender_id.eq.${adminUserId},receiver_id.eq.${user.id})`)
      .order("created_at", { ascending: true });
    setMessages(data || []);
  };

  useEffect(() => {
    if (chatOpen && adminUserId) {
      fetchMessages();
      if (user) {
        supabase.from("messages").update({ is_read: true })
          .eq("receiver_id", user.id).eq("sender_id", adminUserId).eq("is_read", false)
          .then(() => {});
      }
    }
  }, [chatOpen, adminUserId, user]);

  // Realtime messages
  useEffect(() => {
    if (!user || !chatOpen) return;
    const channel = supabase
      .channel("user-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new as Message;
        if (
          (msg.sender_id === user.id || msg.receiver_id === user.id)
        ) {
          setMessages((prev) => [...prev, msg]);
          if (msg.receiver_id === user.id) {
            supabase.from("messages").update({ is_read: true }).eq("id", msg.id).then(() => {});
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, chatOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !adminUserId) return;
    setSendingMessage(true);
    const { error } = await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: adminUserId,
      content: newMessage.trim(),
    });
    if (error) toast.error("Erro ao enviar mensagem.");
    else setNewMessage("");
    setSendingMessage(false);
  };

  const sendSupportMessage = async (subscriptionId: string, planName: string) => {
    if (!user || !adminUserId) return;
    setChatOpen(true);
    const msg = `Olá! Preciso de suporte referente à minha compra do plano ${planName}. (ID: ${subscriptionId})`;
    setSendingMessage(true);
    await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: adminUserId,
      content: msg,
      subscription_id: subscriptionId,
    });
    setSendingMessage(false);
    fetchMessages();
  };

  const activeSubscription = subscriptions.find((s) => s.status === "active" && new Date(s.expires_at) > new Date());

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    toast.success("Token copiado!");
  };

  const planLabels: Record<string, string> = {
    "1_day": "1 Dia",
    "7_days": "7 Dias",
    "1_month": "1 Mês",
    "12_months": "12 Meses",
    "lifetime": "Vitalício",
  };

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
        <div>
          <p className="lv-overline mb-1">Área do membro</p>
          <h1 className="lv-heading-lg">Dashboard</h1>
        </div>

        {/* Payment feedback banner */}
        {paymentStatus && (
          <div className={`lv-card flex items-center gap-4 ${
            paymentStatus === "success" ? "border-green-500/30" :
            paymentStatus === "failure" ? "border-destructive/30" : "border-yellow-500/30"
          }`}>
            {paymentStatus === "success" && <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />}
            {paymentStatus === "failure" && <XCircle className="h-5 w-5 text-destructive shrink-0" />}
            {paymentStatus === "pending" && <Clock className="h-5 w-5 text-yellow-500 shrink-0" />}
            <div>
              <p className="lv-body-strong">
                {paymentStatus === "success" && "Pagamento aprovado! 🎉"}
                {paymentStatus === "failure" && "Pagamento não aprovado."}
                {paymentStatus === "pending" && "Pagamento pendente."}
              </p>
              <p className="lv-caption mt-0.5">
                {paymentStatus === "success" && "Seu plano foi ativado! Seu token de acesso será gerado automaticamente em instantes."}
                {paymentStatus === "failure" && "Houve um problema com o pagamento. Tente novamente ou entre em contato com o suporte."}
                {paymentStatus === "pending" && "Estamos aguardando a confirmação do pagamento. Isso pode levar alguns minutos."}
              </p>
            </div>
          </div>
        )}

        {/* Onboarding trial banner removed */}

        {/* ━━━ BENTO GRID ━━━ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Subscription Status — Large card spanning full width on mobile */}
          <div className="lv-card md:col-span-2">
            <p className="lv-overline mb-3">Status da assinatura</p>
            {activeSubscription ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="lv-stat text-2xl">{planLabels[activeSubscription.plan] || activeSubscription.plan}</p>
                  <p className="lv-body mt-1">
                    Expira em {format(new Date(activeSubscription.expires_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                </div>
                <span className="lv-badge lv-badge-success">Ativo</span>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="lv-body">Nenhuma assinatura ativa.</p>
                <Link to="/checkout" className="lv-btn-primary h-10 px-5 text-sm">Ver Planos</Link>
              </div>
            )}
          </div>

          {/* Token Card */}
          <div className="lv-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Key className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="lv-body-strong">Token de Acesso</p>
                <p className="lv-caption">
                  {tokens.filter(t => t.is_active).length > 1 ? `${tokens.filter(t => t.is_active).length} ativos` : "Seu token ativo"}
                </p>
              </div>
            </div>
            {tokens.filter(t => t.is_active).length > 0 ? (
              <div className="flex items-center gap-2">
                <code className="font-mono text-xs text-foreground bg-muted/60 rounded-lg px-3 py-2 flex-1 truncate">
                  {tokens.find(t => t.is_active)!.token.substring(0, 10)}••••{tokens.find(t => t.is_active)!.token.substring(tokens.find(t => t.is_active)!.token.length - 4)}
                </code>
                <button
                  onClick={() => copyToken(tokens.find(t => t.is_active)!.token)}
                  className="lv-btn-secondary h-9 px-3 text-xs flex items-center gap-1.5 shrink-0"
                >
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </button>
              </div>
            ) : (
              <p className="lv-caption">Nenhum token ativo</p>
            )}
          </div>

          {/* Download Card — only visible with active token or subscription */}
          {(activeSubscription || tokens.some(t => t.is_active)) && (
          <div className="lv-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Download className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="lv-body-strong">Extensão{latestExt ? ` v${latestExt.version}` : ""}</p>
                <p className="lv-caption">Instale no navegador</p>
              </div>
            </div>
            <button
              className="lv-btn-primary w-full h-10 text-sm flex items-center justify-center gap-2"
              disabled={!latestExt}
              onClick={async () => {
                if (!latestExt) return;
                const { data } = await supabase.storage.from("extensions").createSignedUrl(latestExt.file_url, 300);
                if (data?.signedUrl) window.open(data.signedUrl, "_blank");
              }}
            >
              <Download className="h-4 w-4" /> Baixar Extensão
            </button>
          </div>
          )}
          {/* Extension Status Card */}
          <div className="lv-card">
            <div className="flex items-center gap-3 mb-4">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${extensionDetected ? 'bg-green-500/10' : 'bg-muted'}`}>
                <Puzzle className={`h-5 w-5 ${extensionDetected ? 'text-green-600' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className="lv-body-strong">CodeLove Ext</p>
                <p className="lv-caption">
                  {extensionDetected ? 'Extensão conectada' : 'Não detectada'}
                </p>
              </div>
            </div>
            {extensionDetected ? (
              <span className="lv-badge lv-badge-success">✓ Conectada</span>
            ) : (
              <Link to="/install" className="lv-btn-secondary h-9 px-3 text-xs inline-flex items-center gap-1.5">
                <Download className="h-3.5 w-3.5" /> Instalar
              </Link>
            )}
          </div>

          {/* Notes Summary Card */}
          <div className="lv-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <StickyNote className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="lv-body-strong">Notas</p>
                <p className="lv-caption">{notesCount === 0 ? 'Nenhuma nota' : `${notesCount} nota${notesCount > 1 ? 's' : ''}`}</p>
              </div>
            </div>
            <Link to="/notes" className="lv-btn-secondary h-9 px-3 text-xs inline-flex items-center gap-1.5">
              <StickyNote className="h-3.5 w-3.5" /> {notesCount > 0 ? 'Ver notas' : 'Criar nota'}
            </Link>
          </div>

          {/* Lovable Cloud Status Card */}
          <div className="lv-card">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: lovableStatus === "active" ? "rgba(52,199,89,0.12)" :
                    lovableStatus === "expired" ? "rgba(255,59,48,0.10)" : "rgba(0,113,227,0.10)",
                }}
              >
                <Link2
                  className="h-5 w-5"
                  style={{
                    color: lovableStatus === "active" ? "#34c759" :
                      lovableStatus === "expired" ? "#ff3b30" : "#0071e3",
                  }}
                />
              </div>
              <div>
                <p className="lv-body-strong">Lovable</p>
                <p className="lv-caption">
                  {lovableStatus === "active" && "Token ativo"}
                  {lovableStatus === "expired" && "Token expirado"}
                  {lovableStatus === "none" && "Não conectado"}
                </p>
              </div>
            </div>
            {lovableStatus === "active" ? (
              <span className="lv-badge lv-badge-success">✓ Conectado</span>
            ) : lovableStatus === "expired" ? (
              <Link to="/lovable/connect" className="lv-btn-secondary h-9 px-3 text-xs inline-flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" /> Reconectar
              </Link>
            ) : (
              <Link to="/lovable/connect" className="lv-btn-secondary h-9 px-3 text-xs inline-flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" /> Conectar
              </Link>
            )}
          </div>
        </div>

        {/* Admin shortcuts */}
        {isAdmin && (
          <Link to="/admin/lovable-cloud" className="lv-card flex items-center justify-between group hover:border-primary/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(94,92,230,0.12)" }}>
                <CloudLightning className="h-5 w-5" style={{ color: "#5e5ce6" }} />
              </div>
              <div>
                <p className="lv-body-strong">Lovable Cloud</p>
                <p className="lv-caption">Gerencie contas, tokens e logs do proxy</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
        )}
        {(isTenantAdmin || isAdmin) && (
          <Link to="/admin/tenant" className="lv-card flex items-center justify-between group hover:border-primary/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="lv-body-strong">Administrar Tenant</p>
                <p className="lv-caption">Gerencie marca, membros, tokens e financeiro do {tenant?.name || "seu tenant"}</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
        )}

        {/* SSO Status */}
        {tokens.some(t => t.is_active) && (
          <div className="lv-card-sm bg-accent/50 flex items-center gap-3">
            <Zap className="h-4 w-4 text-primary shrink-0" />
            <p className="lv-caption flex-1">
              <strong className="text-foreground">Login automático ativo</strong> — Seu token foi sincronizado com a extensão.
            </p>
            <span className="lv-badge lv-badge-primary">Sync</span>
          </div>
        )}

        {/* All Tokens Log */}
        {tokens.length > 1 && (
          <div className="lv-card">
            <p className="lv-overline mb-3">Histórico de tokens ({tokens.length})</p>
            <div className="space-y-2">
              {tokens.map((t) => (
                <div key={t.id} className="lv-card-sm flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <Key className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <code className="font-mono text-xs text-foreground truncate">
                      {t.token.substring(0, 10)}••••{t.token.substring(t.token.length - 4)}
                    </code>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => copyToken(t.token)}
                      className="lv-btn-icon h-7 w-7">
                      <Copy className="h-3 w-3" />
                    </button>
                    <span className={`lv-badge ${t.is_active ? "lv-badge-success" : "lv-badge-muted"}`}>
                      {t.is_active ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* How to use — Bento horizontal cards */}
        <div className="lv-card">
          <p className="lv-overline mb-4">Como usar</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { step: "01", title: "Baixar", desc: "Faça download da extensão acima", icon: Download },
              { step: "02", title: "Instalar", desc: "Ative no Chrome em Gerenciar Extensões", icon: Monitor },
              { step: "03", title: "Token", desc: "Copie seu token e cole na extensão", icon: Key },
              { step: "04", title: "Pronto", desc: "Abra lovable.dev e a extensão ativa automaticamente", icon: Zap },
            ].map((item) => (
              <div key={item.step} className="rounded-xl bg-muted/50 p-4 relative">
                <span className="text-[32px] font-bold text-foreground/5 absolute top-2 right-3 leading-none">{item.step}</span>
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <item.icon className="h-4 w-4 text-primary" />
                </div>
                <p className="lv-body-strong text-xs mb-1">{item.title}</p>
                <p className="lv-caption">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* History */}
        <div className="lv-card">
          <p className="lv-overline mb-4">Histórico de planos</p>
          {subscriptions.length > 0 ? (
            <div className="space-y-2">
              {subscriptions.map((s) => (
                <div key={s.id} className="lv-card-sm flex items-center justify-between">
                  <div>
                    <p className="lv-body-strong">{planLabels[s.plan] || s.plan}</p>
                    <p className="lv-caption mt-0.5">
                      {format(new Date(s.starts_at), "dd/MM/yyyy")} — {format(new Date(s.expires_at), "dd/MM/yyyy")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => sendSupportMessage(s.id, planLabels[s.plan] || s.plan)}
                      className="lv-btn-icon h-8 w-8"
                      title="Suporte sobre esta compra"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                    </button>
                    <span className={`lv-badge ${s.status === "active" && new Date(s.expires_at) > new Date() ? "lv-badge-success" : "lv-badge-muted"}`}>
                      {s.status === "active" && new Date(s.expires_at) > new Date() ? "Ativo" : "Expirado"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="lv-body">Nenhum plano adquirido.</p>
          )}
        </div>

        {/* Become Affiliate CTA */}
        {!isAffiliate && activeSubscription && (
          <div className="lv-card flex items-center justify-between">
            <div>
              <p className="lv-overline mb-1">Programa de Afiliados</p>
              <p className="lv-body">
                Ganhe 30% de comissão indicando o {brandName} + 20% de desconto nos seus planos.
              </p>
            </div>
            <Link to="/affiliates" className="lv-btn-primary h-10 px-5 text-sm shrink-0">
              Quero ser afiliado
            </Link>
          </div>
        )}
      </div>

      {/* Chat FAB */}
      <button
        onClick={() => setChatOpen(!chatOpen)}
        className={`fixed bottom-6 right-6 z-30 flex items-center gap-2 shadow-lg transition-all duration-300 ${
          chatOpen
            ? "lv-btn-secondary h-12 w-12 rounded-2xl"
            : "lv-btn-primary h-12 px-5 rounded-2xl"
        }`}
      >
        {chatOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <>
            <MessageSquare className="h-4 w-4" />
            <span className="text-xs font-medium">Suporte</span>
          </>
        )}
      </button>

      {/* Chat panel */}
      {chatOpen && (
        <div className="fixed bottom-24 right-6 z-30 w-[360px] max-h-[500px] bg-card border border-border/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border/60">
            <p className="lv-body-strong text-xs">Suporte</p>
            <p className="lv-caption">Chat com o administrador</p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 max-h-[350px]">
            {messages.length === 0 && (
              <p className="lv-caption text-center py-8">
                Envie uma mensagem para iniciar o chat.
              </p>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender_id === user?.id ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-xl text-xs ${
                    msg.sender_id === user?.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  <p className="font-medium">{msg.content}</p>
                  <p className={`text-[9px] mt-1 ${
                    msg.sender_id === user?.id ? "text-primary-foreground/60" : "text-muted-foreground"
                  }`}>
                    {format(new Date(msg.created_at), "HH:mm")}
                  </p>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="px-4 py-3 border-t border-border/60 flex items-center gap-2">
            <input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Digite sua mensagem..."
              className="lv-input h-10 text-xs flex-1"
            />
            <button
              onClick={sendMessage}
              disabled={sendingMessage || !newMessage.trim()}
              className="lv-btn-primary h-10 w-10 flex items-center justify-center"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      </div>
    </AppLayout>
  );
}
