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
  Rocket, Globe, Handshake,
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

const adminTabs = [
  { id: "members", label: "Membros", icon: Users },
  { id: "worker-tokens", label: "Tokens API", icon: Unlock },
  { id: "extension", label: "Extensão", icon: Upload },
  { id: "notifications", label: "Notificações", icon: Bell },
  { id: "messages", label: "Mensagens", icon: Send },
];

export default function AppSidebar() {
  const { user, signOut } = useAuth();
  const { tenant, isTenantAdmin } = useTenant();
  const brandName = "Starble";
  const brandInitials = "SB";
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
  const currentAdminTab = searchParams.get("tab") || "members";

  // ─── Admin contextual sidebar ───
  if (isAdminPage && isAdmin) {
    return (
      <Sidebar collapsible="icon" className="clf-glass-sidebar">
        <SidebarHeader className="p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => navigate("/dashboard")} tooltip="Voltar">
                <ArrowLeft className="h-4 w-4" />
                <span>Voltar</span>
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
          <SidebarGroup>
            <SidebarGroupLabel>Administração</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminTabs.map(tab => (
                  <SidebarMenuItem key={tab.id}>
                    <SidebarMenuButton
                      isActive={currentAdminTab === tab.id}
                      onClick={() => setSearchParams({ tab: tab.id })}
                      tooltip={tab.label}
                    >
                      <tab.icon className="h-4 w-4" />
                      <span>{tab.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
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

  // ─── Default sidebar ───
  const mainItems = [
    { to: "/dashboard", label: "Painel", icon: LayoutDashboard },
    { to: "/brain", label: "Star AI", icon: Brain },
    { to: "/notes", label: "Notas", icon: StickyNote },
    { to: "/community", label: "Comunidade", icon: MessageCircle },
    { to: "/install", label: "Instalar", icon: Download },
  ];

  const lovableItems = [
    { to: "/lovable/connect", label: "Conectar", icon: Link2 },
    { to: "/lovable/projects", label: "Projetos", icon: FolderOpen },
  ];

  const accountItems = [
    { to: `/profile/${user.id}`, label: "Perfil", icon: User },
    { to: "/plans", label: "Planos", icon: CreditCard },
    ...(isAffiliate ? [{ to: "/afiliado/dashboard", label: "Afiliado", icon: Users }] : []),
  ];

  const helpItems = [
    { to: "/ajuda", label: "Central de Ajuda", icon: BookOpen },
    { to: "/suporte", label: "Suporte", icon: LifeBuoy },
    { to: "/termos", label: "Termos de Uso", icon: Scale },
  ];

  const exploreItems = [
    { to: "/afiliados", label: "Programa de Afiliados", icon: Users },
    { to: "/whitelabel", label: "White Label", icon: Globe },
    { to: "/parceiros", label: "Parceiros", icon: Handshake },
  ];

  const adminItems = [
    ...(isTenantAdmin || isAdmin ? [{ to: "/admin/tenant", label: "Admin Tenant", icon: Shield }] : []),
    ...(isAdmin ? [
      { to: "/admin", label: "Admin Operacional", icon: Shield },
      { to: "/admin/global", label: "Admin Global", icon: Building2 },
      { to: "/admin/cloud", label: "Lovable Cloud", icon: Zap },
    ] : []),
  ];

  const lovableActive = lovableItems.some(i => isActive(i.to));
  const accountActive = accountItems.some(i => isActive(i.to));
  const helpActive = helpItems.some(i => isActive(i.to));
  const exploreActive = exploreItems.some(i => isActive(i.to));

  const renderNavItem = (item: { to: string; label: string; icon: React.ElementType }) => {
    const active = isActive(item.to);
    return (
      <SidebarMenuItem key={item.to}>
        <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
          <NavLink to={item.to}>
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" className="clf-glass-sidebar">
      <SidebarHeader className="p-2 relative">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={brandName}>
              <NavLink to="/dashboard" className="font-semibold">
                <span className="text-[13px] font-bold">{brandInitials}</span>
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
            <SidebarMenu>
              {mainItems.map(renderNavItem)}
            </SidebarMenu>
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
                <SidebarMenu>
                  {lovableItems.map(renderNavItem)}
                </SidebarMenu>
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
                <SidebarMenu>
                  {accountItems.map(renderNavItem)}
                </SidebarMenu>
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
                <SidebarMenu>
                  {helpItems.map(renderNavItem)}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Explorar — Landing pages públicas */}
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
                <SidebarMenu>
                  {exploreItems.map(renderNavItem)}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Admin */}
        {adminItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Administração</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map(renderNavItem)}
              </SidebarMenu>
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
