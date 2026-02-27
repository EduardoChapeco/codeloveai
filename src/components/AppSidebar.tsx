import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth, useIsAdmin, useIsAffiliate } from "@/hooks/useAuth";
import { useChatContext } from "@/contexts/ChatContext";
import { useSupportChat } from "@/contexts/SupportChatContext";
import { useTenant } from "@/contexts/TenantContext";
import {
  LayoutDashboard, MessageCircle, Download, Bot, Headphones,
  Link2, FolderOpen, Shield, LogOut, User, ChevronDown,
  ArrowLeft, Bell, Send, Upload,
  PanelLeftClose, PanelLeft, Building2, StickyNote, Brain, Users, Unlock, FileText,
  Zap, CreditCard, BookOpen, LifeBuoy, Workflow, Scale,
  Rocket, Globe, Handshake, Puzzle, Key, Wallet, Palette,
  DollarSign, Package, Sliders, UserPlus, BarChart3, MessageSquare,
  CloudLightning, Activity, Sparkles,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// ── Tab definitions for each admin page ──

const adminOperationalTabs = [
  { id: "members", label: "Membros", icon: Users, desc: "Gestão de usuários" },
  { id: "affiliates", label: "Afiliados", icon: UserPlus, desc: "Programa de indicações" },
  { id: "invoices", label: "Faturas", icon: FileText, desc: "Pagamentos pendentes" },
  { id: "worker-tokens", label: "Tokens API", icon: Zap, desc: "Geração de tokens" },
  { id: "extension", label: "Extensão", icon: Upload, desc: "Uploads e versões" },
  { id: "notifications", label: "Alertas", icon: Bell, desc: "Notificações do sistema" },
  { id: "messages", label: "Chat", icon: MessageSquare, desc: "Mensagens diretas" },
  { id: "support", label: "Suporte", icon: Headphones, desc: "Tickets de suporte" },
];

const adminGlobalTabs = [
  { id: "tenants", label: "Tenants", icon: Building2, desc: "Multi-tenant" },
  { id: "plans", label: "Planos", icon: DollarSign, desc: "Pricing & billing" },
  { id: "modules", label: "Módulos", icon: Package, desc: "Feature toggles" },
  { id: "extensions", label: "Extensões", icon: Puzzle, desc: "Catálogo" },
  { id: "feature_flags", label: "Feature Flags", icon: Sliders, desc: "Flags globais" },
  { id: "lovable_cloud", label: "Lovable Cloud", icon: CloudLightning, desc: "Infra & deploy" },
  { id: "wl_plans", label: "Planos WL", icon: Package, desc: "White Label" },
  { id: "wl_affiliates", label: "Afiliados WL", icon: UserPlus, desc: "Indicações WL" },
  { id: "wl_subs", label: "Assinaturas WL", icon: FileText, desc: "Contratos" },
  { id: "finances", label: "Faturamento", icon: BarChart3, desc: "Receita geral" },
  { id: "commissions", label: "Comissões", icon: BarChart3, desc: "Split & repasse" },
  { id: "wallets", label: "Wallets", icon: Wallet, desc: "Saldos por tenant" },
  { id: "ledger", label: "Ledger", icon: BookOpen, desc: "Extrato contábil" },
  { id: "api_keys", label: "API Keys", icon: Key, desc: "Chaves de acesso" },
  { id: "activity", label: "Atividade", icon: Activity, desc: "Dashboard de uso" },
  { id: "operations", label: "Operações", icon: Shield, desc: "Ações globais" },
];

const adminTenantTabs = [
  { id: "editor", label: "Editor Visual", icon: Palette, desc: "Personalização" },
  { id: "users", label: "Usuários", icon: Users, desc: "Membros do tenant" },
  { id: "licenses", label: "Licenças", icon: Key, desc: "Tokens ativos" },
  { id: "finances", label: "Financeiro", icon: Wallet, desc: "Saldo & extrato" },
  { id: "activity", label: "Atividade", icon: Activity, desc: "Dashboard de uso" },
];

// ── Liquid Glass Tab Button ──
function GlassTabButton({
  tab,
  isActive,
  onClick,
  collapsed,
}: {
  tab: { id: string; label: string; icon: React.ElementType; desc: string };
  isActive: boolean;
  onClick: () => void;
  collapsed: boolean;
}) {
  const Icon = tab.icon;

  if (collapsed) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={isActive}
          onClick={onClick}
          tooltip={tab.label}
        >
          <Icon className="h-4 w-4" />
          <span>{tab.label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`group w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-200 text-left ${
        isActive
          ? "bg-primary/10 border-primary/20 text-primary shadow-sm shadow-primary/5"
          : "border-[var(--liquid-glass-border)] text-muted-foreground hover:text-foreground hover:border-foreground/10 hover:shadow-sm"
      }`}
      style={
        !isActive
          ? {
              background: "var(--liquid-glass-bg)",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
            }
          : {
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
            }
      }
    >
      <div className={`h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
        isActive ? "bg-primary/15" : "bg-foreground/[0.04]"
      }`}>
        <Icon
          className={`h-4 w-4 ${
            isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
          }`}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-semibold truncate ${isActive ? "text-primary" : ""}`}>{tab.label}</p>
        <p className="text-[10px] opacity-50 truncate">{tab.desc}</p>
      </div>
    </button>
  );
}

// ── Liquid Glass Nav Link Button ──
function GlassNavButton({
  item,
  isActive,
  collapsed,
}: {
  item: { to: string; label: string; icon: React.ElementType; desc?: string; badge?: string };
  isActive: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;

  if (collapsed) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
          <NavLink to={item.to}>
            <span className="relative">
              <Icon className="h-4 w-4" />
              {item.badge && (
                <span className="absolute -top-1.5 -right-2 h-2 w-2 rounded-full bg-primary animate-pulse" />
              )}
            </span>
            <span>{item.label}</span>
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <NavLink
      to={item.to}
      className={`group w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-200 text-left no-underline ${
        isActive
          ? "bg-primary/10 border-primary/20 text-primary shadow-sm shadow-primary/5"
          : "border-[var(--liquid-glass-border)] text-muted-foreground hover:text-foreground hover:border-foreground/10 hover:shadow-sm"
      }`}
      style={
        !isActive
          ? {
              background: "var(--liquid-glass-bg)",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
            }
          : {
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
            }
      }
    >
      <div className={`h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
        isActive ? "bg-primary/15" : "bg-foreground/[0.04]"
      }`}>
        <Icon
          className={`h-4 w-4 ${
            isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
          }`}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={`text-xs font-semibold truncate ${isActive ? "text-primary" : ""}`}>{item.label}</p>
          {item.badge && (
            <span className="px-1.5 py-0.5 rounded-md bg-primary/15 text-primary text-[9px] font-bold uppercase tracking-wider shrink-0">
              {item.badge}
            </span>
          )}
        </div>
        {item.desc && <p className="text-[10px] opacity-50 truncate">{item.desc}</p>}
      </div>
    </NavLink>
  );
}

// ── Admin Contextual Sidebar ──
function AdminContextualSidebar({
  tabs,
  currentTab,
  onTabChange,
  title,
  backTo,
  backLabel,
}: {
  tabs: typeof adminOperationalTabs;
  currentTab: string;
  onTabChange: (tab: string) => void;
  title: string;
  backTo: string;
  backLabel: string;
}) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { toggleChat, isChatOpen } = useChatContext();
  const { toggleSupport, isOpen: isSupportOpen, unreadCount } = useSupportChat();
  const { state: sidebarState, toggleSidebar } = useSidebar();
  const collapsed = sidebarState === "collapsed";
  const { tenant } = useTenant();
  const brandName = tenant?.name || "Starble";

  return (
    <Sidebar collapsible="icon" className="clf-glass-sidebar">
      <SidebarHeader className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => navigate(backTo)} tooltip={backLabel}>
              <ArrowLeft className="h-4 w-4" />
              <span>{backLabel}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {!collapsed && (
          <button
            onClick={toggleSidebar}
            className="absolute right-2 top-3 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{title}</SidebarGroupLabel>
          <SidebarGroupContent>
            {collapsed ? (
              <SidebarMenu>
                {tabs.map((tab) => (
                  <GlassTabButton
                    key={tab.id}
                    tab={tab}
                    isActive={currentTab === tab.id}
                    onClick={() => onTabChange(tab.id)}
                    collapsed
                  />
                ))}
              </SidebarMenu>
            ) : (
              <div className="space-y-1.5 px-1">
                {tabs.map((tab) => (
                  <GlassTabButton
                    key={tab.id}
                    tab={tab}
                    isActive={currentTab === tab.id}
                    onClick={() => onTabChange(tab.id)}
                    collapsed={false}
                  />
                ))}
              </div>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          {collapsed && (
            <SidebarMenuItem>
              <SidebarMenuButton onClick={toggleSidebar} tooltip="Expandir">
                <PanelLeft className="h-4 w-4" />
                <span>Expandir</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton isActive={isSupportOpen} onClick={toggleSupport} tooltip="Suporte">
              <span className="relative">
                <Headphones className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 h-3.5 min-w-[14px] rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground flex items-center justify-center px-0.5">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </span>
              <span>Suporte</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton isActive={isChatOpen} onClick={toggleChat} tooltip={brandName + " AI"}>
              <Bot className="h-4 w-4" />
              <span>{brandName} AI</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={signOut}
              tooltip="Sair"
              className="hover:!bg-destructive/10 hover:!text-destructive"
            >
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export default function AppSidebar() {
  const { user, signOut } = useAuth();
  const { tenant, isTenantAdmin } = useTenant();
  const isDefaultTenant = !tenant || tenant.id === "a0000000-0000-0000-0000-000000000001";
  const brandName = tenant?.name || "Starble";
  const brandInitials = brandName.substring(0, 2).toUpperCase();
  const { isAdmin } = useIsAdmin();
  const { isAffiliate } = useIsAffiliate();
  const { toggleChat, isChatOpen } = useChatContext();
  const { toggleSupport, isOpen: isSupportOpen, unreadCount } = useSupportChat();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { state: sidebarState, toggleSidebar } = useSidebar();
  const collapsed = sidebarState === "collapsed";

  if (!user) return null;

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");
  const isAdminPage = location.pathname === "/admin";
  const isAdminGlobalPage = location.pathname === "/admin/global";
  const isAdminTenantPage = location.pathname === "/admin/tenant";

  // ─── Admin Operational contextual sidebar ───
  if (isAdminPage && isAdmin) {
    const currentTab = searchParams.get("tab") || "members";
    return (
      <AdminContextualSidebar
        tabs={adminOperationalTabs}
        currentTab={currentTab}
        onTabChange={(tab) => setSearchParams({ tab })}
        title="Admin Operacional"
        backTo="/dashboard"
        backLabel="Voltar"
      />
    );
  }

  // ─── Admin Global contextual sidebar ───
  if (isAdminGlobalPage && isAdmin) {
    const currentTab = searchParams.get("tab") || "tenants";
    return (
      <AdminContextualSidebar
        tabs={adminGlobalTabs}
        currentTab={currentTab}
        onTabChange={(tab) => setSearchParams({ tab })}
        title="Admin Global"
        backTo="/admin"
        backLabel="Operacional"
      />
    );
  }

  // ─── Admin Tenant contextual sidebar ───
  if (isAdminTenantPage && (isTenantAdmin || isAdmin)) {
    const currentTab = searchParams.get("tab") || "editor";
    return (
      <AdminContextualSidebar
        tabs={adminTenantTabs}
        currentTab={currentTab}
        onTabChange={(tab) => setSearchParams({ tab })}
        title={tenant?.name || "Tenant"}
        backTo="/dashboard"
        backLabel="Voltar"
      />
    );
  }

  // ─── Default sidebar — Big Glass Buttons ───
  const mainItems = [
    { to: "/dashboard", label: "Painel", icon: LayoutDashboard, desc: "Visão geral" },
    { to: "/extensoes", label: "Extensões", icon: Puzzle, desc: "Loja de extensões" },
    { to: "/brain", label: "Star AI", icon: Brain, desc: "Chat com IA gratuita" },
    { to: "/assistente", label: "Assistente", icon: Bot, desc: "Dúvidas da plataforma" },
    { to: "/orquestrador", label: "Orquestrador", icon: Workflow, desc: "Automação de projetos" },
    { to: "/automation", label: "Automação", icon: Zap, desc: "Regras automáticas" },
    { to: "/notes", label: "Notas", icon: StickyNote, desc: "Anotações rápidas" },
    { to: "/community", label: "Comunidade", icon: MessageCircle, desc: "Fórum & discussões" },
    { to: "/install", label: "Instalar", icon: Download, desc: "Download da extensão" },
  ];

  const lovableItems = [
    { to: "/lovable/connect", label: "Conectar", icon: Link2, desc: "Vincular conta" },
    { to: "/lovable/projects", label: "Projetos", icon: FolderOpen, desc: "Seus projetos", badge: "Novo" },
  ];

  const accountItems = [
    { to: `/profile/${user.id}`, label: "Perfil", icon: User, desc: "Sua conta" },
    { to: "/plans", label: "Planos", icon: CreditCard, desc: "Assinatura" },
    ...(isAffiliate ? [{ to: "/afiliado/dashboard", label: "Afiliado", icon: Users, desc: "Suas indicações" }] : []),
  ];

  const helpItems = [
    { to: "/ajuda", label: "Central de Ajuda", icon: BookOpen, desc: "Artigos & guias" },
    { to: "/suporte", label: "Suporte", icon: LifeBuoy, desc: "Fale conosco" },
    { to: "/termos", label: "Termos de Uso", icon: Scale, desc: "Políticas" },
  ];

  const exploreItems = [
    ...(isDefaultTenant ? [{ to: "/afiliados", label: "Programa de Afiliados", icon: Users, desc: "Ganhe comissões" }] : []),
    ...(isDefaultTenant ? [{ to: "/whitelabel", label: "White Label", icon: Globe, desc: "Sua marca" }] : []),
    { to: "/parceiros", label: "Parceiros", icon: Handshake, desc: "Parcerias" },
    { to: "/extensoes/venus", label: "Venus AI", icon: Sparkles, desc: "Assistente visual" },
  ];

  const adminItems = [
    ...(isTenantAdmin || isAdmin ? [{ to: "/admin/tenant", label: "Admin Tenant", icon: Shield, desc: "Seu tenant" }] : []),
    ...(isAdmin ? [
      { to: "/admin", label: "Admin Operacional", icon: Shield, desc: "Gestão operacional" },
      { to: "/admin/global", label: "Admin Global", icon: Building2, desc: "Multi-tenant" },
      { to: "/admin/cloud", label: "Lovable Cloud", icon: Zap, desc: "Infra & deploy" },
    ] : []),
  ];

  const lovableActive = lovableItems.some(i => isActive(i.to));
  const accountActive = accountItems.some(i => isActive(i.to));
  const helpActive = helpItems.some(i => isActive(i.to));
  const exploreActive = exploreItems.some(i => isActive(i.to));

  const renderGlassItems = (items: { to: string; label: string; icon: React.ElementType; desc?: string }[]) => {
    if (collapsed) {
      return (
        <SidebarMenu>
          {items.map(item => (
            <SidebarMenuItem key={item.to}>
              <SidebarMenuButton asChild isActive={isActive(item.to)} tooltip={item.label}>
                <NavLink to={item.to}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      );
    }
    return (
      <div className="space-y-1.5 px-1">
        {items.map(item => (
          <GlassNavButton
            key={item.to}
            item={item}
            isActive={isActive(item.to)}
            collapsed={false}
          />
        ))}
      </div>
    );
  };

  return (
    <Sidebar collapsible="icon" className="clf-glass-sidebar">
      <SidebarHeader className="p-2 relative">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={brandName}>
              <NavLink to="/dashboard" className="font-semibold flex items-center gap-2">
                {tenant?.logo_url ? (
                  <img src={tenant.logo_url} alt="" className="h-5 w-5 rounded object-cover shrink-0" />
                ) : (
                  <span className="text-[13px] font-bold">{brandInitials}</span>
                )}
                <span>{brandName}</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {!collapsed && (
          <button onClick={toggleSidebar} className="absolute right-2 top-3 text-muted-foreground/40 hover:text-muted-foreground transition-colors">
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </SidebarHeader>

      <SidebarContent>
        {/* Principal */}
        <SidebarGroup>
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            {renderGlassItems(mainItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Lovable */}
        <Collapsible defaultOpen={lovableActive} className="group/collapsible">
          <SidebarGroup>
            <CollapsibleTrigger className="w-full">
              <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover:text-muted-foreground transition-colors">
                Lovable
                {!collapsed && (
                  <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                )}
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                {renderGlassItems(lovableItems)}
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Conta */}
        <Collapsible defaultOpen={accountActive} className="group/collapsible">
          <SidebarGroup>
            <CollapsibleTrigger className="w-full">
              <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover:text-muted-foreground transition-colors">
                Conta
                {!collapsed && (
                  <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                )}
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                {renderGlassItems(accountItems)}
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Ajuda */}
        <Collapsible defaultOpen={helpActive} className="group/collapsible">
          <SidebarGroup>
            <CollapsibleTrigger className="w-full">
              <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover:text-muted-foreground transition-colors">
                Ajuda
                {!collapsed && (
                  <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                )}
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                {renderGlassItems(helpItems)}
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Explorar */}
        <Collapsible defaultOpen={exploreActive} className="group/collapsible">
          <SidebarGroup>
            <CollapsibleTrigger className="w-full">
              <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover:text-muted-foreground transition-colors">
                Explorar
                {!collapsed && (
                  <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                )}
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                {renderGlassItems(exploreItems)}
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Admin */}
        {adminItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Administração</SidebarGroupLabel>
            <SidebarGroupContent>
              {renderGlassItems(adminItems)}
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          {collapsed && (
            <SidebarMenuItem>
              <SidebarMenuButton onClick={toggleSidebar} tooltip="Expandir">
                <PanelLeft className="h-4 w-4" />
                <span>Expandir</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton isActive={isSupportOpen} onClick={toggleSupport} tooltip="Suporte">
              <span className="relative">
                <Headphones className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 h-3.5 min-w-[14px] rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground flex items-center justify-center px-0.5">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </span>
              <span>Suporte</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton isActive={isChatOpen} onClick={toggleChat} tooltip={brandName + " AI"}>
              <Bot className="h-4 w-4" />
              <span>{brandName} AI</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={signOut}
              tooltip="Sair"
              className="hover:!bg-destructive/10 hover:!text-destructive"
            >
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
