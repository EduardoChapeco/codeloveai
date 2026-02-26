import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ArrowLeft, User, Key, BarChart3, FolderOpen, Shield, MessageSquare,
  Activity, Copy, RefreshCw, Unlock, XCircle, Trash2, Ban, UserCheck,
  Send, Clock, Zap, ExternalLink, Loader2, Save, Globe, Monitor,
} from "lucide-react";

interface MemberDetailPanelProps {
  userId: string;
  onBack: () => void;
  currentAdminId: string;
}

type SubTab = "profile" | "licenses" | "usage" | "projects" | "activations" | "messages" | "activity";

interface Profile { user_id: string; name: string; email: string; created_at: string; tenant_id: string | null; }
interface License {
  id: string; key: string; active: boolean; plan: string; plan_type: string;
  type: string; status: string; expires_at: string | null; daily_messages: number | null;
  hourly_limit: number | null; messages_used_today: number; device_id: string | null;
  created_at: string; plan_id: string | null; messages_used_month: number;
  trial_used: boolean; trial_expires_at: string | null;
}
interface DailyUsage { id: string; date: string; messages_used: number; license_id: string; }
interface Project {
  id: string; lovable_project_id: string; name: string | null; display_name: string | null;
  published_url: string | null; created_at: string;
}
interface Activation {
  id: string; ip_address: string | null; user_agent: string | null;
  device_info: string | null; location: string | null; activated_at: string;
}
interface DirectMessage {
  id: string; sender_id: string; receiver_id: string; content: string; created_at: string; is_read: boolean;
}
interface Subscription {
  id: string; plan: string; status: string; starts_at: string; expires_at: string;
  payment_id: string | null; created_at: string; affiliate_code: string | null;
}
interface UserRole { role: string; }
interface DbPlan { id: string; name: string; price: number; billing_cycle: string; }
interface ExtUsageLog {
  id: string; function_name: string; project_id: string | null; response_status: number | null;
  duration_ms: number | null; created_at: string; ip_address: string | null; user_agent: string | null;
}

export default function MemberDetailPanel({ userId, onBack, currentAdminId }: MemberDetailPanelProps) {
  const [subTab, setSubTab] = useState<SubTab>("profile");
  const [loading, setLoading] = useState(true);

  // Data
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [usage, setUsage] = useState<DailyUsage[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activations, setActivations] = useState<Activation[]>([]);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [dbPlans, setDbPlans] = useState<DbPlan[]>([]);
  const [extUsage, setExtUsage] = useState<ExtUsageLog[]>([]);
  const [newMessage, setNewMessage] = useState("");

  // Edit states
  const [editName, setEditName] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [profileRes, rolesRes, licensesRes, usageRes, projectsRes, activationsRes, messagesRes, subsRes, plansRes, extUsageRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).single(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("licenses").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("daily_usage").select("*").eq("user_id", userId).order("date", { ascending: false }).limit(30),
      supabase.from("lovable_projects").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      (supabase as any).from("token_activations").select("*").eq("user_id", userId).order("activated_at", { ascending: false }).limit(20),
      supabase.from("messages").select("*").or(`sender_id.eq.${userId},receiver_id.eq.${userId}`).order("created_at", { ascending: false }).limit(50),
      supabase.from("subscriptions").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("plans").select("id, name, price, billing_cycle").eq("is_active", true).order("display_order"),
      (supabase as any).from("extension_usage_logs").select("id, function_name, project_id, response_status, duration_ms, created_at, ip_address, user_agent").eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
    ]);

    if (profileRes.data) {
      setProfile(profileRes.data);
      setEditName(profileRes.data.name || "");
    }
    setRoles((rolesRes.data as UserRole[]) || []);
    setLicenses((licensesRes.data as unknown as License[]) || []);
    setUsage((usageRes.data as DailyUsage[]) || []);
    setProjects((projectsRes.data as Project[]) || []);
    setActivations((activationsRes.data as Activation[]) || []);
    setMessages((messagesRes.data as DirectMessage[]) || []);
    setSubscriptions((subsRes.data as Subscription[]) || []);
    setDbPlans((plansRes.data as DbPlan[]) || []);
    setExtUsage((extUsageRes.data as ExtUsageLog[]) || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const activeLicense = licenses.find(l => l.active && l.status === "active");
  const isUserAdmin = roles.some(r => r.role === "admin");

  // Actions
  const saveName = async () => {
    await supabase.from("profiles").update({ name: editName }).eq("user_id", userId);
    toast.success("Nome atualizado!");
    fetchAll();
  };

  const revokeLicenses = async () => {
    if (!confirm("Revogar TODAS as licenças?")) return;
    await supabase.from("licenses").update({ active: false, status: "suspended" }).eq("user_id", userId);
    toast.success("Licenças revogadas!");
    fetchAll();
  };

  const resetDailyUsage = async () => {
    if (!activeLicense) return toast.error("Sem licença ativa");
    await supabase.from("licenses").update({ messages_used_today: 0 }).eq("id", activeLicense.id);
    const today = new Date().toISOString().split("T")[0];
    await supabase.from("daily_usage").delete().eq("license_id", activeLicense.id).eq("date", today);
    toast.success("Uso diário resetado!");
    fetchAll();
  };

  const unlockDevice = async () => {
    if (!activeLicense) return;
    await supabase.from("licenses").update({ device_id: null }).eq("id", activeLicense.id);
    toast.success("Dispositivo desbloqueado!");
    fetchAll();
  };

  const suspendLicense = async (licenseId: string) => {
    await supabase.from("licenses").update({ status: "suspended", active: false }).eq("id", licenseId);
    toast.success("Licença suspensa!");
    fetchAll();
  };

  const reactivateLicense = async (licenseId: string) => {
    await supabase.from("licenses").update({ status: "active", active: true }).eq("id", licenseId);
    toast.success("Licença reativada!");
    fetchAll();
  };

  const assignPlanFromDb = async () => {
    if (!selectedPlanId) return toast.error("Selecione um plano");
    setAssignLoading(true);
    const plan = dbPlans.find(p => p.id === selectedPlanId);
    if (!plan) return;
    // Deactivate current
    if (activeLicense) {
      await supabase.from("licenses").update({ active: false, status: "expired" }).eq("id", activeLicense.id);
    }
    const expiresAt = new Date();
    if (plan.billing_cycle === "daily") expiresAt.setDate(expiresAt.getDate() + 1);
    else if (plan.billing_cycle === "weekly") expiresAt.setDate(expiresAt.getDate() + 7);
    else expiresAt.setDate(expiresAt.getDate() + 30);

    await supabase.from("licenses").insert({
      user_id: userId, plan: plan.name, plan_type: "messages", type: "daily_token",
      plan_id: plan.id, status: "active", active: true,
      key: `CLF1.ADMIN.${Date.now()}`,
      expires_at: expiresAt.toISOString(),
    });
    toast.success(`Plano "${plan.name}" atribuído!`);
    setAssignLoading(false);
    fetchAll();
  };

  const banUser = async () => {
    if (!confirm("Banir usuário? Todas as licenças serão revogadas.")) return;
    await supabase.from("licenses").update({ active: false, status: "suspended" }).eq("user_id", userId);
    toast.success("Usuário banido!");
    fetchAll();
  };

  const sendMsg = async () => {
    if (!newMessage.trim()) return;
    await supabase.from("messages").insert({
      sender_id: currentAdminId, receiver_id: userId, content: newMessage.trim(),
    });
    toast.success("Mensagem enviada!");
    setNewMessage("");
    fetchAll();
  };

  const tabs: { id: SubTab; label: string; icon: any }[] = [
    { id: "profile", label: "Perfil", icon: User },
    { id: "licenses", label: "Licenças", icon: Key },
    { id: "activity", label: "Atividade", icon: Activity },
    { id: "usage", label: "Uso", icon: BarChart3 },
    { id: "projects", label: "Projetos", icon: FolderOpen },
    { id: "activations", label: "Ativações", icon: Monitor },
    { id: "messages", label: "Mensagens", icon: MessageSquare },
  ];

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="lv-btn-secondary h-10 w-10 p-0 shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="lv-heading-md truncate">{profile?.name || profile?.email || "Membro"}</h2>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="lv-caption font-mono">{profile?.email}</span>
            {roles.map(r => (
              <span key={r.role} className={`lv-badge text-[9px] ${r.role === "admin" ? "lv-badge-primary" : "lv-badge-muted"}`}>
                {r.role.toUpperCase()}
              </span>
            ))}
            {activeLicense && (
              <span className="lv-badge lv-badge-success text-[9px]">
                {activeLicense.plan} — ATIVO
              </span>
            )}
            {!activeLicense && <span className="lv-badge lv-badge-destructive text-[9px]">SEM ACESSO</span>}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={banUser} className="lv-btn-secondary h-9 px-4 text-[10px] font-black text-destructive border-destructive/20 hover:bg-destructive hover:text-white">
            <Ban className="h-3.5 w-3.5 mr-1.5" /> BANIR
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1.5 flex-wrap bg-muted/30 p-1 rounded-xl">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`h-9 px-4 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              subTab === t.id ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-muted/50"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ PROFILE TAB ═══ */}
      {subTab === "profile" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Profile Info */}
          <div className="clf-liquid-glass p-6 space-y-5">
            <p className="lv-overline">Informações do Perfil</p>
            <div className="space-y-4">
              <div>
                <label className="lv-label mb-1">Nome</label>
                <div className="flex gap-2">
                  <input value={editName} onChange={e => setEditName(e.target.value)} className="lv-input flex-1" />
                  <button onClick={saveName} className="lv-btn-primary h-10 px-4"><Save className="h-4 w-4" /></button>
                </div>
              </div>
              <div>
                <label className="lv-label mb-1">Email</label>
                <div className="lv-input bg-muted/30 cursor-default">{profile?.email}</div>
              </div>
              <div>
                <label className="lv-label mb-1">User ID</label>
                <div className="flex gap-2">
                  <code className="lv-input bg-muted/30 cursor-default font-mono text-[11px] flex-1 truncate">{userId}</code>
                  <button onClick={() => { navigator.clipboard.writeText(userId); toast.success("ID copiado!"); }}
                    className="lv-btn-secondary h-10 w-10 p-0 shrink-0"><Copy className="h-4 w-4" /></button>
                </div>
              </div>
              <div>
                <label className="lv-label mb-1">Cadastro</label>
                <div className="lv-input bg-muted/30 cursor-default">
                  {profile?.created_at ? format(new Date(profile.created_at), "dd/MM/yyyy HH:mm") : "—"}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-6">
            {/* Assign Plan */}
            <div className="clf-liquid-glass p-6 space-y-4">
              <p className="lv-overline">Atribuir Plano</p>
              <div className="flex gap-2">
                <select value={selectedPlanId} onChange={e => setSelectedPlanId(e.target.value)} className="lv-input flex-1">
                  <option value="">Selecionar plano...</option>
                  {dbPlans.map(p => (
                    <option key={p.id} value={p.id}>{p.name} — R${(p.price / 100).toFixed(2)}/{p.billing_cycle === "daily" ? "dia" : p.billing_cycle === "weekly" ? "sem" : "mês"}</option>
                  ))}
                </select>
                <button onClick={assignPlanFromDb} disabled={assignLoading} className="lv-btn-primary h-10 px-5 text-[10px] font-bold">
                  {assignLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* License Actions */}
            <div className="clf-liquid-glass p-6 space-y-4">
              <p className="lv-overline">Ações Rápidas</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={resetDailyUsage} disabled={!activeLicense} className="lv-btn-secondary h-10 text-[10px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-30">
                  <RefreshCw className="h-3.5 w-3.5" /> Reset Uso Diário
                </button>
                <button onClick={unlockDevice} disabled={!activeLicense?.device_id} className="lv-btn-secondary h-10 text-[10px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-30">
                  <Unlock className="h-3.5 w-3.5" /> Desbloquear Device
                </button>
                <button onClick={revokeLicenses} disabled={licenses.length === 0} className="lv-btn-secondary h-10 text-[10px] font-bold text-destructive border-destructive/20 flex items-center justify-center gap-1.5 disabled:opacity-30">
                  <Trash2 className="h-3.5 w-3.5" /> Revogar Todas
                </button>
                <button onClick={() => setSubTab("messages")} className="lv-btn-secondary h-10 text-[10px] font-bold flex items-center justify-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" /> Enviar Mensagem
                </button>
              </div>
            </div>

            {/* Stats Summary */}
            <div className="clf-liquid-glass p-6">
              <p className="lv-overline mb-4">Resumo</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="lv-stat text-2xl">{licenses.length}</p>
                  <p className="lv-caption text-[9px]">Licenças</p>
                </div>
                <div className="text-center">
                  <p className="lv-stat text-2xl">{projects.length}</p>
                  <p className="lv-caption text-[9px]">Projetos</p>
                </div>
                <div className="text-center">
                  <p className="lv-stat text-2xl">{activations.length}</p>
                  <p className="lv-caption text-[9px]">Ativações</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ LICENSES TAB ═══ */}
      {subTab === "licenses" && (
        <div className="space-y-4">
          {licenses.length === 0 && <p className="lv-caption text-center py-12 opacity-40">Nenhuma licença encontrada</p>}
          {licenses.map(l => (
            <div key={l.id} className={`clf-liquid-glass p-5 ${l.active ? "border-l-4 border-l-primary" : "opacity-60"}`}>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`lv-badge text-[9px] ${l.active && l.status === "active" ? "lv-badge-success" : l.status === "suspended" ? "lv-badge-destructive" : "lv-badge-muted"}`}>
                      {l.status.toUpperCase()}
                    </span>
                    <span className="text-xs font-bold">{l.plan}</span>
                    <span className="lv-caption text-[10px]">({l.plan_type} / {l.type})</span>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
                    <span>Criada: {format(new Date(l.created_at), "dd/MM/yy HH:mm")}</span>
                    {l.expires_at && <span>Expira: {format(new Date(l.expires_at), "dd/MM/yy HH:mm")}</span>}
                    {l.daily_messages && <span>Uso: {l.messages_used_today}/{l.daily_messages}/dia</span>}
                    {l.device_id && <span className="text-blue-500 font-mono">🔒 {l.device_id.substring(0, 12)}…</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-[10px] font-mono text-muted-foreground/60 truncate max-w-[300px]">{l.key}</code>
                    <button onClick={() => { navigator.clipboard.writeText(l.key); toast.success("Copiado!"); }}
                      className="lv-btn-icon h-6 w-6"><Copy className="h-3 w-3" /></button>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {l.active ? (
                    <button onClick={() => suspendLicense(l.id)} className="lv-btn-secondary h-8 px-3 text-[9px] font-bold text-destructive">
                      <XCircle className="h-3 w-3 mr-1" /> Suspender
                    </button>
                  ) : (
                    <button onClick={() => reactivateLicense(l.id)} className="lv-btn-secondary h-8 px-3 text-[9px] font-bold text-primary">
                      <Zap className="h-3 w-3 mr-1" /> Reativar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Subscriptions */}
          {subscriptions.length > 0 && (
            <div className="mt-6">
              <p className="lv-overline mb-4">Assinaturas (Pagamentos)</p>
              {subscriptions.map(s => (
                <div key={s.id} className="clf-liquid-glass p-4 mb-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`lv-badge text-[9px] ${s.status === "active" ? "lv-badge-success" : "lv-badge-muted"}`}>{s.status}</span>
                    <span className="text-sm font-bold">{s.plan}</span>
                    <span className="lv-caption text-[10px]">{format(new Date(s.starts_at), "dd/MM/yy")} → {format(new Date(s.expires_at), "dd/MM/yy")}</span>
                    {s.payment_id && <span className="text-[10px] font-mono text-muted-foreground">PAY: {s.payment_id.substring(0, 12)}</span>}
                    {s.affiliate_code && <span className="text-[10px] text-primary font-bold">Ref: {s.affiliate_code}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ USAGE TAB ═══ */}
      {subTab === "usage" && (
        <div className="space-y-6">
          {/* Usage chart (simple bar representation) */}
          <div className="clf-liquid-glass p-6">
            <p className="lv-overline mb-4">Uso Diário (últimos 30 dias)</p>
            {usage.length === 0 ? (
              <p className="lv-caption text-center py-8 opacity-40">Sem dados de uso</p>
            ) : (
              <div className="space-y-2">
                {usage.slice(0, 15).map(u => {
                  const maxMsg = Math.max(...usage.map(x => x.messages_used), 1);
                  const pct = (u.messages_used / maxMsg) * 100;
                  return (
                    <div key={u.id} className="flex items-center gap-3">
                      <span className="text-[11px] font-mono text-muted-foreground w-20 shrink-0">{u.date}</span>
                      <div className="flex-1 h-5 bg-muted/30 rounded-full overflow-hidden">
                        <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] font-bold w-10 text-right">{u.messages_used}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Current license usage */}
          {activeLicense && (
            <div className="clf-liquid-glass p-6">
              <p className="lv-overline mb-4">Licença Ativa</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><p className="lv-stat text-2xl">{activeLicense.messages_used_today}</p><p className="lv-caption text-[9px]">Msgs Hoje</p></div>
                <div><p className="lv-stat text-2xl">{activeLicense.daily_messages ?? "∞"}</p><p className="lv-caption text-[9px]">Limite/Dia</p></div>
                <div><p className="lv-stat text-2xl">{activeLicense.messages_used_month}</p><p className="lv-caption text-[9px]">Msgs/Mês</p></div>
                <div>
                  <p className="lv-stat text-2xl">{activeLicense.expires_at ? format(new Date(activeLicense.expires_at), "dd/MM") : "∞"}</p>
                  <p className="lv-caption text-[9px]">Expira</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ ACTIVITY TAB ═══ */}
      {subTab === "activity" && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="clf-liquid-glass p-5 text-center">
              <p className="lv-stat text-2xl">{extUsage.length}</p>
              <p className="lv-caption text-[9px]">Total Chamadas</p>
            </div>
            <div className="clf-liquid-glass p-5 text-center">
              <p className="lv-stat text-2xl">
                {extUsage.filter(u => {
                  const d = new Date(u.created_at);
                  const now = new Date();
                  return d.toDateString() === now.toDateString();
                }).length}
              </p>
              <p className="lv-caption text-[9px]">Hoje</p>
            </div>
            <div className="clf-liquid-glass p-5 text-center">
              <p className="lv-stat text-2xl">
                {extUsage.filter(u => new Date(u.created_at) > new Date(Date.now() - 7 * 86400000)).length}
              </p>
              <p className="lv-caption text-[9px]">Últimos 7 dias</p>
            </div>
            <div className="clf-liquid-glass p-5 text-center">
              <p className="lv-stat text-2xl">
                {extUsage.length > 0 ? format(new Date(extUsage[0].created_at), "dd/MM HH:mm") : "—"}
              </p>
              <p className="lv-caption text-[9px]">Último Acesso</p>
            </div>
          </div>

          {/* By Function */}
          <div className="clf-liquid-glass p-6">
            <p className="lv-overline mb-4">Chamadas por Endpoint</p>
            <div className="space-y-2">
              {Object.entries(
                extUsage.reduce((acc, u) => {
                  acc[u.function_name] = (acc[u.function_name] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              ).sort((a, b) => b[1] - a[1]).map(([fn, count]) => {
                const maxCount = Math.max(...Object.values(
                  extUsage.reduce((acc, u) => { acc[u.function_name] = (acc[u.function_name] || 0) + 1; return acc; }, {} as Record<string, number>)
                ), 1);
                return (
                  <div key={fn} className="flex items-center gap-3">
                    <span className="text-[11px] font-mono text-muted-foreground w-32 shrink-0 truncate">{fn}</span>
                    <div className="flex-1 h-5 bg-muted/30 rounded-full overflow-hidden">
                      <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${(count / maxCount) * 100}%` }} />
                    </div>
                    <span className="text-[11px] font-bold w-10 text-right">{count}</span>
                  </div>
                );
              })}
              {extUsage.length === 0 && <p className="lv-caption text-center py-8 opacity-40">Sem dados de atividade</p>}
            </div>
          </div>

          {/* Recent Calls Log */}
          <div className="clf-liquid-glass p-6">
            <p className="lv-overline mb-4">Log de Chamadas Recentes</p>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {extUsage.slice(0, 50).map(u => (
                <div key={u.id} className="flex items-center gap-3 py-2 border-b border-border/20 last:border-0">
                  <div className={`h-2 w-2 rounded-full shrink-0 ${
                    u.response_status && u.response_status < 300 ? "bg-green-500" :
                    u.response_status && u.response_status < 500 ? "bg-yellow-500" : "bg-red-500"
                  }`} />
                  <span className="text-[10px] font-mono text-muted-foreground w-28 shrink-0">
                    {format(new Date(u.created_at), "dd/MM HH:mm:ss")}
                  </span>
                  <span className="text-[11px] font-bold truncate flex-1">{u.function_name}</span>
                  {u.project_id && <span className="text-[9px] font-mono text-muted-foreground truncate max-w-[120px]">{u.project_id.substring(0, 8)}…</span>}
                  {u.duration_ms && <span className="text-[10px] text-muted-foreground">{u.duration_ms}ms</span>}
                  <span className={`text-[10px] font-bold ${
                    u.response_status && u.response_status < 300 ? "text-green-500" : "text-destructive"
                  }`}>{u.response_status || "—"}</span>
                </div>
              ))}
              {extUsage.length === 0 && <p className="lv-caption text-center py-8 opacity-40">Nenhuma chamada registrada</p>}
            </div>
          </div>
        </div>
      )}

      {/* ═══ PROJECTS TAB ═══ */}
      {subTab === "projects" && (
        <div className="space-y-4">
          {projects.length === 0 && <p className="lv-caption text-center py-12 opacity-40">Nenhum projeto encontrado</p>}
          {projects.map(p => (
            <div key={p.id} className="clf-liquid-glass p-5 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{p.display_name || p.name || p.lovable_project_id}</p>
                <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                  <span className="font-mono">{p.lovable_project_id}</span>
                  <span>{format(new Date(p.created_at), "dd/MM/yy")}</span>
                </div>
              </div>
              {p.published_url && (
                <a href={p.published_url} target="_blank" rel="noopener noreferrer"
                  className="lv-btn-secondary h-8 px-3 text-[10px] font-bold flex items-center gap-1.5">
                  <ExternalLink className="h-3 w-3" /> Ver
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ═══ ACTIVATIONS TAB ═══ */}
      {subTab === "activations" && (
        <div className="space-y-4">
          <p className="lv-overline">Histórico de Ativações</p>
          {activations.length === 0 && <p className="lv-caption text-center py-12 opacity-40">Nenhuma ativação registrada</p>}
          {activations.map(a => (
            <div key={a.id} className="clf-liquid-glass p-4 flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Monitor className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold">{format(new Date(a.activated_at), "dd/MM/yyyy HH:mm:ss")}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{a.user_agent?.substring(0, 80) || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-[10px] text-muted-foreground shrink-0">
                {a.ip_address && (
                  <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> {a.ip_address}</span>
                )}
                {a.location && (
                  <span className="flex items-center gap-1"><Activity className="h-3 w-3" /> {a.location}</span>
                )}
                {a.device_info && (
                  <span className="font-mono">{a.device_info.substring(0, 20)}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ MESSAGES TAB ═══ */}
      {subTab === "messages" && (
        <div className="clf-liquid-glass flex flex-col max-h-[600px]">
          <div className="px-6 py-4 border-b border-border/50">
            <p className="lv-overline">Canal Direto com {profile?.name || profile?.email}</p>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            {messages.filter(m => m.sender_id === currentAdminId || m.receiver_id === currentAdminId).slice().reverse().map(msg => (
              <div key={msg.id} className={`flex ${msg.sender_id === currentAdminId ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-[13px] ${
                  msg.sender_id === currentAdminId
                    ? "bg-primary text-primary-foreground rounded-br-none"
                    : "bg-muted rounded-bl-none"
                }`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p className={`text-[9px] mt-1 opacity-50 ${msg.sender_id === currentAdminId ? "text-right" : ""}`}>
                    {format(new Date(msg.created_at), "dd/MM HH:mm")}
                  </p>
                </div>
              </div>
            ))}
            {messages.length === 0 && <p className="lv-caption text-center py-12 opacity-40">Nenhuma mensagem</p>}
          </div>
          <div className="p-4 border-t border-border/50 flex gap-2">
            <input value={newMessage} onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMsg()}
              placeholder="Enviar mensagem..." className="lv-input flex-1" />
            <button onClick={sendMsg} disabled={!newMessage.trim()} className="lv-btn-primary h-10 w-10 p-0 shrink-0">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
