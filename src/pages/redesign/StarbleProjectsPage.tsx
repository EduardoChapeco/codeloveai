import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLovableProxy } from "@/hooks/useLovableProxy";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus, ExternalLink, MoreHorizontal, Filter,
  Loader2, Globe, Link2, Edit3, Trash2, Copy, Eye,
  Zap, Github, Clock, Search, Rocket, BarChart3,
  ShoppingCart, Settings, Briefcase, Puzzle, Layers, Code2,
} from "lucide-react";

/* ── Types ── */

interface UnifiedProject {
  id: string;
  name: string;
  display_name: string;
  source: "lovable" | "cirius";
  status?: string;
  latest_screenshot_url?: string;
  published_url?: string;
  github_url?: string;
  vercel_url?: string;
  preview_url?: string;
  template_type?: string;
  description?: string;
  generation_engine?: string;
  progress_pct?: number;
  created_at?: string;
}

type FilterKey = "all" | "lovable" | "cirius" | "live" | "generating";

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "lovable", label: "Lovable" },
  { key: "cirius", label: "Cirius" },
  { key: "live", label: "Online" },
  { key: "generating", label: "Gerando" },
];

const STATUS_STYLE: Record<string, string> = {
  draft: "ch-gray", generating: "ch-orange", generating_prd: "ch-orange",
  generating_code: "ch-blue", deploying: "ch-purple", live: "ch-green",
  failed: "ch-red", paused: "ch-orange", cancelled: "ch-gray",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho", generating: "Gerando", generating_prd: "Gerando PRD",
  generating_code: "Gerando Código", deploying: "Deploy", live: "Online",
  failed: "Falhou", paused: "Pausado", cancelled: "Cancelado",
};

const INTENT_BADGE: Record<string, { label: string; cls: string; Icon: typeof Rocket }> = {
  landing_page: { label: "Landing", cls: "ch-green", Icon: Rocket },
  marketing_site: { label: "Site", cls: "ch-teal", Icon: Globe },
  crud_system: { label: "CRUD", cls: "ch-blue", Icon: Settings },
  dashboard: { label: "Dashboard", cls: "ch-indigo", Icon: BarChart3 },
  ecommerce: { label: "E-commerce", cls: "ch-orange", Icon: ShoppingCart },
  saas_app: { label: "SaaS", cls: "ch-purple", Icon: Briefcase },
  api_only: { label: "API", cls: "ch-blue", Icon: Code2 },
  component: { label: "Component", cls: "ch-pink", Icon: Puzzle },
  custom: { label: "Custom", cls: "ch-gray", Icon: Layers },
};

function isGenerating(s: string | null) {
  return ["generating", "generating_prd", "generating_code", "deploying"].includes(s || "");
}

/* ── Dropdown ── */

function ProjectDropdown({ project, onClose }: { project: UnifiedProject; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const getEditUrl = () => {
    if (project.source === "cirius") return `/cirius/editor/${project.id}`;
    return `/projeto/${project.id}/editar`;
  };

  const getLiveUrl = () => project.published_url || project.vercel_url || project.preview_url;

  const copyUrl = () => {
    const url = getLiveUrl();
    if (url) { navigator.clipboard.writeText(url); toast.success("URL copiada!"); }
    else toast.info("Projeto não publicado ainda");
    onClose();
  };

  const handleDelete = async () => {
    if (project.source === "cirius") {
      const { error } = await supabase.from("cirius_projects").delete().eq("id", project.id);
      if (error) toast.error("Erro ao deletar");
      else toast.success("Projeto removido");
    } else {
      toast.info("Exclusão disponível em breve");
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
      <button className="proj-dropdown-item" onClick={() => { navigate(getEditUrl()); onClose(); }}>
        <Edit3 size={12} /> Editar projeto
      </button>
      {getLiveUrl() && (
        <button className="proj-dropdown-item" onClick={() => { window.open(getLiveUrl(), "_blank"); onClose(); }}>
          <ExternalLink size={12} /> Abrir site
        </button>
      )}
      <button className="proj-dropdown-item" onClick={() => { navigate(getEditUrl()); onClose(); }}>
        <Eye size={12} /> Visualizar
      </button>
      <button className="proj-dropdown-item" onClick={copyUrl}>
        <Copy size={12} /> Copiar URL
      </button>
      {project.github_url && (
        <button className="proj-dropdown-item" onClick={() => { window.open(project.github_url, "_blank"); onClose(); }}>
          <Github size={12} /> GitHub
        </button>
      )}
      <div style={{ height: 1, background: "var(--b1)", margin: "4px 0" }} />
      <button className="proj-dropdown-item" style={{ color: "var(--red-l)" }} onClick={handleDelete}>
        <Trash2 size={12} /> Excluir
      </button>
    </div>
  );
}

/* ── Main Page ── */

export default function StarbleProjectsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { invoke, checkConnection } = useLovableProxy();
  const [lovableProjects, setLovableProjects] = useState<UnifiedProject[]>([]);
  const [ciriusProjects, setCiriusProjects] = useState<UnifiedProject[]>([]);
  const [loadingLovable, setLoadingLovable] = useState(true);
  const [loadingCirius, setLoadingCirius] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<"active" | "expired" | "none" | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

  /* ── Load Lovable projects ── */
  useEffect(() => {
    if (!user) return;
    checkConnection(user.id).then((status) => {
      setConnectionStatus(status);
      if (status !== "active") setLoadingLovable(false);
    });
  }, [user, checkConnection]);

  useEffect(() => {
    if (connectionStatus !== "active") return;
    const load = async () => {
      try {
        const wsData = await invoke({ route: "/user/workspaces" }) as any;
        const wsList = Array.isArray(wsData) ? wsData : wsData?.workspaces || [];
        if (wsList.length > 0) {
          const data = await invoke({ route: `/workspaces/${wsList[0].id}/projects` }) as any;
          const list = Array.isArray(data) ? data : data?.projects || [];
          setLovableProjects(list.map((p: any) => ({
            id: p.id, name: p.name, display_name: p.display_name || p.name,
            source: "lovable" as const,
            status: p.published_url ? "live" : "draft",
            latest_screenshot_url: p.latest_screenshot_url,
            published_url: p.published_url,
          })));
        }
      } catch { /* silent */ }
      setLoadingLovable(false);
    };
    load();
  }, [connectionStatus, invoke]);

  /* ── Load Cirius projects ── */
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("cirius_projects")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      setCiriusProjects((data || []).map((p: any) => ({
        id: p.id, name: p.name, display_name: p.name,
        source: "cirius" as const,
        status: p.status || "draft",
        description: p.description,
        template_type: p.template_type,
        generation_engine: p.generation_engine,
        progress_pct: p.progress_pct,
        github_url: p.github_url,
        vercel_url: p.vercel_url,
        preview_url: p.preview_url,
        created_at: p.created_at,
      })));
      setLoadingCirius(false);
    })();
  }, [user]);

  /* ── Cirius realtime ── */
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("cirius-unified")
      .on("postgres_changes", { event: "*", schema: "public", table: "cirius_projects", filter: `user_id=eq.${user.id}` }, (payload) => {
        if (payload.eventType === "INSERT") {
          const p = payload.new as any;
          setCiriusProjects((prev) => [{ id: p.id, name: p.name, display_name: p.name, source: "cirius", status: p.status, description: p.description, template_type: p.template_type, generation_engine: p.generation_engine, progress_pct: p.progress_pct, github_url: p.github_url, vercel_url: p.vercel_url, preview_url: p.preview_url, created_at: p.created_at }, ...prev]);
        } else if (payload.eventType === "UPDATE") {
          const p = payload.new as any;
          setCiriusProjects((prev) => prev.map((x) => x.id === p.id ? { ...x, status: p.status, progress_pct: p.progress_pct, vercel_url: p.vercel_url, preview_url: p.preview_url, github_url: p.github_url } : x));
        } else if (payload.eventType === "DELETE") {
          setCiriusProjects((prev) => prev.filter((x) => x.id !== (payload.old as any).id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  /* ── Combined + filtered ── */
  const allProjects = useMemo(() => {
    let list = [...ciriusProjects, ...lovableProjects];
    if (filter === "lovable") list = list.filter((p) => p.source === "lovable");
    else if (filter === "cirius") list = list.filter((p) => p.source === "cirius");
    else if (filter === "live") list = list.filter((p) => p.status === "live" || p.published_url || p.vercel_url);
    else if (filter === "generating") list = list.filter((p) => isGenerating(p.status || ""));

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.display_name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q));
    }
    return list;
  }, [lovableProjects, ciriusProjects, filter, search]);

  const loading = loadingLovable || loadingCirius;

  const getEditUrl = (p: UnifiedProject) => {
    if (p.source === "cirius") {
      return isGenerating(p.status || "") ? `/cirius/editor/${p.id}` : `/cirius/project/${p.id}`;
    }
    return `/projeto/${p.id}/editar`;
  };

  const getLiveUrl = (p: UnifiedProject) => p.published_url || p.vercel_url || p.preview_url;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div className="page-header">
        <div className="ph-top">
          <div>
            <div className="ph-title">Projetos</div>
            <div className="ph-sub">Todos os seus apps e sites em um lugar</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {connectionStatus !== "active" && (
              <button className="gl sm ghost" onClick={() => navigate("/lovable/connect")}>
                <Link2 size={12} /> Conectar Lovable
              </button>
            )}
            <button className="gl sm orange" onClick={() => navigate("/home")}>
              <Plus size={12} /> Novo Projeto
            </button>
          </div>
        </div>
      </div>

      {/* Search + Filters */}
      <div style={{ padding: "0 28px 12px", display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
          <Search size={12} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--tq)" }} />
          <input className="rd-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar projetos..." style={{ paddingLeft: 30, height: 32, fontSize: 12 }} />
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {FILTER_TABS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)} className={`gl sm ${filter === f.key ? "primary" : "ghost"}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="proj-grid" style={{ padding: "0 28px 28px" }}>
        {/* New project card */}
        <div className="proj-card new-card" onClick={() => navigate("/home")}>
          <div className="nc-ico"><Plus size={18} /></div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--tp)" }}>Novo projeto</div>
          <div style={{ fontSize: 11, color: "var(--tt)" }}>Descreva sua ideia e a IA constrói</div>
        </div>

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
            <Loader2 size={20} style={{ animation: "gl-spin .7s linear infinite", color: "var(--tt)" }} />
          </div>
        ) : allProjects.length === 0 ? (
          <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "48px 0" }}>
            <Rocket size={36} style={{ color: "var(--tq)", margin: "0 auto 12px", display: "block" }} />
            <p style={{ fontSize: 13, color: "var(--ts)", marginBottom: 4 }}>Nenhum projeto encontrado</p>
            <p style={{ fontSize: 11, color: "var(--tt)" }}>Crie seu primeiro projeto com IA</p>
          </div>
        ) : (
          allProjects.map((project) => {
            const statusKey = project.status || "draft";
            const gen = isGenerating(statusKey);
            const intentKey = project.template_type || "custom";
            const intent = INTENT_BADGE[intentKey] || INTENT_BADGE.custom;
            const IntentIcon = intent.Icon;

            return (
              <div key={`${project.source}-${project.id}`} className="proj-card" onClick={() => navigate(getEditUrl(project))}>
                {/* Actions — top-right overlay */}
                <div className="proj-card-actions">
                  {getLiveUrl(project) && (
                    <a href={getLiveUrl(project)} target="_blank" rel="noopener noreferrer" className="gl ico xs ghost" onClick={(e) => e.stopPropagation()}>
                      <ExternalLink size={11} />
                    </a>
                  )}
                  {project.github_url && (
                    <a href={project.github_url} target="_blank" rel="noopener noreferrer" className="gl ico xs ghost" onClick={(e) => e.stopPropagation()}>
                      <Github size={11} />
                    </a>
                  )}
                  <button className="gl ico xs ghost" onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === `${project.source}-${project.id}` ? null : `${project.source}-${project.id}`); }}>
                    <MoreHorizontal size={11} />
                  </button>
                  {openDropdown === `${project.source}-${project.id}` && (
                    <ProjectDropdown project={project} onClose={() => setOpenDropdown(null)} />
                  )}
                </div>

                <div className="proj-thumb">
                  <div className="proj-thumb-grid" />
                  <div className="proj-thumb-inner">
                    {project.latest_screenshot_url ? (
                      <img src={project.latest_screenshot_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <Globe size={24} style={{ color: "var(--tq)" }} />
                    )}
                  </div>
                  {/* Source badge */}
                  <div style={{
                    position: "absolute", top: 6, left: 6, fontSize: 9, fontWeight: 700,
                    padding: "1px 6px", borderRadius: "var(--r1)",
                    background: project.source === "cirius" ? "rgba(168,85,247,0.2)" : "rgba(59,130,246,0.2)",
                    color: project.source === "cirius" ? "var(--purple-l)" : "var(--blue-l)",
                    border: `1px solid ${project.source === "cirius" ? "rgba(168,85,247,0.3)" : "rgba(59,130,246,0.3)"}`,
                    textTransform: "uppercase", letterSpacing: "0.5px",
                  }}>
                    {project.source === "cirius" ? "Cirius" : "Lovable"}
                  </div>
                </div>

                {/* Progress bar for generating */}
                {gen && (
                  <div className="rd-progress" style={{ margin: "0 8px" }}>
                    <div className="rd-progress-bar blue" style={{ width: `${project.progress_pct || 10}%` }} />
                  </div>
                )}

                <div className="proj-info">
                  <div className="proj-name">{project.display_name || project.name}</div>
                  {project.description && (
                    <div style={{ fontSize: 10, color: "var(--tt)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{project.description}</div>
                  )}
                  <div className="proj-meta">
                    {project.source === "cirius" && (
                      <span className={`chip sm ${intent.cls}`} style={{ fontSize: 9 }}>
                        <IntentIcon size={9} /> {intent.label}
                      </span>
                    )}
                    <span className={`chip sm ${STATUS_STYLE[statusKey] || "ch-gray"}`} style={{ fontSize: 9 }}>
                      {STATUS_LABEL[statusKey] || (getLiveUrl(project) ? "Live" : "Rascunho")}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
