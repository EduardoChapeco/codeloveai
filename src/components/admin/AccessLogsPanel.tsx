import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  MapPin, Globe, Monitor, Smartphone, Tablet, RefreshCw,
  Loader2, Search, Shield, Clock, Wifi, ChevronDown, ChevronUp,
  Eye, User, Hash, Activity
} from "lucide-react";
import { format } from "date-fns";

interface AccessLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  ip_address: string | null;
  country: string | null;
  country_code: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  isp: string | null;
  org: string | null;
  as_number: string | null;
  device_type: string | null;
  browser: string | null;
  browser_version: string | null;
  os: string | null;
  os_version: string | null;
  screen_width: number | null;
  screen_height: number | null;
  language: string | null;
  referrer: string | null;
  page_url: string | null;
  user_agent: string | null;
  is_mobile: boolean;
  is_vpn: boolean;
  session_id: string | null;
  created_at: string;
}

const FLAG_EMOJI: Record<string, string> = {
  US: "🇺🇸", BR: "🇧🇷", PT: "🇵🇹", GB: "🇬🇧", DE: "🇩🇪", FR: "🇫🇷",
  ES: "🇪🇸", IT: "🇮🇹", CA: "🇨🇦", AU: "🇦🇺", JP: "🇯🇵", IN: "🇮🇳",
  MX: "🇲🇽", AR: "🇦🇷", CL: "🇨🇱", CO: "🇨🇴", CN: "🇨🇳", KR: "🇰🇷",
};

const DeviceIcon = ({ type }: { type: string | null }) => {
  if (type === "mobile") return <Smartphone className="h-3.5 w-3.5" />;
  if (type === "tablet") return <Tablet className="h-3.5 w-3.5" />;
  return <Monitor className="h-3.5 w-3.5" />;
};

export default function AccessLogsPanel() {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [countryFilter, setCountryFilter] = useState<string>("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("access_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (countryFilter) {
      query = query.eq("country_code", countryFilter);
    }

    const { data } = await query;
    setLogs((data || []) as AccessLog[]);
    setLoading(false);
  }, [countryFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filtered = logs.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.ip_address?.includes(q) ||
      l.user_email?.toLowerCase().includes(q) ||
      l.city?.toLowerCase().includes(q) ||
      l.country?.toLowerCase().includes(q) ||
      l.browser?.toLowerCase().includes(q) ||
      l.os?.toLowerCase().includes(q) ||
      l.isp?.toLowerCase().includes(q)
    );
  });

  // Stats
  const uniqueIPs = new Set(logs.map(l => l.ip_address)).size;
  const uniqueCountries = new Set(logs.filter(l => l.country_code).map(l => l.country_code)).size;
  const vpnCount = logs.filter(l => l.is_vpn).length;
  const mobileCount = logs.filter(l => l.is_mobile).length;

  const countryCounts = logs.reduce<Record<string, number>>((acc, l) => {
    if (l.country_code) acc[l.country_code] = (acc[l.country_code] || 0) + 1;
    return acc;
  }, {});
  const topCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "IPs Únicos", value: uniqueIPs, icon: Hash, accent: "text-foreground" },
          { label: "Países", value: uniqueCountries, icon: Globe, accent: "text-primary" },
          { label: "VPN/Proxy", value: vpnCount, icon: Shield, accent: "text-amber-400" },
          { label: "Mobile", value: mobileCount, icon: Smartphone, accent: "text-emerald-400" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-white/[0.06] p-4" style={{ background: "rgba(255,255,255,0.02)" }}>
            <div className="flex items-center gap-1.5 mb-1">
              <s.icon className={`h-3.5 w-3.5 ${s.accent}`} />
              <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">{s.label}</span>
            </div>
            <p className={`text-xl font-black ${s.accent} tabular-nums`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Country chips */}
      {topCountries.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setCountryFilter("")}
            className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${!countryFilter ? "bg-primary/10 text-primary border border-primary/20" : "bg-white/[0.03] text-muted-foreground border border-transparent hover:bg-white/[0.06]"}`}
          >
            Todos
          </button>
          {topCountries.map(([code, count]) => (
            <button
              key={code}
              onClick={() => setCountryFilter(countryFilter === code ? "" : code)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all flex items-center gap-1.5 ${countryFilter === code ? "bg-primary/10 text-primary border border-primary/20" : "bg-white/[0.03] text-muted-foreground border border-transparent hover:bg-white/[0.06]"}`}
            >
              <span>{FLAG_EMOJI[code] || "🌐"}</span>
              {code}
              <span className="opacity-50">{count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Search + refresh */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar IP, email, cidade, browser..."
            className="w-full h-10 pl-9 pr-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <button onClick={fetchLogs} className="h-10 w-10 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-muted-foreground hover:text-foreground">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Log list */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Activity className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum acesso registrado</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(log => {
            const isExpanded = expandedId === log.id;
            return (
              <div key={log.id} className="rounded-2xl border border-white/[0.06] overflow-hidden" style={{ background: "rgba(255,255,255,0.02)" }}>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/[0.02] transition-colors"
                >
                  {/* Flag + Location */}
                  <div className="flex items-center gap-2 min-w-0 w-32 shrink-0">
                    <span className="text-base">{FLAG_EMOJI[log.country_code || ""] || "🌐"}</span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-foreground truncate">{log.city || "—"}</p>
                      <p className="text-[9px] text-muted-foreground truncate">{log.region || ""}{log.country ? `, ${log.country}` : ""}</p>
                    </div>
                  </div>

                  {/* IP */}
                  <div className="w-28 shrink-0">
                    <p className="text-[11px] font-mono text-foreground">{log.ip_address || "—"}</p>
                    {log.is_vpn && <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-bold">VPN</span>}
                  </div>

                  {/* Device */}
                  <div className="flex items-center gap-1.5 w-28 shrink-0">
                    <DeviceIcon type={log.device_type} />
                    <div className="min-w-0">
                      <p className="text-[10px] text-foreground truncate">{log.browser} {log.browser_version?.split(".")[0]}</p>
                      <p className="text-[9px] text-muted-foreground truncate">{log.os} {log.os_version}</p>
                    </div>
                  </div>

                  {/* User */}
                  <div className="flex-1 min-w-0">
                    {log.user_email ? (
                      <p className="text-[10px] text-primary font-bold truncate">{log.user_email}</p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground italic">Anônimo</p>
                    )}
                  </div>

                  {/* Time */}
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {format(new Date(log.created_at), "dd/MM HH:mm")}
                    </span>
                    {isExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-white/[0.06] p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-[10px]">
                    <div>
                      <p className="text-muted-foreground font-bold uppercase tracking-widest mb-1">Localização</p>
                      <p className="text-foreground">{log.city}, {log.region}</p>
                      <p className="text-foreground">{log.country}</p>
                      {log.latitude && <p className="text-muted-foreground font-mono">{log.latitude.toFixed(4)}, {log.longitude?.toFixed(4)}</p>}
                      <p className="text-muted-foreground">TZ: {log.timezone}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground font-bold uppercase tracking-widest mb-1">Rede</p>
                      <p className="text-foreground font-mono">{log.ip_address}</p>
                      <p className="text-muted-foreground">ISP: {log.isp || "—"}</p>
                      <p className="text-muted-foreground">ORG: {log.org || "—"}</p>
                      <p className="text-muted-foreground">AS: {log.as_number || "—"}</p>
                      {log.is_vpn && <p className="text-amber-400 font-bold">⚠ VPN/Proxy detectado</p>}
                    </div>
                    <div>
                      <p className="text-muted-foreground font-bold uppercase tracking-widest mb-1">Dispositivo</p>
                      <p className="text-foreground">{log.browser} {log.browser_version}</p>
                      <p className="text-foreground">{log.os} {log.os_version}</p>
                      <p className="text-muted-foreground">{log.device_type} • {log.is_mobile ? "Mobile" : "Desktop"}</p>
                      {log.screen_width && <p className="text-muted-foreground">Tela: {log.screen_width}×{log.screen_height}</p>}
                      <p className="text-muted-foreground">Idioma: {log.language}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground font-bold uppercase tracking-widest mb-1">Sessão</p>
                      {log.user_email && <p className="text-primary font-bold">{log.user_email}</p>}
                      {log.user_id && <p className="text-muted-foreground font-mono break-all">{log.user_id}</p>}
                      {log.session_id && <p className="text-muted-foreground font-mono truncate">SID: {log.session_id.slice(0, 8)}</p>}
                      {log.referrer && <p className="text-muted-foreground truncate">Ref: {log.referrer}</p>}
                      <p className="text-muted-foreground truncate">URL: {log.page_url}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
