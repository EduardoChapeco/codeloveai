import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLovableProxy } from "@/hooks/useLovableProxy";
import { supabase } from "@/integrations/supabase/client";
import AppNav from "@/components/AppNav";
import { toast } from "sonner";
import {
  Loader2, ExternalLink, Rocket, Eye, BarChart3, RefreshCw,
  Copy, Globe, Pencil, Check, X, ChevronDown
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
  const { invoke } = useLovableProxy();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWs, setSelectedWs] = useState<string>("");
  const [projects, setProjects] = useState<LovableProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingWs, setLoadingWs] = useState(true);
  const [connected, setConnected] = useState<boolean | null>(null);

  // Deploy state
  const [deploying, setDeploying] = useState<string | null>(null);
  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  // Analytics modal
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login?returnTo=/lovable/projects");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    const checkConnection = async () => {
      const { data } = await supabase
        .from("lovable_accounts")
        .select("status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      setConnected(!!data);
      if (!data) setLoadingWs(false);
    };
    checkConnection();
  }, [user]);

  useEffect(() => {
    if (!connected) return;
    const loadWorkspaces = async () => {
      try {
        const data = await invoke({ route: "/user/workspaces" });
        const wsList = Array.isArray(data) ? data : data?.workspaces || [];
        setWorkspaces(wsList);
        if (wsList.length > 0) setSelectedWs(wsList[0].id);
      } catch (err: any) {
        toast.error("Erro ao carregar workspaces: " + (err?.message || ""));
      } finally {
        setLoadingWs(false);
      }
    };
    loadWorkspaces();
  }, [connected, invoke]);

  const loadProjects = useCallback(async () => {
    if (!selectedWs) return;
    setLoading(true);
    try {
      const data = await invoke({ route: `/workspaces/${selectedWs}/projects` });
      const projectsList = Array.isArray(data) ? data : data?.projects || [];
      setProjects(projectsList);
    } catch (err: any) {
      toast.error("Erro ao carregar projetos: " + (err?.message || ""));
    } finally {
      setLoading(false);
    }
  }, [selectedWs, invoke]);

  useEffect(() => {
    if (selectedWs) loadProjects();
  }, [selectedWs, loadProjects]);

  const handleDeploy = async (projectId: string) => {
    setDeploying(projectId);
    try {
      const data = await invoke({
        route: `/projects/${projectId}/deployments?async=true`,
        method: "POST",
      });

      // Log to deployments_log
      if (user) {
        await supabase.from("deployments_log").insert({
          user_id: user.id,
          lovable_project_id: projectId,
          deployment_id: data?.id || null,
          status: "queued",
          target_url: data?.url || null,
        });
      }

      toast.success("Deploy iniciado!");
    } catch (err: any) {
      toast.error("Erro no deploy: " + (err?.message || ""));
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
      toast.success("Renomeado!");
      setRenamingId(null);
    } catch (err: any) {
      toast.error("Erro ao renomear: " + (err?.message || ""));
    }
  };

  const handleAnalytics = async (projectId: string) => {
    setAnalyticsLoading(projectId);
    try {
      const data = await invoke({ route: `/projects/${projectId}/analytics` });
      setAnalyticsData({ projectId, ...data });
    } catch (err: any) {
      toast.error("Erro ao buscar analytics: " + (err?.message || ""));
    } finally {
      setAnalyticsLoading(null);
    }
  };

  if (authLoading || !user) return <div className="min-h-screen bg-background" />;

  if (connected === false) {
    return (
      <div className="min-h-screen bg-background">
        <AppNav />
        <div className="max-w-xl mx-auto px-8 py-20 text-center">
          <p className="ep-subtitle mb-2">NÃO CONECTADO</p>
          <p className="text-sm text-muted-foreground mb-6">
            Conecte sua conta Lovable para gerenciar projetos.
          </p>
          <button onClick={() => navigate("/lovable/connect")} className="ep-btn-primary h-11 px-8">
            CONECTAR AGORA
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      <div className="max-w-6xl mx-auto px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="ep-subtitle mb-1">INTEGRAÇÃO LOVABLE</p>
            <h1 className="ep-section-title text-2xl">MEUS PROJETOS</h1>
          </div>
          <div className="flex items-center gap-3">
            {workspaces.length > 1 && (
              <div className="relative">
                <select
                  value={selectedWs}
                  onChange={(e) => setSelectedWs(e.target.value)}
                  className="ep-btn-secondary h-9 px-4 pr-8 text-[9px] appearance-none cursor-pointer"
                >
                  {workspaces.map((ws) => (
                    <option key={ws.id} value={ws.id}>{ws.display_name || ws.id}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none" />
              </div>
            )}
            <button onClick={loadProjects} className="ep-btn-secondary h-9 px-4 text-[9px] flex items-center gap-1.5">
              <RefreshCw className="h-3 w-3" /> ATUALIZAR
            </button>
          </div>
        </div>

        {loadingWs || loading ? (
          <div className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /></div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <p className="ep-subtitle mb-2">NENHUM PROJETO</p>
            <p className="text-sm text-muted-foreground">Nenhum projeto encontrado neste workspace.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <div key={project.id} className="ep-card space-y-3">
                {/* Screenshot */}
                {project.latest_screenshot_url && (
                  <div className="rounded-[10px] overflow-hidden border border-border bg-muted h-36">
                    <img src={project.latest_screenshot_url} alt="" className="w-full h-full object-cover" />
                  </div>
                )}

                {/* Info */}
                <div>
                  {renamingId === project.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="flex-1 bg-muted/50 border border-border/50 rounded-[8px] px-3 py-1.5 text-sm font-bold text-foreground focus:outline-none"
                        autoFocus
                        onKeyDown={(e) => e.key === "Enter" && handleRename(project.id)}
                      />
                      <button onClick={() => handleRename(project.id)} className="h-7 w-7 rounded-[8px] bg-foreground flex items-center justify-center">
                        <Check className="h-3 w-3 text-background" />
                      </button>
                      <button onClick={() => setRenamingId(null)} className="h-7 w-7 rounded-[8px] bg-muted flex items-center justify-center">
                        <X className="h-3 w-3 text-foreground" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-foreground truncate flex-1">
                        {project.display_name || project.name || project.id}
                      </h3>
                      <button
                        onClick={() => { setRenamingId(project.id); setRenameValue(project.display_name || project.name || ""); }}
                        className="h-6 w-6 rounded-[6px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  {project.name && (
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{project.name}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => handleDeploy(project.id)}
                    disabled={deploying === project.id}
                    className="ep-btn-primary h-8 px-3 text-[8px] flex items-center gap-1.5 disabled:opacity-40"
                  >
                    {deploying === project.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Rocket className="h-3 w-3" />}
                    DEPLOY
                  </button>

                  <button
                    onClick={() => navigate(`/lovable/preview?projectId=${project.id}`)}
                    className="ep-btn-secondary h-8 px-3 text-[8px] flex items-center gap-1.5"
                  >
                    <Eye className="h-3 w-3" /> PREVIEW
                  </button>

                  <button
                    onClick={() => handleAnalytics(project.id)}
                    disabled={analyticsLoading === project.id}
                    className="ep-btn-secondary h-8 px-3 text-[8px] flex items-center gap-1.5"
                  >
                    {analyticsLoading === project.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <BarChart3 className="h-3 w-3" />}
                    ANALYTICS
                  </button>

                  {project.published_url && (
                    <a
                      href={project.published_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ep-btn-secondary h-8 px-3 text-[8px] flex items-center gap-1.5"
                    >
                      <Globe className="h-3 w-3" /> SITE
                    </a>
                  )}

                  <button
                    onClick={() => { navigator.clipboard.writeText(project.id); toast.success("ID copiado!"); }}
                    className="ep-btn-secondary h-8 px-3 text-[8px] flex items-center gap-1.5"
                  >
                    <Copy className="h-3 w-3" /> ID
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Analytics modal */}
        {analyticsData && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => setAnalyticsData(null)}>
            <div className="bg-card border border-border rounded-[16px] p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-foreground">ANALYTICS</h2>
                <button onClick={() => setAnalyticsData(null)} className="h-8 w-8 rounded-[8px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap bg-muted/50 rounded-[10px] p-4">
                {JSON.stringify(analyticsData, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
