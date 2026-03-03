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
  required_headers: ["Origin: https://lovable.dev", "Referer: https://lovable.dev/", "x-client-git-sha: <latest>"],
  edge_function: "lovable-proxy",
};

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number | string; color: string }) {
  return (
    <div className="rd-stat-card">
      <div className="rd-ico-box" style={{ background: color + "18" }}><Icon className="h-5 w-5" style={{ color }} /></div>
      <div style={{ marginTop: 12 }}>
        <div className="rd-stat-label">{label}</div>
        <div className="rd-stat-value" style={{ color, fontSize: 22 }}>{value}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: "Ativo", cls: "chip green" },
    expired: { label: "Expirado", cls: "chip orange" },
    error: { label: "Erro", cls: "chip red" },
    none: { label: "Sem token", cls: "chip" },
  };
  const s = map[status] ?? { label: status, cls: "chip" };
  return <span className={s.cls}>{s.label}</span>;
}

export default function LovableCloudAdmin() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const navigate = useNavigate();
  useSEO({ title: "Lovable Cloud Admin" });
  const [accounts, setAccounts] = useState<LovableAccount[]>([]);
  const [logs, setLogs] = useState<ApiCallLog[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
    if (!adminLoading && !isAdmin) navigate("/dashboard");
  }, [user, authLoading, isAdmin, adminLoading, navigate]);

  const fetchAll = async () => {
    setLoadingAccounts(true); setLoadingLogs(true);
    const { data: accs } = await supabase.from("lovable_accounts").select("*, profiles(name, email)").order("created_at", { ascending: false }).limit(100);
    setAccounts((accs as unknown as LovableAccount[]) || []); setLoadingAccounts(false);
    const { data: logsData } = await supabase.from("lovable_api_calls_log").select("*").order("created_at", { ascending: false }).limit(100);
    setLogs(logsData || []); setLoadingLogs(false);
  };

  useEffect(() => { if (user && isAdmin) fetchAll(); }, [user, isAdmin]); // eslint-disable-line

  const handleRefresh = async () => { setRefreshing(true); await fetchAll(); toast.success("Dados atualizados."); setRefreshing(false); };

  const handleRevoke = async (accountId: string, label: string) => {
    if (!confirm(`Revogar token de ${label}?`)) return;
    const { error } = await supabase.from("lovable_accounts").update({ status: "expired", token_encrypted: "" }).eq("id", accountId);
    if (error) toast.error("Erro ao revogar token.");
    else { toast.success("Token revogado."); setAccounts(prev => prev.map(a => a.id === accountId ? { ...a, status: "expired" } : a)); }
  };

  const activeCount = accounts.filter(a => a.status === "active").length;
  const expiredCount = accounts.filter(a => a.status === "expired" || a.status === "error").length;
  const noneCount = accounts.filter(a => a.status === "none").length;

  if (authLoading || adminLoading) return <AppLayout><div className="flex items-center justify-center h-[60vh]"><Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--text-tertiary)" }} /></div></AppLayout>;
  if (!isAdmin) return null;

  return (
    <AppLayout>
      <div className="rd-page-content">
        {/* Header */}
        <div className="rd-page-head">
          <div className="flex items-center justify-between">
            <div>
              <div className="sec-label">Admin</div>
              <h1 className="flex items-center gap-2.5"><CloudLightning className="h-6 w-6" style={{ color: "var(--blue-l)" }} /> Lovable Cloud</h1>
            </div>
            <button onClick={handleRefresh} disabled={refreshing} className="gl sm ghost">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Atualizar
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="rd-grid-4" style={{ marginBottom: 20 }}>
          <StatCard icon={Users} label="Total de contas" value={accounts.length} color="#3b82f6" />
          <StatCard icon={CheckCircle} label="Tokens ativos" value={activeCount} color="#22c55e" />
          <StatCard icon={XCircle} label="Expirados / Erro" value={expiredCount} color="#ef4444" />
          <StatCard icon={Clock} label="Sem token" value={noneCount} color="#f59e0b" />
        </div>

        {/* Accounts table */}
        <div className="rd-card" style={{ padding: 0, overflow: "hidden", marginBottom: 20 }}>
          <div className="flex items-center justify-between" style={{ padding: "14px 18px", borderBottom: "1px solid var(--b1)" }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Contas conectadas</p>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{accounts.length} usuários com registro</p>
            </div>
            <Key className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
          </div>
          {loadingAccounts ? (
            <div className="flex items-center justify-center" style={{ padding: "48px 0" }}><Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--text-tertiary)" }} /></div>
          ) : accounts.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center" }}><p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Nenhuma conta conectada ainda.</p></div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: 12 }}>
                <thead><tr style={{ borderBottom: "1px solid var(--b1)", background: "var(--bg-2)" }}>
                  <th style={{ textAlign: "left", padding: "8px 18px" }} className="sec-label">Usuário</th>
                  <th style={{ textAlign: "left", padding: "8px 14px" }} className="sec-label">Status</th>
                  <th style={{ textAlign: "left", padding: "8px 14px" }} className="sec-label hidden md:table-cell">Última verificação</th>
                  <th style={{ textAlign: "left", padding: "8px 14px" }} className="sec-label hidden lg:table-cell">Criado em</th>
                  <th style={{ padding: "8px 14px" }}></th>
                </tr></thead>
                <tbody>
                  {accounts.map(acc => {
                    const profileName = acc.profiles?.name || "—";
                    const profileEmail = acc.profiles?.email || acc.user_id.substring(0, 8) + "...";
                    const initial = (acc.profiles?.name || acc.profiles?.email || "?")[0].toUpperCase();
                    return (
                      <tr key={acc.id} style={{ borderBottom: "1px solid var(--b1)" }} className="hover:bg-[var(--bg-2)] transition-colors">
                        <td style={{ padding: "10px 18px" }}>
                          <div className="flex items-center gap-2.5">
                            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{initial}</div>
                            <div><p style={{ fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}>{profileName}</p><p style={{ color: "var(--text-tertiary)", fontSize: 10 }}>{profileEmail}</p></div>
                          </div>
                        </td>
                        <td style={{ padding: "10px 14px" }}><StatusBadge status={acc.status} /></td>
                        <td style={{ padding: "10px 14px", color: "var(--text-tertiary)" }} className="hidden md:table-cell">{acc.last_verified_at ? formatDistanceToNow(new Date(acc.last_verified_at), { addSuffix: true, locale: ptBR }) : "—"}</td>
                        <td style={{ padding: "10px 14px", color: "var(--text-tertiary)" }} className="hidden lg:table-cell">{format(new Date(acc.created_at), "dd/MM/yy")}</td>
                        <td style={{ padding: "10px 14px" }}>
                          <button onClick={() => handleRevoke(acc.id, profileEmail)} disabled={acc.status !== "active"} className="gl xs ghost" style={{ color: "var(--red-l)", opacity: acc.status !== "active" ? 0.3 : 1 }}>
                            <Unlink className="h-3 w-3" /> Revogar
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

        {/* API Call Logs */}
        <div className="rd-card" style={{ padding: 0, overflow: "hidden", marginBottom: 20 }}>
          <div className="flex items-center justify-between" style={{ padding: "14px 18px", borderBottom: "1px solid var(--b1)" }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Log de chamadas API</p>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>Últimas 100 chamadas via lovable-proxy</p>
            </div>
            <Activity className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
          </div>
          {loadingLogs ? (
            <div className="flex items-center justify-center" style={{ padding: "48px 0" }}><Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--text-tertiary)" }} /></div>
          ) : logs.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center" }}>
              <ShieldAlert className="h-8 w-8 mx-auto" style={{ color: "var(--text-tertiary)", opacity: 0.4, marginBottom: 12 }} />
              <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Nenhum log disponível.</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: 12 }}>
                <thead><tr style={{ borderBottom: "1px solid var(--b1)", background: "var(--bg-2)" }}>
                  <th style={{ textAlign: "left", padding: "8px 18px" }} className="sec-label">Endpoint</th>
                  <th style={{ textAlign: "left", padding: "8px 14px" }} className="sec-label">Método</th>
                  <th style={{ textAlign: "left", padding: "8px 14px" }} className="sec-label">Status</th>
                  <th style={{ textAlign: "left", padding: "8px 14px" }} className="sec-label hidden md:table-cell">Duração</th>
                  <th style={{ textAlign: "left", padding: "8px 14px" }} className="sec-label">Hora</th>
                </tr></thead>
                <tbody>
                  {logs.map(log => {
                    const isOk = log.response_status != null && log.response_status < 400;
                    const isErr = log.response_status != null && log.response_status >= 400;
                    return (
                      <tr key={log.id} style={{ borderBottom: "1px solid var(--b1)" }} className="hover:bg-[var(--bg-2)] transition-colors">
                        <td style={{ padding: "8px 18px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-primary)", maxWidth: 220 }} className="truncate" title={log.endpoint}>{log.endpoint}</td>
                        <td style={{ padding: "8px 14px" }}><span className="chip">{log.method}</span></td>
                        <td style={{ padding: "8px 14px" }}>{log.response_status != null ? <span className={`chip ${isOk ? "green" : isErr ? "red" : "orange"}`}>{log.response_status}</span> : "—"}</td>
                        <td style={{ padding: "8px 14px", color: "var(--text-tertiary)" }} className="hidden md:table-cell">{log.duration_ms != null ? `${log.duration_ms}ms` : "—"}</td>
                        <td style={{ padding: "8px 14px", color: "var(--text-tertiary)" }}>{format(new Date(log.created_at), "HH:mm:ss")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Proxy Configuration */}
        <div className="rd-grid-2">
          <div className="rd-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="flex items-center gap-2"><Globe className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} /><p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>URLs do Proxy</p></div>
            {[
              { label: "API Base", value: PROXY_INFO.base_url },
              { label: "Firebase Refresh", value: PROXY_INFO.firebase_refresh_url },
              { label: "Edge Function", value: PROXY_INFO.edge_function },
            ].map(item => (
              <div key={item.label}>
                <p className="sec-label" style={{ marginBottom: 4 }}>{item.label}</p>
                <div className="flex items-center gap-2">
                  <code style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-primary)", flex: 1, padding: "6px 10px", borderRadius: "var(--r2)", background: "var(--bg-3)", border: "1px solid var(--b1)" }} className="truncate">{item.value}</code>
                  {item.value.startsWith("http") && <a href={item.value} target="_blank" rel="noopener noreferrer" className="gl ico xs ghost"><ExternalLink className="h-3.5 w-3.5" /></a>}
                </div>
              </div>
            ))}
            <div>
              <p className="sec-label" style={{ marginBottom: 6 }}>Prefixos permitidos</p>
              <div className="flex flex-wrap gap-2">{PROXY_INFO.allowed_prefixes.map(p => <span key={p} className="chip">{p}</span>)}</div>
            </div>
          </div>

          <div className="rd-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="flex items-center gap-2"><Webhook className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} /><p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Headers injetados</p></div>
            <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Todos os requests para <code style={{ fontFamily: "var(--font-mono)" }}>api.lovable.dev</code> incluem:</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {PROXY_INFO.required_headers.map(h => (
                <div key={h} style={{ padding: "6px 10px", borderRadius: "var(--r2)", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-primary)", background: "var(--bg-3)", border: "1px solid var(--b1)" }}>{h}</div>
              ))}
            </div>
            <div className="rd-alert info">
              <p style={{ fontWeight: 600, fontSize: 12 }}>Auto-refresh ativo</p>
              <p style={{ fontSize: 11, marginTop: 2 }}>Tokens expirados são renovados automaticamente via Firebase securetoken API.</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
