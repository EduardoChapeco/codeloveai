import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLovableProxy } from "@/hooks/useLovableProxy";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { toast } from "sonner";
import {
  Loader2, ExternalLink, Rocket, Eye, BarChart3, RefreshCw,
  Copy, Globe, Pencil, Check, X, ChevronDown, Link2, AlertTriangle
} from "lucide-react";

interface LovableProject {
  id: string;
  name: string;
  display_name: string;
  latest_screenshot_url?: string;
  published_url?: string;
  preview_build_commit_sha?: string;
}

interface Workspace {
  id: string;
  display_name: string;
}

export default function LovableProjects() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { invoke, checkConnection, isTokenExpired } = useLovableProxy();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWs, setSelectedWs] = useState<string>("");
  const [projects, setProjects] = useState<LovableProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingWs, setLoadingWs] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<"active" | "expired" | "none" | null>(null);

  const [deploying, setDeploying] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login?returnTo=/lovable/projects");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    const check = async () => {
      const status = await checkConnection(user.id);
      setConnectionStatus(status);
      if (status !== "active") setLoadingWs(false);
    };
    check();
  }, [user, checkConnection]);

  useEffect(() => {
    if (connectionStatus !== "active") return;
    const loadWorkspaces = async () => {
      try {
        const data = await invoke({ route: "/user/workspaces" }) as any;
        const wsList = Array.isArray(data) ? data : data?.workspaces || [];
        setWorkspaces(wsList);
        if (wsList.length > 0) setSelectedWs(wsList[0].id);
      } catch (err: any) {
        if (err?.isTokenExpired) {
          setConnectionStatus("expired");
        } else {
          toast.error("Erro ao carregar workspaces: " + (err?.message || "Tente novamente"));
        }
      } finally {
        setLoadingWs(false);
      }
    };
    loadWorkspaces();
  }, [connectionStatus, invoke]);

  const syncProjectsToDb = useCallback(async (projectsList: LovableProject[]) => {
    if (!user || projectsList.length === 0) return;
    for (const p of projectsList) {
      await supabase.from("lovable_projects").upsert({
        user_id: user.id,
        lovable_project_id: p.id,
        name: p.name || null,
        display_name: p.display_name || p.name || null,
        latest_screenshot_url: p.latest_screenshot_url || null,
        published_url: p.published_url || null,
        preview_build_commit_sha: p.preview_build_commit_sha || null,
        workspace_id: selectedWs,
      }, { onConflict: "lovable_project_id" });
    }
  }, [user, selectedWs]);

  const loadProjects = useCallback(async () => {
    if (!selectedWs) return;
    setLoading(true);
    try {
      const data = await invoke({ route: `/workspaces/${selectedWs}/projects` }) as any;
      const projectsList = Array.isArray(data) ? data : data?.projects || [];
      setProjects(projectsList);
      await syncProjectsToDb(projectsList);
    } catch (err: any) {
      if (err?.isTokenExpired) {
        setConnectionStatus("expired");
      } else {
        toast.error("Erro ao carregar projetos");
      }
    } finally {
      setLoading(false);
    }
  }, [selectedWs, invoke, syncProjectsToDb]);

  useEffect(() => {
    if (selectedWs) loadProjects();
  }, [selectedWs, loadProjects]);

  const handleDeploy = async (projectId: string) => {
    setDeploying(projectId);
    try {
      const data = await invoke({
        route: `/projects/${projectId}/deployments?async=true`,
        method: "POST",
      }) as any;
      if (user) {
        await supabase.from("deployments_log").insert({
          user_id: user.id,
          lovable_project_id: projectId,
          deployment_id: data?.id || null,
          status: "queued",
          target_url: data?.url || null,
        });
      }
      toast.success("Deploy iniciado com sucesso!");
    } catch (err: any) {
      toast.error("Erro no deploy: " + (err?.message || "Tente novamente"));
    } finally {
      setDeploying(null);
    }
  };

  const handleRename = async (projectId: string) => {
    if (!renameValue.trim()) return;
    try {
      await invoke({
        route: `/projects/${projectId}`,
        method: "PUT",
        payload: { display_name: renameValue.trim() },
      });
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, display_name: renameValue.trim() } : p))
      );
      if (user) {
        await supabase.from("lovable_projects")
          .update({ display_name: renameValue.trim() })
          .eq("lovable_project_id", projectId)
          .eq("user_id", user.id);
      }
      toast.success("Projeto renomeado!");
      setRenamingId(null);
    } catch (err: any) {
      toast.error("Erro ao renomear: " + (err?.message || "Tente novamente"));
    }
  };

  const handleAnalytics = async (projectId: string) => {
    setAnalyticsLoading(projectId);
    try {
      const data = await invoke({ route: `/projects/${projectId}/analytics` }) as any;
      setAnalyticsData({ projectId, ...data });
    } catch (err: any) {
      toast.error("Analytics indisponível para este projeto");
    } finally {
      setAnalyticsLoading(null);
    }
  };

  if (authLoading || !user) return <div className="min-h-screen bg-background" />;

  if (connectionStatus === "none" || connectionStatus === "expired") {
    return (
      <AppLayout>
        <div className="max-w-xl mx-auto px-6 py-20 text-center">
          {connectionStatus === "expired" ? (
            <>
              <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
              <h2 className="lv-heading-sm mb-2">Token expirado</h2>
              <p className="lv-body mb-6">Reconecte via extensão para continuar.</p>
            </>
          ) : (
            <>
              <Link2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="lv-heading-sm mb-2">Não conectado</h2>
              <p className="lv-body mb-6">Conecte sua conta Lovable para gerenciar projetos.</p>
            </>
          )}
          <button onClick={() => navigate("/lovable/connect")} className="lv-btn-primary h-11 px-8 text-sm">
            {connectionStatus === "expired" ? "Reconectar" : "Conectar agora"}
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="lv-overline mb-1">Integração Lovable</p>
            <h1 className="lv-heading-lg">Meus Projetos</h1>
          </div>
          <div className="flex items-center gap-3">
            {workspaces.length > 1 && (
              <div className="relative">
                <select
                  value={selectedWs}
                  onChange={(e) => setSelectedWs(e.target.value)}
                  className="lv-input h-9 px-4 pr-8 text-xs appearance-none cursor-pointer"
                >
                  {workspaces.map((ws) => (
                    <option key={ws.id} value={ws.id}>{ws.display_name || ws.id}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none text-muted-foreground" />
              </div>
            )}
            <button onClick={loadProjects} disabled={loading} className="lv-btn-secondary h-9 px-4 text-xs flex items-center gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </button>
          </div>
        </div>

        {loadingWs || loading ? (
          <div className="text-center py-20">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="lv-caption mt-3">Carregando projetos...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <Globe className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="lv-body-strong mb-1">Nenhum projeto</p>
            <p className="lv-caption">Nenhum projeto encontrado neste workspace.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <div key={project.id} className="clf-liquid-glass space-y-4 flex flex-col group hover:brightness-[1.02] transition-all p-5 rounded-[22px]">
                {/* Screenshot / Visual */}
                {project.latest_screenshot_url ? (
                  <div className="rounded-[16px] overflow-hidden border border-black/[0.03] dark:border-white/[0.05] bg-black/[0.02] dark:bg-white/[0.02] h-44 relative group-hover:shadow-lg transition-all">
                    <img src={project.latest_screenshot_url} alt={project.display_name || project.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                ) : (
                  <div className="rounded-[16px] border border-black/[0.03] dark:border-white/[0.05] bg-black/[0.03] dark:bg-white/[0.03] h-44 flex items-center justify-center">
                    <Globe className="h-10 w-10 text-muted-foreground/20" />
                  </div>
                )}

                {/* Info Section */}
                <div className="flex-1">
                  {renamingId === project.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="lv-input flex-1 h-9 text-sm font-semibold px-3"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRename(project.id);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                      />
                      <button onClick={() => handleRename(project.id)} className="h-8 w-8 rounded-xl bg-primary shadow-lg shadow-primary/20 flex items-center justify-center text-white">
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={() => setRenamingId(null)} className="h-8 w-8 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="lv-body-strong text-[15px] truncate text-foreground group-hover:text-primary transition-colors">
                          {project.display_name || project.name || project.id}
                        </h3>
                        {project.name && project.name !== project.display_name && (
                          <p className="lv-caption font-mono mt-0.5 truncate opacity-60">ID: {project.id}</p>
                        )}
                      </div>
                      <button
                        onClick={() => { setRenamingId(project.id); setRenameValue(project.display_name || project.name || ""); }}
                        className="lv-btn-icon h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Renomear"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Actions Grid */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={() => handleDeploy(project.id)}
                    disabled={deploying === project.id}
                    className="lv-btn-primary h-10 px-0 text-xs flex items-center justify-center gap-2 shadow-md"
                  >
                    {deploying === project.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
                    Deploy
                  </button>

                  <button
                    onClick={() => navigate(`/projeto/${project.id}/editar`)}
                    className="lv-btn-accent h-10 px-0 text-xs flex items-center justify-center gap-2 shadow-md"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </button>

                  <button
                    onClick={() => navigate(`/lovable/preview?projectId=${project.id}`)}
                    className="lv-btn-secondary h-10 px-0 text-xs flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Eye className="h-3.5 w-3.5" /> Preview
                  </button>

                  <button
                    onClick={() => handleAnalytics(project.id)}
                    disabled={analyticsLoading === project.id}
                    className="lv-btn-secondary h-10 px-0 text-xs flex items-center justify-center gap-2 shadow-sm"
                  >
                    {analyticsLoading === project.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BarChart3 className="h-3.5 w-3.5" />}
                    Analytics
                  </button>

                  {project.published_url ? (
                    <a href={project.published_url} target="_blank" rel="noopener noreferrer"
                      className="lv-btn-ghost col-span-2 h-9 text-xs flex items-center justify-center gap-2 hover:bg-primary/5 active:bg-primary/10 rounded-xl"
                    >
                      <Globe className="h-3.5 w-3.5 text-primary" /> Ver Site Publicado <ExternalLink className="h-3 w-3 opacity-40" />
                    </a>
                  ) : (
                    <div className="col-span-2 h-9 flex items-center justify-center">
                      <p className="lv-caption italic opacity-40">Projeto não publicado</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Analytics Modal */}
        {analyticsData && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => setAnalyticsData(null)}>
            <div className="bg-card border border-border/60 rounded-2xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="lv-heading-sm">Analytics</h2>
                <button onClick={() => setAnalyticsData(null)} className="lv-btn-icon h-8 w-8">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap bg-muted/50 rounded-xl p-4">
                {JSON.stringify(analyticsData, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
