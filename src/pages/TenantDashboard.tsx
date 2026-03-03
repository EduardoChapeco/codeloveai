import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSEO } from "@/hooks/useSEO";
import { toast } from "sonner";
import {
  BarChart3, Users, DollarSign, Palette, Globe, Settings, MessageSquare,
  Crown, Shield, Zap, CheckCircle2, ChevronRight,
  Store, BookOpen, Sparkles, Rocket, Target, TrendingUp,
  Loader2, CreditCard
} from "lucide-react";
import AppLayout from "@/components/AppLayout";

type Tab = "overview" | "marketplace" | "revenue" | "guide" | "settings";

export default function TenantDashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  useSEO({ title: "Painel White Label — Seu Negócio de IA" });
  const [tab, setTab] = useState<Tab>("overview");
  const [tenant, setTenant] = useState<any>(null);
  const [stats, setStats] = useState({ users: 0, revenue: 0, messages: 0, affiliates: 0, marketplaceSales: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (!authLoading && !user) navigate("/login"); }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: tu } = await supabase.from("tenant_users").select("tenant_id, role").eq("user_id", user.id).in("role", ["tenant_owner", "tenant_admin"]).limit(1).maybeSingle();
      if (!tu) { navigate("/home"); return; }
      const { data: t } = await supabase.from("tenants").select("id,name,slug,domain_custom,is_domain_approved,logo_url,primary_color,secondary_color,is_active,commission_percent,marketplace_commission_percent,custom_ai_name,custom_orchestrator_name,custom_venus_name,modules,created_at").eq("id", tu.tenant_id).single();
      setTenant(t);
      const { count: userCount } = await supabase.from("tenant_users").select("id", { count: "exact", head: true }).eq("tenant_id", tu.tenant_id);
      const today = new Date().toISOString().split("T")[0];
      const { data: usageData } = await supabase.from("daily_usage").select("messages_used").eq("tenant_id", tu.tenant_id).eq("date", today);
      const totalMessages = usageData?.reduce((sum, u) => sum + u.messages_used, 0) || 0;
      setStats({ users: userCount || 0, revenue: 0, messages: totalMessages, affiliates: 0, marketplaceSales: 0 });
      setLoading(false);
    };
    load();
  }, [user, navigate]);

  if (authLoading || loading) return <AppLayout><div className="flex items-center justify-center" style={{ minHeight: "60vh" }}><Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--text-tertiary)" }} /></div></AppLayout>;

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "overview", label: "Visão Geral", icon: BarChart3 },
    { key: "marketplace", label: "Lojinha", icon: Store },
    { key: "revenue", label: "Comissões", icon: DollarSign },
    { key: "guide", label: "Guia Rápido", icon: BookOpen },
    { key: "settings", label: "Configurar", icon: Settings },
  ];

  return (
    <AppLayout>
      <div className="rd-page-content">
        {/* Header */}
        <div className="rd-page-head">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              {tenant?.logo_url ? (
                <img src={tenant.logo_url} alt="" style={{ height: 48, width: 48, borderRadius: "var(--r4)", objectFit: "contain", border: "1px solid var(--b1)" }} />
              ) : (
                <div className="rd-ico-box lg" style={{ background: "rgba(245,158,11,0.1)" }}><Crown className="h-6 w-6" style={{ color: "var(--orange-l)" }} /></div>
              )}
              <div>
                <h1>{tenant?.name || "Meu White Label"}</h1>
                <p>Sua plataforma de IA personalizada · <span style={{ color: "var(--green-l)" }}>Ativo</span></p>
              </div>
            </div>
            <Link to="/admin/tenant" className="gl sm orange" style={{ textDecoration: "none" }}><Palette className="h-4 w-4" /> Personalizar</Link>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-48 shrink-0 hidden md:flex flex-col gap-1">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`nav-entry ${tab === t.key ? "active" : ""}`} style={{ textDecoration: "none" }}>
                <t.icon className="h-4 w-4" style={{ color: tab === t.key ? "var(--orange-l)" : "var(--text-tertiary)" }} />
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Mobile tabs */}
            <div className="flex gap-1 overflow-x-auto md:hidden" style={{ marginBottom: 16, paddingBottom: 4 }}>
              {tabs.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)} className={tab === t.key ? "chip orange" : "chip"} style={{ whiteSpace: "nowrap" }}>{t.label}</button>
              ))}
            </div>

            {/* OVERVIEW */}
            {tab === "overview" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="rd-grid-4">
                  {[
                    { label: "Usuários ativos", value: stats.users, icon: Users, color: "var(--blue-l)" },
                    { label: "Mensagens hoje", value: stats.messages, icon: MessageSquare, color: "var(--green-l)" },
                    { label: "Comissão marketplace", value: `${tenant?.marketplace_commission_percent || 15}%`, icon: Store, color: "var(--orange-l)" },
                    { label: "Sua margem", value: "60%+", icon: TrendingUp, color: "var(--blue-l)" },
                  ].map(s => (
                    <div key={s.label} className="rd-stat-card">
                      <div className="rd-stat-label flex items-center gap-2"><s.icon className="h-3.5 w-3.5" style={{ color: s.color }} />{s.label}</div>
                      <div className="rd-stat-value" style={{ color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                <div className="rd-card">
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14 }}>Ações Rápidas</p>
                  <div className="rd-grid-3">
                    {[
                      { label: "Personalizar Marca", icon: Palette, link: "/admin/tenant", desc: "Cores, logo, domínio" },
                      { label: "Gerenciar CRM", icon: Users, link: "/admin/tenant?tab=crm", desc: "Contatos & campanhas" },
                      { label: "Ver Comunidade", icon: Globe, link: "/community", desc: "Comunidade unificada" },
                    ].map(a => (
                      <Link key={a.label} to={a.link} className="rd-card interactive flex items-center gap-3" style={{ padding: 14, textDecoration: "none" }}>
                        <div className="rd-ico-box" style={{ background: "rgba(245,158,11,0.1)" }}><a.icon className="h-5 w-5" style={{ color: "var(--orange-l)" }} /></div>
                        <div className="flex-1 min-w-0">
                          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{a.label}</p>
                          <p style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{a.desc}</p>
                        </div>
                        <ChevronRight className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="rd-alert info">
                  <div className="rd-ico-box" style={{ background: "rgba(245,158,11,0.1)" }}><Rocket className="h-5 w-5" style={{ color: "var(--orange-l)" }} /></div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)", marginBottom: 4 }}>Convide seus clientes a criar White Labels!</p>
                    <p style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.5, marginBottom: 8 }}>Qualquer usuário pode criar sua própria plataforma. Compartilhe o link e ganhe comissões.</p>
                    <div className="flex items-center gap-2">
                      <code style={{ fontSize: 10, fontFamily: "var(--font-mono)", padding: "4px 10px", borderRadius: "var(--r2)", background: "var(--bg-3)", border: "1px solid var(--b1)", color: "var(--text-primary)" }}>{window.location.origin}/whitelabel?tenant={tenant?.slug}</code>
                      <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/whitelabel?tenant=${tenant?.slug}`); toast.success("Link copiado!"); }} className="gl xs ghost" style={{ color: "var(--orange-l)" }}>Copiar</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MARKETPLACE */}
            {tab === "marketplace" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="rd-card">
                  <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Lojinha de Projetos</p>
                  <p style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.6, marginBottom: 20 }}>A lojinha é unificada — todos os White Labels vendem no mesmo marketplace.</p>
                  <div className="rd-card" style={{ marginBottom: 14 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }} className="flex items-center gap-2"><DollarSign className="h-4 w-4" style={{ color: "var(--green-l)" }} /> Estrutura de Comissões</p>
                    {[
                      { label: "Taxa da plataforma (master)", value: "30%", desc: "Cobrado sobre cada venda" },
                      { label: "Sua comissão (White Label)", value: `${tenant?.marketplace_commission_percent || 15}%`, desc: "15% dos 30% da plataforma" },
                      { label: "Vendedor recebe", value: "70%", desc: "Direto para o criador do projeto" },
                    ].map(r => (
                      <div key={r.label} className="flex items-center justify-between" style={{ padding: "8px 0", borderBottom: "1px solid var(--b1)" }}>
                        <div><p style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{r.label}</p><p style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{r.desc}</p></div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--orange-l)" }}>{r.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="rd-alert warning"><p style={{ fontSize: 11, fontWeight: 600, marginBottom: 2 }}>Como maximizar seus ganhos</p><p style={{ fontSize: 10 }}>Incentive seus usuários a publicar projetos no marketplace.</p></div>
                </div>
              </div>
            )}

            {/* REVENUE */}
            {tab === "revenue" && (
              <div className="rd-card">
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14 }}>Extrato de Comissões</p>
                <div className="rd-grid-3" style={{ marginBottom: 20 }}>
                  {[{ label: "Total ganho", value: "R$0,00" }, { label: "Pendente", value: "R$0,00" }, { label: "Disponível", value: "R$0,00" }].map(s => (
                    <div key={s.label} className="rd-stat-card" style={{ textAlign: "center" }}>
                      <div className="rd-stat-value" style={{ fontSize: 18 }}>{s.value}</div>
                      <div className="rd-stat-label" style={{ marginTop: 4 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <CreditCard className="h-8 w-8 mx-auto" style={{ color: "var(--text-tertiary)", opacity: 0.2, marginBottom: 8 }} />
                  <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Nenhuma comissão registrada ainda</p>
                </div>
              </div>
            )}

            {/* GUIDE */}
            {tab === "guide" && (
              <div className="rd-card">
                <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Guia do Operador White Label</p>
                <p style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.6, marginBottom: 20 }}>Tudo que você precisa saber para operar sua plataforma.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { title: "1. Personalize tudo", desc: "Acesse o Editor Visual para definir cores, logo e módulos.", icon: Palette },
                    { title: "2. Renomeie os produtos", desc: `Star AI, Orchestrator e Venus podem ter nomes personalizados.`, icon: Sparkles },
                    { title: "3. Ofereça Venus com trial", desc: "Libere 30 dias de teste da extensão premium.", icon: Zap },
                    { title: "4. Use o CRM", desc: "Importe contatos, segmente e dispare campanhas.", icon: Target },
                    { title: "5. Marketplace unificado", desc: "Seus usuários vendem, você ganha 15%.", icon: Store },
                    { title: "6. Comunidade unificada", desc: "Todos os tenants compartilham a mesma comunidade.", icon: Globe },
                    { title: "7. Defina seus preços", desc: "Custo: R$7,96/dia ou R$59,96/mês por usuário.", icon: DollarSign },
                  ].map(s => (
                    <div key={s.title} className="rd-card" style={{ padding: 14, display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <div className="rd-ico-box sm" style={{ background: "rgba(245,158,11,0.1)" }}><s.icon className="h-4 w-4" style={{ color: "var(--orange-l)" }} /></div>
                      <div><p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{s.title}</p><p style={{ fontSize: 10, color: "var(--text-tertiary)", lineHeight: 1.5 }}>{s.desc}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SETTINGS */}
            {tab === "settings" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="rd-card">
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14 }}>Nomes Personalizados dos Produtos</p>
                  <div className="rd-grid-3">
                    {[
                      { label: "IA Principal", current: tenant?.custom_ai_name || "Star AI", field: "custom_ai_name" },
                      { label: "Orquestrador", current: tenant?.custom_orchestrator_name || "Orchestrator", field: "custom_orchestrator_name" },
                      { label: "Extensão Premium", current: tenant?.custom_venus_name || "Venus", field: "custom_venus_name" },
                    ].map(p => (
                      <div key={p.field}>
                        <label className="sec-label" style={{ display: "block", marginBottom: 6 }}>{p.label}</label>
                        <input style={{ width: "100%", height: 36, padding: "0 12px", borderRadius: "var(--r2)", background: "var(--bg-3)", border: "1px solid var(--b1)", color: "var(--text-primary)", fontSize: 13 }}
                          defaultValue={p.current}
                          onBlur={async e => { if (e.target.value !== p.current && tenant) { await supabase.from("tenants").update({ [p.field]: e.target.value } as any).eq("id", tenant.id); toast.success("Nome atualizado!"); } }} />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rd-card">
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Configurações Avançadas</p>
                  {[
                    { label: "Editor Visual Completo", link: "/admin/tenant" },
                    { label: "CRM & Mensageria", link: "/admin/tenant?tab=crm" },
                    { label: "Financeiro & Saldo", link: "/admin/tenant?tab=finances" },
                  ].map(l => (
                    <Link key={l.label} to={l.link} className="flex items-center justify-between" style={{ padding: "10px 0", borderBottom: "1px solid var(--b1)", textDecoration: "none" }}>
                      <span style={{ fontSize: 12, color: "var(--text-primary)" }}>{l.label}</span>
                      <ChevronRight className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
