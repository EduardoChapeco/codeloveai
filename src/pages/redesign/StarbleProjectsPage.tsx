import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLovableProxy } from "@/hooks/useLovableProxy";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus, Star, Heart, ExternalLink, MoreHorizontal, Filter,
  Loader2, Globe, RefreshCw, Link2, AlertTriangle,
} from "lucide-react";

interface LovableProject {
  id: string;
  name: string;
  display_name: string;
  latest_screenshot_url?: string;
  published_url?: string;
}

export default function StarbleProjectsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { invoke, checkConnection } = useLovableProxy();
  const [projects, setProjects] = useState<LovableProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<"active" | "expired" | "none" | null>(null);
  const [selectedWs, setSelectedWs] = useState("");

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
          <Link2 size={40} style={{ color: "var(--text-tertiary)", margin: "0 auto 16px", display: "block" }} />
          <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>
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
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Novo projeto</div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Descreva sua ideia e a IA constrói</div>
        </div>

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
            <Loader2 size={20} style={{ animation: "gl-spin .7s linear infinite", color: "var(--text-tertiary)" }} />
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
                    <Globe size={24} style={{ color: "var(--text-quaternary)" }} />
                  )}
                </div>
              </div>
              <div className="proj-info">
                <div className="proj-name">{project.display_name || project.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Projeto Lovable</div>
                <div className="proj-meta">
                  <div className={`proj-status-dot ${project.published_url ? "ps-live" : "ps-draft"}`} />
                  <span className={`chip sm ${project.published_url ? "ch-green" : "ch-gray"}`}>
                    {project.published_url ? "Live" : "Rascunho"}
                  </span>
                </div>
              </div>
              <div className="proj-card-actions">
                {project.published_url && (
                  <a href={project.published_url} target="_blank" rel="noopener noreferrer" className="gl ico xs ghost" onClick={(e) => e.stopPropagation()}>
                    <ExternalLink size={11} />
                  </a>
                )}
                <button className="gl ico xs ghost" onClick={(e) => e.stopPropagation()}>
                  <MoreHorizontal size={11} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
