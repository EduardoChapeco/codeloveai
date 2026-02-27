import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLovableProxy } from "@/hooks/useLovableProxy";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { toast } from "sonner";
import {
  Loader2, ExternalLink, Rocket, Eye, BarChart3, RefreshCw,
  Copy, Globe, Pencil, Check, X, ChevronDown, Link2, AlertTriangle,
  FolderOpen, Brain, Plus,
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
  const { invoke, checkConnection } = useLovableProxy();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWs, setSelectedWs] = useState<string>("");
  const [projects, setProjects] = useState<LovableProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingWs, setLoadingWs] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<"active" | "expired" | "none" | null>(null);
  const [selectedProject, setSelectedProject] = useState<LovableProject | null>(null);

  const [deploying, setDeploying] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [ghostCreating, setGhostCreating] = useState(false);

  // Ghost Create: creates a project and immediately cancels the initial prompt (no credits used)
  const handleGhostCreate = async () => {
    if (!selectedWs) { toast.error("Selecione um workspace"); return; }
    setGhostCreating(true);
    try {
      // Create project
      const project = await invoke({
        route: `/workspaces/${selectedWs}/projects`,
        method: "POST",
        payload: { name: `project-${Date.now().toString(36)}`, initial_message: { message: "setup" } },
      }) as any;

      if (!project?.id) throw new Error("Falha ao criar projeto");

      // Cancel immediately (< 500ms) to avoid credit consumption
      setTimeout(async () => {
        try {
          await invoke({ route: `/projects/${project.id}/chat/cancel`, method: "POST" });
        } catch { /* best effort cancel */ }
      }, 300);

      toast.success("Projeto criado sem gastar créditos! 🚀");
      await loadProjects();
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "tente novamente"));
    } finally {
      setGhostCreating(false);
    }
  };

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
        if (err?.isTokenExpired) setConnectionStatus("expired");
        else toast.error("Erro ao carregar workspaces");
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
      }, { onConflict: "user_id,lovable_project_id" });
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
      if (projectsList.length > 0 && !selectedProject) setSelectedProject(projectsList[0]);
    } catch (err: any) {
      if (err?.isTokenExpired) setConnectionStatus("expired");
      else toast.error("Erro ao carregar projetos");
    } finally {
      setLoading(false);
    }
  }, [selectedWs, invoke, syncProjectsToDb, selectedProject]);

  useEffect(() => {
    if (selectedWs) loadProjects();
  }, [selectedWs, loadProjects]);

  const handleDeploy = async (projectId: string) => {
    setDeploying(projectId);
    try {
      const data = await invoke({ route: `/projects/${projectId}/deployments?async=true`, method: "POST" }) as any;
      if (user) {
        await supabase.from("deployments_log").insert({
          user_id: user.id, lovable_project_id: projectId,
          deployment_id: data?.id || null, status: "queued", target_url: data?.url || null,
        });
      }
      toast.success("Deploy iniciado!");
    } catch (err: any) {
      toast.error("Erro no deploy");
    } finally {
      setDeploying(null);
    }
  };

  const handleRename = async (projectId: string) => {
    if (!renameValue.trim()) return;
    try {
      await invoke({ route: `/projects/${projectId}`, method: "PUT", payload: { display_name: renameValue.trim() } });
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, display_name: renameValue.trim() } : p));
      if (selectedProject?.id === projectId) setSelectedProject({ ...selectedProject, display_name: renameValue.trim() });
      if (user) {
        await supabase.from("lovable_projects").update({ display_name: renameValue.trim() })
          .eq("lovable_project_id", projectId).eq("user_id", user.id);
      }
      toast.success("Renomeado!");
      setRenamingId(null);
    } catch { toast.error("Erro ao renomear"); }
  };

  if (authLoading || !user) return <div className="min-h-screen bg-background" />;

  if (connectionStatus === "none" || connectionStatus === "expired") {
    return (
      <AppLayout>
        <div className="max-w-xl mx-auto px-6 py-20 text-center">
          {connectionStatus === "expired" ? (
            <>
              <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
              <h2 className="text-lg font-bold mb-2">Token expirado</h2>
              <p className="text-sm text-muted-foreground mb-6">Reconecte via extensão para continuar.</p>
            </>
          ) : (
            <>
              <Link2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-lg font-bold mb-2">Não conectado</h2>
              <p className="text-sm text-muted-foreground mb-6">Conecte sua conta Lovable para gerenciar projetos.</p>
            </>
          )}
          <button onClick={() => navigate("/lovable/connect")} className="h-11 px-8 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm">
            {connectionStatus === "expired" ? "Reconectar" : "Conectar agora"}
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-4rem)] md:h-screen">
        {/* ── Left column: Compact project grid ── */}
        <div className="w-56 shrink-0 flex flex-col h-full overflow-hidden" style={{ borderRight: '0.5px solid var(--clf-border)' }}>
          {/* Header */}
          <div className="p-2.5 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Projetos</span>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={handleGhostCreate}
                  disabled={ghostCreating}
                  className="h-6 px-2 flex items-center gap-1 rounded-md bg-primary/10 text-primary text-[9px] font-semibold hover:bg-primary/20 transition-colors disabled:opacity-50"
                  title="Criar projeto sem gastar créditos"
                >
                  {ghostCreating ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Plus className="h-2.5 w-2.5" />}
                  Novo
                </button>
                {workspaces.length > 1 && (
                  <select value={selectedWs} onChange={e => setSelectedWs(e.target.value)}
                    className="h-6 px-1.5 text-[9px] rounded-md bg-muted/30 border-none focus:outline-none text-muted-foreground">
                    {workspaces.map(ws => <option key={ws.id} value={ws.id}>{ws.display_name}</option>)}
                  </select>
                )}
                <button onClick={loadProjects} disabled={loading}
                  className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-muted/40 transition-colors" title="Atualizar">
                  <RefreshCw className={`h-3 w-3 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Project list */}
          <div className="flex-1 overflow-y-auto px-1.5 pb-2 no-scrollbar space-y-1">
            {loadingWs || loading ? (
              <div className="text-center py-12">
                <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-12">
                <Globe className="h-6 w-6 mx-auto text-muted-foreground/20 mb-1" />
                <p className="text-[10px] text-muted-foreground">Nenhum projeto</p>
              </div>
            ) : projects.map(project => {
              const isActive = selectedProject?.id === project.id;
              return (
                <div
                  key={project.id}
                  onClick={() => setSelectedProject(project)}
                  className="group relative cursor-pointer rounded-xl overflow-hidden transition-all duration-200"
                  style={{
                    border: isActive ? '1.5px solid hsl(var(--primary) / 0.4)' : '1px solid hsl(var(--border) / 0.3)',
                    boxShadow: isActive ? '0 0 0 2px hsl(var(--primary) / 0.1)' : undefined,
                  }}
                >
                  {/* Mini screenshot preview */}
                  <div className="aspect-[16/10] bg-muted/20 relative">
                    {project.latest_screenshot_url ? (
                      <img src={project.latest_screenshot_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <Globe className="h-5 w-5 text-muted-foreground/15" />
                      </div>
                    )}
                    {/* Hover overlay with actions */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-1.5 p-2">
                      <button onClick={e => { e.stopPropagation(); handleDeploy(project.id); }}
                        disabled={deploying === project.id}
                        className="w-full h-6 rounded-md bg-primary text-primary-foreground text-[9px] font-semibold flex items-center justify-center gap-1 hover:opacity-90 transition-opacity">
                        {deploying === project.id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Rocket className="h-2.5 w-2.5" />} Deploy
                      </button>
                      <div className="flex gap-1 w-full">
                        <button onClick={e => { e.stopPropagation(); navigate(`/projeto/${project.id}/editar`); }}
                          className="flex-1 h-6 rounded-md bg-white/20 text-white text-[9px] font-medium flex items-center justify-center gap-0.5 hover:bg-white/30 transition-colors">
                          <Pencil className="h-2.5 w-2.5" /> Editar
                        </button>
                        <button onClick={e => { e.stopPropagation(); navigate(`/lovable/preview?projectId=${project.id}`); }}
                          className="flex-1 h-6 rounded-md bg-white/20 text-white text-[9px] font-medium flex items-center justify-center gap-0.5 hover:bg-white/30 transition-colors">
                          <Eye className="h-2.5 w-2.5" /> Preview
                        </button>
                      </div>
                      <button onClick={e => { e.stopPropagation(); setRenamingId(project.id); setRenameValue(project.display_name || project.name || ""); }}
                        className="w-full h-5 rounded-md text-white/60 text-[8px] flex items-center justify-center gap-0.5 hover:text-white/90 transition-colors">
                        <Pencil className="h-2 w-2" /> Renomear
                      </button>
                    </div>
                  </div>
                  {/* Project name */}
                  <div className="px-2 py-1.5">
                    {renamingId === project.id ? (
                      <div className="flex items-center gap-1">
                        <input value={renameValue} onChange={e => setRenameValue(e.target.value)}
                          className="flex-1 h-5 px-1.5 text-[10px] font-medium rounded bg-muted/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
                          autoFocus onClick={e => e.stopPropagation()}
                          onKeyDown={e => { if (e.key === "Enter") handleRename(project.id); if (e.key === "Escape") setRenamingId(null); }} />
                        <button onClick={e => { e.stopPropagation(); handleRename(project.id); }} className="h-5 w-5 rounded bg-primary flex items-center justify-center text-primary-foreground"><Check className="h-2.5 w-2.5" /></button>
                        <button onClick={e => { e.stopPropagation(); setRenamingId(null); }} className="h-5 w-5 rounded bg-muted/30 flex items-center justify-center"><X className="h-2.5 w-2.5" /></button>
                      </div>
                    ) : (
                      <p className="text-[11px] font-semibold truncate">{project.display_name || project.name}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right column: Preview ── */}
        <div className="flex-1 flex flex-col min-w-0 h-full">
          {selectedProject ? (
            <>
              {/* Preview header */}
              <div className="px-4 py-3 flex items-center gap-3 shrink-0" style={{ borderBottom: '0.5px solid var(--clf-border)' }}>
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center">
                  <Globe className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  {renamingId === selectedProject.id ? (
                    <div className="flex items-center gap-2">
                      <input value={renameValue} onChange={e => setRenameValue(e.target.value)}
                        className="flex-1 h-8 px-3 text-sm font-semibold rounded-xl bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
                        autoFocus onKeyDown={e => { if (e.key === "Enter") handleRename(selectedProject.id); if (e.key === "Escape") setRenamingId(null); }} />
                      <button onClick={() => handleRename(selectedProject.id)} className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground"><Check className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setRenamingId(null)} className="h-7 w-7 rounded-lg bg-muted/30 flex items-center justify-center"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold truncate">{selectedProject.display_name || selectedProject.name}</p>
                      <button onClick={() => { setRenamingId(selectedProject.id); setRenameValue(selectedProject.display_name || selectedProject.name || ""); }}
                        className="h-6 w-6 rounded-md hover:bg-muted/30 flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity">
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground font-mono">{selectedProject.id}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => handleDeploy(selectedProject.id)} disabled={deploying === selectedProject.id}
                    className="h-8 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 transition-opacity disabled:opacity-40">
                    {deploying === selectedProject.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />} Deploy
                  </button>
                  {selectedProject.published_url && (
                    <a href={selectedProject.published_url} target="_blank" rel="noopener noreferrer"
                      className="h-8 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:bg-muted/30 transition-colors text-muted-foreground hover:text-foreground"
                      style={{ border: '0.5px solid var(--clf-border)' }}>
                      <ExternalLink className="h-3.5 w-3.5" /> Abrir
                    </a>
                  )}
                </div>
              </div>

              {/* Preview iframe */}
              <div className="flex-1 relative bg-muted/5">
                {selectedProject.latest_screenshot_url ? (
                  <div className="absolute inset-0 flex items-center justify-center p-6">
                    <div className="w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl shadow-black/10" style={{ border: '1px solid var(--clf-border)' }}>
                      <img src={selectedProject.latest_screenshot_url} alt={selectedProject.display_name || selectedProject.name}
                        className="w-full h-auto object-contain" />
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <Globe className="h-16 w-16 mx-auto text-muted-foreground/10 mb-3" />
                      <p className="text-sm text-muted-foreground/40">Sem preview disponível</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="h-20 w-20 rounded-[2rem] bg-gradient-to-br from-primary/10 to-transparent flex items-center justify-center mx-auto mb-4">
                  <FolderOpen className="h-8 w-8 text-muted-foreground/20" />
                </div>
                <h2 className="text-lg font-bold mb-2">Selecione um projeto</h2>
                <p className="text-sm text-muted-foreground">Clique em um projeto na barra lateral para visualizar.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
