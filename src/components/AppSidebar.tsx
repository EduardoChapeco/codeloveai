import { useLocation } from "react-router-dom";
import { useAuth, useIsAdmin, useIsAffiliate } from "@/hooks/useAuth";
import { useChatContext } from "@/contexts/ChatContext";
import {
  LayoutDashboard, MessageCircle, Users, Download, Bot,
  Link2, FolderOpen, Shield, LogOut, User, ChevronDown,
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

export default function AppSidebar() {
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { isAffiliate } = useIsAffiliate();
  const { toggleChat, isChatOpen } = useChatContext();
  const location = useLocation();
  const { state: sidebarState } = useSidebar();
  const collapsed = sidebarState === "collapsed";

  if (!user) return null;

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");

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

  return (
    <Sidebar collapsible="icon" className="border-r border-border/60">
      <SidebarHeader className="p-4 border-b border-border/40">
        <NavLink to="/dashboard" className="flex items-center gap-2 text-foreground font-semibold tracking-tight">
          {!collapsed && <span className="text-base">CodeLove AI</span>}
          {collapsed && <span className="text-xs font-bold">CL</span>}
        </NavLink>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        {/* Principal */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-muted-foreground/70 px-2">
            Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map(item => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={isActive(item.to)}>
                    <NavLink to={item.to} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm">
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Lovable */}
        <Collapsible defaultOpen={lovableActive} className="group/collapsible">
          <SidebarGroup>
            <CollapsibleTrigger className="w-full">
              <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-muted-foreground/70 px-2 flex items-center justify-between cursor-pointer hover:text-foreground transition-colors">
                Lovable
                {!collapsed && (
                  <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                )}
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {lovableItems.map(item => (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={isActive(item.to)}>
                        <NavLink to={item.to} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm">
                          <item.icon className="h-4 w-4 shrink-0" />
                          {!collapsed && <span>{item.label}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Conta */}
        <Collapsible defaultOpen={accountActive} className="group/collapsible">
          <SidebarGroup>
            <CollapsibleTrigger className="w-full">
              <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-muted-foreground/70 px-2 flex items-center justify-between cursor-pointer hover:text-foreground transition-colors">
                Conta
                {!collapsed && (
                  <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                )}
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {accountItems.map(item => (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={isActive(item.to)}>
                        <NavLink to={item.to} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm">
                          <item.icon className="h-4 w-4 shrink-0" />
                          {!collapsed && <span>{item.label}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Admin */}
        {adminItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-muted-foreground/70 px-2">
              Administração
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map(item => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={isActive(item.to)}>
                      <NavLink to={item.to} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm">
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.label}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-border/40 space-y-1">
        <button
          onClick={toggleChat}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors hover:bg-accent ${
            isChatOpen ? "bg-primary/10 text-primary" : "text-muted-foreground"
          }`}
        >
          <Bot className="h-4 w-4 shrink-0" />
          {!collapsed && <span>CodeLove AI</span>}
        </button>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
