import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { useSEO } from "@/hooks/useSEO";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import {
  CloudLightning, Users, CheckCircle, XCircle, Clock,
  RefreshCw, Unlink, ExternalLink, Loader2, ShieldAlert,
  Activity, Key, Globe, Webhook,
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type LovableAccount = Database["public"]["Tables"]["lovable_accounts"]["Row"] & {
  profiles?: { name: string | null; email: string | null } | null;
};

type ApiCallLog = Database["public"]["Tables"]["lovable_api_calls_log"]["Row"];

const PROXY_INFO = {
  base_url: "https://api.lovable.dev",
  firebase_refresh_url: "https://securetoken.googleapis.com/v1/token",
  allowed_prefixes: ["/user/", "/projects/", "/workspaces/"],
  required_headers: [
    "Origin: https://lovable.dev",
    "Referer: https://lovable.dev/",
    "x-client-git-sha: <latest>",
  ],
  edge_function: "lovable-proxy",
};

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: number | string; color: string;
}) {
  return (
    <div className="lv-card flex items-center gap-4 p-5">
      <div
        className="w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0"
        style={{ background: color + "18" }}
      >
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <div>
        <p className="lv-stat text-[22px]" style={{ color }}>{value}</p>
        <p className="lv-caption mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active:  { label: "Ativo",     cls: "lv-badge lv-badge-success" },
    expired: { label: "Expirado",  cls: "lv-badge lv-badge-warning" },
    error:   { label: "Erro",      cls: "lv-badge lv-badge-destructive" },
    none:    { label: "Sem token", cls: "lv-badge lv-badge-muted" },
  };
  const s = map[status] ?? { label: status, cls: "lv-badge lv-badge-muted" };
  return <span className={s.cls}>{s.label}</span>;
}

export default function LovableCloudAdmin() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const navigate = useNavigate();
  useSEO({ title: "Lovable Cloud Admin" });

  const [accounts, setAccounts] = useState<LovableAccount[]>([]);
  const [logs, setLogs]         = useState<ApiCallLog[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingLogs, setLoadingLogs]         = useState(true);
  const [refreshing, setRefreshing]           = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
    if (!adminLoading && !isAdmin) navigate("/dashboard");
  }, [user, authLoading, isAdmin, adminLoading, navigate]);

  const fetchAll = async () => {
    setLoadingAccounts(true);
    setLoadingLogs(true);

    // Accounts — join with profiles via user_id
    const { data: accs } = await supabase
      .from("lovable_accounts")
      .select("*, profiles(name, email)")
      .order("created_at", { ascending: false })
      .limit(100);
    setAccounts((accs as LovableAccount[]) || []);
    setLoadingAccounts(false);

    // API call logs
    const { data: logsData } = await supabase
      .from("lovable_api_calls_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setLogs(logsData || []);
    setLoadingLogs(false);
  };

  useEffect(() => {
    if (user && isAdmin) fetchAll();
  }, [user, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    toast.success("Dados atualizados.");
    setRefreshing(false);
  };

  const handleRevoke = async (accountId: string, label: string) => {
    if (!confirm(`Revogar token de ${label}?`)) return;
    const { error } = await supabase
      .from("lovable_accounts")
      .update({ status: "expired", token_encrypted: "" })
      .eq("id", accountId);
    if (error) toast.error("Erro ao revogar token.");
    else {
      toast.success("Token revogado.");
      setAccounts(prev => prev.map(a => a.id === accountId ? { ...a, status: "expired" } : a));
    }
  };

  const activeCount  = accounts.filter(a => a.status === "active").length;
  const expiredCount = accounts.filter(a => a.status === "expired" || a.status === "error").length;
  const noneCount    = accounts.filter(a => a.status === "none").length;

  if (authLoading || adminLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) return null;

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <p className="lv-label mb-1">Admin</p>
            <h1 className="lv-heading-lg flex items-center gap-2.5">
              <CloudLightning className="h-7 w-7" style={{ color: "var(--clf-plan)" }} />
              Lovable Cloud
            </h1>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="lv-btn-secondary h-9 px-4 text-xs gap-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Users}        label="Total de contas"  value={accounts.length} color="#0071e3" />
          <StatCard icon={CheckCircle}  label="Tokens ativos"    value={activeCount}     color="#34c759" />
          <StatCard icon={XCircle}      label="Expirados / Erro" value={expiredCount}    color="#ff3b30" />
          <StatCard icon={Clock}        label="Sem token"        value={noneCount}       color="#ff9f0a" />
        </div>

        {/* ── Accounts table ── */}
        <div className="lv-card p-0 overflow-hidden">
          <div
            className="px-5 py-4 flex items-center justify-between border-b"
            style={{ borderColor: "var(--clf-border-dark)" }}
          >
            <div>
              <p className="lv-body-strong">Contas conectadas</p>
              <p className="lv-caption mt-0.5">{accounts.length} usuários com registro Lovable</p>
            </div>
            <Key className="h-4 w-4 text-muted-foreground" />
          </div>

          {loadingAccounts ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="lv-empty m-5">
              <p className="lv-body">Nenhuma conta conectada ainda.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr
                    className="border-b"
                    style={{ borderColor: "var(--clf-border-dark)", background: "rgba(245,245,247,0.5)" }}
                  >
                    <th className="text-left px-5 py-2.5 clf-section-label font-bold">Usuário</th>
                    <th className="text-left px-4 py-2.5 clf-section-label font-bold">Status</th>
                    <th className="text-left px-4 py-2.5 clf-section-label font-bold hidden md:table-cell">Última verificação</th>
                    <th className="text-left px-4 py-2.5 clf-section-label font-bold hidden lg:table-cell">Criado em</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((acc) => {
                    const profileName  = acc.profiles?.name  || "—";
                    const profileEmail = acc.profiles?.email || acc.user_id.substring(0, 8) + "...";
                    const initial      = (acc.profiles?.name || acc.profiles?.email || "?")[0].toUpperCase();
                    return (
                      <tr
                        key={acc.id}
                        className="border-b transition-colors hover:bg-black/[0.02]"
                        style={{ borderColor: "var(--clf-border)" }}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                              style={{ background: "linear-gradient(135deg,#0071e3,#5e5ce6)" }}
                            >
                              {initial}
                            </div>
                            <div>
                              <p className="font-semibold text-foreground leading-tight">{profileName}</p>
                              <p className="text-muted-foreground text-[10px]">{profileEmail}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={acc.status} />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                          {acc.last_verified_at
                            ? formatDistanceToNow(new Date(acc.last_verified_at), { addSuffix: true, locale: ptBR })
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                          {format(new Date(acc.created_at), "dd/MM/yy")}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleRevoke(acc.id, profileEmail)}
                            disabled={acc.status !== "active"}
                            className="lv-btn-danger h-7 px-2.5 text-[10px] disabled:opacity-30 disabled:pointer-events-none"
                          >
                            <Unlink className="h-3 w-3 mr-1" />
                            Revogar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── API Call Logs ── */}
        <div className="lv-card p-0 overflow-hidden">
          <div
            className="px-5 py-4 flex items-center justify-between border-b"
            style={{ borderColor: "var(--clf-border-dark)" }}
          >
            <div>
              <p className="lv-body-strong">Log de chamadas API</p>
              <p className="lv-caption mt-0.5">Últimas 100 chamadas via lovable-proxy</p>
            </div>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </div>

          {loadingLogs ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <ShieldAlert className="h-8 w-8 mx-auto text-muted-foreground mb-3 opacity-40" />
              <p className="lv-body">Nenhum log disponível.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr
                    className="border-b"
                    style={{ borderColor: "var(--clf-border-dark)", background: "rgba(245,245,247,0.5)" }}
                  >
                    <th className="text-left px-5 py-2.5 clf-section-label font-bold">Endpoint</th>
                    <th className="text-left px-4 py-2.5 clf-section-label font-bold">Método</th>
                    <th className="text-left px-4 py-2.5 clf-section-label font-bold">Status</th>
                    <th className="text-left px-4 py-2.5 clf-section-label font-bold hidden md:table-cell">Duração</th>
                    <th className="text-left px-4 py-2.5 clf-section-label font-bold">Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const isOk  = log.response_status != null && log.response_status < 400;
                    const isErr = log.response_status != null && log.response_status >= 400;
                    return (
                      <tr
                        key={log.id}
                        className="border-b transition-colors hover:bg-black/[0.02]"
                        style={{ borderColor: "var(--clf-border)" }}
                      >
                        <td
                          className="px-5 py-2.5 font-mono text-[11px] text-foreground max-w-[220px] truncate"
                          title={log.endpoint}
                        >
                          {log.endpoint}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="lv-badge lv-badge-muted">{log.method}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          {log.response_status != null ? (
                            <span className={`lv-badge ${isOk ? "lv-badge-success" : isErr ? "lv-badge-destructive" : "lv-badge-warning"}`}>
                              {log.response_status}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell">
                          {log.duration_ms != null ? `${log.duration_ms}ms` : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {format(new Date(log.created_at), "HH:mm:ss")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Proxy Configuration ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <div className="lv-card space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <p className="lv-body-strong">URLs do Proxy</p>
            </div>
            <div className="space-y-3">
              {[
                { label: "API Base",         value: PROXY_INFO.base_url },
                { label: "Firebase Refresh", value: PROXY_INFO.firebase_refresh_url },
                { label: "Edge Function",    value: PROXY_INFO.edge_function },
              ].map(item => (
                <div key={item.label}>
                  <p className="clf-section-label mb-1">{item.label}</p>
                  <div className="flex items-center gap-2">
                    <code
                      className="text-[11px] font-mono text-foreground flex-1 px-3 py-2 rounded-[8px] truncate"
                      style={{ background: "rgba(245,245,247,0.8)", border: "0.5px solid var(--clf-border-dark)" }}
                    >
                      {item.value}
                    </code>
                    {item.value.startsWith("http") && (
                      <a
                        href={item.value}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="lv-btn-icon h-8 w-8 shrink-0"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div>
              <p className="clf-section-label mb-2">Prefixos permitidos</p>
              <div className="flex flex-wrap gap-2">
                {PROXY_INFO.allowed_prefixes.map(p => (
                  <span key={p} className="lv-pill">{p}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="lv-card space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Webhook className="h-4 w-4 text-muted-foreground" />
              <p className="lv-body-strong">Headers injetados</p>
            </div>
            <p className="lv-caption">
              Todos os requests para <code className="lv-mono">api.lovable.dev</code> incluem:
            </p>
            <div className="space-y-2">
              {PROXY_INFO.required_headers.map(h => (
                <div
                  key={h}
                  className="px-3 py-2 rounded-[8px] font-mono text-[11px] text-foreground"
                  style={{ background: "rgba(245,245,247,0.8)", border: "0.5px solid var(--clf-border-dark)" }}
                >
                  {h}
                </div>
              ))}
            </div>
            <div
              className="rounded-[10px] p-3.5 space-y-1"
              style={{ background: "var(--clf-accent-bg)", border: "0.5px solid rgba(0,113,227,0.15)" }}
            >
              <p className="lv-body-strong text-[12px]" style={{ color: "var(--clf-accent)" }}>
                🔒 Auto-refresh ativo
              </p>
              <p className="lv-caption">
                Tokens expirados são renovados automaticamente via Firebase securetoken API.
              </p>
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
