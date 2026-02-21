import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth, useIsAdmin, useIsAffiliate } from "@/hooks/useAuth";
import { useChatContext } from "@/contexts/ChatContext";
import {
  LayoutDashboard, MessageCircle, Users, Download, Bot,
  Link2, FolderOpen, Shield, LogOut, User, ChevronDown,
  ArrowLeft, Key, Bell, Send, Gift, Upload, FileText, Coins, Unlock,
  PanelLeftClose, PanelLeft,
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
  { id: "affiliates", label: "Afiliados", icon: Coins },
  { id: "invoices", label: "Faturas", icon: FileText },
  { id: "worker-tokens", label: "Tokens API", icon: Unlock },
  { id: "extension", label: "Extensão", icon: Upload },
  { id: "notifications", label: "Notificações", icon: Bell },
  { id: "messages", label: "Mensagens", icon: Send },
  { id: "free-links", label: "Links Grátis", icon: Gift },
];

export default function AppSidebar() {
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { isAffiliate } = useIsAffiliate();
  const { toggleChat, isChatOpen } = useChatContext();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { state: sidebarState, toggleSidebar } = useSidebar();
  const collapsed = sidebarState === "collapsed";

  if (!user) return null;

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");
  const isAdminPage = location.pathname === "/admin";
  const currentAdminTab = searchParams.get("tab") || "members";

  // Shared button styles — glass/blur aesthetic, no shadows
  const navBtnBase = "flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all duration-150";
  const navBtnActive = "bg-primary/8 text-primary font-medium backdrop-blur-sm";
  const navBtnInactive = "text-muted-foreground hover:bg-muted/40 hover:text-foreground";

  // ─── Admin contextual sidebar ───
  if (isAdminPage && isAdmin) {
    return (
      <Sidebar collapsible="icon">
        <SidebarHeader className="p-3 flex flex-row items-center justify-between">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors text-sm"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Voltar ao painel</span>}
          </button>
          {!collapsed && (
            <button onClick={toggleSidebar} className="text-muted-foreground/60 hover:text-foreground transition-colors">
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </SidebarHeader>

        <SidebarContent className="px-2 py-3">
          <SidebarGroup>
            <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-muted-foreground/50 px-3 mb-1">
              Administração
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminTabs.map(tab => (
                  <SidebarMenuItem key={tab.id}>
                    <SidebarMenuButton
                      isActive={currentAdminTab === tab.id}
                      onClick={() => setSearchParams({ tab: tab.id })}
                      className={`${navBtnBase} cursor-pointer ${currentAdminTab === tab.id ? navBtnActive : navBtnInactive}`}
                    >
                      <tab.icon className={`h-4 w-4 shrink-0 ${currentAdminTab === tab.id ? "text-primary" : ""}`} />
                      {!collapsed && <span>{tab.label}</span>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="p-3 border-t border-border/10 space-y-0.5">
          {collapsed && (
            <button onClick={toggleSidebar} className="w-full flex items-center justify-center py-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
              <PanelLeft className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={toggleChat}
            className={`w-full ${navBtnBase} ${isChatOpen ? navBtnActive : navBtnInactive}`}
          >
            <Bot className={`h-4 w-4 shrink-0 ${isChatOpen ? "text-primary" : ""}`} />
            {!collapsed && <span>CodeLove AI</span>}
          </button>
          <button
            onClick={signOut}
            className={`w-full ${navBtnBase} text-muted-foreground hover:bg-destructive/8 hover:text-destructive`}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </SidebarFooter>
      </Sidebar>
    );
  }

  // ─── Default sidebar ───
  const mainItems = [
    { to: "/dashboard", label: "Painel", icon: LayoutDashboard },
    { to: "/community", label: "Comunidade", icon: MessageCircle },
    { to: "/install", label: "Instalar", icon: Download },
  ];

  const lovableItems = [
    { to: "/lovable/connect", label: "Conectar", icon: Link2 },
    { to: "/lovable/projects", label: "Projetos", icon: FolderOpen },
  ];

  const accountItems = [
    { to: `/profile/${user.id}`, label: "Perfil", icon: User },
    ...(isAffiliate ? [{ to: "/affiliate", label: "Afiliado", icon: Users }] : []),
  ];

  const adminItems = isAdmin
    ? [{ to: "/admin", label: "Admin", icon: Shield }]
    : [];

  const lovableActive = lovableItems.some(i => isActive(i.to));
  const accountActive = accountItems.some(i => isActive(i.to));

  const renderNavItem = (item: { to: string; label: string; icon: any }) => {
    const active = isActive(item.to);
    return (
      <SidebarMenuItem key={item.to}>
        <SidebarMenuButton asChild isActive={active}>
          <NavLink to={item.to} className={`${navBtnBase} ${active ? navBtnActive : navBtnInactive}`}>
            <item.icon className={`h-4 w-4 shrink-0 ${active ? "text-primary" : ""}`} />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-3 flex flex-row items-center justify-between">
        <NavLink to="/dashboard" className="flex items-center gap-2 text-foreground font-semibold tracking-tight">
          {!collapsed && <span className="text-sm">CodeLove AI</span>}
          {collapsed && <span className="text-xs font-bold">CL</span>}
        </NavLink>
        {!collapsed && (
          <button onClick={toggleSidebar} className="text-muted-foreground/60 hover:text-foreground transition-colors">
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        {/* Principal */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-muted-foreground/50 px-3 mb-1">
            Principal
          </SidebarGroupLabel>
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
              <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-muted-foreground/50 px-3 flex items-center justify-between cursor-pointer hover:text-foreground transition-colors">
                Lovable
                {!collapsed && (
                  <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]/collapsible:rotate-180" />
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
              <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-muted-foreground/50 px-3 flex items-center justify-between cursor-pointer hover:text-foreground transition-colors">
                Conta
                {!collapsed && (
                  <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]/collapsible:rotate-180" />
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

        {/* Admin */}
        {adminItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-muted-foreground/50 px-3 mb-1">
              Administração
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map(renderNavItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-border/10 space-y-0.5">
        {collapsed && (
          <button onClick={toggleSidebar} className="w-full flex items-center justify-center py-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
            <PanelLeft className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={toggleChat}
          className={`w-full ${navBtnBase} ${isChatOpen ? navBtnActive : navBtnInactive}`}
        >
          <Bot className={`h-4 w-4 shrink-0 ${isChatOpen ? "text-primary" : ""}`} />
          {!collapsed && <span>CodeLove AI</span>}
        </button>
        <button
          onClick={signOut}
          className={`w-full ${navBtnBase} text-muted-foreground hover:bg-destructive/8 hover:text-destructive`}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
