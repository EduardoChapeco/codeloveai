import { useEffect, useState, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { LogOut, Key, UserCheck, UserX, Ban, XCircle, Users, Coins, Upload, RefreshCw, Bell, MessageSquare, Send, Gift, Copy, Link as LinkIcon, Trash2, DollarSign, FileText, CheckCircle, Search, Unlock, Zap, Loader2, UserPlus, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import AppLayout from "@/components/AppLayout";

interface MemberToken {
  id: string;
  token: string;
  is_active: boolean;
  created_at: string;
}

interface Member {
  user_id: string;
  name: string;
  email: string;
  subscription?: { plan: string; status: string; expires_at: string };
  token?: string;
  tokens: MemberToken[];
  isAffiliate?: boolean;
}

interface AffiliateInfo {
  id: string;
  user_id: string;
  affiliate_code: string;
  display_name: string;
  discount_percent: number;
  coins?: { balance: number; total_earned: number; total_spent: number };
  weeklyReferrals: number;
  totalReferrals: number;
  pendingReferrals: number;
  totalCommission: number;
  bankInfo?: { pix_key_type: string; pix_key: string; holder_name: string };
}

interface Invoice {
  id: string;
  affiliate_id: string;
  user_id: string;
  week_start: string;
  week_end: string;
  total_sales: number;
  total_commission: number;
  status: string;
  paid_at: string | null;
  payment_notes: string;
  affiliate_name?: string;
  affiliate_code?: string;
}

const planOptions = [
  { value: "1_day", label: "1 Dia", days: 1 },
  { value: "7_days", label: "7 Dias", days: 7 },
  { value: "1_month", label: "1 Mês", days: 30 },
  { value: "12_months", label: "12 Meses", days: 365 },
];

const planLabels: Record<string, string> = {
  "1_day": "1 Dia", "7_days": "7 Dias", "1_month": "1 Mês", "12_months": "12 Meses",
};

type Tab = "members" | "affiliates" | "invoices" | "extension" | "notifications" | "messages" | "worker-tokens";

export default function Admin() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tab = (searchParams.get("tab") || "members") as Tab;
  const [members, setMembers] = useState<Member[]>([]);
  const [affiliates, setAffiliates] = useState<AffiliateInfo[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tokenInput, setTokenInput] = useState<Record<string, string>>({});
  const [planInput, setPlanInput] = useState<Record<string, string>>({});
  const [newAffUserId, setNewAffUserId] = useState("");
  const [newAffCode, setNewAffCode] = useState("");
  const [newAffName, setNewAffName] = useState("");
  const [extVersion, setExtVersion] = useState("");
  const [extFile, setExtFile] = useState<File | null>(null);
  const [extInstructions, setExtInstructions] = useState("");
  const [extensions, setExtensions] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  // freeLinks removed
  const [paymentNotes, setPaymentNotes] = useState<Record<string, string>>({});

  // Worker token management
  const [workerEmail, setWorkerEmail] = useState("");
  const [workerName, setWorkerName] = useState("");
  const [workerPlan, setWorkerPlan] = useState("days_30");
  const [workerUserId, setWorkerUserId] = useState("");
  const [workerLoading, setWorkerLoading] = useState(false);
  const [workerResult, setWorkerResult] = useState<any>(null);
  const [searchEmail, setSearchEmail] = useState("");
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [unbindToken, setUnbindToken] = useState("");
  const [unbindLoading, setUnbindLoading] = useState(false);
  const [expandedTokens, setExpandedTokens] = useState<string | null>(null);

  // Chat state
  const [chatUsers, setChatUsers] = useState<{ user_id: string; name: string; email: string; unread: number }[]>([]);
  const [selectedChatUser, setSelectedChatUser] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [adminMessage, setAdminMessage] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Create user sheet state
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserPlan, setNewUserPlan] = useState("");
  const [newUserRole, setNewUserRole] = useState("member");
  const [newUserAutoToken, setNewUserAutoToken] = useState(true);
  const [newUserLoading, setNewUserLoading] = useState(false);
  const [newUserResult, setNewUserResult] = useState<any>(null);
  const [showNewPassword, setShowNewPassword] = useState(false);

  useEffect(() => {
    if (!authLoading && !adminLoading) {
      if (!user) navigate("/login");
      else if (!isAdmin) navigate("/dashboard");
    }
  }, [user, isAdmin, authLoading, adminLoading, navigate]);

  // Fetch members
  const fetchMembers = async () => {
    const { data: profiles } = await supabase.from("profiles").select("*");
    if (!profiles) return;

    const { data: allAffiliates } = await supabase.from("affiliates").select("user_id");
    const affUserIds = new Set((allAffiliates || []).map((a) => a.user_id));

    const memberList: Member[] = [];
    for (const p of profiles) {
      const { data: subs } = await supabase.from("subscriptions").select("*")
        .eq("user_id", p.user_id).order("created_at", { ascending: false }).limit(1);
      const { data: toks } = await supabase.from("tokens").select("*")
        .eq("user_id", p.user_id).order("created_at", { ascending: false });

      const allTokens: MemberToken[] = (toks || []).map(t => ({
        id: t.id, token: t.token, is_active: t.is_active, created_at: t.created_at,
      }));
      const activeToken = allTokens.find(t => t.is_active);

      memberList.push({
        user_id: p.user_id, name: p.name, email: p.email,
        subscription: subs?.[0] ? { plan: subs[0].plan, status: subs[0].status, expires_at: subs[0].expires_at } : undefined,
        token: activeToken?.token,
        tokens: allTokens,
        isAffiliate: affUserIds.has(p.user_id),
      });
    }
    setMembers(memberList);
  };

  // Fetch affiliates
  const fetchAffiliates = async () => {
    const { data: affs } = await supabase.from("affiliates").select("*");
    if (!affs) return;

    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);

    const list: AffiliateInfo[] = [];
    for (const a of affs) {
      const { data: coinsData } = await supabase.from("codecoins").select("*").eq("user_id", a.user_id).maybeSingle();
      const { data: refs } = await supabase.from("affiliate_referrals").select("*").eq("affiliate_id", a.id);
      const { data: bankData } = await supabase.from("affiliate_bank_info").select("pix_key_type, pix_key, holder_name").eq("affiliate_id", a.id).maybeSingle();
      const allRefs = refs || [];
      const weeklyConfirmed = allRefs.filter((r) => r.confirmed && new Date(r.created_at) >= monday).length;
      const pending = allRefs.filter((r) => !r.confirmed).length;
      const totalCommission = allRefs.reduce((sum, r) => sum + Number((r as any).commission_amount || 0), 0);

      list.push({
        id: a.id, user_id: a.user_id, affiliate_code: a.affiliate_code,
        display_name: a.display_name, discount_percent: a.discount_percent,
        coins: coinsData || undefined,
        weeklyReferrals: weeklyConfirmed, totalReferrals: allRefs.length, pendingReferrals: pending,
        totalCommission,
        bankInfo: bankData || undefined,
      });
    }
    setAffiliates(list);
  };

  // Fetch invoices
  const fetchInvoices = async () => {
    const { data } = await supabase.from("affiliate_invoices").select("*").order("week_start", { ascending: false });
    if (!data) return;

    // Enrich with affiliate names
    const { data: affs } = await supabase.from("affiliates").select("id, display_name, affiliate_code");
    const affMap = new Map((affs || []).map(a => [a.id, a]));

    const enriched = data.map(inv => ({
      ...inv,
      affiliate_name: affMap.get(inv.affiliate_id)?.display_name || "?",
      affiliate_code: affMap.get(inv.affiliate_id)?.affiliate_code || "?",
    }));
    setInvoices(enriched);
  };

  const fetchExtensions = async () => {
    const { data } = await supabase.from("extension_files").select("*").order("created_at", { ascending: false });
    setExtensions(data || []);
  };

  const fetchNotifications = async () => {
    const { data } = await supabase.from("admin_notifications").select("*").order("created_at", { ascending: false }).limit(50);
    setNotifications(data || []);
  };

  const fetchChatUsers = async () => {
    if (!user) return;
    const { data: msgs } = await supabase
      .from("messages")
      .select("sender_id, receiver_id, is_read")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

    if (!msgs) return;

    const userIds = new Set<string>();
    msgs.forEach((m) => {
      if (m.sender_id !== user.id) userIds.add(m.sender_id);
      if (m.receiver_id !== user.id) userIds.add(m.receiver_id);
    });

    if (userIds.size === 0) { setChatUsers([]); return; }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, name, email")
      .in("user_id", Array.from(userIds));

    const chatList = (profiles || []).map((p) => ({
      ...p,
      unread: msgs.filter((m) => m.sender_id === p.user_id && m.receiver_id === user.id && !m.is_read).length,
    }));
    chatList.sort((a, b) => b.unread - a.unread);
    setChatUsers(chatList);
  };

  const fetchChatMessages = async (otherUserId: string) => {
    if (!user) return;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
      .order("created_at", { ascending: true });
    setChatMessages(data || []);
    await supabase.from("messages").update({ is_read: true })
      .eq("sender_id", otherUserId).eq("receiver_id", user.id).eq("is_read", false);
    fetchChatUsers();
  };

  useEffect(() => {
    if (isAdmin) {
      fetchMembers();
      fetchAffiliates();
      fetchInvoices();
      fetchExtensions();
      fetchNotifications();
      fetchChatUsers();
    }
  }, [isAdmin]);

  // Realtime
  useEffect(() => {
    if (!user || !isAdmin) return;
    const channel = supabase
      .channel("admin-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        fetchChatUsers();
        if (selectedChatUser) fetchChatMessages(selectedChatUser);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "admin_notifications" }, () => {
        fetchNotifications();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, isAdmin, selectedChatUser]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const sendAdminMessage = async () => {
    if (!adminMessage.trim() || !user || !selectedChatUser) return;
    await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: selectedChatUser,
      content: adminMessage.trim(),
    });
    setAdminMessage("");
    fetchChatMessages(selectedChatUser);
  };

  const markNotificationRead = async (id: string) => {
    await supabase.from("admin_notifications").update({ is_read: true }).eq("id", id);
    fetchNotifications();
  };

  // Member actions
  const assignToken = async (userId: string) => {
    const token = tokenInput[userId];
    if (!token) return toast.error("Insira um token.");
    await supabase.from("tokens").update({ is_active: false }).eq("user_id", userId);
    const { error } = await supabase.from("tokens").insert({ user_id: userId, token, is_active: true });
    if (error) return toast.error(error.message);
    toast.success("Token atribuído!");
    setTokenInput((prev) => ({ ...prev, [userId]: "" }));
    fetchMembers();
  };

  const destroyToken = async (userId: string) => {
    if (!confirm("Destruir/revogar TODOS os tokens deste usuário?")) return;
    await supabase.from("tokens").update({ is_active: false }).eq("user_id", userId);
    toast.success("Todos os tokens foram revogados!");
    fetchMembers();
  };

  const assignPlan = async (userId: string) => {
    const planValue = planInput[userId];
    if (!planValue) return toast.error("Selecione um plano.");
    const plan = planOptions.find((p) => p.value === planValue);
    if (!plan) return;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + plan.days);
    const { error } = await supabase.from("subscriptions").insert({
      user_id: userId, plan: plan.value as any, status: "active" as any,
      starts_at: new Date().toISOString(), expires_at: expiresAt.toISOString(),
    });
    if (error) return toast.error(error.message);
    toast.success("Plano atribuído!");
    fetchMembers();
  };

  const cancelSubscription = async (userId: string) => {
    if (!confirm("Cancelar assinatura? O afiliado verá o cancelamento.")) return;
    await supabase.from("subscriptions").update({ status: "cancelled" as any }).eq("user_id", userId).eq("status", "active");
    toast.success("Cancelada!");
    fetchMembers();
  };

  const banUser = async (userId: string) => {
    if (!confirm("Banir usuário? Isso revoga token + cancela plano.")) return;
    await supabase.from("tokens").update({ is_active: false }).eq("user_id", userId);
    await supabase.from("subscriptions").update({ status: "cancelled" as any }).eq("user_id", userId).eq("status", "active");
    toast.success("Banido!");
    fetchMembers();
  };

  // Affiliate actions
  const createAffiliate = async () => {
    if (!newAffUserId || !newAffCode || !newAffName) return toast.error("Preencha todos os campos.");
    await supabase.from("user_roles").insert({ user_id: newAffUserId, role: "affiliate" as any });
    const { error } = await supabase.from("affiliates").insert({
      user_id: newAffUserId, affiliate_code: newAffCode.toUpperCase(), display_name: newAffName,
    });
    if (error) return toast.error(error.message);
    await supabase.from("codecoins").insert({ user_id: newAffUserId });
    toast.success("Afiliado criado!");
    setNewAffUserId(""); setNewAffCode(""); setNewAffName("");
    fetchAffiliates(); fetchMembers();
  };

  const confirmReferral = async (affiliateId: string, affiliateUserId: string, referralId: string) => {
    await supabase.from("affiliate_referrals").update({ confirmed: true }).eq("id", referralId);
    const { data: coins } = await supabase.from("codecoins").select("*").eq("user_id", affiliateUserId).maybeSingle();
    if (coins) {
      await supabase.from("codecoins").update({
        balance: coins.balance + 1, total_earned: coins.total_earned + 1, updated_at: new Date().toISOString(),
      }).eq("user_id", affiliateUserId);
    }
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    await supabase.from("codecoin_transactions").insert({
      user_id: affiliateUserId, amount: 1, type: "earned",
      description: "Indicação confirmada", week_start: monday.toISOString().split("T")[0],
    });
    toast.success("+1 CodeCoin creditado!");
    fetchAffiliates();
  };

  const redeemCoins = async (affiliateUserId: string) => {
    const { data: coins } = await supabase.from("codecoins").select("*").eq("user_id", affiliateUserId).maybeSingle();
    if (!coins || coins.balance < 2) return toast.error("Saldo insuficiente (mínimo 2 coins).");
    await supabase.from("codecoins").update({
      balance: coins.balance - 2, total_spent: coins.total_spent + 2, updated_at: new Date().toISOString(),
    }).eq("user_id", affiliateUserId);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await supabase.from("subscriptions").insert({
      user_id: affiliateUserId, plan: "7_days" as any, status: "active" as any,
      starts_at: new Date().toISOString(), expires_at: expiresAt.toISOString(),
    });
    await supabase.from("codecoin_transactions").insert({
      user_id: affiliateUserId, amount: -2, type: "redeemed", description: "Resgate: 7 dias free",
    });
    toast.success("7 dias ativados!");
    fetchAffiliates();
  };

  // Invoice actions
  const closeInvoice = async (invoiceId: string) => {
    if (!confirm("Fechar esta fatura? Isso indica que o pagamento será feito.")) return;
    await supabase.from("affiliate_invoices").update({ status: "closed" }).eq("id", invoiceId);
    toast.success("Fatura fechada!");
    fetchInvoices();
  };

  const markInvoicePaid = async (invoiceId: string) => {
    const notes = paymentNotes[invoiceId] || "";
    if (!confirm("Marcar como PAGA? Confirme que o PIX foi realizado.")) return;
    await supabase.from("affiliate_invoices").update({
      status: "paid",
      paid_at: new Date().toISOString(),
      paid_by: user?.id,
      payment_notes: notes,
    }).eq("id", invoiceId);
    toast.success("Fatura marcada como paga!");
    setPaymentNotes(prev => ({ ...prev, [invoiceId]: "" }));
    fetchInvoices();
  };

  const cancelInvoice = async (invoiceId: string) => {
    if (!confirm("Cancelar esta fatura? O afiliado verá o cancelamento.")) return;
    await supabase.from("affiliate_invoices").update({ status: "cancelled" }).eq("id", invoiceId);
    toast.success("Fatura cancelada!");
    fetchInvoices();
  };

  // Extension upload
  const uploadExtension = async () => {
    if (!extFile || !extVersion) return toast.error("Selecione arquivo e versão.");
    const path = `extensions/v${extVersion}/${extFile.name}`;
    const { error: upErr } = await supabase.storage.from("extensions").upload(path, extFile);
    if (upErr) return toast.error(upErr.message);
    await supabase.from("extension_files").update({ is_latest: false }).eq("is_latest", true);
    await supabase.from("extension_files").insert({
      file_url: path, version: extVersion, uploaded_by: user!.id, is_latest: true,
      instructions: extInstructions,
    });
    toast.success("Extensão enviada!");
    setExtVersion(""); setExtFile(null); setExtInstructions("");
    fetchExtensions();
  };

  // Worker token actions
  const generateTokenViaWorker = async () => {
    if (!workerEmail) return toast.error("Email obrigatório.");
    setWorkerLoading(true);
    setWorkerResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("admin-token-actions", {
        body: {
          action: "generate",
          email: workerEmail,
          name: workerName || workerEmail.split("@")[0],
          plan: workerPlan,
          user_id: workerUserId || undefined,
        },
      });
      if (error) throw error;
      setWorkerResult(data);
      if (data?.token) {
        toast.success("Token gerado com sucesso!");
        if (workerUserId) fetchMembers();
      }
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "Falha ao gerar token"));
    }
    setWorkerLoading(false);
  };

  const searchTokensByEmail = async () => {
    if (!searchEmail) return toast.error("Email obrigatório.");
    setSearchLoading(true);
    setSearchResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("admin-token-actions", {
        body: { action: "info", email: searchEmail },
      });
      if (error) throw error;
      setSearchResult(data);
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "Falha ao buscar"));
    }
    setSearchLoading(false);
  };

  const unbindDevice = async () => {
    if (!unbindToken) return toast.error("Token obrigatório.");
    if (!confirm("Desbloquear dispositivo deste token?")) return;
    setUnbindLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-token-actions", {
        body: { action: "unbind", token: unbindToken },
      });
      if (error) throw error;
      toast.success("Dispositivo desbloqueado!");
      setUnbindToken("");
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "Falha ao desbloquear"));
    }
    setUnbindLoading(false);
  };

  // Create user via admin
  const createUserAdmin = async () => {
    if (!newUserEmail || !newUserPassword) return toast.error("Email e senha são obrigatórios.");
    if (newUserPassword.length < 6) return toast.error("Senha deve ter pelo menos 6 caracteres.");
    setNewUserLoading(true);
    setNewUserResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: {
          email: newUserEmail,
          name: newUserName || newUserEmail.split("@")[0],
          password: newUserPassword,
          plan: newUserPlan || undefined,
          role: newUserRole,
          generate_token: newUserAutoToken,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setNewUserResult(data);
      toast.success("Usuário criado com sucesso!");
      fetchMembers();
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "Falha ao criar usuário"));
    }
    setNewUserLoading(false);
  };

  const resetCreateUserForm = () => {
    setNewUserEmail("");
    setNewUserName("");
    setNewUserPassword("");
    setNewUserPlan("");
    setNewUserRole("member");
    setNewUserAutoToken(true);
    setNewUserResult(null);
    setShowNewPassword(false);
  };

  if (authLoading || adminLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="ep-subtitle">CARREGANDO...</p>
    </div>;
  }

  const invoiceStatusLabel: Record<string, string> = {
    open: "EM ABERTO", closed: "FECHADA", paid: "PAGA", cancelled: "CANCELADA",
  };
  const invoiceStatusClass: Record<string, string> = {
    open: "ep-badge-live", closed: "bg-yellow-500/20 text-yellow-700", paid: "bg-green-500/20 text-green-700", cancelled: "ep-badge-offline",
  };

  return (
    <AppLayout>
    <div className="min-h-screen bg-background">

      <div className="max-w-6xl mx-auto px-8 py-12 space-y-8">
        <div>
          <p className="ep-subtitle mb-2">PAINEL ADMINISTRATIVO</p>
          <h1 className="ep-section-title">GERENCIAR</h1>
        </div>

        {/* Tab title */}
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold capitalize">{
            { members: "Membros", affiliates: "Afiliados", invoices: "Faturas", "worker-tokens": "Tokens API", extension: "Extensão", notifications: "Notificações", messages: "Mensagens" }[tab]
          }</h2>
        </div>

        {/* Members Tab */}
        {tab === "members" && (
          <div className="space-y-4">
            <button onClick={() => { resetCreateUserForm(); setCreateUserOpen(true); }}
              className="ep-btn-secondary h-10 px-6 text-[9px] flex items-center gap-2">
              <UserPlus className="h-3 w-3" /> CRIAR USUÁRIO
            </button>
            {members.map((m) => (
              <div key={m.user_id} className="ep-card">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground">{m.name || "Sem nome"}</p>
                      {m.isAffiliate && <span className="ep-badge ep-badge-live text-[8px]">AFILIADO</span>}
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">{m.email}</p>
                    {m.subscription && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`ep-badge ${m.subscription.status === "active" && new Date(m.subscription.expires_at) > new Date() ? "ep-badge-live" : "ep-badge-offline"}`}>
                          {planLabels[m.subscription.plan] || m.subscription.plan}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Exp: {format(new Date(m.subscription.expires_at), "dd/MM/yyyy")}
                        </span>
                      </div>
                    )}
                    {m.token && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">Token ativo:</span>
                        <code className="font-mono text-xs bg-muted px-2 py-0.5 rounded-[8px]">
                          {m.token.substring(0, 10)}••••{m.token.substring(m.token.length - 4)}
                        </code>
                        <button onClick={() => { navigator.clipboard.writeText(m.token!); toast.success("Token copiado!"); }}
                          className="ep-btn-icon h-6 w-6 rounded-[6px]">
                          <Copy className="h-2.5 w-2.5" />
                        </button>
                        {m.tokens.length > 1 && (
                          <button onClick={() => setExpandedTokens(expandedTokens === m.user_id ? null : m.user_id)}
                            className="text-[9px] font-bold text-muted-foreground hover:text-foreground transition-colors">
                            {m.tokens.length} TOKENS {expandedTokens === m.user_id ? "▲" : "▼"}
                          </button>
                        )}
                      </div>
                    )}
                    {expandedTokens === m.user_id && m.tokens.length > 0 && (
                      <div className="mt-2 space-y-1.5 pl-4 border-l-2 border-border">
                        {m.tokens.map(t => (
                          <div key={t.id} className="flex items-center gap-2">
                            <span className={`ep-badge text-[7px] ${t.is_active ? "ep-badge-live" : "ep-badge-offline"}`}>
                              {t.is_active ? "ATIVO" : "INATIVO"}
                            </span>
                            <code className="font-mono text-[10px] text-muted-foreground">
                              {t.token.substring(0, 10)}••••{t.token.substring(t.token.length - 4)}
                            </code>
                            <button onClick={() => { navigator.clipboard.writeText(t.token); toast.success("Token copiado!"); }}
                              className="ep-btn-icon h-5 w-5 rounded-[4px]">
                              <Copy className="h-2 w-2" />
                            </button>
                            <span className="text-[9px] text-muted-foreground">
                              {format(new Date(t.created_at), "dd/MM/yy HH:mm")}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <select value={planInput[m.user_id] || ""}
                        onChange={(e) => setPlanInput((prev) => ({ ...prev, [m.user_id]: e.target.value }))}
                        className="ep-input h-10 rounded-[14px] text-xs px-3 bg-muted border border-border">
                        <option value="">Plano...</option>
                        {planOptions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                      </select>
                      <button onClick={() => assignPlan(m.user_id)} className="ep-btn-secondary h-10 px-4 text-[9px]">
                        <UserCheck className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input placeholder="Token..." value={tokenInput[m.user_id] || ""}
                        onChange={(e) => setTokenInput((prev) => ({ ...prev, [m.user_id]: e.target.value }))}
                        className="ep-input h-10 rounded-[14px] text-xs px-3 border border-border flex-1" />
                      <button onClick={() => assignToken(m.user_id)} className="ep-btn-secondary h-10 px-4 text-[9px]">
                        <Key className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {m.token && (
                        <button onClick={() => destroyToken(m.user_id)} className="ep-btn-secondary h-10 px-4 text-[9px] text-destructive border-destructive/30">
                          <Trash2 className="h-3 w-3 mr-1" /> REVOGAR TOKEN
                        </button>
                      )}
                      {m.subscription?.status === "active" && new Date(m.subscription.expires_at) > new Date() && (
                        <button onClick={() => cancelSubscription(m.user_id)} className="ep-btn-secondary h-10 px-4 text-[9px] text-destructive border-destructive/30">
                          <XCircle className="h-3 w-3 mr-1" /> CANCELAR
                        </button>
                      )}
                      <button onClick={() => banUser(m.user_id)} className="ep-btn-secondary h-10 px-4 text-[9px] text-destructive border-destructive/30">
                        <Ban className="h-3 w-3 mr-1" /> BANIR
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {members.length === 0 && (
              <div className="ep-empty">
                <UserX className="h-10 w-10 mx-auto mb-4" />
                <p className="ep-empty-title">NENHUM MEMBRO</p>
              </div>
            )}
          </div>
        )}

        {/* Affiliates Tab */}
        {tab === "affiliates" && (
          <div className="space-y-6">
            <div className="ep-card">
              <p className="ep-subtitle mb-4">CRIAR AFILIADO</p>
              <div className="flex flex-col md:flex-row gap-3">
                <select value={newAffUserId} onChange={(e) => setNewAffUserId(e.target.value)}
                  className="ep-input h-10 rounded-[14px] text-xs px-3 bg-muted border border-border flex-1">
                  <option value="">Selecionar membro...</option>
                  {members.filter((m) => !m.isAffiliate).map((m) => (
                    <option key={m.user_id} value={m.user_id}>{m.name || m.email}</option>
                  ))}
                </select>
                <input placeholder="Código (ex: ABC123)" value={newAffCode}
                  onChange={(e) => setNewAffCode(e.target.value)}
                  className="ep-input h-10 rounded-[14px] text-xs px-3 border border-border" />
                <input placeholder="Nome de exibição" value={newAffName}
                  onChange={(e) => setNewAffName(e.target.value)}
                  className="ep-input h-10 rounded-[14px] text-xs px-3 border border-border" />
                <button onClick={createAffiliate} className="ep-btn-primary h-10 px-6 text-[9px]">CRIAR</button>
              </div>
            </div>

            {affiliates.map((a) => (
              <div key={a.id} className="ep-card">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                  <div className="flex-1">
                    <p className="text-sm font-bold text-foreground">{a.display_name}</p>
                    <p className="text-xs text-muted-foreground font-medium font-mono">Código: {a.affiliate_code}</p>
                    {a.bankInfo ? (
                      <p className="text-xs text-muted-foreground mt-1">
                        PIX: {a.bankInfo.pix_key_type.toUpperCase()} — {a.bankInfo.pix_key} ({a.bankInfo.holder_name})
                      </p>
                    ) : (
                      <p className="text-xs text-yellow-600 mt-1">⚠ Dados bancários não cadastrados</p>
                    )}
                    <div className="flex items-center gap-4 mt-3">
                      <div className="text-center">
                        <p className="text-lg font-bold">{a.coins?.balance || 0}</p>
                        <p className="text-[9px] text-muted-foreground">COINS</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold">{a.totalReferrals}</p>
                        <p className="text-[9px] text-muted-foreground">VENDAS</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-green-600">R${a.totalCommission.toFixed(2)}</p>
                        <p className="text-[9px] text-muted-foreground">COMISSÃO TOTAL</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold">{a.pendingReferrals}</p>
                        <p className="text-[9px] text-muted-foreground">PENDENTES</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {(a.coins?.balance || 0) >= 2 && (
                      <button onClick={() => redeemCoins(a.user_id)} className="ep-btn-primary h-10 px-4 text-[9px]">
                        <Coins className="h-3 w-3 mr-1" /> RESGATAR 2 COINS
                      </button>
                    )}
                    <button onClick={() => {
                      supabase.from("affiliate_referrals").select("*")
                        .eq("affiliate_id", a.id).eq("confirmed", false)
                        .then(({ data: pendingRefs }) => {
                          if (!pendingRefs?.length) return toast.info("Nenhuma pendente.");
                          if (confirm(`Confirmar ${pendingRefs.length} indicação(ões)?`)) {
                            pendingRefs.forEach((r) => confirmReferral(a.id, a.user_id, r.id));
                          }
                        });
                    }} className="ep-btn-secondary h-10 px-4 text-[9px]">
                      <UserCheck className="h-3 w-3 mr-1" /> CONFIRMAR PENDENTES
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {affiliates.length === 0 && (
              <div className="ep-empty">
                <Users className="h-10 w-10 mx-auto mb-4" />
                <p className="ep-subtitle">NENHUM AFILIADO</p>
              </div>
            )}
          </div>
        )}

        {/* Invoices Tab */}
        {tab === "invoices" && (
          <div className="space-y-6">
            <div className="ep-card">
              <p className="ep-subtitle mb-2">FATURAS SEMANAIS DOS AFILIADOS</p>
              <p className="text-xs text-muted-foreground font-medium">
                Comissão de 30% sobre cada venda. Feche a fatura e pague via PIX ao afiliado.
              </p>
            </div>

            {invoices.length === 0 && (
              <div className="ep-empty">
                <FileText className="h-10 w-10 mx-auto mb-4" />
                <p className="ep-subtitle">NENHUMA FATURA</p>
                <p className="text-xs text-muted-foreground mt-2">As faturas são criadas automaticamente quando há vendas via afiliados.</p>
              </div>
            )}

            {invoices.map((inv) => (
              <div key={inv.id} className={`ep-card ${inv.status === "open" ? "border-yellow-500/30" : ""}`}>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold text-foreground">{inv.affiliate_name}</p>
                      <span className="text-xs text-muted-foreground font-mono">({inv.affiliate_code})</span>
                      <span className={`ep-badge text-[8px] ${invoiceStatusClass[inv.status] || "ep-badge-offline"}`}>
                        {invoiceStatusLabel[inv.status] || inv.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">
                      Semana: {inv.week_start} → {inv.week_end}
                    </p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-xs font-medium">{inv.total_sales} venda(s)</span>
                      <span className="text-sm font-bold text-green-600">R${Number(inv.total_commission).toFixed(2)}</span>
                    </div>
                    {inv.paid_at && (
                      <p className="text-xs text-green-600 mt-1">
                        Pago em {format(new Date(inv.paid_at), "dd/MM/yyyy HH:mm")}
                        {inv.payment_notes && ` — ${inv.payment_notes}`}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    {inv.status === "open" && (
                      <button onClick={() => closeInvoice(inv.id)} className="ep-btn-secondary h-10 px-4 text-[9px]">
                        <FileText className="h-3 w-3 mr-1" /> FECHAR FATURA
                      </button>
                    )}
                    {inv.status === "closed" && (
                      <>
                        <input
                          placeholder="Notas do pagamento (opcional)"
                          value={paymentNotes[inv.id] || ""}
                          onChange={(e) => setPaymentNotes(prev => ({ ...prev, [inv.id]: e.target.value }))}
                          className="ep-input h-10 rounded-[14px] text-xs px-3 border border-border"
                        />
                        <button onClick={() => markInvoicePaid(inv.id)} className="ep-btn-primary h-10 px-4 text-[9px]">
                          <CheckCircle className="h-3 w-3 mr-1" /> MARCAR COMO PAGA
                        </button>
                      </>
                    )}
                    {(inv.status === "open" || inv.status === "closed") && (
                      <button onClick={() => cancelInvoice(inv.id)} className="ep-btn-secondary h-10 px-4 text-[9px] text-destructive border-destructive/30">
                        <XCircle className="h-3 w-3 mr-1" /> CANCELAR
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Extension Tab */}
        {tab === "extension" && (
          <div className="space-y-6">
            <div className="ep-card">
              <p className="ep-subtitle mb-4">UPLOAD DA EXTENSÃO</p>
              <div className="space-y-3">
                <div className="flex flex-col md:flex-row gap-3">
                  <input placeholder="Versão (ex: 1.0.3)" value={extVersion}
                    onChange={(e) => setExtVersion(e.target.value)}
                    className="ep-input h-10 rounded-[14px] text-xs px-3 border border-border" />
                  <input type="file" accept=".zip,.crx,.xpi,.txt"
                    onChange={(e) => setExtFile(e.target.files?.[0] || null)}
                    className="ep-input h-10 rounded-[14px] text-xs px-3 border border-border flex-1" />
                </div>
                <textarea
                  placeholder="Instruções de instalação..."
                  value={extInstructions}
                  onChange={(e) => setExtInstructions(e.target.value)}
                  rows={5}
                  className="ep-input w-full rounded-[14px] text-xs px-4 py-3 border border-border resize-none"
                />
                <button onClick={uploadExtension} className="ep-btn-primary h-10 px-6 text-[9px]">
                  <Upload className="h-3 w-3 mr-1" /> ENVIAR EXTENSÃO
                </button>
              </div>
            </div>

            {extensions.map((ext) => (
              <div key={ext.id} className="ep-card">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold text-foreground">v{ext.version}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(ext.created_at), "dd/MM/yyyy HH:mm")}</p>
                  </div>
                  <span className={`ep-badge ${ext.is_latest ? "ep-badge-live" : "ep-badge-offline"}`}>
                    {ext.is_latest ? "ATUAL" : "ANTIGA"}
                  </span>
                </div>
                {ext.instructions && (
                  <div className="bg-muted rounded-[12px] p-4 mt-2">
                    <p className="ep-subtitle text-[9px] mb-2">INSTRUÇÕES</p>
                    <pre className="text-xs text-muted-foreground font-medium whitespace-pre-wrap">{ext.instructions}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Notifications Tab */}
        {tab === "notifications" && (
          <div className="space-y-4">
            {notifications.length === 0 && (
              <div className="ep-empty">
                <Bell className="h-10 w-10 mx-auto mb-4" />
                <p className="ep-subtitle">NENHUMA NOTIFICAÇÃO</p>
              </div>
            )}
            {notifications.map((n) => (
              <div key={n.id} className={`ep-card flex items-start justify-between gap-4 ${!n.is_read ? "border-foreground/20" : ""}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {!n.is_read && <span className="h-2 w-2 rounded-full bg-foreground shrink-0" />}
                    <p className="text-sm font-bold text-foreground">{n.title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">{n.description}</p>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    {format(new Date(n.created_at), "dd/MM/yyyy HH:mm")}
                  </p>
                </div>
                {!n.is_read && (
                  <button onClick={() => markNotificationRead(n.id)} className="ep-btn-secondary h-8 px-3 text-[8px]">
                    MARCAR LIDA
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Messages Tab */}
        {tab === "messages" && (
          <div className="flex gap-6 min-h-[500px]">
            <div className="w-64 shrink-0 space-y-2">
              <p className="ep-subtitle mb-3">CONVERSAS</p>
              {chatUsers.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhuma conversa.</p>
              )}
              {chatUsers.map((cu) => (
                <button
                  key={cu.user_id}
                  onClick={() => { setSelectedChatUser(cu.user_id); fetchChatMessages(cu.user_id); }}
                  className={`w-full text-left ep-card-sm flex items-center justify-between ${
                    selectedChatUser === cu.user_id ? "border-foreground/30" : ""
                  }`}
                >
                  <div>
                    <p className="text-xs font-bold text-foreground">{cu.name || cu.email}</p>
                    <p className="text-[10px] text-muted-foreground">{cu.email}</p>
                  </div>
                  {cu.unread > 0 && (
                    <span className="h-5 w-5 rounded-full bg-foreground text-background text-[9px] flex items-center justify-center font-bold">
                      {cu.unread}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex-1 ep-card flex flex-col">
              {!selectedChatUser ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">Selecione uma conversa</p>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 max-h-[400px]">
                    {chatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender_id === user?.id ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[75%] px-3 py-2 rounded-[12px] text-xs ${
                            msg.sender_id === user?.id
                              ? "bg-foreground text-background"
                              : "bg-muted text-foreground"
                          }`}
                        >
                          <p className="font-medium">{msg.content}</p>
                          <p className={`text-[9px] mt-1 ${
                            msg.sender_id === user?.id ? "text-background/60" : "text-muted-foreground"
                          }`}>
                            {format(new Date(msg.created_at), "HH:mm dd/MM")}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="px-4 py-3 border-t border-border flex items-center gap-2">
                    <input
                      value={adminMessage}
                      onChange={(e) => setAdminMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendAdminMessage()}
                      placeholder="Responder..."
                      className="ep-input h-10 rounded-[12px] text-xs px-3 border border-border flex-1"
                    />
                    <button
                      onClick={sendAdminMessage}
                      disabled={!adminMessage.trim()}
                      className="ep-btn-primary h-10 w-10 rounded-[12px] flex items-center justify-center"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Worker Tokens Tab */}
        {tab === "worker-tokens" && (
          <div className="space-y-6">
            {/* Generate Token */}
            <div className="ep-card">
              <p className="ep-subtitle mb-4">GERAR TOKEN VIA API (WORKER)</p>
              <p className="text-xs text-muted-foreground font-medium mb-4">
                Gera um token de ativação diretamente no Worker externo. Opcionalmente vincula ao usuário no banco.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <input placeholder="Email do cliente *" value={workerEmail}
                  onChange={(e) => setWorkerEmail(e.target.value)}
                  className="ep-input h-10 rounded-[14px] text-xs px-3 border border-border" />
                <input placeholder="Nome (opcional)" value={workerName}
                  onChange={(e) => setWorkerName(e.target.value)}
                  className="ep-input h-10 rounded-[14px] text-xs px-3 border border-border" />
                <select value={workerPlan} onChange={(e) => setWorkerPlan(e.target.value)}
                  className="ep-input h-10 rounded-[14px] text-xs px-3 bg-muted border border-border">
                  <option value="test_5h">Teste 5h</option>
                  <option value="test_1d">Teste 1 dia</option>
                  <option value="days_15">15 Dias</option>
                  <option value="days_30">30 Dias</option>
                  <option value="days_90">90 Dias</option>
                </select>
                <select value={workerUserId} onChange={(e) => setWorkerUserId(e.target.value)}
                  className="ep-input h-10 rounded-[14px] text-xs px-3 bg-muted border border-border">
                  <option value="">Vincular ao usuário (opcional)</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>{m.name || m.email}</option>
                  ))}
                </select>
              </div>
              <button onClick={generateTokenViaWorker} disabled={workerLoading}
                className="ep-btn-primary h-10 px-6 text-[9px]">
                {workerLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Zap className="h-3 w-3 mr-1" />}
                GERAR TOKEN
              </button>
              {workerResult?.token && (
                <div className="mt-4 ep-card-sm border-green-500/30">
                  <p className="text-xs font-bold text-green-600 mb-1">Token gerado!</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0 bg-muted px-3 py-2 rounded-[8px]">
                      <code className="font-mono text-xs text-muted-foreground">
                        {workerResult.token.substring(0, 12)}••••••••{workerResult.token.substring(workerResult.token.length - 6)}
                      </code>
                    </div>
                    <button onClick={() => { navigator.clipboard.writeText(workerResult.token); toast.success("Copiado!"); }}
                      className="ep-btn-secondary h-8 px-3 text-[8px] flex items-center gap-1 shrink-0">
                      <Copy className="h-3 w-3" /> COPIAR
                    </button>
                  </div>
                  {workerResult.expires && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Expira: {new Date(workerResult.expires * 1000).toLocaleString("pt-BR")}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Search Tokens by Email */}
            <div className="ep-card">
              <p className="ep-subtitle mb-4">BUSCAR TOKENS POR EMAIL</p>
              <div className="flex items-center gap-3 mb-4">
                <input placeholder="Email do cliente" value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchTokensByEmail()}
                  className="ep-input h-10 rounded-[14px] text-xs px-3 border border-border flex-1" />
                <button onClick={searchTokensByEmail} disabled={searchLoading}
                  className="ep-btn-secondary h-10 px-4 text-[9px]">
                  {searchLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                </button>
              </div>
              {searchResult && (
                <div className="space-y-2">
                  {Array.isArray(searchResult) ? searchResult.map((item: any, i: number) => (
                    <div key={i} className="ep-card-sm">
                      <code className="font-mono text-xs text-muted-foreground break-all">{JSON.stringify(item, null, 2)}</code>
                    </div>
                  )) : (
                    <div className="ep-card-sm">
                      <pre className="font-mono text-xs text-muted-foreground whitespace-pre-wrap">{JSON.stringify(searchResult, null, 2)}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Unbind Device */}
            <div className="ep-card">
              <p className="ep-subtitle mb-4">DESBLOQUEAR DISPOSITIVO</p>
              <p className="text-xs text-muted-foreground font-medium mb-4">
                Remove o vínculo de dispositivo de um token, permitindo que seja usado em outro navegador/máquina.
              </p>
              <div className="flex items-center gap-3">
                <input placeholder="Token do cliente (CLF1.eyJ...)" value={unbindToken}
                  onChange={(e) => setUnbindToken(e.target.value)}
                  className="ep-input h-10 rounded-[14px] text-xs px-3 border border-border flex-1" />
                <button onClick={unbindDevice} disabled={unbindLoading}
                  className="ep-btn-secondary h-10 px-4 text-[9px]">
                  {unbindLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlock className="h-3 w-3 mr-1" />}
                  DESBLOQUEAR
                </button>
              </div>
            </div>

            {/* Token Stats */}
            <div className="ep-card">
              <p className="ep-subtitle mb-4">ESTATÍSTICAS DE TOKENS</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">{members.filter(m => m.token).length}</p>
                  <p className="text-[9px] text-muted-foreground">COM TOKEN</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{members.filter(m => m.subscription?.status === "active" && new Date(m.subscription.expires_at) > new Date()).length}</p>
                  <p className="text-[9px] text-muted-foreground">ATIVOS</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{members.filter(m => m.subscription && (m.subscription.status !== "active" || new Date(m.subscription.expires_at) <= new Date())).length}</p>
                  <p className="text-[9px] text-muted-foreground">EXPIRADOS</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Free Links Tab removed */}
      </div>

      {/* Create User Sheet */}
      <Sheet open={createUserOpen} onOpenChange={setCreateUserOpen}>
        <SheetContent>
          <SheetHeader>
            <div className="h-16 w-16 rounded-[24px] bg-foreground flex items-center justify-center mb-8">
              <UserPlus className="h-7 w-7 text-background" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.6em] text-muted-foreground">Protocol Start</p>
            <SheetTitle>CRIAR USUÁRIO</SheetTitle>
            <SheetDescription>Crie uma conta com plano e token opcionais vinculados ao sistema.</SheetDescription>
          </SheetHeader>

          <div className="p-12 lg:p-16 space-y-10 flex-1">
            <div className="relative group/input">
              <label className="ep-sheet-label">EMAIL *</label>
              <div className="relative">
                <span className="absolute left-8 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground/40 group-focus-within/input:text-foreground transition-colors">@</span>
                <input type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="usuario@email.com" className="ep-sheet-input w-full" />
                <div className="absolute inset-x-12 -bottom-3 h-1 bg-foreground scale-x-0 group-focus-within/input:scale-x-100 transition-transform duration-700 rounded-sm" />
              </div>
            </div>

            <div className="relative group/input">
              <label className="ep-sheet-label">NOME</label>
              <div className="relative">
                <Users className="absolute left-8 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground/40 group-focus-within/input:text-foreground transition-colors" />
                <input value={newUserName} onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Nome do usuário" className="ep-sheet-input w-full" />
              </div>
            </div>

            <div className="relative group/input">
              <label className="ep-sheet-label">SENHA *</label>
              <div className="relative">
                <Key className="absolute left-8 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground/40 group-focus-within/input:text-foreground transition-colors" />
                <input type={showNewPassword ? "text" : "password"} value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)} placeholder="Mínimo 6 caracteres"
                  className="ep-sheet-input w-full" />
                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-8 top-1/2 -translate-y-1/2 h-10 w-10 rounded-[12px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                  {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="relative group/input">
              <label className="ep-sheet-label">PLANO</label>
              <select value={newUserPlan} onChange={(e) => setNewUserPlan(e.target.value)}
                className="ep-sheet-input w-full pl-8 appearance-none cursor-pointer">
                <option value="">Sem plano</option>
                {planOptions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>

            <div className="relative group/input">
              <label className="ep-sheet-label">PAPEL</label>
              <select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value)}
                className="ep-sheet-input w-full pl-8 appearance-none cursor-pointer">
                <option value="member">Membro</option>
                <option value="admin">Admin</option>
                <option value="affiliate">Afiliado</option>
              </select>
            </div>

            <div className="flex items-center gap-4 p-6 rounded-[24px] border border-border">
              <button type="button" onClick={() => setNewUserAutoToken(!newUserAutoToken)}
                className={`h-8 w-14 rounded-[10px] transition-colors duration-300 ${newUserAutoToken ? "bg-foreground" : "bg-muted border border-border"}`}>
                <div className={`h-6 w-6 rounded-[8px] bg-background transition-transform mx-1 ${newUserAutoToken ? "translate-x-6" : "translate-x-0"}`} />
              </button>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Gerar token automaticamente</span>
            </div>

            <button onClick={createUserAdmin} disabled={newUserLoading}
              className="ep-sheet-btn group">
              {newUserLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
              {newUserLoading ? "DEPLOYING NODE..." : "AUTHORIZE ACTIVATION"}
              {!newUserLoading && <span className="group-hover:translate-x-3 transition-transform">→</span>}
            </button>

            {newUserResult && (
              <div className="rounded-[32px] border border-border p-8 space-y-3">
                <p className="text-[10px] font-black uppercase tracking-[0.5em] text-foreground">✓ NODE DEPLOYED</p>
                <p className="text-sm font-medium text-muted-foreground">Email: {newUserResult.email}</p>
                <p className="text-sm font-medium text-muted-foreground">Papel: {newUserResult.role}</p>
                {newUserResult.plan && <p className="text-sm font-medium text-muted-foreground">Plano: {planLabels[newUserResult.plan] || newUserResult.plan}</p>}
                {newUserResult.token && (
                  <div className="mt-4">
                    <p className="ep-sheet-label mb-2">TOKEN</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0 bg-muted px-6 py-4 rounded-[16px]">
                        <code className="font-mono text-sm text-muted-foreground">
                          {newUserResult.token.substring(0, 12)}••••••••{newUserResult.token.substring(newUserResult.token.length - 6)}
                        </code>
                      </div>
                      <button onClick={() => { navigator.clipboard.writeText(newUserResult.token); toast.success("Token copiado!"); }}
                        className="h-14 w-14 rounded-[20px] border border-border flex items-center justify-center text-muted-foreground hover:bg-foreground hover:text-background hover:border-foreground transition-all duration-300">
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
                {newUserResult.token_error && <p className="text-sm text-destructive font-medium">{newUserResult.token_error}</p>}
              </div>
            )}

            <p className="ep-sheet-footer">CODELOVE AI CORE SYSTEM v4.2</p>
          </div>
        </SheetContent>
      </Sheet>
    </div>
    </AppLayout>
  );
}
