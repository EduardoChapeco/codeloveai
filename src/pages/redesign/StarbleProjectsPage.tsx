import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLovableProxy } from "@/hooks/useLovableProxy";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus, ExternalLink, MoreHorizontal, Filter,
  Loader2, Globe, Link2, Edit3, Trash2, Copy, Eye,
} from "lucide-react";

interface LovableProject {
  id: string;
  name: string;
  display_name: string;
  latest_screenshot_url?: string;
  published_url?: string;
}

function ProjectDropdown({ project, onClose }: { project: LovableProject; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const copyUrl = () => {
    if (project.published_url) {
      navigator.clipboard.writeText(project.published_url);
      toast.success("URL copiada!");
    } else {
      toast.info("Projeto não publicado ainda");
    }
    onClose();
  };

  return (
    <div
      ref={ref}
      style={{
        position: "absolute", top: 32, right: 0, zIndex: 50,
        minWidth: 160, padding: 4,
        background: "var(--bg-2)", border: "1px solid var(--b2)",
        borderRadius: "var(--r3)", boxShadow: "var(--shadow-md)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button className="proj-dropdown-item" onClick={() => { navigate(`/projeto/${project.id}/editar`); onClose(); }}>
        <Edit3 size={12} /> Editar projeto
      </button>
      {project.published_url && (
        <button className="proj-dropdown-item" onClick={() => { window.open(project.published_url, "_blank"); onClose(); }}>
          <ExternalLink size={12} /> Abrir site
        </button>
      )}
      <button className="proj-dropdown-item" onClick={() => { navigate(`/projeto/${project.id}/editar`); onClose(); }}>
        <Eye size={12} /> Visualizar
      </button>
      <button className="proj-dropdown-item" onClick={copyUrl}>
        <Copy size={12} /> Copiar URL
      </button>
      <div style={{ height: 1, background: "var(--b1)", margin: "4px 0" }} />
      <button className="proj-dropdown-item" style={{ color: "var(--red-l)" }} onClick={() => { toast.info("Exclusão disponível em breve"); onClose(); }}>
        <Trash2 size={12} /> Excluir
      </button>
    </div>
  );
}

export default function StarbleProjectsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { invoke, checkConnection } = useLovableProxy();
  const [projects, setProjects] = useState<LovableProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<"active" | "expired" | "none" | null>(null);
  const [selectedWs, setSelectedWs] = useState("");
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    checkConnection(user.id).then((status) => {
      setConnectionStatus(status);
      if (status !== "active") setLoading(false);
    });
  }, [user, checkConnection]);

  useEffect(() => {
    if (connectionStatus !== "active") return;
    const load = async () => {
      try {
        const wsData = await invoke({ route: "/user/workspaces" }) as any;
        const wsList = Array.isArray(wsData) ? wsData : wsData?.workspaces || [];
        if (wsList.length > 0) {
          setSelectedWs(wsList[0].id);
          const data = await invoke({ route: `/workspaces/${wsList[0].id}/projects` }) as any;
          setProjects(Array.isArray(data) ? data : data?.projects || []);
        }
      } catch { /* silent */ }
      setLoading(false);
    };
    load();
  }, [connectionStatus, invoke]);

  if (connectionStatus === "none" || connectionStatus === "expired") {
    return (
      <div style={{ padding: 28 }}>
        <div className="page-header">
          <div className="ph-top">
            <div>
              <div className="ph-title">Projetos</div>
              <div className="ph-sub">Conecte sua conta para ver seus projetos</div>
            </div>
          </div>
        </div>
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <Link2 size={40} style={{ color: "var(--tq)", margin: "0 auto 16px", display: "block" }} />
          <p style={{ color: "var(--ts)", fontSize: 13, marginBottom: 16 }}>
            {connectionStatus === "expired" ? "Token expirado. Reconecte." : "Conecte sua conta Lovable."}
          </p>
          <button className="gl orange" onClick={() => navigate("/lovable/connect")}>
            {connectionStatus === "expired" ? "Reconectar" : "Conectar agora"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div className="page-header">
        <div className="ph-top">
          <div>
            <div className="ph-title">Projetos</div>
            <div className="ph-sub">Seus apps e sites criados com IA</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="gl sm ghost"><Filter size={12} /> Filtrar</button>
            <button className="gl sm orange" onClick={() => navigate("/cirius/new")}>
              <Plus size={12} /> Novo Projeto
            </button>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="proj-grid">
        {/* New project card */}
        <div className="proj-card new-card" onClick={() => navigate("/cirius/new")}>
          <div className="nc-ico"><Plus size={18} /></div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--tp)" }}>Novo projeto</div>
          <div style={{ fontSize: 11, color: "var(--tt)" }}>Descreva sua ideia e a IA constrói</div>
        </div>

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
            <Loader2 size={20} style={{ animation: "gl-spin .7s linear infinite", color: "var(--tt)" }} />
          </div>
        ) : (
          projects.map((project) => (
            <div
              key={project.id}
              className="proj-card"
              onClick={() => navigate(`/projeto/${project.id}/editar`)}
            >
              <div className="proj-thumb">
                <div className="proj-thumb-grid" />
                <div className="proj-thumb-inner">
                  {project.latest_screenshot_url ? (
                    <img src={project.latest_screenshot_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <Globe size={24} style={{ color: "var(--tq)" }} />
                  )}
                </div>
              </div>
              <div className="proj-info">
                <div className="proj-name">{project.display_name || project.name}</div>
                <div style={{ fontSize: 11, color: "var(--tt)" }}>Projeto Lovable</div>
                <div className="proj-meta">
                  <div className={`proj-status-dot ${project.published_url ? "ps-live" : "ps-draft"}`} />
                  <span className={`chip sm ${project.published_url ? "ch-green" : "ch-gray"}`}>
                    {project.published_url ? "Live" : "Rascunho"}
                  </span>
                </div>
              </div>
              <div className="proj-card-actions" style={{ position: "relative" }}>
                {project.published_url && (
                  <a href={project.published_url} target="_blank" rel="noopener noreferrer" className="gl ico xs ghost" onClick={(e) => e.stopPropagation()}>
                    <ExternalLink size={11} />
                  </a>
                )}
                <button
                  className="gl ico xs ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenDropdown(openDropdown === project.id ? null : project.id);
                  }}
                >
                  <MoreHorizontal size={11} />
                </button>
                {openDropdown === project.id && (
                  <ProjectDropdown project={project} onClose={() => setOpenDropdown(null)} />
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
