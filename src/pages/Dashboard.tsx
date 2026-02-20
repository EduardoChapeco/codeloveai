import { useEffect, useState, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin, useIsAffiliate } from "@/hooks/useAuth";
import { Copy, Download, LogOut, Shield, Users, MessageSquare, Send, CheckCircle, XCircle, Clock, X, Gift, ChevronRight, Zap, Monitor, Key, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import AppNav from "@/components/AppNav";

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
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { isAffiliate } = useIsAffiliate();
  const [adminTokenGenerated, setAdminTokenGenerated] = useState(false);
  const onboardRef = useRef(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [profile, setProfile] = useState<{ name: string; email: string } | null>(null);
  const [latestExt, setLatestExt] = useState<{ file_url: string; version: string; instructions: string } | null>(null);
  const [onboardingBanner, setOnboardingBanner] = useState<{ expires_at: string } | null>(null);

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
        setTokens(data || []);
        // SSO Bridge: notify extension of active token
        const activeToken = (data || []).find((t: Token) => t.is_active);
        if (activeToken) {
          const email = user.email || "";
          const name = user.user_metadata?.name || email.split("@")[0] || "";
          localStorage.setItem('clf_token', activeToken.token);
          localStorage.setItem('clf_email', email);
          localStorage.setItem('clf_name', name);
          window.postMessage({
            type: 'clf_sso_token',
            token: activeToken.token,
            email: email,
            name: name,
          }, '*');
        }
      });

    supabase.from("extension_files").select("file_url, version, instructions")
      .eq("is_latest", true).maybeSingle()
      .then(({ data }) => setLatestExt(data));

    // Find admin user for chat
    supabase.from("user_roles").select("user_id").eq("role", "admin").limit(1)
      .then(({ data }) => {
        if (data?.[0]) setAdminUserId(data[0].user_id);
      });
  }, [user]);

  // Auto-generate 1000-day token for admin if none exists
  useEffect(() => {
    if (!user || adminLoading || !isAdmin || adminTokenGenerated) return;
    const hasActiveToken = tokens.some((t) => t.is_active);
    if (hasActiveToken) return;

    const generateAdminToken = async () => {
      try {
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
          localStorage.setItem('clf_token', data.token);
          localStorage.setItem('clf_email', user.email || '');
          localStorage.setItem('clf_name', user.user_metadata?.name || '');
          window.postMessage({ type: 'clf_sso_token', token: data.token, email: user.email, name: user.user_metadata?.name || '' }, '*');
          toast.success("Token admin de 1000 dias gerado automaticamente!");
        }
        setAdminTokenGenerated(true);
      } catch {
        setAdminTokenGenerated(true);
      }
    };
    generateAdminToken();
  }, [user, isAdmin, adminLoading, tokens, adminTokenGenerated]);

  // Auto-onboard: give new users a 5-hour trial (runs once only via ref guard)
  useEffect(() => {
    if (!user || authLoading || adminLoading) return;
    if (onboardRef.current) return;
    if (isAdmin) return; // Admins get their own token
    // Wait until initial data is loaded before deciding
    if (subscriptions.length > 0 || tokens.length > 0) return;

    // Mark as running immediately to prevent duplicate calls
    onboardRef.current = true;

    const runOnboard = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("auto-onboard");
        if (!error && data?.status === "activated") {
          setOnboardingBanner({ expires_at: data.expires_at });
          toast.success("🎉 Trial de 5 horas ativado! Aproveite para testar.");
          // Refresh subscriptions and tokens
          const { data: subs } = await supabase.from("subscriptions").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
          setSubscriptions(subs || []);
          const { data: toks } = await supabase.from("tokens").select("*").eq("user_id", user.id);
          setTokens(toks || []);
          // SSO bridge for new token
          const activeToken = (toks || []).find((t: Token) => t.is_active);
          if (activeToken) {
            const email = user.email || "";
            const name = user.user_metadata?.name || email.split("@")[0] || "";
            localStorage.setItem('clf_token', activeToken.token);
            localStorage.setItem('clf_email', email);
            localStorage.setItem('clf_name', name);
            window.postMessage({ type: 'clf_sso_token', token: activeToken.token, email, name }, '*');
          }
        }
      } catch (err) {
        console.error("Auto-onboard error:", err);
      }
    };
    runOnboard();
  }, [user, authLoading, adminLoading, isAdmin, subscriptions, tokens]);

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
      // Mark unread messages as read
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
  };

  if (authLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="ep-subtitle">CARREGANDO...</p>
    </div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppNav />

      <div className="max-w-4xl mx-auto px-8 py-12 space-y-8">
        <div>
          <p className="ep-subtitle mb-2">ÁREA DO MEMBRO</p>
          <h1 className="ep-section-title">DASHBOARD</h1>
        </div>

        {/* Payment feedback banner */}
        {paymentStatus && (
          <div className={`ep-card flex items-center gap-4 ${
            paymentStatus === "success" ? "border-green-500/30" :
            paymentStatus === "failure" ? "border-destructive/30" : "border-yellow-500/30"
          }`}>
            {paymentStatus === "success" && <CheckCircle className="h-6 w-6 text-green-500 shrink-0" />}
            {paymentStatus === "failure" && <XCircle className="h-6 w-6 text-destructive shrink-0" />}
            {paymentStatus === "pending" && <Clock className="h-6 w-6 text-yellow-500 shrink-0" />}
            <div>
              <p className="text-sm font-bold text-foreground">
                {paymentStatus === "success" && "Pagamento aprovado! 🎉"}
                {paymentStatus === "failure" && "Pagamento não aprovado."}
                {paymentStatus === "pending" && "Pagamento pendente."}
              </p>
              <p className="text-xs text-muted-foreground font-medium">
                {paymentStatus === "success" && "Seu plano foi ativado! Seu token de acesso será gerado automaticamente em instantes."}
                {paymentStatus === "failure" && "Houve um problema com o pagamento. Tente novamente ou entre em contato com o suporte."}
                {paymentStatus === "pending" && "Estamos aguardando a confirmação do pagamento. Isso pode levar alguns minutos."}
              </p>
            </div>
          </div>
        )}

        {/* Onboarding trial banner */}
        {onboardingBanner && (
          <div className="ep-card flex items-center gap-4 border-foreground/20">
            <Gift className="h-6 w-6 text-foreground shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">🎉 Trial de 5 horas ativado!</p>
              <p className="text-xs text-muted-foreground font-medium">
                Seu token e extensão já estão disponíveis. Aproveite para testar a plataforma!
              </p>
            </div>
            <Link to="/checkout" className="ep-btn-primary h-9 px-4 text-[9px] shrink-0">
              VER PLANOS
            </Link>
          </div>
        )}

        <div className="ep-card">
          <p className="ep-subtitle mb-4">STATUS DA ASSINATURA</p>
          {activeSubscription ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="ep-value">{planLabels[activeSubscription.plan] || activeSubscription.plan}</p>
                <p className="text-sm text-muted-foreground font-medium mt-2">
                  Expira em {format(new Date(activeSubscription.expires_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
              <span className="ep-badge ep-badge-live">ATIVO</span>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground font-medium">Nenhuma assinatura ativa.</p>
              <Link to="/checkout" className="ep-btn-primary h-10 px-6 text-[9px]">VER PLANOS</Link>
            </div>
          )}
        </div>

        {/* Quick Access: Token + Download unified */}
        <div className="ep-card">
          <p className="ep-subtitle mb-4">ACESSO RÁPIDO</p>
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Token card */}
            <div className="flex-1 bg-muted rounded-[16px] p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-[14px] bg-foreground flex items-center justify-center shrink-0">
                <Key className="h-5 w-5 text-background" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-muted-foreground tracking-widest mb-1">TOKEN</p>
                {tokens.filter(t => t.is_active).length > 0 ? (
                  <code className="font-mono text-xs text-foreground">
                    {tokens.find(t => t.is_active)!.token.substring(0, 10)}••••{tokens.find(t => t.is_active)!.token.substring(tokens.find(t => t.is_active)!.token.length - 4)}
                  </code>
                ) : (
                  <p className="text-xs text-muted-foreground">Nenhum ativo</p>
                )}
              </div>
              {tokens.filter(t => t.is_active).length > 0 && (
                <button
                  onClick={() => copyToken(tokens.find(t => t.is_active)!.token)}
                  className="ep-btn-secondary h-10 px-4 text-[9px] flex items-center gap-1.5 shrink-0"
                >
                  <Copy className="h-3 w-3" /> COPIAR
                </button>
              )}
            </div>

            {/* Download card */}
            <div className="flex-1 bg-muted rounded-[16px] p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-[14px] bg-foreground flex items-center justify-center shrink-0">
                <Download className="h-5 w-5 text-background" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-muted-foreground tracking-widest mb-1">EXTENSÃO {latestExt ? `V${latestExt.version}` : ""}</p>
                <p className="text-xs text-muted-foreground">Instale no navegador</p>
              </div>
              <button
                className="ep-btn-primary h-10 px-4 text-[9px] flex items-center gap-1.5 shrink-0"
                disabled={!activeSubscription || !latestExt}
                onClick={async () => {
                  if (!latestExt) return;
                  const { data } = await supabase.storage.from("extensions").createSignedUrl(latestExt.file_url, 300);
                  if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                }}
              >
                <Download className="h-3 w-3" /> BAIXAR
              </button>
            </div>
          </div>
        </div>

        {/* SSO Status - only show when token is active */}
        {tokens.some(t => t.is_active) && (
          <div className="ep-card-sm bg-muted/30 flex items-center gap-3 py-3 px-4">
            <Zap className="h-4 w-4 text-foreground shrink-0" />
            <p className="text-[10px] text-muted-foreground font-medium flex-1">
              <strong className="text-foreground">Login automático ativo</strong> — Seu token foi sincronizado com a extensão. Ao abrir o Lovable, a extensão será ativada automaticamente.
            </p>
            <span className="ep-badge ep-badge-live shrink-0">SYNC</span>
          </div>
        )}

        {/* Step-by-step guide - horizontal scroll cards */}
        <div className="ep-card">
          <p className="ep-subtitle mb-4">COMO USAR</p>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
            {[
              { step: "01", title: "BAIXAR", desc: "Faça download da extensão acima", icon: Download },
              { step: "02", title: "INSTALAR", desc: "Ative no Chrome em Gerenciar Extensões", icon: Monitor },
              { step: "03", title: "TOKEN", desc: "Copie seu token e cole na extensão", icon: Key },
              { step: "04", title: "PRONTO", desc: "Abra lovable.dev e a extensão ativa automaticamente", icon: Zap },
            ].map((item) => (
              <div key={item.step} className="shrink-0 w-[200px] bg-muted rounded-[16px] p-5 relative">
                <span className="text-[40px] font-black text-foreground/5 absolute top-3 right-4 leading-none">{item.step}</span>
                <div className="h-10 w-10 rounded-[12px] bg-foreground flex items-center justify-center mb-3">
                  <item.icon className="h-4 w-4 text-background" />
                </div>
                <p className="text-[10px] font-bold text-foreground tracking-widest mb-1">{item.title}</p>
                <p className="text-[10px] text-muted-foreground font-medium">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* History */}
        <div className="ep-card">
          <p className="ep-subtitle mb-6">HISTÓRICO DE PLANOS</p>
          {subscriptions.length > 0 ? (
            <div className="space-y-3">
              {subscriptions.map((s) => (
                <div key={s.id} className="ep-card-sm flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-foreground">{planLabels[s.plan] || s.plan}</p>
                    <p className="text-xs text-muted-foreground font-medium">
                      {format(new Date(s.starts_at), "dd/MM/yyyy")} — {format(new Date(s.expires_at), "dd/MM/yyyy")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => sendSupportMessage(s.id, planLabels[s.plan] || s.plan)}
                      className="ep-btn-icon h-8 w-8 rounded-[10px]"
                      title="Suporte sobre esta compra"
                    >
                      <MessageSquare className="h-3 w-3" />
                    </button>
                    <span className={`ep-badge ${s.status === "active" && new Date(s.expires_at) > new Date() ? "ep-badge-live" : "ep-badge-offline"}`}>
                      {s.status === "active" && new Date(s.expires_at) > new Date() ? "ATIVO" : "EXPIRADO"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground font-medium">Nenhum plano adquirido.</p>
          )}
        </div>

        {/* Become Affiliate CTA */}
        {!isAffiliate && activeSubscription && (
          <div className="ep-card flex items-center justify-between">
            <div>
              <p className="ep-subtitle mb-1">PROGRAMA DE AFILIADOS</p>
              <p className="text-sm text-muted-foreground font-medium">
                Ganhe 30% de comissão indicando o CodeLove AI + 20% de desconto nos seus planos.
              </p>
            </div>
            <Link to="/affiliates" className="ep-btn-primary h-10 px-6 text-[9px] shrink-0">
              QUERO SER AFILIADO
            </Link>
          </div>
        )}
      </div>

      {/* Chat FAB - CODELOVE badge that expands */}
      <button
        onClick={() => setChatOpen(!chatOpen)}
        className={`fixed bottom-6 right-6 z-30 flex items-center gap-2 shadow-lg transition-all duration-300 ${
          chatOpen
            ? "ep-btn-secondary h-12 w-12 rounded-[16px]"
            : "ep-btn-primary h-12 px-5 rounded-[16px]"
        }`}
      >
        {chatOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <>
            <MessageSquare className="h-4 w-4" />
            <span className="text-[9px] font-bold tracking-widest">CODELOVE</span>
          </>
        )}
      </button>

      {/* Chat panel */}
      {chatOpen && (
        <div className="fixed bottom-24 right-6 z-30 w-[360px] max-h-[500px] bg-background border border-border rounded-[20px] shadow-2xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="ep-label text-[10px]">SUPORTE</p>
            <p className="text-xs text-muted-foreground">Chat com o administrador</p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 max-h-[350px]">
            {messages.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">
                Envie uma mensagem para iniciar o chat.
              </p>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender_id === user?.id ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-[12px] text-xs ${
                    msg.sender_id === user?.id
                      ? "bg-foreground text-background"
                      : "bg-muted text-foreground"
                  }`}
                >
                  <p className="font-medium">{msg.content}</p>
                  <p className={`text-[9px] mt-1 ${
                    msg.sender_id === user?.id ? "text-background/60" : "text-muted-foreground"
                  }`}>
                    {format(new Date(msg.created_at), "HH:mm")}
                  </p>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="px-4 py-3 border-t border-border flex items-center gap-2">
            <input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Digite sua mensagem..."
              className="ep-input h-10 rounded-[12px] text-xs px-3 border border-border flex-1"
            />
            <button
              onClick={sendMessage}
              disabled={sendingMessage || !newMessage.trim()}
              className="ep-btn-primary h-10 w-10 rounded-[12px] flex items-center justify-center"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
