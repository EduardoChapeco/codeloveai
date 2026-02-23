import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSEO } from "@/hooks/useSEO";
import { toast } from "sonner";
import { BarChart3, Users, DollarSign, Palette, Link2, Settings, MessageSquare } from "lucide-react";
import AppLayout from "@/components/AppLayout";

type Tab = "overview" | "users" | "revenue" | "branding" | "affiliates" | "settings";

export default function TenantDashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  useSEO({ title: "Painel White Label" });

  const [tab, setTab] = useState<Tab>("overview");
  const [tenant, setTenant] = useState<any>(null);
  const [stats, setStats] = useState({ users: 0, revenue: 0, messages: 0, affiliates: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // Find tenant where user is owner
      const { data: tu } = await supabase
        .from("tenant_users")
        .select("tenant_id, role")
        .eq("user_id", user.id)
        .in("role", ["tenant_owner", "tenant_admin"])
        .limit(1)
        .maybeSingle();

      if (!tu) { navigate("/dashboard"); return; }

      const { data: t } = await supabase.from("tenants").select("*").eq("id", tu.tenant_id).single();
      setTenant(t);

      // Stats
      const { count: userCount } = await supabase.from("tenant_users").select("id", { count: "exact", head: true }).eq("tenant_id", tu.tenant_id);
      const today = new Date().toISOString().split("T")[0];
      const { data: usageData } = await supabase.from("daily_usage").select("messages_used").eq("tenant_id", tu.tenant_id).eq("date", today);
      const totalMessages = usageData?.reduce((sum, u) => sum + u.messages_used, 0) || 0;

      setStats({ users: userCount || 0, revenue: 0, messages: totalMessages, affiliates: 0 });
      setLoading(false);
    };
    load();
  }, [user, navigate]);

  if (authLoading || loading) return <AppLayout><div className="min-h-screen flex items-center justify-center"><p className="lv-overline">Carregando...</p></div></AppLayout>;

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "overview", label: "Visão Geral", icon: BarChart3 },
    { key: "users", label: "Usuários", icon: Users },
    { key: "revenue", label: "Receita", icon: DollarSign },
    { key: "branding", label: "Personalização", icon: Palette },
    { key: "affiliates", label: "Afiliados", icon: Link2 },
    { key: "settings", label: "Configurações", icon: Settings },
  ];

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <p className="lv-overline mb-1">White Label</p>
          <h1 className="lv-heading-lg">{tenant?.name || "Meu White Label"}</h1>
        </div>

        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-48 shrink-0 space-y-1 hidden md:block">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-sm transition-colors ${tab === t.key ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
              >
                <t.icon className="h-4 w-4" /> {t.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Mobile tabs */}
            <div className="flex gap-1 mb-6 overflow-x-auto md:hidden pb-2">
              {tabs.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${tab === t.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "overview" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: "Usuários", value: stats.users, icon: Users },
                    { label: "Receita do mês", value: `R$${stats.revenue}`, icon: DollarSign },
                    { label: "Mensagens hoje", value: stats.messages, icon: MessageSquare },
                    { label: "Afiliados", value: stats.affiliates, icon: Link2 },
                  ].map((s) => (
                    <div key={s.label} className="lv-card">
                      <div className="flex items-center gap-2 mb-2">
                        <s.icon className="h-4 w-4 text-muted-foreground" />
                        <span className="lv-caption">{s.label}</span>
                      </div>
                      <p className="lv-stat text-2xl">{s.value}</p>
                    </div>
                  ))}
                </div>
                <div className="lv-card">
                  <p className="lv-overline mb-3">Status</p>
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${tenant?.status === "active" ? "bg-green-500" : "bg-yellow-500"}`} />
                    <span className="lv-body-strong capitalize">{tenant?.status || "pending"}</span>
                  </div>
                </div>
              </div>
            )}

            {tab === "users" && (
              <div className="lv-card">
                <p className="lv-overline mb-4">Usuários do tenant</p>
                <p className="lv-body text-center py-8">Funcionalidade de gestão de usuários em desenvolvimento.</p>
              </div>
            )}

            {tab === "revenue" && (
              <div className="lv-card">
                <p className="lv-overline mb-4">Comissões e Receita</p>
                <p className="lv-body text-center py-8">Relatórios de receita em desenvolvimento.</p>
              </div>
            )}

            {tab === "branding" && (
              <div className="lv-card space-y-4">
                <p className="lv-overline mb-2">Personalização</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="lv-caption mb-1.5 block">Cor primária</label>
                    <input type="color" value={tenant?.primary_color || "#6C3CE1"} className="h-10 w-10 rounded cursor-pointer" readOnly />
                  </div>
                  <div>
                    <label className="lv-caption mb-1.5 block">Cor secundária</label>
                    <input type="color" value={tenant?.secondary_color || "#5E5CE6"} className="h-10 w-10 rounded cursor-pointer" readOnly />
                  </div>
                </div>
                {tenant?.logo_url && <img src={tenant.logo_url} alt="Logo" className="h-12 rounded" />}
              </div>
            )}

            {tab === "affiliates" && (
              <div className="lv-card">
                <p className="lv-overline mb-4">Afiliados</p>
                <p className="lv-body text-center py-8">Gestão de afiliados em desenvolvimento.</p>
              </div>
            )}

            {tab === "settings" && (
              <div className="lv-card">
                <p className="lv-overline mb-4">Configurações</p>
                <p className="lv-body text-center py-8">Configurações avançadas em desenvolvimento.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
