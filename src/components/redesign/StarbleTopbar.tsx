import { useLocation } from "react-router-dom";
import { Search, Bell, Settings, PanelLeftClose } from "lucide-react";

const pageTitles: Record<string, string> = {
  "/lovable/projects": "Projetos",
  "/brain": "Star AI",
  "/community": "Comunidade",
  "/cirius": "Cirius Editor",
  "/marketplace": "Loja",
  "/dashboard": "Assistente IA",
  "/plans": "Planos & Billing",
  "/admin": "Admin",
  "/admin/tenant": "Admin Tenant",
  "/admin/global": "Admin Global",
  "/extensoes/venus": "Venus AI",
  "/notes": "Notas",
  "/ajuda": "Central de Ajuda",
  "/lovable/connect": "Lovable Connect",
  "/automation": "Automação",
  "/suporte": "Suporte",
};

export default function StarbleTopbar() {
  const location = useLocation();

  const title = Object.entries(pageTitles).find(
    ([path]) => location.pathname === path || location.pathname.startsWith(path + "/")
  )?.[1] || "Starble";

  return (
    <div id="topbar">
      <button
        className="gl ico xs ghost"
        onClick={() => window.dispatchEvent(new Event("sidebar-toggle"))}
        title="Recolher/expandir menu"
      >
        <PanelLeftClose size={14} />
      </button>
      <span className="tb-title">{title}</span>
      <div className="tb-spacer" />
      <div className="tb-search">
        <Search size={12} />
        <span>Pesquisar...</span>
        <kbd>⌘K</kbd>
      </div>
      <button className="gl sm ghost">
        <Bell size={14} />
      </button>
      <button className="gl sm ghost">
        <Settings size={14} />
      </button>
    </div>
  );
}
