import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Search, Bell, Settings, PanelLeftClose, X } from "lucide-react";
import { toast } from "sonner";

const pageTitles: Record<string, string> = {
  "/lovable/projects": "Projetos",
  "/ai": "AI",
  "/brain": "AI",
  "/community": "Comunidade",
  "/cirius": "Cirius Editor",
  "/marketplace": "Loja",
  "/home": "Home",
  "/dashboard": "Home",
  "/plans": "Planos & Billing",
  "/admin": "Admin",
  "/admin/tenant": "Admin Tenant",
  "/admin/global": "Admin Global",
  "/admin/integrations": "Integrações API",
  "/admin/cloud": "Lovable Cloud",
  "/admin/brainchain": "Brainchain",
  "/admin/extensions": "Extensões",
  "/admin/modules": "Módulos",
  "/tenant/admin": "Admin Tenant",
  "/extensoes/venus": "Venus",
  "/notes": "Notas",
  "/ajuda": "Central de Ajuda",
  "/painel": "Painel",
  "/lovable/connect": "Painel",
  "/automation": "Automação",
  "/suporte": "Suporte",
};

const SEARCH_ITEMS = [
  { label: "Home", path: "/home" },
  { label: "Projetos", path: "/lovable/projects" },
  { label: "AI", path: "/ai" },
  { label: "Comunidade", path: "/community" },
  { label: "Loja", path: "/marketplace" },
  { label: "Painel", path: "/painel" },
  { label: "Planos & Billing", path: "/plans" },
  { label: "Configurações", path: "/cirius/integrations" },
  { label: "Venus", path: "/extensoes/venus" },
  { label: "Notas", path: "/notes" },
  { label: "Suporte", path: "/suporte" },
  { label: "Admin", path: "/admin" },
  { label: "Admin Global", path: "/admin/global" },
];

export default function StarbleTopbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const title = Object.entries(pageTitles).find(
    ([path]) => location.pathname === path || location.pathname.startsWith(path + "/")
  )?.[1] || "Engios";

  const filtered = searchQuery.trim()
    ? SEARCH_ITEMS.filter((i) => i.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : SEARCH_ITEMS;

  const handleSearchSelect = (path: string) => {
    setSearchOpen(false);
    setSearchQuery("");
    navigate(path);
  };

  return (
    <>
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
        <div className="tb-search" onClick={() => setSearchOpen(true)} style={{ cursor: "pointer" }}>
          <Search size={12} />
          <span>Pesquisar...</span>
          <kbd>⌘K</kbd>
        </div>
        <button className="gl sm ghost" onClick={() => toast.info("Notificações em breve!")} title="Notificações">
          <Bell size={14} />
        </button>
        <button className="gl sm ghost" onClick={() => navigate("/cirius/integrations")} title="Configurações">
          <Settings size={14} />
        </button>
      </div>

      {/* Search overlay */}
      {searchOpen && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "flex-start", justifyContent: "center",
            paddingTop: 120,
          }}
          onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 480,
              background: "var(--bg-1)", border: "1px solid var(--b1)",
              borderRadius: "var(--r3)", overflow: "hidden",
              boxShadow: "0 24px 48px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--b0)" }}>
              <Search size={14} style={{ color: "var(--tq)", flexShrink: 0 }} />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar páginas..."
                style={{
                  flex: 1, background: "transparent", border: "none", outline: "none",
                  color: "var(--tp)", fontSize: 14, fontFamily: "var(--sans)",
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") { setSearchOpen(false); setSearchQuery(""); }
                  if (e.key === "Enter" && filtered.length > 0) handleSearchSelect(filtered[0].path);
                }}
              />
              <button className="gl ico xs ghost" onClick={() => { setSearchOpen(false); setSearchQuery(""); }}>
                <X size={12} />
              </button>
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto", padding: "6px 0" }}>
              {filtered.length === 0 && (
                <div style={{ padding: "20px 16px", textAlign: "center", fontSize: 12, color: "var(--tq)" }}>
                  Nenhum resultado encontrado
                </div>
              )}
              {filtered.map((item) => (
                <div
                  key={item.path}
                  onClick={() => handleSearchSelect(item.path)}
                  style={{
                    padding: "10px 16px", cursor: "pointer", fontSize: 13,
                    color: "var(--ts)", display: "flex", alignItems: "center", gap: 10,
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <Search size={11} style={{ color: "var(--tq)" }} />
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
