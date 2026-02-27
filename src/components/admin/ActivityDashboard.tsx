import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, Users, MessageSquare, Zap, Crown, BarChart3, Activity, Globe } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

interface UsageRow {
  id: string;
  license_id: string;
  user_id: string;
  tenant_id: string | null;
  date: string;
  messages_used: number;
}

interface LicenseRow {
  id: string;
  user_id: string;
  tenant_id: string | null;
  plan: string;
  active: boolean;
  status: string;
  daily_messages: number | null;
  messages_used_today: number;
  created_at: string;
}

interface ProfileRow {
  user_id: string;
  name: string;
  email: string;
  tenant_id: string | null;
}

interface ExtLog {
  id: string;
  user_id: string;
  function_name: string;
  project_id: string | null;
  response_status: number | null;
  duration_ms: number | null;
  created_at: string;
  ip_address: string | null;
}

interface TenantOption {
  id: string;
  name: string;
}

interface Props {
  isGlobalAdmin: boolean;
  tenantId?: string | null;
}

export default function ActivityDashboard({ isGlobalAdmin, tenantId }: Props) {
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [licenses, setLicenses] = useState<LicenseRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [extLogs, setExtLogs] = useState<ExtLog[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);

  // Filters
  const [filterTenant, setFilterTenant] = useState<string>("all");
  const [filterPeriod, setFilterPeriod] = useState<string>("7d");
  const [filterPlan, setFilterPlan] = useState<string>("all");

  useEffect(() => {
    fetchData();
  }, [isGlobalAdmin, tenantId]);

  async function fetchData() {
    setLoading(true);
    try {
      const days = 30;
      const since = subDays(new Date(), days).toISOString().split("T")[0];

      // Usage data
      let usageQ = supabase.from("daily_usage").select("*").gte("date", since).order("date", { ascending: false });
      if (!isGlobalAdmin && tenantId) usageQ = usageQ.eq("tenant_id", tenantId);
      const usageRes = await usageQ;

      // Licenses
      let licQ = supabase.from("licenses").select("id, user_id, tenant_id, plan, active, status, daily_messages, messages_used_today, created_at");
      if (!isGlobalAdmin && tenantId) licQ = licQ.eq("tenant_id", tenantId);
      const licRes = await licQ;

      // Profiles
      let profQ = supabase.from("profiles").select("user_id, name, email, tenant_id");
      if (!isGlobalAdmin && tenantId) profQ = profQ.eq("tenant_id", tenantId);
      const profRes = await profQ;

      // Extension logs (last 30d)
      const extRes = await supabase.from("extension_usage_logs").select("*")
        .gte("created_at", subDays(new Date(), days).toISOString())
        .order("created_at", { ascending: false }).limit(1000);

      setUsage(usageRes.data || []);
      setLicenses(licRes.data || []);
      setProfiles(profRes.data || []);
      setExtLogs(extRes.data || []);

      // Tenants (global admin only)
      if (isGlobalAdmin) {
        const tenantRes = await supabase.from("tenants").select("id, name").order("name");
        setTenants(tenantRes.data || []);
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  // ── Computed data ──
  const periodDays = filterPeriod === "1d" ? 1 : filterPeriod === "7d" ? 7 : filterPeriod === "14d" ? 14 : 30;
  const periodSince = subDays(new Date(), periodDays).toISOString().split("T")[0];

  const filteredUsage = useMemo(() => {
    let data = usage.filter(u => u.date >= periodSince);
    if (filterTenant !== "all") data = data.filter(u => u.tenant_id === filterTenant);
    return data;
  }, [usage, periodSince, filterTenant]);

  const filteredLicenses = useMemo(() => {
    let data = licenses;
    if (filterTenant !== "all") data = data.filter(l => l.tenant_id === filterTenant);
    if (filterPlan !== "all") data = data.filter(l => l.plan === filterPlan);
    return data;
  }, [licenses, filterTenant, filterPlan]);

  const profileMap = useMemo(() => {
    const m = new Map<string, ProfileRow>();
    profiles.forEach(p => m.set(p.user_id, p));
    return m;
  }, [profiles]);

  // ── KPIs ──
  const totalMessages = filteredUsage.reduce((s, u) => s + u.messages_used, 0);
  const activeUsers = new Set(filteredUsage.map(u => u.user_id)).size;
  const totalActiveLicenses = filteredLicenses.filter(l => l.active).length;
  const totalLicenses = filteredLicenses.length;
  const avgMessagesPerUser = activeUsers > 0 ? Math.round(totalMessages / activeUsers) : 0;

  // ── Messages per day chart data ──
  const dailyData = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < periodDays; i++) {
      const d = subDays(new Date(), i).toISOString().split("T")[0];
      map.set(d, 0);
    }
    filteredUsage.forEach(u => {
      map.set(u.date, (map.get(u.date) || 0) + u.messages_used);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));
  }, [filteredUsage, periodDays]);

  const maxDaily = Math.max(1, ...dailyData.map(d => d.count));

  // ── Top users ranking ──
  const topUsers = useMemo(() => {
    const userMap = new Map<string, number>();
    filteredUsage.forEach(u => {
      userMap.set(u.user_id, (userMap.get(u.user_id) || 0) + u.messages_used);
    });
    return Array.from(userMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userId, messages], idx) => {
        const profile = profileMap.get(userId);
        const license = licenses.find(l => l.user_id === userId && l.active);
        return {
          rank: idx + 1,
          userId,
          name: profile?.name || "—",
          email: profile?.email || userId.slice(0, 8),
          messages,
          plan: license?.plan || "—",
        };
      });
  }, [filteredUsage, profileMap, licenses]);

  // ── Plan distribution ──
  const planDistribution = useMemo(() => {
    const map = new Map<string, number>();
    filteredLicenses.filter(l => l.active).forEach(l => {
      const plan = l.plan || "unknown";
      map.set(plan, (map.get(plan) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([plan, count]) => ({ plan, count }));
  }, [filteredLicenses]);

  // ── Top functions (extension usage) ──
  const topFunctions = useMemo(() => {
    const map = new Map<string, number>();
    extLogs.forEach(l => {
      map.set(l.function_name, (map.get(l.function_name) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [extLogs]);

  // ── Unique plans for filter ──
  const uniquePlans = useMemo(() => {
    return Array.from(new Set(licenses.map(l => l.plan))).filter(Boolean).sort();
  }, [licenses]);

  // ── Tenant distribution ──
  const tenantDistribution = useMemo(() => {
    if (!isGlobalAdmin) return [];
    const map = new Map<string, number>();
    filteredUsage.forEach(u => {
      const tid = u.tenant_id || "no_tenant";
      map.set(tid, (map.get(tid) || 0) + u.messages_used);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tid, messages]) => ({
        tenantId: tid,
        name: tenants.find(t => t.id === tid)?.name || tid.slice(0, 8),
        messages,
      }));
  }, [filteredUsage, tenants, isGlobalAdmin]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={filterPeriod} onValueChange={setFilterPeriod}>
          <SelectTrigger className="w-[140px] h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1d">Hoje</SelectItem>
            <SelectItem value="7d">7 dias</SelectItem>
            <SelectItem value="14d">14 dias</SelectItem>
            <SelectItem value="30d">30 dias</SelectItem>
          </SelectContent>
        </Select>

        {isGlobalAdmin && (
          <Select value={filterTenant} onValueChange={setFilterTenant}>
            <SelectTrigger className="w-[180px] h-9 text-xs">
              <SelectValue placeholder="Todos os tenants" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tenants</SelectItem>
              {tenants.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={filterPlan} onValueChange={setFilterPlan}>
          <SelectTrigger className="w-[140px] h-9 text-xs">
            <SelectValue placeholder="Todos os planos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os planos</SelectItem>
            {uniquePlans.map(p => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="clf-liquid-glass p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MessageSquare className="h-4 w-4" />
            <span className="text-xs font-medium">Mensagens</span>
          </div>
          <p className="text-2xl font-bold">{totalMessages.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">{periodDays}d período</p>
        </div>
        <div className="clf-liquid-glass p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-xs font-medium">Usuários ativos</span>
          </div>
          <p className="text-2xl font-bold">{activeUsers}</p>
          <p className="text-xs text-muted-foreground">com uso no período</p>
        </div>
        <div className="clf-liquid-glass p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Zap className="h-4 w-4" />
            <span className="text-xs font-medium">Licenças ativas</span>
          </div>
          <p className="text-2xl font-bold">{totalActiveLicenses}<span className="text-sm text-muted-foreground">/{totalLicenses}</span></p>
          <p className="text-xs text-muted-foreground">ativa / total</p>
        </div>
        <div className="clf-liquid-glass p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs font-medium">Média/usuário</span>
          </div>
          <p className="text-2xl font-bold">{avgMessagesPerUser}</p>
          <p className="text-xs text-muted-foreground">mensagens/usuário</p>
        </div>
      </div>

      {/* Messages per day chart */}
      <div className="clf-liquid-glass p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Mensagens por dia</h3>
          </div>
          <span className="text-xs text-muted-foreground">{dailyData.length} dias</span>
        </div>
        <div className="flex items-end gap-[2px] h-32">
          {dailyData.map((d, i) => {
            const h = Math.max(2, (d.count / maxDaily) * 100);
            return (
              <div key={i} className="flex-1 group relative flex flex-col items-center justify-end">
                <div
                  className="w-full bg-primary/80 hover:bg-primary rounded-t transition-colors min-w-[4px]"
                  style={{ height: `${h}%` }}
                />
                <div className="absolute -top-8 bg-popover text-popover-foreground text-[10px] px-1.5 py-0.5 rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10">
                  {format(new Date(d.date), "dd/MM")}: {d.count}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-muted-foreground">{dailyData[0]?.date ? format(new Date(dailyData[0].date), "dd/MM") : ""}</span>
          <span className="text-[10px] text-muted-foreground">{dailyData.length > 0 ? format(new Date(dailyData[dailyData.length - 1].date), "dd/MM") : ""}</span>
        </div>
        </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Top Users Ranking */}
        <div className="clf-liquid-glass p-5">
          <div className="flex items-center gap-2 mb-4">
            <Crown className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-semibold">Top 10 Usuários</h3>
          </div>
          <div className="space-y-2 max-h-[340px] overflow-y-auto">
            {topUsers.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum dado no período</p>
            ) : topUsers.map(u => (
              <div key={u.userId} className="flex items-center gap-3 text-xs py-1.5 border-b border-border/50 last:border-0">
                <span className={`w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-bold ${
                  u.rank <= 3 ? "bg-accent/20 text-accent-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  {u.rank}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{u.name}</p>
                  <p className="text-muted-foreground truncate">{u.email}</p>
                </div>
                <Badge variant="outline" className="text-[10px]">{u.plan}</Badge>
                <span className="font-bold tabular-nums">{u.messages.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Plan Distribution */}
        <div className="clf-liquid-glass p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Distribuição por plano</h3>
          </div>
          <div className="space-y-3">
            {planDistribution.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhuma licença ativa</p>
            ) : planDistribution.map(pd => {
              const pct = totalActiveLicenses > 0 ? ((pd.count / totalActiveLicenses) * 100).toFixed(1) : "0";
              return (
                <div key={pd.plan} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium capitalize">{pd.plan}</span>
                    <span className="text-muted-foreground">{pd.count} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Function usage */}
          {topFunctions.length > 0 && (
            <>
              <div className="flex items-center gap-2 mt-6 mb-3">
                <Zap className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Endpoints mais usados</h3>
              </div>
              <div className="space-y-1.5">
                {topFunctions.map(([fn, count]) => (
                  <div key={fn} className="flex justify-between text-xs">
                    <span className="font-mono text-muted-foreground truncate">{fn}</span>
                    <span className="font-medium tabular-nums">{count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tenant distribution (global admin only) */}
      {isGlobalAdmin && tenantDistribution.length > 0 && (
        <div className="clf-liquid-glass p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Mensagens por tenant</h3>
          </div>
          <div className="space-y-2">
            {tenantDistribution.map(td => {
              const totalTenantMsg = tenantDistribution.reduce((s, t) => s + t.messages, 0);
              const pct = totalTenantMsg > 0 ? ((td.messages / totalTenantMsg) * 100).toFixed(1) : "0";
              return (
                <div key={td.tenantId} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">{td.name}</span>
                    <span className="text-muted-foreground">{td.messages.toLocaleString()} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary/70 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
