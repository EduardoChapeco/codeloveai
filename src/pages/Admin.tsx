import { useEffect, useState, useRef, useCallback, lazy, Suspense } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";
import { useSEO } from "@/hooks/useSEO";
import { LogOut, Key, UserCheck, UserX, Ban, XCircle, Users, Coins, Upload, RefreshCw, Bell, MessageSquare, Send, Gift, Copy, Link as LinkIcon, Trash2, DollarSign, FileText, CheckCircle, Search, Unlock, Zap, Loader2, UserPlus, Eye, EyeOff, Puzzle, Download, ChevronRight, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import AppLayout from "@/components/AppLayout";
import MemberDetailPanel from "@/components/admin/MemberDetailPanel";

interface MemberLicense {
  id: string;
  key: string;
  active: boolean;
  plan: string;
  plan_type: string;
  type: string;
  status: string;
  expires_at: string | null;
  daily_messages: number | null;
  hourly_limit: number | null;
  messages_used_today: number;
  device_id: string | null;
  created_at: string;
}

interface Member {
  user_id: string;
  name: string;
  email: string;
  license?: MemberLicense;
  licenses: MemberLicense[];
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

interface AdminNotification {
  id: string;
  type: string;
  title: string;
  description: string;
  user_id: string | null;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
}

interface TenantExtension {
  id: string;
  tenant_id: string;
  file_url: string;
  version: string;
  instructions: string;
  is_latest: boolean;
  is_enabled?: boolean;
  activation_cost?: number;
  created_at: string;
  uploaded_by?: string;
}

interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  category: string;
  created_at: string;
  updated_at: string;
  user_email?: string;
  user_name?: string;
}

interface TicketReply {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
}

const planOptions = [
  { value: "daily_token", label: "Token Diário (24h)", days: 1 },
  { value: "messages", label: "Mensal (Mensagens)", days: 30 },
  { value: "hourly", label: "Por Hora", days: 30 },
];

const planLabels: Record<string, string> = {
  "daily_token": "Token Diário", "messages": "Mensal", "hourly": "Por Hora",
  "trial": "Trial", "custom": "Custom", "monthly": "Mensal",
};

interface NewUserResult {
  email: string;
  role: string;
  plan?: string;
  token?: string;
  token_error?: string;
  error?: string;
}

interface WorkerResult {
  token?: string;
  user_id?: string;
  email?: string;
  plan?: string;
  error?: string;
  expires?: number;
}

const LazyTenantAdmin = lazy(() => import("./TenantAdmin"));

type Tab = "members" | "affiliates" | "invoices" | "extension" | "notifications" | "messages" | "worker-tokens" | "support" | "tenant";

export default function Admin() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { isTenantAdmin } = useTenant();
  useSEO({ title: "Admin" });
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [extensions, setExtensions] = useState<TenantExtension[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  // freeLinks removed
  const [paymentNotes, setPaymentNotes] = useState<Record<string, string>>({});

  // Worker token management
  const [workerEmail, setWorkerEmail] = useState("");
  const [workerName, setWorkerName] = useState("");
  const [workerPlan, setWorkerPlan] = useState("days_30");
  const [workerUserId, setWorkerUserId] = useState("");
  const [workerLoading, setWorkerLoading] = useState(false);
  const [workerResult, setWorkerResult] = useState<WorkerResult | null>(null);
  const [searchEmail, setSearchEmail] = useState("");
  const [searchResult, setSearchResult] = useState<unknown>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [unbindToken, setUnbindToken] = useState("");
  const [unbindLoading, setUnbindLoading] = useState(false);
  const [expandedTokens, setExpandedTokens] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // Chat state
  const [chatUsers, setChatUsers] = useState<{ user_id: string; name: string; email: string; unread: number }[]>([]);
  const [selectedChatUser, setSelectedChatUser] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<{ id: string; sender_id: string; content: string; created_at: string }[]>([]);
  const [adminMessage, setAdminMessage] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Support state
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketReplies, setTicketReplies] = useState<TicketReply[]>([]);
  const [replyMessage, setReplyMessage] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  // Create user sheet state
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserPlan, setNewUserPlan] = useState("");
  const [newUserRole, setNewUserRole] = useState("member");
  const [newUserAutoToken, setNewUserAutoToken] = useState(true);
  const [newUserLoading, setNewUserLoading] = useState(false);
  const [newUserResult, setNewUserResult] = useState<NewUserResult | null>(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [dbPlans, setDbPlans] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    supabase.from("plans").select("id, name").eq("is_active", true).order("display_order", { ascending: true })
      .then(({ data }) => setDbPlans(data || []));
  }, []);

  const hasAdminAccess = isAdmin || isTenantAdmin;

  useEffect(() => {
    if (!authLoading && !adminLoading) {
      if (!user) navigate("/login");
      else if (!hasAdminAccess) navigate("/home");
      else if (isAdmin) {
        fetchTickets();
      }
      // Tenant-only admins default to tenant tab
      if (!isAdmin && isTenantAdmin && tab !== "tenant") {
        setSearchParams({ tab: "tenant" });
      }
    }
  }, [user, isAdmin, isTenantAdmin, hasAdminAccess, authLoading, adminLoading, navigate]);

  const fetchTickets = useCallback(async () => {
    const { data: tks, error } = await (supabase as any)
      .from("support_tickets")
      .select(`
        *,
        profiles:user_id (email, name)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar tickets");
      return;
    }

    const formatted = (tks || []).map((t: any) => ({
      ...t,
      user_email: t.profiles?.email,
      user_name: t.profiles?.name,
    }));
    setTickets(formatted);
  }, []);

  const fetchTicketReplies = async (ticketId: string) => {
    const { data, error } = await (supabase as any)
      .from("ticket_replies")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    
    if (!error) setTicketReplies((data as TicketReply[]) || []);
  };

  const sendTicketReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) return;
    setReplyLoading(true);
    const { error } = await (supabase as any).from("ticket_replies").insert({
      ticket_id: selectedTicket.id,
      user_id: user!.id,
      message: replyMessage,
      is_admin: true
    });

    if (error) {
      toast.error("Erro ao enviar resposta");
    } else {
      toast.success("Resposta enviada!");
      setReplyMessage("");
      fetchTicketReplies(selectedTicket.id);
    }
    setReplyLoading(false);
  };

  const updateTicketStatus = async (ticketId: string, status: SupportTicket["status"]) => {
    setStatusLoading(true);
    const { error } = await (supabase as any)
      .from("support_tickets")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", ticketId);

    if (error) {
      toast.error("Erro ao atualizar status");
    } else {
      toast.success(`Status atualizado para ${status}`);
      fetchTickets();
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(prev => prev ? { ...prev, status } : null);
      }
    }
    setStatusLoading(false);
  };

  // Fetch members
  const fetchMembers = useCallback(async () => {
    const { data: profiles } = await supabase.from("profiles").select("*");
    if (!profiles) return;

    const { data: allAffiliates } = await supabase.from("affiliates").select("user_id");
    const affUserIds = new Set((allAffiliates || []).map((a) => a.user_id));

    // Buscar todas as licenças de uma vez (v2)
    const { data: allLicenses } = await supabase.from("licenses")
      .select("id, key, active, plan, plan_type, type, status, expires_at, daily_messages, hourly_limit, messages_used_today, device_id, user_id, created_at")
      .order("created_at", { ascending: false });

    const licensesByUser = new Map<string, MemberLicense[]>();
    for (const lic of (allLicenses || [])) {
      const uid = lic.user_id;
      if (!licensesByUser.has(uid)) licensesByUser.set(uid, []);
      licensesByUser.get(uid)!.push({
        id: lic.id, key: lic.key, active: lic.active, plan: lic.plan,
        plan_type: lic.plan_type, type: lic.type, status: lic.status,
        expires_at: lic.expires_at, daily_messages: lic.daily_messages,
        hourly_limit: lic.hourly_limit, messages_used_today: lic.messages_used_today || 0,
        device_id: lic.device_id, created_at: lic.created_at,
      });
    }

    const memberList: Member[] = profiles.map(p => {
      const userLicenses = licensesByUser.get(p.user_id) || [];
      const activeLicense = userLicenses.find(l => l.active && l.status === 'active');
      return {
        user_id: p.user_id, name: p.name, email: p.email,
        license: activeLicense,
        licenses: userLicenses,
        isAffiliate: affUserIds.has(p.user_id),
      };
    });
    setMembers(memberList);
  }, []);

  // Fetch affiliates
  const fetchAffiliates = useCallback(async () => {
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
      const totalCommission = allRefs.reduce((sum, r) => sum + Number((r as { commission_amount?: number }).commission_amount || 0), 0);

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
  }, []);

  // Fetch invoices
  const fetchInvoices = useCallback(async () => {
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
  }, []);

  const fetchExtensions = useCallback(async () => {
    const { data } = await supabase.from("extension_files").select("*").order("created_at", { ascending: false });
    setExtensions((data as TenantExtension[]) || []);
  }, []);

  const fetchNotifications = useCallback(async () => {
    const { data } = await supabase.from("admin_notifications").select("*").order("created_at", { ascending: false }).limit(50);
    setNotifications(data || []);
  }, []);

  const fetchChatUsers = useCallback(async () => {
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
  }, [user]);

  const fetchChatMessages = useCallback(async (otherUserId: string) => {
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
  }, [user, fetchChatUsers]);

  useEffect(() => {
    if (isAdmin) {
      fetchMembers();
      fetchAffiliates();
      fetchInvoices();
      fetchExtensions();
      fetchNotifications();
      fetchChatUsers();
    }
  }, [isAdmin, fetchMembers, fetchAffiliates, fetchInvoices, fetchExtensions, fetchNotifications, fetchChatUsers]);

  useEffect(() => {
    if (user && isAdmin && selectedChatUser) {
      fetchChatMessages(selectedChatUser);
      // Mark as read
      supabase.from("messages").update({ is_read: true })
        .eq("sender_id", selectedChatUser).eq("receiver_id", user.id)
        .then(() => fetchChatUsers());
    }
  }, [user, isAdmin, selectedChatUser, fetchChatMessages, fetchChatUsers]);

  // Realtime
  useEffect(() => {
    if (!user || !isAdmin) return;
    const channel = supabase
      .channel("admin-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        fetchChatUsers();
        if (selectedChatUser) fetchChatMessages(selectedChatUser);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "admin_notifications" }, (payload: any) => {
        fetchNotifications();
        const n = payload?.new;
        if (n?.title) {
          toast.info(n.title, { description: n.description?.slice(0, 120), duration: 8000 });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, isAdmin, selectedChatUser, fetchChatUsers, fetchChatMessages, fetchNotifications]);

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

  // Member actions — v2 uses "licenses" table
  const assignLicenseKey = async (userId: string) => {
    const key = tokenInput[userId];
    if (!key) return toast.error("Insira uma chave de licença.");
    // Desativar licenças anteriores
    await supabase.from("licenses").update({ active: false, status: "expired" }).eq("user_id", userId).eq("active", true);
    const { error } = await supabase.from("licenses").insert([{
      user_id: userId, key, active: true, status: "active",
      plan: "days_30", plan_type: "messages", type: "daily_token",
      expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    }]);
    if (error) return toast.error(error.message);
    toast.success("Licença atribuída!");
    setTokenInput((prev) => ({ ...prev, [userId]: "" }));
    fetchMembers();
  };

  const revokeLicenses = async (userId: string) => {
    if (!confirm("Revogar TODAS as licenças deste usuário?")) return;
    await supabase.from("licenses").update({ active: false, status: "suspended" }).eq("user_id", userId);
    toast.success("Todas as licenças foram revogadas!");
    fetchMembers();
  };

  const resetDailyUsage = async (userId: string) => {
    const member = members.find(m => m.user_id === userId);
    if (!member?.license) return toast.error("Usuário sem licença ativa.");
    await supabase.from("licenses").update({ messages_used_today: 0 }).eq("id", member.license.id);
    const today = new Date().toISOString().split('T')[0];
    await supabase.from("daily_usage").delete().eq("license_id", member.license.id).eq("date", today);
    toast.success("Uso diário resetado!");
    fetchMembers();
  };

  const unlockDevice = async (userId: string) => {
    const member = members.find(m => m.user_id === userId);
    if (!member?.license) return toast.error("Usuário sem licença ativa.");
    if (!confirm("Desbloquear dispositivo? O usuário poderá vincular um novo.")) return;
    await supabase.from("licenses").update({ device_id: null }).eq("id", member.license.id);
    toast.success("Dispositivo desbloqueado!");
    fetchMembers();
  };

  const assignPlan = async (userId: string) => {
    const planValue = planInput[userId];
    if (!planValue) return toast.error("Selecione um plano.");
    const plan = planOptions.find((p) => p.value === planValue);
    if (!plan) return;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + plan.days);
    // Atualizar licença ativa existente ou criar nova
    const member = members.find(m => m.user_id === userId);
    if (member?.license) {
      const { error } = await supabase.from("licenses").update({
        plan_type: plan.value, type: plan.value,
        expires_at: expiresAt.toISOString(), status: "active", active: true,
        messages_used_today: 0,
      }).eq("id", member.license.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("licenses").insert({
        user_id: userId, plan_type: plan.value, type: plan.value,
        plan: plan.label, status: "active", active: true,
        key: `CLF1.ADMIN.${Date.now()}`,
        expires_at: expiresAt.toISOString(),
      });
      if (error) return toast.error(error.message);
    }
    toast.success("Plano atribuído!");
    fetchMembers();
  };

  const suspendLicense = async (userId: string) => {
    if (!confirm("Suspender licença? O usuário perderá o acesso.")) return;
    await supabase.from("licenses").update({ status: "suspended", active: false }).eq("user_id", userId).eq("active", true);
    toast.success("Licença suspensa!");
    fetchMembers();
  };

  const banUser = async (userId: string) => {
    if (!confirm("Banir usuário? Isso revoga todas as licenças.")) return;
    await supabase.from("licenses").update({ active: false, status: "suspended" }).eq("user_id", userId);
    toast.success("Banido!");
    fetchMembers();
  };

  // Affiliate actions
  const createAffiliate = async () => {
    if (!newAffUserId || !newAffCode || !newAffName) return toast.error("Preencha todos os campos.");
    await supabase.from("user_roles").insert({ user_id: newAffUserId, role: "affiliate" });
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
    // Criar uma licença v2 de 7 dias
    await supabase.from("licenses").insert({
      user_id: affiliateUserId, plan: "7_days_coin_redeem", plan_type: "daily_token",
      type: "daily_token", status: "active", active: true,
      key: `CLF1.REDEEM.${Date.now()}`,
      expires_at: expiresAt.toISOString(),
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
    } catch (err) {
      toast.error("Erro: " + (err instanceof Error ? err.message : "Falha ao gerar token"));
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
    } catch (err) {
      toast.error("Erro: " + (err instanceof Error ? err.message : "Falha ao buscar"));
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
    } catch (err) {
      toast.error("Erro: " + (err instanceof Error ? err.message : "Falha ao desbloquear"));
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
    } catch (err) {
      toast.error("Erro: " + (err instanceof Error ? err.message : "Falha ao criar usuário"));
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
    open: "lv-badge-success animate-pulse", closed: "lv-badge-muted opacity-50", paid: "lv-badge-success", cancelled: "lv-badge-destructive opacity-50",
  };

  return (
    <AppLayout>
    <div className="min-h-screen bg-background">

      <div className="max-w-6xl mx-auto px-8 py-12 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="lv-overline mb-2">PAINEL ADMINISTRATIVO</p>
            <h1 className="lv-heading-lg">Gerenciar</h1>
          </div>
          
          {/* Tab navigation moved to sidebar */}
        </div>

        {/* Tab Subtitle */}
        <div className="flex items-center justify-between">
          <p className="lv-label">
            Exibindo: <span className="text-foreground">{
              { 
                members: "Gestão de Membros e Licenças", 
                affiliates: "Programa de Afiliados", 
                invoices: "Faturamento Semanal", 
                "worker-tokens": "Gerador de Tokens Externo", 
                extension: "Distribuição da Extensão", 
                notifications: "Notificações do Sistema", 
                messages: "Atendimento ao Cliente",
                support: "Gestão de Tickets",
                tenant: "Operação do Tenant",
              }[tab]
            }</span>
          </p>
          
          {tab === "members" && (
            <button onClick={() => { resetCreateUserForm(); setCreateUserOpen(true); }}
              className="lv-btn-primary h-9 px-5 text-[10px] font-black tracking-widest flex items-center gap-2">
              <UserPlus className="h-3 w-3" /> NOVO USUÁRIO
            </button>
          )}
        </div>

        {/* Members Tab */}
        {tab === "members" && (
          <div className="space-y-4">
            {selectedMemberId ? (
              <MemberDetailPanel
                userId={selectedMemberId}
                currentAdminId={user!.id}
                onBack={() => setSelectedMemberId(null)}
              />
            ) : (
              <>
                {/* Search */}
                <div className="clf-liquid-glass p-4">
                  <input
                    placeholder="Buscar por nome ou email..."
                    className="lv-input"
                    onChange={(e) => {
                      const q = e.target.value.toLowerCase();
                      // Simple client-side filter via CSS visibility
                      document.querySelectorAll("[data-member-card]").forEach((el) => {
                        const text = el.getAttribute("data-member-search") || "";
                        (el as HTMLElement).style.display = text.includes(q) ? "" : "none";
                      });
                    }}
                  />
                </div>

                {members.map((m) => (
                  <div
                    key={m.user_id}
                    data-member-card
                    data-member-search={`${m.name?.toLowerCase() || ""} ${m.email?.toLowerCase() || ""}`}
                    onClick={() => setSelectedMemberId(m.user_id)}
                    className="clf-liquid-glass rounded-[20px] p-5 cursor-pointer hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-sm group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        {(m.name?.[0] || m.email?.[0] || "?").toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold truncate">{m.name || "Sem nome"}</p>
                          {m.isAffiliate && <span className="lv-badge lv-badge-primary text-[8px]">AFILIADO</span>}
                        </div>
                        <p className="lv-caption font-mono text-[11px] truncate">{m.email}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {m.license ? (
                          <span className={`lv-badge text-[9px] ${m.license.active && m.license.status === "active" ? "lv-badge-success" : "lv-badge-destructive"}`}>
                            {m.license.plan} — {m.license.status}
                          </span>
                        ) : (
                          <span className="lv-badge lv-badge-muted text-[9px]">SEM LICENÇA</span>
                        )}
                        {m.license?.daily_messages && (
                          <span className="text-[10px] text-muted-foreground">
                            {m.license.messages_used_today}/{m.license.daily_messages}
                          </span>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </div>
                ))}
                {members.length === 0 && (
                  <div className="lv-empty">
                    <UserX className="h-12 w-12 opacity-20 mb-2" />
                    <p className="lv-overline">NENHUM MEMBRO ENCONTRADO</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Affiliates Tab */}
        {tab === "affiliates" && (
          <div className="space-y-6">
            <div className="clf-liquid-glass p-6">
              <p className="lv-overline mb-4">CRIAR NOVO AFILIADO</p>
              <div className="flex flex-col md:flex-row gap-3">
                <select value={newAffUserId} onChange={(e) => setNewAffUserId(e.target.value)}
                  className="lv-input h-10 rounded-xl text-xs px-4 flex-1">
                  <option value="">Selecionar membro...</option>
                  {members.filter((m) => !m.isAffiliate).map((m) => (
                    <option key={m.user_id} value={m.user_id}>{m.name || m.email}</option>
                  ))}
                </select>
                <input placeholder="Código (ex: ABC123)" value={newAffCode}
                  onChange={(e) => setNewAffCode(e.target.value)}
                  className="lv-input h-10 rounded-xl text-xs px-4 w-40" />
                <input placeholder="Nome de exibição" value={newAffName}
                  onChange={(e) => setNewAffName(e.target.value)}
                  className="lv-input h-10 rounded-xl text-xs px-4 flex-1" />
                <button onClick={createAffiliate} className="lv-btn-primary h-10 px-6 text-[10px] font-black tracking-widest">
                  CRIAR AFILIADO
                </button>
              </div>
            </div>

            {affiliates.map((a) => (
              <div key={a.id} className="clf-liquid-glass p-8">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8">
                  <div className="flex-1 space-y-4">
                    <div>
                      <p className="lv-body-strong text-lg">{a.display_name}</p>
                      <p className="lv-caption font-mono uppercase tracking-widest opacity-60">Código: {a.affiliate_code}</p>
                    </div>

                    {a.bankInfo ? (
                      <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 flex items-center gap-3">
                        <DollarSign className="h-4 w-4 text-primary" />
                        <p className="text-[11px] font-bold text-primary italic">
                          PIX: {a.bankInfo.pix_key_type.toUpperCase()} • {a.bankInfo.pix_key} • {a.bankInfo.holder_name}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-destructive/5 border border-destructive/10 rounded-xl p-3 flex items-center gap-3">
                        <Ban className="h-4 w-4 text-destructive" />
                        <p className="lv-caption text-destructive font-bold uppercase">Dados bancários não cadastrados</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-muted/40 p-4 rounded-2xl border border-border/50">
                        <p className="lv-stat text-2xl">{a.coins?.balance || 0}</p>
                        <p className="lv-overline opacity-60">COINS</p>
                      </div>
                      <div className="bg-muted/40 p-4 rounded-2xl border border-border/50">
                        <p className="lv-stat text-2xl">{a.totalReferrals}</p>
                        <p className="lv-overline opacity-60">VENDAS</p>
                      </div>
                      <div className="lv-badge-success/5 p-4 rounded-2xl border" style={{ background: 'var(--clf-ok-bg)', borderColor: 'var(--clf-ok)' }}>
                        <p className="lv-stat text-2xl" style={{ color: 'var(--clf-ok)' }}>R${a.totalCommission.toFixed(2)}</p>
                        <p className="lv-overline opacity-60" style={{ color: 'var(--clf-ok)' }}>COMISSÃO</p>
                      </div>
                      <div className="bg-muted/40 p-4 rounded-2xl border border-border/50">
                        <p className="lv-stat text-2xl" style={{ color: 'var(--clf-warn)' }}>{a.pendingReferrals}</p>
                        <p className="lv-overline opacity-60" style={{ color: 'var(--clf-warn)' }}>PENDENTES</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 shrink-0">
                    {(a.coins?.balance || 0) >= 2 && (
                      <button onClick={() => redeemCoins(a.user_id)} className="lv-btn-primary h-11 px-6 text-[10px] font-black bg-green-600 hover:bg-green-700">
                        <Coins className="h-4 w-4 mr-2" /> RESGATAR 2 COINS
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
                    }} className="lv-btn-secondary h-11 px-6 text-[10px] font-black">
                      <UserCheck className="h-4 w-4 mr-2 text-primary" /> CONFIRMAR PENDENTES
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {affiliates.length === 0 && (
              <div className="lv-empty">
                <Users className="h-12 w-12 opacity-20 mb-2" />
                <p className="lv-overline">NENHUM AFILIADO ENCONTRADO</p>
              </div>
            )}
          </div>
        )}

        {/* Invoices Tab */}
        {tab === "invoices" && (
          <div className="space-y-6">
            <div className="clf-liquid-glass p-6">
              <p className="lv-overline mb-2">GESTÃO DE FATURAMENTO</p>
              <p className="lv-caption font-medium max-w-2xl">
                Comissão padrão: <span className="text-foreground font-black">30%</span> • Feche faturas semanais após validar as vendas e realize o pagamento via PIX para liquidar o débito.
              </p>
            </div>

            {invoices.length === 0 && (
              <div className="lv-empty">
                <FileText className="h-12 w-12 opacity-20 mb-2" />
                <p className="lv-overline">NENHUMA FATURA DISPONÍVEL</p>
              </div>
            )}

            {invoices.map((inv) => (
              <div key={inv.id} className={`clf-liquid-glass p-6 ${inv.status === "open" ? "border-primary/20 bg-primary/[0.02]" : ""}`}>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <p className="lv-body-strong text-base">{inv.affiliate_name}</p>
                      <span className="lv-caption font-mono tracking-tighter opacity-40">({inv.affiliate_code})</span>
                      <span className={`lv-badge ${
                        inv.status === 'paid' ? 'lv-badge-success' : 
                        inv.status === 'closed' ? 'lv-badge-warning' : 
                        inv.status === 'cancelled' ? 'lv-badge-destructive' : 'lv-badge-primary'
                      }`}>
                        {invoiceStatusLabel[inv.status] || inv.status}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 lv-caption">
                      <Clock className="h-3 w-3" />
                      Semana: <span className="font-bold text-foreground">{inv.week_start}</span> → <span className="font-bold text-foreground">{inv.week_end}</span>
                    </div>

                    <div className="flex items-center gap-6 pt-2">
                       <div className="flex items-baseline gap-1">
                          <span className="lv-stat text-2xl">R${Number(inv.total_commission).toFixed(2)}</span>
                          <span className="lv-caption font-black uppercase tracking-widest opacity-40">Líquido</span>
                       </div>
                       <div className="flex items-center gap-2 px-3 py-1 bg-muted/40 rounded-full border border-border/50">
                          <Zap className="h-3 w-3 text-primary" />
                          <span className="text-[10px] font-bold">{inv.total_sales} vendas</span>
                       </div>
                    </div>

                    {inv.paid_at && (
                      <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-3 flex flex-col gap-1">
                        <p className="text-[10px] font-black text-green-600 uppercase">✓ Liquidação Confirmada</p>
                        <p className="lv-caption text-green-700/80 italic">
                          Pago em {format(new Date(inv.paid_at), "dd/MM/yyyy HH:mm")}
                          {inv.payment_notes && ` — ${inv.payment_notes}`}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 shrink-0">
                    {inv.status === "open" && (
                      <button onClick={() => closeInvoice(inv.id)} className="lv-btn-primary h-11 px-6 text-[10px] font-black tracking-widest">
                        <FileText className="h-4 w-4 mr-2" /> FECHAR FATURA
                      </button>
                    )}
                    {inv.status === "closed" && (
                      <div className="flex flex-col gap-2">
                        <input
                          placeholder="Compromisso de pagamento / Notas"
                          value={paymentNotes[inv.id] || ""}
                          onChange={(e) => setPaymentNotes(prev => ({ ...prev, [inv.id]: e.target.value }))}
                          className="lv-input h-10 min-w-[280px] text-xs px-4"
                        />
                        <button onClick={() => markInvoicePaid(inv.id)} className="lv-btn-primary h-11 px-6 text-[10px] font-black bg-green-600 hover:bg-green-700">
                          <CheckCircle className="h-4 w-4 mr-2" /> MARCAR COMO PAGA
                        </button>
                      </div>
                    )}
                    {(inv.status === "open" || inv.status === "closed") && (
                      <button onClick={() => cancelInvoice(inv.id)} className="lv-btn-secondary h-11 px-6 text-[10px] font-black text-destructive border-destructive/20 hover:bg-destructive hover:text-destructive-foreground">
                        <XCircle className="h-4 w-4 mr-2" /> CANCELAR
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
            <div className="clf-liquid-glass p-8">
              <p className="lv-overline mb-4 text-primary">UPLOAD DA NOVA VERSÃO</p>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="lv-label">Versão do Build</label>
                    <input placeholder="ex: 2.1.0" value={extVersion}
                      onChange={(e) => setExtVersion(e.target.value)}
                      className="lv-input" />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="lv-label">Arquivo (.zip / .crx)</label>
                    <input type="file" accept=".zip,.crx,.xpi,.txt"
                      onChange={(e) => setExtFile(e.target.files?.[0] || null)}
                      className="lv-input file:hidden pt-2.5" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="lv-label">Changelog / Instruções</label>
                  <textarea
                    placeholder="Quais são as novidades desta versão?"
                    value={extInstructions}
                    onChange={(e) => setExtInstructions(e.target.value)}
                    rows={4}
                    className="lv-textarea"
                  />
                </div>
                <button onClick={uploadExtension} className="lv-btn-primary w-full md:w-auto h-11 px-8 text-[11px] font-black uppercase tracking-widest">
                  <Upload className="h-4 w-4 mr-2" /> PUBLICAR VERSÃO
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {extensions.map((ext) => (
                <div key={ext.id} className="clf-liquid-glass p-6 group">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Puzzle className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="lv-body-strong text-base">v{ext.version}</p>
                        <p className="lv-caption opacity-60">{format(new Date(ext.created_at), "dd/MM/yyyy HH:mm")}</p>
                      </div>
                    </div>
                    <span className={`lv-badge ${ext.is_latest ? "lv-badge-success" : "lv-badge-muted"}`}>
                      {ext.is_latest ? "PRODUÇÃO" : "ARQUIVADA"}
                    </span>
                  </div>
                  {ext.instructions && (
                    <div className="bg-muted/40 rounded-2xl p-4 border border-border/50">
                      <p className="lv-overline text-[8px] mb-2 opacity-40 italic">Changelog</p>
                      <pre className="text-xs text-muted-foreground font-mono leading-relaxed whitespace-pre-wrap">{ext.instructions}</pre>
                    </div>
                  )}
                  <div className="mt-4 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                     <button className="lv-btn-icon h-8 w-8 rounded-lg bg-primary/10 text-primary">
                        <Download className="h-4 w-4" />
                     </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {tab === "notifications" && (
          <div className="space-y-4">
            {notifications.length === 0 && (
              <div className="lv-empty">
                <Bell className="h-12 w-12 opacity-20 mb-2" />
                <p className="lv-overline">NENHUMA NOTIFICAÇÃO NO MOMENTO</p>
              </div>
            )}
            {notifications.map((n) => (
              <div key={n.id} className={`clf-liquid-glass p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300 ${!n.is_read ? "border-primary/20 bg-primary/[0.02] shadow-primary/[0.05]" : "opacity-70 grayscale-[0.5]"}`}>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    {!n.is_read && <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse shrink-0" />}
                    <p className="lv-body-strong text-base">{n.title}</p>
                  </div>
                  <p className="lv-caption text-[13px] leading-relaxed opacity-80">{n.description}</p>
                  <div className="flex items-center gap-2 lv-caption text-[9px] opacity-40 uppercase font-black tracking-widest mt-2">
                    <Clock className="h-3 w-3" />
                    {format(new Date(n.created_at), "dd/MM/yyyy HH:mm")}
                  </div>
                </div>
                {!n.is_read && (
                  <button onClick={() => markNotificationRead(n.id)} className="lv-btn-secondary h-10 px-6 text-[10px] font-black shrink-0 tracking-widest">
                    MARCAR LIDA
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Messages Tab */}
        {tab === "messages" && (
          <div className="flex flex-col md:flex-row gap-6 min-h-[600px]">
            <div className="w-full md:w-80 shrink-0 space-y-4">
              <div className="clf-liquid-glass p-6">
                <p className="lv-overline mb-4">CANAL DE ATENDIMENTO</p>
                <div className="space-y-2">
                  {chatUsers.length === 0 && (
                    <div className="py-12 text-center opacity-30">
                      <MessageSquare className="h-10 w-10 mx-auto mb-2" />
                      <p className="lv-caption">Nenhuma conversa ativa</p>
                    </div>
                  )}
                  {chatUsers.map((cu) => (
                    <button
                      key={cu.user_id}
                      onClick={() => { setSelectedChatUser(cu.user_id); fetchChatMessages(cu.user_id); }}
                      className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 flex items-center justify-between group ${
                        selectedChatUser === cu.user_id 
                        ? "bg-primary border-primary shadow-lg shadow-primary/20 scale-[1.02]" 
                        : "bg-muted/40 border-border/50 hover:bg-primary/5 hover:border-primary/20"
                      }`}
                    >
                      <div className="min-w-0 pr-4">
                        <p className={`text-[13px] font-bold truncate ${selectedChatUser === cu.user_id ? "text-primary-foreground" : "text-foreground"}`}>
                          {cu.name || cu.email}
                        </p>
                        <p className={`text-[10px] font-mono opacity-60 truncate ${selectedChatUser === cu.user_id ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                          {cu.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {cu.unread > 0 && (
                          <span className="h-5 min-w-[20px] rounded-full bg-primary-foreground text-primary text-[10px] flex items-center justify-center font-black px-1.5 shadow-sm">
                            {cu.unread}
                          </span>
                        )}
                        <ChevronRight className={`h-4 w-4 transition-transform ${selectedChatUser === cu.user_id ? "text-primary-foreground translate-x-1" : "text-muted-foreground/30 group-hover:text-primary"}`} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 clf-liquid-glass flex flex-col overflow-hidden">
              {!selectedChatUser ? (
                <div className="flex-1 flex flex-col items-center justify-center opacity-30 p-12">
                   <div className="h-20 w-20 rounded-[32px] bg-primary/10 flex items-center justify-center mb-6">
                      <MessageSquare className="h-10 w-10 text-primary" />
                   </div>
                  <p className="lv-body-strong text-lg">Selecione uma conversa</p>
                  <p className="lv-caption mt-2">Clique em um usuário na lista lateral para ver o histórico</p>
                </div>
              ) : (
                <>
                  <div className="px-8 py-5 border-b border-border/50 bg-primary/5 flex items-center justify-between">
                     <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-black text-sm">
                           {(chatUsers.find(u => u.user_id === selectedChatUser)?.name || "Z")[0].toUpperCase()}
                        </div>
                        <div>
                           <p className="lv-body-strong">{chatUsers.find(u => u.user_id === selectedChatUser)?.name || "Usuário"}</p>
                           <p className="lv-caption text-[10px] opacity-60">Canal de suporte direto</p>
                        </div>
                     </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4 max-h-[450px] scroll-smooth">
                    {chatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender_id === user?.id ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] px-5 py-3 rounded-[20px] text-[13px] shadow-sm relative group ${
                            msg.sender_id === user?.id
                              ? "bg-primary text-primary-foreground rounded-br-none"
                              : "bg-muted/50 border border-border/50 text-foreground rounded-bl-none"
                          }`}
                        >
                          <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                          <div className={`mt-2 flex items-center justify-end gap-2 text-[9px] font-bold opacity-0 group-hover:opacity-60 transition-opacity ${
                            msg.sender_id === user?.id ? "text-primary-foreground" : "text-muted-foreground"
                          }`}>
                            <Clock className="h-2.5 w-2.5" />
                            {format(new Date(msg.created_at), "HH:mm • dd/MM")}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>

                  <div className="p-6 bg-muted/20 border-t border-border/50">
                    <div className="relative group/chatbox flex items-center gap-3">
                      <div className="relative flex-1">
                        <input
                          value={adminMessage}
                          onChange={(e) => setAdminMessage(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendAdminMessage()}
                          placeholder="Digite sua resposta e pressione Enter..."
                          className="lv-input h-12 rounded-2xl pl-12 pr-6 border-2 border-transparent focus:border-primary/30 transition-all shadow-inner"
                        />
                        <Send className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/40 group-focus-within/chatbox:text-primary transition-colors" />
                      </div>
                      <button
                        onClick={sendAdminMessage}
                        disabled={!adminMessage.trim()}
                        className="lv-btn-primary h-12 w-12 rounded-2xl flex items-center justify-center scale-95 hover:scale-105 active:scale-95 disabled:scale-100"
                      >
                        <Zap className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Worker Tokens Tab */}
        {tab === "worker-tokens" && (
          <div className="space-y-6">
            <div className="clf-liquid-glass p-8">
              <p className="lv-overline mb-4 text-primary">FORJA DE TOKENS (SISTEMA EXTERNO)</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="space-y-4">
                   <div className="space-y-1.5">
                      <label className="lv-label">Email do Cliente *</label>
                      <input placeholder="usuario@dominio.com" value={workerEmail}
                        onChange={(e) => setWorkerEmail(e.target.value)}
                        className="lv-input" />
                   </div>
                   <div className="space-y-1.5">
                      <label className="lv-label">Nome de Ativação</label>
                      <input placeholder="Ex: Star AI" value={workerName}
                        onChange={(e) => setWorkerName(e.target.value)}
                        className="lv-input" />
                   </div>
                </div>
                <div className="space-y-4">
                   <div className="space-y-1.5">
                      <label className="lv-label">Duração / Plano</label>
                      <select value={workerPlan} onChange={(e) => setWorkerPlan(e.target.value)}
                        className="lv-input">
                        <option value="test_5h">⚡ Teste 5 horas</option>
                        <option value="test_1d">⚡ Teste 1 dia</option>
                        <option value="days_15">💎 15 Dias Pro</option>
                        <option value="days_30">💎 30 Dias Lux</option>
                        <option value="days_90">👑 90 Dias Prime</option>
                        <option value="lifetime">🌌 Master / Vitalício</option>
                      </select>
                   </div>
                   <div className="space-y-1.5">
                      <label className="lv-label">Sincronizar com Perfil Local</label>
                      <select value={workerUserId} onChange={(e) => setWorkerUserId(e.target.value)}
                        className="lv-input">
                        <option value="">Não vincular (Token isolado)</option>
                        {members.map((m) => (
                          <option key={m.user_id} value={m.user_id}>{m.name || m.email}</option>
                        ))}
                      </select>
                   </div>
                </div>
              </div>
              <button onClick={generateTokenViaWorker} disabled={workerLoading}
                className="lv-btn-primary h-12 px-8 text-[11px] font-black uppercase tracking-[0.2em] w-full md:w-auto shadow-xl">
                {workerLoading ? <Loader2 className="h-5 w-5 animate-spin mr-3" /> : <Zap className="h-5 w-5 mr-3" />}
                INICIAR FORJA DE TOKEN
              </button>

              {workerResult?.token && (
                <div className="mt-8 bg-green-500/5 border border-green-500/10 rounded-3xl p-6 clf-fade-up">
                  <div className="flex items-center gap-3 mb-4">
                     <CheckCircle className="h-6 w-6 text-green-600" />
                     <p className="text-sm font-black text-green-700 uppercase tracking-widest">Token Gerado com Sucesso</p>
                  </div>
                  <div className="flex flex-col md:flex-row items-center gap-4 bg-muted/40 p-4 rounded-2xl border border-border/50">
                    <code className="lv-mono text-[13px] break-all flex-1 text-center md:text-left selection:bg-green-200">
                      {workerResult.token}
                    </code>
                    <button onClick={() => { navigator.clipboard.writeText(workerResult.token); toast.success("Copiado!"); }}
                      className="lv-btn-secondary h-10 px-6 font-black text-[10px] shrink-0 border-green-500/20 text-green-700">
                      <Copy className="h-4 w-4 mr-2" /> COPIAR
                    </button>
                  </div>
                  {workerResult.expires && (
                    <p className="lv-caption text-green-600/60 mt-4 text-center md:text-left font-bold uppercase tracking-widest text-[9px]">
                      Expiração Programada: {new Date(workerResult.expires * 1000).toLocaleString("pt-BR")}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="clf-liquid-glass p-8">
                  <p className="lv-overline mb-4 text-primary">AUDITORIA DE TOKENS</p>
                  <div className="flex items-center gap-3 mb-6">
                    <input placeholder="Email para pesquisar histórico..." value={searchEmail}
                      onChange={(e) => setSearchEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && searchTokensByEmail()}
                      className="lv-input h-11" />
                    <button onClick={searchTokensByEmail} disabled={searchLoading}
                      className="lv-btn-secondary h-11 w-11 p-0 shrink-0">
                      {searchLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                    </button>
                  </div>
                  {searchResult && (
                    <div className="bg-muted/40 rounded-2xl p-4 border border-border/50 overflow-x-auto">
                      <pre className="lv-mono text-[10px] opacity-60 leading-relaxed">{JSON.stringify(searchResult, null, 2)}</pre>
                    </div>
                  )}
               </div>

               <div className="clf-liquid-glass p-8">
                  <p className="lv-overline mb-4 text-destructive">LIBERAÇÃO DE HARDWARE</p>
                  <p className="lv-caption mb-6">Reseta o vínculo de IDs fixos (HWID) para permitir migração de dispositivo.</p>
                  <div className="flex flex-col gap-3">
                    <input placeholder="Token do cliente (CLF1...)" value={unbindToken}
                      onChange={(e) => setUnbindToken(e.target.value)}
                      className="lv-input h-11" />
                    <button onClick={unbindDevice} disabled={unbindLoading}
                      className="lv-btn-danger h-11 font-black text-[10px] uppercase tracking-widest">
                      {unbindLoading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Unlock className="h-5 w-5 mr-2" />}
                      FORÇAR DESBLOQUEIO
                    </button>
                  </div>
               </div>
            </div>

            <div className="clf-liquid-glass p-8">
              <p className="lv-overline mb-6">MÉTRICAS DE DISTRIBUIÇÃO</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                <div className="text-center md:text-left space-y-1">
                  <p className="lv-stat text-4xl">{members.filter(m => m.licenses.length > 0).length}</p>
                  <p className="lv-overline opacity-60">LICENCIADOS</p>
                </div>
                <div className="text-center md:text-left space-y-1">
                  <p className="lv-stat text-4xl text-primary">{members.filter(m => m.license?.active).length}</p>
                  <p className="lv-overline text-primary opacity-60">FLUXO ATIVO</p>
                </div>
                <div className="text-center md:text-left space-y-1">
                  <p className="lv-stat text-4xl text-destructive">{members.filter(m => m.license && !m.license.active).length}</p>
                  <p className="lv-overline text-destructive opacity-60">RETENÇÃO/EXPIRADO</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Support Tab */}
        {tab === "support" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Tickets List */}
            <div className="lg:col-span-1 space-y-4 max-h-[1000px] overflow-y-auto pr-2">
              {tickets.map(t => (
                <div 
                  key={t.id} 
                  onClick={() => {
                    setSelectedTicket(t);
                    fetchTicketReplies(t.id);
                  }}
                  className={`clf-liquid-glass p-5 cursor-pointer transition-all hover:scale-[1.02] border-2 ${
                    selectedTicket?.id === t.id ? "border-primary" : "border-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${
                      { 
                        open: "bg-amber-500/10 text-amber-600",
                        in_progress: "bg-blue-500/10 text-blue-600",
                        resolved: "bg-emerald-500/10 text-emerald-600",
                        closed: "bg-slate-500/10 text-slate-600"
                      }[t.status as SupportTicket["status"]]
                    }`}>
                      {t.status.replace("_", " ")}
                    </span>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${
                      { 
                        low: "bg-blue-500/5 text-blue-400",
                        medium: "bg-yellow-500/5 text-yellow-400",
                        high: "bg-orange-500/5 text-orange-400",
                        urgent: "bg-rose-500/10 text-rose-600 animate-pulse"
                      }[t.priority as SupportTicket["priority"]]
                    }`}>
                      {t.priority}
                    </span>
                  </div>
                  <h3 className="font-bold text-sm mb-1 line-clamp-1">{t.subject}</h3>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 mb-3">{t.description}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-medium opacity-70">{t.user_email}</p>
                    <p className="text-[9px] opacity-40">{format(new Date(t.created_at), "dd/MM HH:mm")}</p>
                  </div>
                </div>
              ))}
              {tickets.length === 0 && (
                <div className="lv-empty py-20">
                  <MessageSquare className="h-10 w-10 opacity-10 mb-2" />
                  <p className="lv-overline opacity-40">Nenhum ticket</p>
                </div>
              )}
            </div>

            {/* Ticket Detail & Chat */}
            <div className="lg:col-span-2 space-y-6">
              {selectedTicket ? (
                <div className="clf-liquid-glass flex flex-col h-[1000px]">
                  {/* Header */}
                  <div className="p-8 border-b border-white/10 shrink-0">
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <p className="lv-overline text-primary mb-2">TICKET #{selectedTicket.id.substring(0,8)}</p>
                        <h2 className="lv-heading-sm mb-1">{selectedTicket.subject}</h2>
                        <div className="flex items-center gap-3">
                          <p className="lv-body-strong text-xs">{selectedTicket.user_name || "Usuário"}</p>
                          <span className="h-1 w-1 rounded-full bg-muted-foreground/20" />
                          <p className="lv-body text-xs opacity-60">{selectedTicket.user_email}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {(["open", "in_progress", "resolved", "closed"] as const).map(s => (
                          <button
                            key={s}
                            disabled={statusLoading}
                            onClick={() => updateTicketStatus(selectedTicket.id, s)}
                            className={`h-8 px-3 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                              selectedTicket.status === s
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted/40 hover:bg-muted/60 opacity-40 hover:opacity-100"
                            }`}
                          >
                            {s.replace("_", " ")}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="bg-muted/40 p-4 rounded-2xl border border-border/50">
                      <p className="text-sm italic opacity-80 leading-relaxed">
                        "{selectedTicket.description}"
                      </p>
                    </div>
                  </div>

                  {/* Replies area */}
                  <div className="flex-1 overflow-y-auto p-8 space-y-6">
                    {ticketReplies.map(r => (
                      <div key={r.id} className={`flex ${r.is_admin ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] p-4 rounded-3xl ${
                          r.is_admin 
                          ? "bg-primary text-primary-foreground rounded-tr-none" 
                          : "bg-muted/40 rounded-tl-none border border-border/50"
                        }`}>
                          <p className="text-sm leading-relaxed">{r.message}</p>
                          <p className={`text-[9px] mt-2 font-bold uppercase tracking-widest opacity-40 ${r.is_admin ? "text-right" : ""}`}>
                            {format(new Date(r.created_at), "dd/MM HH:mm")} {r.is_admin && "• Admin"}
                          </p>
                        </div>
                      </div>
                    ))}
                    {ticketReplies.length === 0 && (
                      <div className="text-center py-10">
                        <p className="lv-overline opacity-20">Sem respostas ainda</p>
                      </div>
                    )}
                  </div>

                  {/* Reply Input */}
                  <div className="p-8 border-t border-border/50 shrink-0">
                    <div className="relative">
                      <textarea
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        placeholder="Digite sua resposta oficial..."
                        className="lv-input min-h-[120px] rounded-3xl p-6 pr-16 resize-none"
                      />
                      <button 
                        onClick={sendTicketReply}
                        disabled={replyLoading || !replyMessage.trim()}
                        className="absolute bottom-4 right-4 h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:scale-110 active:scale-95 transition-transform disabled:opacity-50"
                      >
                        {replyLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="clf-liquid-glass h-full flex flex-col items-center justify-center p-20 text-center opacity-40">
                  <div className="h-24 w-24 rounded-[40px] bg-muted/40 flex items-center justify-center mb-6">
                    <Eye className="h-10 w-10" />
                  </div>
                  <h3 className="lv-heading-sm mb-2">Selecione um Ticket</h3>
                  <p className="lv-body max-w-xs">Escolha um chamado na lista à esquerda para ver os detalhes e responder.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Free Links Tab removed */}
      </div>

        {/* Tenant Tab — embedded TenantAdmin */}
        {tab === "tenant" && (
          <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "var(--tt)" }}>Carregando painel de operação...</div>}>
            <LazyTenantAdmin embedded />
          </Suspense>
        )}

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

          <div className="p-8 lg:p-12 space-y-8 flex-1">
            <div className="space-y-2 group/input">
              <p className="lv-overline ml-1 opacity-60">EMAIL DE ACESSO *</p>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center text-muted-foreground/40 font-black">@</span>
                <input type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="usuario@email.com" className="lv-input h-12 rounded-2xl pl-10 pr-6 border-2 border-transparent focus:border-primary/20 transition-all font-medium text-sm" />
              </div>
            </div>

            <div className="space-y-2 group/input">
              <p className="lv-overline ml-1 opacity-60">NOME COMPLETO</p>
              <div className="relative">
                <Users className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/40 transition-colors" />
                <input value={newUserName} onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Nome do usuário" className="lv-input h-12 rounded-2xl pl-12 pr-6 border-2 border-transparent focus:border-primary/20 transition-all font-medium text-sm" />
              </div>
            </div>

            <div className="space-y-2 group/input">
              <p className="lv-overline ml-1 opacity-60">SENHA MESTRA *</p>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/40 transition-colors" />
                <input type={showNewPassword ? "text" : "password"} value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)} placeholder="Mínimo 6 caracteres"
                  className="lv-input h-12 rounded-2xl pl-12 pr-12 border-2 border-transparent focus:border-primary/20 transition-all font-medium text-sm" />
                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground transition-all">
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 group/input">
                <p className="lv-overline ml-1 opacity-60">PLANO INICIAL</p>
                <select value={newUserPlan} onChange={(e) => setNewUserPlan(e.target.value)}
                  className="lv-input h-12 rounded-2xl px-4 appearance-none cursor-pointer border-2 border-transparent focus:border-primary/20 transition-all text-xs font-bold uppercase tracking-widest">
                  <option value="">Sem plano</option>
                  <optgroup label="PADRÃO">
                    {planOptions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </optgroup>
                  {dbPlans.length > 0 && (
                    <optgroup label="CUSTOM">
                      {dbPlans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </optgroup>
                  )}
                </select>
              </div>

              <div className="space-y-2 group/input">
                <p className="lv-overline ml-1 opacity-60">NÍVEL DE ACESSO</p>
                <select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value)}
                  className="lv-input h-12 rounded-2xl px-4 appearance-none cursor-pointer border-2 border-transparent focus:border-primary/20 transition-all text-xs font-bold uppercase tracking-widest">
                  <option value="member">Membro</option>
                  <option value="admin">Admin</option>
                  <option value="affiliate">Afiliado</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between p-5 rounded-3xl bg-primary/5 border border-primary/10">
              <div className="flex items-center gap-3">
                 <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Zap className="h-4 w-4 text-primary" />
                 </div>
                 <span className="lv-overline text-[9px]">Gerar token (CLF1)</span>
              </div>
              <button type="button" onClick={() => setNewUserAutoToken(!newUserAutoToken)}
                className={`h-7 w-12 rounded-full transition-colors duration-300 relative ${newUserAutoToken ? "bg-primary" : "bg-muted-foreground/20"}`}>
                <div className={`h-5 w-5 rounded-full bg-white transition-transform shadow-md absolute top-1 ${newUserAutoToken ? "left-6" : "left-1"}`} />
              </button>
            </div>

            <button onClick={createUserAdmin} disabled={newUserLoading}
              className="lv-btn-primary h-14 w-full rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 group">
              {newUserLoading ? <Loader2 className="h-5 w-5 animate-spin mr-3" /> : <UserPlus className="h-5 w-5 mr-3" />}
              {newUserLoading ? "SINCRONIZANDO..." : "AUTORIZAR ATIVAÇÃO"}
              {!newUserLoading && <span className="ml-2 opacity-40 group-hover:translate-x-2 transition-transform inline-block">→</span>}
            </button>

            {newUserResult && (
              <div className="rounded-[32px] bg-green-500/5 border border-green-500/10 p-8 space-y-4 clf-fade-up">
                <p className="lv-overline text-green-600 font-black tracking-[0.3em]">✓ ACESSO LIBERADO</p>
                <div className="space-y-2">
                  <p className="lv-caption text-foreground"><span className="opacity-40">Email:</span> {newUserResult.email}</p>
                  <p className="lv-caption text-foreground"><span className="opacity-40">Papel:</span> {newUserResult.role}</p>
                  {newUserResult.plan && <p className="lv-caption text-foreground"><span className="opacity-40">Plano:</span> {planLabels[newUserResult.plan] || newUserResult.plan}</p>}
                </div>
                {newUserResult.token && (
                  <div className="mt-4 pt-4 border-t border-green-500/10">
                    <p className="lv-overline text-[8px] mb-2 opacity-60">TOKEN DE ATIVAÇÃO</p>
                    <div className="flex items-center gap-2 bg-white/20 dark:bg-black/20 p-4 rounded-2xl border border-white/10">
                      <code className="lv-mono text-[12px] break-all flex-1 text-green-700">
                        {newUserResult.token.substring(0, 15)}••••{newUserResult.token.substring(newUserResult.token.length - 6)}
                      </code>
                      <button onClick={() => { navigator.clipboard.writeText(newUserResult.token); toast.success("Token copiado!"); }}
                        className="lv-btn-icon h-9 w-9 bg-green-500/10 text-green-700 hover:bg-green-500 hover:text-white transition-all">
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
                {newUserResult.token_error && <p className="text-xs text-destructive font-black uppercase tracking-widest">{newUserResult.token_error}</p>}
              </div>
            )}

            <p className="text-center text-[9px] font-black uppercase tracking-[0.4em] opacity-30 pt-4">Cloud Architecture v4.5</p>
          </div>
        </SheetContent>
      </Sheet>
    </div>
    </AppLayout>
  );
}
