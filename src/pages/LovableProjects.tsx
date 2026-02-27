import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLovableProxy } from "@/hooks/useLovableProxy";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { toast } from "sonner";
import {
  Loader2, ExternalLink, Rocket, Eye, RefreshCw,
  Copy, Globe, Pencil, Check, X, Link2, AlertTriangle,
  FolderOpen, Plus,
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

  const handleGhostCreate = async () => {
    if (!selectedWs) { toast.error("Selecione um workspace"); return; }
    setGhostCreating(true);
    try {
      const project = await invoke({
        route: `/workspaces/${selectedWs}/projects`,
        method: "POST",
        payload: { name: `project-${Date.now().toString(36)}`, initial_message: { message: "setup" } },
      }) as any;
      if (!project?.id) throw new Error("Falha ao criar projeto");
      setTimeout(async () => {
        try { await invoke({ route: `/projects/${project.id}/chat/cancel`, method: "POST" }); } catch { /* best effort */ }
      }, 300);
      toast.success("Projeto criado sem gastar créditos! 🚀");
      await loadProjects();
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "tente novamente"));
    } finally { setGhostCreating(false); }
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
      } finally { setLoadingWs(false); }
    };
    loadWorkspaces();
  }, [connectionStatus, invoke]);

  const syncProjectsToDb = useCallback(async (projectsList: LovableProject[]) => {
    if (!user || projectsList.length === 0) return;
    for (const p of projectsList) {
      await supabase.from("lovable_projects").upsert({
        user_id: user.id, lovable_project_id: p.id,
        name: p.name || null, display_name: p.display_name || p.name || null,
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
    } finally { setLoading(false); }
  }, [selectedWs, invoke, syncProjectsToDb, selectedProject]);

  useEffect(() => { if (selectedWs) loadProjects(); }, [selectedWs, loadProjects]);

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
    } catch { toast.error("Erro no deploy"); } finally { setDeploying(null); }
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
          <button onClick={() => navigate("/lovable/connect")} className="lv-btn-primary h-11 px-8 text-sm">
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
                  className="h-6 px-2 flex items-center gap-1 rounded-[10px] bg-primary/10 text-primary text-[9px] font-semibold hover:bg-primary/20 transition-colors disabled:opacity-50"
                  title="Criar projeto sem gastar créditos"
                >
                  {ghostCreating ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Plus className="h-2.5 w-2.5" />}
                  Novo
                </button>
                {workspaces.length > 1 && (
                  <select value={selectedWs} onChange={e => setSelectedWs(e.target.value)}
                    className="lv-input h-6 px-1.5 text-[9px]">
                    {workspaces.map(ws => <option key={ws.id} value={ws.id}>{ws.display_name}</option>)}
                  </select>
                )}
                <button onClick={loadProjects} disabled={loading}
                  className="h-6 w-6 flex items-center justify-center rounded-[10px] hover:bg-muted/40 transition-colors" title="Atualizar">
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
                  className={`group relative cursor-pointer rounded-2xl overflow-hidden transition-all duration-200 ${
                    isActive ? "ring-[1.5px] ring-primary/40 shadow-md shadow-primary/5" : "hover:ring-1 hover:ring-border/60"
                  }`}
                  style={{ border: '0.5px solid var(--clf-border)' }}
                >
                  {/* Mini screenshot preview */}
                  <div className="aspect-[16/10] bg-muted/20 relative overflow-hidden">
                    {project.latest_screenshot_url ? (
                      <img src={project.latest_screenshot_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <Globe className="h-5 w-5 text-muted-foreground/15" />
                      </div>
                    )}
                    {/* Hover overlay with actions */}
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-200 flex flex-col items-center justify-center gap-1.5 p-2">
                      <button onClick={e => { e.stopPropagation(); handleDeploy(project.id); }}
                        disabled={deploying === project.id}
                        className="w-full h-7 rounded-[10px] bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity shadow-sm">
                        {deploying === project.id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Rocket className="h-2.5 w-2.5" />} Deploy
                      </button>
                      <div className="flex gap-1 w-full">
                        <button onClick={e => { e.stopPropagation(); navigate(`/projeto/${project.id}/editar`); }}
                          className="flex-1 h-7 rounded-[10px] clf-liquid-glass text-foreground text-[9px] font-semibold flex items-center justify-center gap-1 hover:bg-muted/60 transition-colors">
                          <Pencil className="h-2.5 w-2.5" /> Editar
                        </button>
                        <button onClick={e => { e.stopPropagation(); navigate(`/lovable/preview?projectId=${project.id}`); }}
                          className="flex-1 h-7 rounded-[10px] clf-liquid-glass text-foreground text-[9px] font-semibold flex items-center justify-center gap-1 hover:bg-muted/60 transition-colors">
                          <Eye className="h-2.5 w-2.5" /> Preview
                        </button>
                      </div>
                      <button onClick={e => { e.stopPropagation(); setRenamingId(project.id); setRenameValue(project.display_name || project.name || ""); }}
                        className="w-full h-5 rounded-[8px] text-muted-foreground text-[8px] flex items-center justify-center gap-1 hover:text-foreground transition-colors">
                        <Pencil className="h-2 w-2" /> Renomear
                      </button>
                    </div>
                  </div>
                  {/* Project name */}
                  <div className="px-2 py-1.5">
                    {renamingId === project.id ? (
                      <div className="flex items-center gap-1">
                        <input value={renameValue} onChange={e => setRenameValue(e.target.value)}
                          className="lv-input flex-1 h-5 px-1.5 text-[10px] font-medium"
                          autoFocus onClick={e => e.stopPropagation()}
                          onKeyDown={e => { if (e.key === "Enter") handleRename(project.id); if (e.key === "Escape") setRenamingId(null); }} />
                        <button onClick={e => { e.stopPropagation(); handleRename(project.id); }} className="h-5 w-5 rounded-[8px] bg-primary flex items-center justify-center text-primary-foreground"><Check className="h-2.5 w-2.5" /></button>
                        <button onClick={e => { e.stopPropagation(); setRenamingId(null); }} className="h-5 w-5 rounded-[8px] bg-muted/30 flex items-center justify-center"><X className="h-2.5 w-2.5" /></button>
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

        {/* ── Right column: Full Preview ── */}
        <div className="flex-1 flex flex-col min-w-0 h-full">
          {selectedProject ? (
            <>
              {/* Preview header */}
              <div className="px-4 py-2.5 flex items-center gap-3 shrink-0" style={{ borderBottom: '0.5px solid var(--clf-border)' }}>
                <div className="h-8 w-8 rounded-[12px] bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center">
                  <Globe className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  {renamingId === selectedProject.id ? (
                    <div className="flex items-center gap-2">
                      <input value={renameValue} onChange={e => setRenameValue(e.target.value)}
                        className="lv-input flex-1 h-8 px-3 text-sm font-semibold"
                        autoFocus onKeyDown={e => { if (e.key === "Enter") handleRename(selectedProject.id); if (e.key === "Escape") setRenamingId(null); }} />
                      <button onClick={() => handleRename(selectedProject.id)} className="h-7 w-7 rounded-[10px] bg-primary flex items-center justify-center text-primary-foreground"><Check className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setRenamingId(null)} className="h-7 w-7 rounded-[10px] bg-muted/30 flex items-center justify-center"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold truncate">{selectedProject.display_name || selectedProject.name}</p>
                      <button onClick={() => { setRenamingId(selectedProject.id); setRenameValue(selectedProject.display_name || selectedProject.name || ""); }}
                        className="h-6 w-6 rounded-[10px] hover:bg-muted/30 flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity">
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  <p className="text-[9px] text-muted-foreground/50 font-mono">{selectedProject.id}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => handleDeploy(selectedProject.id)} disabled={deploying === selectedProject.id}
                    className="lv-btn-primary h-8 px-4 text-[10px] flex items-center gap-1.5 disabled:opacity-40">
                    {deploying === selectedProject.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Rocket className="h-3 w-3" />} Deploy
                  </button>
                  <button onClick={() => navigate(`/projeto/${selectedProject.id}/editar`)}
                    className="lv-btn-secondary h-8 px-4 text-[10px] flex items-center gap-1.5">
                    <Pencil className="h-3 w-3" /> Editar Projeto
                  </button>
                  {selectedProject.published_url && (
                    <a href={selectedProject.published_url} target="_blank" rel="noopener noreferrer"
                      className="h-8 w-8 rounded-[12px] clf-liquid-glass flex items-center justify-center hover:bg-muted/40 transition-colors"
                      title="Abrir publicado">
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </a>
                  )}
                </div>
              </div>

              {/* Full-screen iframe preview */}
              <div className="flex-1 relative">
                <iframe
                  src={`https://id-preview--${selectedProject.id}.lovable.app`}
                  className="w-full h-full border-0"
                  title={selectedProject.display_name || selectedProject.name}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                />
                {/* Floating "Editar Projeto" button on preview */}
                <button
                  onClick={() => navigate(`/projeto/${selectedProject.id}/editar`)}
                  className="absolute top-3 right-3 h-9 px-4 rounded-2xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-2 shadow-lg shadow-primary/25 hover:scale-105 active:scale-95 transition-transform z-10"
                >
                  <Pencil className="h-3.5 w-3.5" /> Editar Projeto
                </button>
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
