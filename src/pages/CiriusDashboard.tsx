import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import {
  Plus, Rocket, Globe, Github, Clock, AlertCircle, CheckCircle2,
  Loader2, Search, MoreVertical, ExternalLink, Trash2, Eye, Layers,
  Zap, BarChart3, ShoppingCart, Settings, Briefcase, Puzzle, Code2, Cpu,
} from "lucide-react";
import { toast } from "sonner";

/* ─── Maps ─── */

type Filter = "all" | "generating" | "live" | "failed";

const STATUS_STYLE: Record<string, string> = {
  draft: "ch-gray",
  generating: "ch-orange",
  generating_prd: "ch-orange",
  generating_code: "ch-blue",
  deploying: "ch-purple",
  live: "ch-green",
  failed: "ch-red",
  paused: "ch-orange",
  cancelled: "ch-gray",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  generating: "Gerando",
  generating_prd: "Gerando PRD",
  generating_code: "Gerando Código",
  deploying: "Deploy",
  live: "Online",
  failed: "Falhou",
  paused: "Pausado",
  cancelled: "Cancelado",
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

const ENGINE_SHORT: Record<string, string> = {
  brainchain: "Brainchain",
  brain: "Brain",
  orchestrator: "Orchestrator",
};

const FILTER_LABELS: { key: Filter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "generating", label: "Gerando" },
  { key: "live", label: "Pronto" },
  { key: "failed", label: "Falhou" },
];

function isGenerating(s: string | null) {
  return ["generating", "generating_prd", "generating_code", "deploying"].includes(s || "");
}

/* ─── Component ─── */

export default function CiriusDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  // Fetch projects
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("cirius_projects")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      setProjects(data || []);
      setLoading(false);
    })();
  }, [user]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("cirius-dash")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cirius_projects", filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setProjects((prev) => [payload.new as any, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setProjects((prev) => prev.map((p) => (p.id === (payload.new as any).id ? payload.new : p)));
          } else if (payload.eventType === "DELETE") {
            setProjects((prev) => prev.filter((p) => p.id !== (payload.old as any).id));
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Filter + search
  const filtered = useMemo(() => {
    let list = projects;
    if (filter === "generating") list = list.filter((p) => isGenerating(p.status));
    else if (filter === "live") list = list.filter((p) => p.status === "live");
    else if (filter === "failed") list = list.filter((p) => p.status === "failed");

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => (p.name || "").toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q));
    }
    return list;
  }, [projects, filter, search]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("cirius_projects").delete().eq("id", id);
    if (error) toast.error("Erro ao deletar");
    else {
      setProjects((prev) => prev.filter((p) => p.id !== id));
      toast.success("Projeto removido");
    }
  };

  return (
    <AppLayout>
      <div className="rd-page-content">
        {/* Header */}
        <div className="rd-page-head" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="rd-ico-box ib-blue"><Zap size={18} /></div>
            <h1>Meus Projetos</h1>
          </div>
          <button className="gl primary" onClick={() => navigate("/cirius/new")}>
            <Plus size={14} /> Novo Projeto
          </button>
        </div>

        {/* Search + Filters */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-quaternary)" }} />
            <input
              className="rd-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar projetos..."
              style={{ paddingLeft: 36 }}
            />
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {FILTER_LABELS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`gl sm ${filter === f.key ? "primary" : "ghost"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
            <Loader2 size={24} className="animate-spin" style={{ color: "var(--text-quaternary)" }} />
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="rd-card" style={{ padding: 48, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <Rocket size={48} style={{ color: "var(--text-quaternary)", marginBottom: 16 }} />
            <div className="label-lg" style={{ marginBottom: 4 }}>Nenhum projeto ainda</div>
            <div className="caption-sm" style={{ marginBottom: 20 }}>Crie seu primeiro projeto com IA em minutos</div>
            <button className="gl primary" onClick={() => navigate("/cirius/new")}>
              <Plus size={14} /> Criar seu primeiro projeto
            </button>
          </div>
        )}

        {/* Grid */}
        {!loading && filtered.length > 0 && (
          <div className="proj-grid">
            {filtered.map((p) => {
              const intentKey = p.template_type || (p.prd_json as any)?.intent || "custom";
              const intent = INTENT_BADGE[intentKey] || INTENT_BADGE.custom;
              const IntentIcon = intent.Icon;
              const statusKey = p.status || "draft";
              const gen = isGenerating(statusKey);

              return (
                <div
                  key={p.id}
                  className="rd-card"
                  style={{ cursor: "pointer", display: "flex", flexDirection: "column", gap: 12 }}
                  onClick={() => navigate(gen ? `/cirius/editor/${p.id}` : `/cirius/project/${p.id}`)}
                >
                  {/* Top row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="label-lg" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                      {p.description && (
                        <div className="caption-sm" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{p.description}</div>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                      className="gl ico xs ghost"
                      title="Deletar"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {/* Badges */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span className={`chip sm ${intent.cls}`}>
                      <IntentIcon size={10} /> {intent.label}
                    </span>
                    <span className={`chip sm ${STATUS_STYLE[statusKey] || "ch-gray"}`}>
                      {STATUS_LABEL[statusKey] || statusKey}
                    </span>
                  </div>

                  {/* Progress bar for generating */}
                  {gen && (
                    <div className="rd-progress">
                      <div className="rd-progress-bar blue" style={{ width: `${p.progress_pct || 10}%` }} />
                    </div>
                  )}

                  {/* Footer */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", paddingTop: 4 }}>
                    <div className="caption-sm" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {p.generation_engine && (
                        <span>{ENGINE_SHORT[p.generation_engine] || p.generation_engine}</span>
                      )}
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Clock size={10} />
                        {new Date(p.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                      {p.github_url && (
                        <a href={p.github_url} target="_blank" rel="noreferrer" style={{ color: "var(--text-quaternary)" }}>
                          <Github size={14} />
                        </a>
                      )}
                      {p.vercel_url && (
                        <a href={p.vercel_url} target="_blank" rel="noreferrer" style={{ color: "var(--text-quaternary)" }}>
                          <ExternalLink size={14} />
                        </a>
                      )}
                      {p.preview_url && !p.vercel_url && (
                        <a href={p.preview_url} target="_blank" rel="noreferrer" style={{ color: "var(--text-quaternary)" }}>
                          <Globe size={14} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
