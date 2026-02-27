import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSEO } from "@/hooks/useSEO";
import { toast } from "sonner";
import {
  BarChart3, Users, DollarSign, Palette, Link2, Settings, MessageSquare,
  Crown, ArrowUpRight, Shield, Zap, Globe, CheckCircle2, ChevronRight,
  Store, BookOpen, Sparkles, Rocket, Target, TrendingUp, FileText,
  ExternalLink, Star, Loader2, CreditCard
} from "lucide-react";
import AppLayout from "@/components/AppLayout";

type Tab = "overview" | "marketplace" | "revenue" | "guide" | "settings";

const GlassCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-2xl border border-white/[0.06] overflow-hidden ${className}`}
    style={{ background: "rgba(255,255,255,0.02)", backdropFilter: "blur(40px) saturate(180%)" }}>
    {children}
  </div>
);

export default function TenantDashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  useSEO({ title: "Painel White Label — Seu Negócio de IA" });

  const [tab, setTab] = useState<Tab>("overview");
  const [tenant, setTenant] = useState<any>(null);
  const [stats, setStats] = useState({ users: 0, revenue: 0, messages: 0, affiliates: 0, marketplaceSales: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: tu } = await supabase
        .from("tenant_users")
        .select("tenant_id, role")
        .eq("user_id", user.id)
        .in("role", ["tenant_owner", "tenant_admin"])
        .limit(1)
        .maybeSingle();

      if (!tu) { navigate("/dashboard"); return; }

      const { data: t } = await supabase.from("tenants")
        .select("id,name,slug,domain_custom,is_domain_approved,logo_url,primary_color,secondary_color,is_active,commission_percent,marketplace_commission_percent,custom_ai_name,custom_orchestrator_name,custom_venus_name,modules,created_at")
        .eq("id", tu.tenant_id).single();
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

  if (authLoading || loading) return (
    <AppLayout>
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    </AppLayout>
  );

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "overview", label: "Visão Geral", icon: BarChart3 },
    { key: "marketplace", label: "Lojinha", icon: Store },
    { key: "revenue", label: "Comissões", icon: DollarSign },
    { key: "guide", label: "Guia Rápido", icon: BookOpen },
    { key: "settings", label: "Configurar", icon: Settings },
  ];

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            {tenant?.logo_url ? (
              <img src={tenant.logo_url} alt="" className="h-12 w-12 rounded-2xl object-contain border border-white/[0.06]" />
            ) : (
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10">
                <Crown className="h-6 w-6 text-primary" />
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">{tenant?.name || "Meu White Label"}</h1>
              <p className="text-xs text-muted-foreground">Sua plataforma de IA personalizada • <span className="text-emerald-400">Ativo</span></p>
            </div>
          </div>
          <Link to="/admin/tenant" className="h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-2 hover:shadow-lg hover:shadow-primary/25 transition-all">
            <Palette className="h-4 w-4" /> Personalizar
          </Link>
        </div>

        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-48 shrink-0 space-y-1 hidden md:block">
            {tabs.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm transition-colors ${
                  tab === t.key ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-white/[0.03]"
                }`}>
                <t.icon className="h-4 w-4" /> {t.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Mobile tabs */}
            <div className="flex gap-1 mb-6 overflow-x-auto md:hidden pb-2">
              {tabs.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
                    tab === t.key ? "bg-primary text-primary-foreground" : "bg-white/[0.04] text-muted-foreground"
                  }`}>{t.label}</button>
              ))}
            </div>

            {/* ═══ OVERVIEW ═══ */}
            {tab === "overview" && (
              <div className="space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: "Usuários ativos", value: stats.users, icon: Users, color: "text-primary" },
                    { label: "Mensagens hoje", value: stats.messages, icon: MessageSquare, color: "text-emerald-400" },
                    { label: "Comissão marketplace", value: `${tenant?.marketplace_commission_percent || 15}%`, icon: Store, color: "text-amber-400" },
                    { label: "Sua margem", value: "60%+", icon: TrendingUp, color: "text-blue-400" },
                  ].map(s => (
                    <GlassCard key={s.label} className="p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <s.icon className={`h-4 w-4 ${s.color}`} />
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{s.label}</span>
                      </div>
                      <p className={`text-2xl font-bold ${s.color} tabular-nums`}>{s.value}</p>
                    </GlassCard>
                  ))}
                </div>

                {/* Quick Actions */}
                <GlassCard className="p-6">
                  <h3 className="text-sm font-bold text-foreground mb-4">🚀 Ações Rápidas</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { label: "Personalizar Marca", icon: Palette, link: "/admin/tenant", desc: "Cores, logo, domínio" },
                      { label: "Gerenciar CRM", icon: Users, link: "/admin/tenant?tab=crm", desc: "Contatos & campanhas" },
                      { label: "Ver Comunidade", icon: Globe, link: "/community", desc: "Comunidade unificada" },
                    ].map(a => (
                      <Link key={a.label} to={a.link}
                        className="flex items-center gap-3 p-4 rounded-xl border border-white/[0.06] hover:bg-white/[0.03] transition-colors group">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <a.icon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground">{a.label}</p>
                          <p className="text-[10px] text-muted-foreground">{a.desc}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </Link>
                    ))}
                  </div>
                </GlassCard>

                {/* Info Banner: WL for everyone */}
                <GlassCard className="p-6 border-primary/20">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0">
                      <Rocket className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground mb-1">Convide seus clientes a criar White Labels!</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                        Qualquer usuário pode criar sua própria plataforma White Label. Compartilhe o link abaixo e ganhe
                        comissões sobre cada venda no marketplace. A comunidade é unificada — todos compartilham o mesmo espaço.
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="text-[10px] font-mono px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-foreground">
                          {window.location.origin}/whitelabel?tenant={tenant?.slug}
                        </code>
                        <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/whitelabel?tenant=${tenant?.slug}`); toast.success("Link copiado!"); }}
                          className="text-primary text-[10px] font-semibold hover:underline">Copiar</button>
                      </div>
                    </div>
                  </div>
                </GlassCard>

                {/* Venus Trial Info */}
                <GlassCard className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 flex items-center justify-center shrink-0">
                      <Sparkles className="h-6 w-6 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground mb-1">{tenant?.custom_venus_name || "Venus"} — Trial de 30 dias</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Ofereça aos seus clientes 30 dias gratuitos da extensão premium. Após o trial, a conversão é automática.
                        Você pode renomear todos os produtos ({tenant?.custom_ai_name || "Star AI"}, {tenant?.custom_orchestrator_name || "Orchestrator"}, {tenant?.custom_venus_name || "Venus"}).
                      </p>
                    </div>
                  </div>
                </GlassCard>
              </div>
            )}

            {/* ═══ MARKETPLACE ═══ */}
            {tab === "marketplace" && (
              <div className="space-y-6">
                <GlassCard className="p-6">
                  <h3 className="text-base font-bold text-foreground mb-2">🏪 Lojinha de Projetos</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-6">
                    A lojinha de projetos é unificada — todos os White Labels vendem no mesmo marketplace.
                    As cores seguem seu branding, mas o processo de pagamento utiliza a infraestrutura master.
                  </p>

                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-5 mb-4">
                    <h4 className="text-xs font-bold text-foreground mb-3 flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-emerald-400" /> Estrutura de Comissões
                    </h4>
                    <div className="space-y-2">
                      {[
                        { label: "Taxa da plataforma (master)", value: "30%", desc: "Cobrado sobre cada venda" },
                        { label: "Sua comissão (White Label)", value: `${tenant?.marketplace_commission_percent || 15}%`, desc: "15% dos 30% da plataforma" },
                        { label: "Vendedor recebe", value: "70%", desc: "Direto para o criador do projeto" },
                      ].map(r => (
                        <div key={r.label} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                          <div>
                            <p className="text-xs font-medium text-foreground">{r.label}</p>
                            <p className="text-[10px] text-muted-foreground">{r.desc}</p>
                          </div>
                          <span className="text-sm font-bold text-primary tabular-nums">{r.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-4">
                    <p className="text-xs text-amber-400 font-semibold mb-1">💡 Como maximizar seus ganhos</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Incentive seus usuários a publicar projetos no marketplace. Quanto mais vendas geradas dentro do seu tenant,
                      maior sua comissão. Crie tutoriais, ofereça suporte e destaque os melhores projetos na sua comunidade.
                    </p>
                  </div>
                </GlassCard>

                <GlassCard className="p-6">
                  <h4 className="text-sm font-bold text-foreground mb-4">📋 Passo a Passo das Vendas</h4>
                  <div className="space-y-4">
                    {[
                      { step: "1", title: "Vendedor publica o projeto", desc: "O criador define preço, descrição e demonstração no marketplace" },
                      { step: "2", title: "Comprador realiza o pagamento", desc: "Pagamento processado pela infraestrutura master (Mercado Pago)" },
                      { step: "3", title: "Período de hold (7 dias)", desc: "O valor fica retido para garantir satisfação do comprador" },
                      { step: "4", title: "Liberação automática", desc: "Após 7 dias: 70% para o vendedor, 30% plataforma (15% para você)" },
                      { step: "5", title: "Comissão creditada", desc: "Sua comissão aparece no extrato de faturas com status atualizado" },
                    ].map(s => (
                      <div key={s.step} className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-primary">{s.step}</span>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground">{s.title}</p>
                          <p className="text-[10px] text-muted-foreground">{s.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              </div>
            )}

            {/* ═══ REVENUE ═══ */}
            {tab === "revenue" && (
              <div className="space-y-4">
                <GlassCard className="p-6">
                  <h3 className="text-sm font-bold text-foreground mb-4">💰 Extrato de Comissões</h3>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    {[
                      { label: "Total ganho", value: "R$0,00", status: "success" },
                      { label: "Pendente", value: "R$0,00", status: "warning" },
                      { label: "Disponível", value: "R$0,00", status: "info" },
                    ].map(s => (
                      <div key={s.label} className="text-center p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                        <p className="text-lg font-bold text-foreground tabular-nums">{s.value}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
                      <div className="grid grid-cols-5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        <span>Data</span><span>Tipo</span><span>Valor</span><span>Comissão</span><span>Status</span>
                      </div>
                    </div>
                    <div className="text-center py-12">
                      <CreditCard className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhuma comissão registrada ainda</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">Suas comissões do marketplace aparecerão aqui com status em tempo real</p>
                    </div>
                  </div>
                </GlassCard>

                <GlassCard className="p-5">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">Status das faturas:</strong> Pendente → Em Hold (7 dias) → Aprovada → Paga.
                    Comissões são creditadas automaticamente após o período de hold.
                  </p>
                </GlassCard>
              </div>
            )}

            {/* ═══ GUIDE ═══ */}
            {tab === "guide" && (
              <div className="space-y-4">
                <GlassCard className="p-6">
                  <h3 className="text-base font-bold text-foreground mb-2">📖 Guia do Operador White Label</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-6">
                    Tudo que você precisa saber para operar sua plataforma de IA e maximizar resultados.
                  </p>

                  <div className="space-y-3">
                    {[
                      { title: "1. Personalize tudo", desc: "Acesse o Editor Visual para definir cores, logo, domínio e módulos. Seus clientes nunca verão a marca original.", icon: Palette },
                      { title: "2. Renomeie os produtos", desc: `Star AI, Orchestrator e Venus podem ter nomes personalizados (atual: ${tenant?.custom_ai_name || "Star AI"}, ${tenant?.custom_orchestrator_name || "Orchestrator"}, ${tenant?.custom_venus_name || "Venus"}).`, icon: Sparkles },
                      { title: "3. Ofereça Venus com trial", desc: "Libere 30 dias de teste da extensão premium. A conversão pós-trial é automática.", icon: Zap },
                      { title: "4. Use o CRM", desc: "Importe contatos via CSV, segmente por tags e dispare campanhas via WhatsApp.", icon: Target },
                      { title: "5. Marketplace unificado", desc: "A lojinha de projetos é compartilhada. Seus usuários vendem, você ganha 15% sobre a taxa da plataforma.", icon: Store },
                      { title: "6. Comunidade unificada", desc: "Todos os tenants compartilham a mesma comunidade. Incentive participação para engajamento orgânico.", icon: Globe },
                      { title: "7. Defina seus preços", desc: "Custo: R$7,96/dia ou R$59,96/mês por usuário. A margem acima disso é toda sua.", icon: DollarSign },
                    ].map(s => (
                      <div key={s.title} className="flex items-start gap-3 p-4 rounded-xl border border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <s.icon className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground">{s.title}</p>
                          <p className="text-[10px] text-muted-foreground leading-relaxed">{s.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              </div>
            )}

            {/* ═══ SETTINGS ═══ */}
            {tab === "settings" && (
              <div className="space-y-4">
                <GlassCard className="p-6">
                  <h3 className="text-sm font-bold text-foreground mb-4">Nomes Personalizados dos Produtos</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Renomeie os produtos de IA para a marca do seu White Label. As mudanças são aplicadas em toda a plataforma.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { label: "IA Principal", current: tenant?.custom_ai_name || "Star AI", field: "custom_ai_name" },
                      { label: "Orquestrador", current: tenant?.custom_orchestrator_name || "Orchestrator", field: "custom_orchestrator_name" },
                      { label: "Extensão Premium", current: tenant?.custom_venus_name || "Venus", field: "custom_venus_name" },
                    ].map(p => (
                      <div key={p.field}>
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">{p.label}</label>
                        <input className="w-full h-10 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                          defaultValue={p.current}
                          onBlur={async (e) => {
                            if (e.target.value !== p.current && tenant) {
                              await supabase.from("tenants").update({ [p.field]: e.target.value } as any).eq("id", tenant.id);
                              toast.success("Nome atualizado!");
                            }
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </GlassCard>

                <GlassCard className="p-6">
                  <h3 className="text-sm font-bold text-foreground mb-3">Configurações Avançadas</h3>
                  <div className="space-y-2">
                    <Link to="/tenant/admin" className="flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.03] transition-colors">
                      <span className="text-xs text-foreground">Editor Visual Completo</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                    <Link to="/tenant/admin?tab=crm" className="flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.03] transition-colors">
                      <span className="text-xs text-foreground">CRM & Mensageria</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                    <Link to="/tenant/admin?tab=finances" className="flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.03] transition-colors">
                      <span className="text-xs text-foreground">Financeiro & Saldo</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </div>
                </GlassCard>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
