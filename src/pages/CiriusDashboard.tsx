import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus, Rocket, Globe, Github, Clock, AlertCircle, CheckCircle2,
  Loader2, Search, MoreVertical, ExternalLink, Trash2, Eye, Layers,
  Zap, BarChart3, ShoppingCart, Settings, Briefcase, Puzzle, Code2, Cpu,
} from "lucide-react";
import { toast } from "sonner";

/* ─── Maps ─── */

type Filter = "all" | "generating" | "live" | "failed";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-neutral-800/60 text-neutral-400",
  generating: "bg-amber-500/15 text-amber-400 animate-pulse",
  generating_prd: "bg-amber-500/15 text-amber-400 animate-pulse",
  generating_code: "bg-blue-500/15 text-blue-400 animate-pulse",
  deploying: "bg-purple-500/15 text-purple-400 animate-pulse",
  live: "bg-emerald-500/15 text-emerald-400",
  failed: "bg-red-500/15 text-red-400",
  paused: "bg-amber-500/15 text-amber-400",
  cancelled: "bg-neutral-800/60 text-neutral-500",
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
  landing_page: { label: "Landing", cls: "bg-emerald-600/15 text-emerald-400 border-emerald-600/20", Icon: Rocket },
  marketing_site: { label: "Site", cls: "bg-teal-600/15 text-teal-400 border-teal-600/20", Icon: Globe },
  crud_system: { label: "CRUD", cls: "bg-blue-600/15 text-blue-400 border-blue-600/20", Icon: Settings },
  dashboard: { label: "Dashboard", cls: "bg-indigo-600/15 text-indigo-400 border-indigo-600/20", Icon: BarChart3 },
  ecommerce: { label: "E-commerce", cls: "bg-orange-600/15 text-orange-400 border-orange-600/20", Icon: ShoppingCart },
  saas_app: { label: "SaaS", cls: "bg-purple-600/15 text-purple-400 border-purple-600/20", Icon: Briefcase },
  api_only: { label: "API", cls: "bg-cyan-600/15 text-cyan-400 border-cyan-600/20", Icon: Code2 },
  component: { label: "Component", cls: "bg-pink-600/15 text-pink-400 border-pink-600/20", Icon: Puzzle },
  custom: { label: "Custom", cls: "bg-neutral-700/40 text-neutral-400 border-neutral-600/30", Icon: Layers },
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
    <div className="min-h-screen" style={{ background: "#08080a" }}>
      <div className="max-w-6xl mx-auto px-4 py-8 lg:py-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-600/20 flex items-center justify-center">
              <Zap className="h-5 w-5 text-blue-400" />
            </div>
            <h1 className="text-xl font-semibold text-white tracking-tight" style={{ fontFamily: "Geist, sans-serif" }}>
              Meus Projetos
            </h1>
          </div>
          <Button
            onClick={() => navigate("/cirius/new")}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm gap-1.5 h-9"
          >
            <Plus className="h-4 w-4" /> Novo Projeto
          </Button>
        </div>

        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-600" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar projetos..."
              className="pl-9 bg-neutral-900/50 border-neutral-800/60 text-sm text-neutral-300 placeholder:text-neutral-600 focus-visible:ring-blue-500/40"
            />
          </div>
          <div className="flex gap-1.5">
            {FILTER_LABELS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-md text-xs transition-colors ${
                  filter === f.key
                    ? "bg-blue-600/20 text-blue-400"
                    : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/40"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 text-neutral-600 animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <Card className="border-neutral-800/40 bg-neutral-900/30 p-12 flex flex-col items-center text-center backdrop-blur">
            <Rocket className="h-12 w-12 text-neutral-700 mb-4" />
            <p className="text-sm text-neutral-400 mb-1">Nenhum projeto ainda</p>
            <p className="text-xs text-neutral-600 mb-5">Crie seu primeiro projeto com IA em minutos</p>
            <Button
              onClick={() => navigate("/cirius/new")}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm gap-1.5"
            >
              <Plus className="h-4 w-4" /> Criar seu primeiro projeto
            </Button>
          </Card>
        )}

        {/* Grid */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((p) => {
              const intentKey = p.template_type || (p.prd_json as any)?.intent || "custom";
              const intent = INTENT_BADGE[intentKey] || INTENT_BADGE.custom;
              const IntentIcon = intent.Icon;
              const statusKey = p.status || "draft";
              const gen = isGenerating(statusKey);

              return (
                <Card
                  key={p.id}
                  className="border-neutral-800/50 bg-neutral-900/40 p-4 backdrop-blur flex flex-col gap-3 group hover:border-neutral-700/60 transition-colors cursor-pointer"
                  onClick={() => navigate(gen ? `/cirius/editor/${p.id}` : `/cirius/project/${p.id}`)}
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-neutral-200 truncate">{p.name}</h3>
                      {p.description && (
                        <p className="text-[11px] text-neutral-600 truncate mt-0.5">{p.description}</p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="h-7 w-7 rounded flex items-center justify-center text-neutral-600 hover:text-neutral-300 hover:bg-neutral-800/60 transition-colors"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-neutral-900 border-neutral-800">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/cirius/project/${p.id}`); }}>
                          <Eye className="h-3.5 w-3.5 mr-2" /> Ver Detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/cirius/editor/${p.id}`); }}>
                          <Cpu className="h-3.5 w-3.5 mr-2" /> Abrir Editor
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                          className="text-red-400 focus:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Deletar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="outline" className={`text-[10px] ${intent.cls}`}>
                      <IntentIcon className="h-3 w-3 mr-1" />
                      {intent.label}
                    </Badge>
                    <Badge className={`text-[10px] border-0 ${STATUS_STYLE[statusKey] || STATUS_STYLE.draft}`}>
                      {STATUS_LABEL[statusKey] || statusKey}
                    </Badge>
                  </div>

                  {/* Progress bar for generating */}
                  {gen && (
                    <Progress value={p.progress_pct || 10} className="h-1 bg-neutral-800" />
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-auto pt-1">
                    <div className="flex items-center gap-2 text-[11px] text-neutral-600">
                      {p.generation_engine && (
                        <span>{ENGINE_SHORT[p.generation_engine] || p.generation_engine}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(p.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {p.github_url && (
                        <a href={p.github_url} target="_blank" rel="noreferrer" className="text-neutral-600 hover:text-neutral-300 transition-colors">
                          <Github className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {p.vercel_url && (
                        <a href={p.vercel_url} target="_blank" rel="noreferrer" className="text-neutral-600 hover:text-neutral-300 transition-colors">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {p.preview_url && !p.vercel_url && (
                        <a href={p.preview_url} target="_blank" rel="noreferrer" className="text-neutral-600 hover:text-neutral-300 transition-colors">
                          <Globe className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
