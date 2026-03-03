import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft, Play, Pause, X, Github, Globe, Database,
  RefreshCw, Rocket, CheckCircle2, Clock, Loader2,
  Circle, ChevronDown, ChevronRight, FileCode, Wrench, Shield,
  Eye, EyeOff, Search, ExternalLink, Plug, Link2, Unlink,
  AlertTriangle,
} from "lucide-react";

const statusLabels: Record<string, string> = {
  draft: "Rascunho", generating_prd: "Gerando PRD", generating_code: "Gerando Código",
  deploying: "Deploy", live: "Online", failed: "Falhou", paused: "Pausado",
};

const statusChip: Record<string, string> = {
  draft: "ch-gray", generating_prd: "ch-orange", generating_code: "ch-blue",
  deploying: "ch-purple", live: "ch-green", failed: "ch-red", paused: "ch-orange",
};

interface TaskItem {
  title: string;
  prompt?: string;
  status: "done" | "running" | "pending" | "failed";
  duration_ms?: number;
  engine?: string;
}

export default function CiriusProject() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [expandedTask, setExpandedTask] = useState<number | null>(null);
  const [thinkingTime, setThinkingTime] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [integrationsOpen, setIntegrationsOpen] = useState(false);
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [loadingIntegrations, setLoadingIntegrations] = useState(false);

  const loadProject = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.functions.invoke("cirius-status", { body: { action: "get", project_id: id } });
    if (data?.project) { setProject(data.project); setLogs(data.logs || []); }
    setLoading(false);
  }, [id]);

  useEffect(() => { loadProject(); }, [loadProject]);

  useEffect(() => {
    if (!project || !id) return;
    const activeStates = ["generating_prd", "generating_code", "deploying", "live", "awaiting_approval"];
    if (activeStates.includes(project.status)) navigate(`/cirius/editor/${id}`, { replace: true });
  }, [project?.status, id, navigate]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`cirius:project:${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "cirius_generation_log", filter: `project_id=eq.${id}` },
        (payload) => { setLogs(prev => [payload.new, ...prev].slice(0, 30)); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "cirius_projects", filter: `id=eq.${id}` },
        (payload) => { setProject(payload.new); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  useEffect(() => {
    if (!project) return;
    const isThinking = ["generating_prd", "generating_code", "deploying"].includes(project.status);
    if (!isThinking) { setThinkingTime(0); return; }
    const interval = setInterval(() => setThinkingTime(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [project?.status]);

  async function doAction(action: string) {
    setActing(true);
    try {
      const { data } = await supabase.functions.invoke("cirius-generate", { body: { action, project_id: id } });
      if (data?.error) toast.error(data.error);
      else toast.success(`${action} executado`);
      await loadProject();
    } catch { toast.error("Erro"); }
    setActing(false);
  }

  async function doDeploy(target: string) {
    setActing(true);
    try {
      const { data } = await supabase.functions.invoke("cirius-deploy", { body: { action: target, project_id: id } });
      if (data?.error) toast.error(data.error);
      else toast.success(`Deploy ${target} iniciado`);
      await loadProject();
    } catch { toast.error("Erro no deploy"); }
    setActing(false);
  }

  const verifyProject = async () => {
    if (!id) return;
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("cirius-generate", { body: { action: "debug_log", project_id: id } });
      if (error) toast.error("Verificação falhou: " + error.message);
      else { const summary = data?.summary || JSON.stringify(data).substring(0, 300); toast.success("Diagnóstico concluído", { description: summary, duration: 8000 }); }
    } catch { toast.error("Erro na verificação"); }
    finally { setVerifying(false); }
  };

  if (!user) { navigate("/login"); return null; }
  if (loading) return <AppLayout><div style={{ minHeight: "100vh", background: "var(--bg-0)" }} /></AppLayout>;
  if (!project) return <AppLayout><div className="rd-page-content body-text">Projeto não encontrado</div></AppLayout>;

  const isActive = ["generating_prd", "generating_code", "deploying"].includes(project.status);
  const prd = project.prd_json as { tasks?: TaskItem[]; design?: any } | null;
  const tasks: TaskItem[] = prd?.tasks?.map((t: any, i: number) => {
    const logForTask = logs.find(l => l.step === `code_task_${i}`);
    let status: TaskItem["status"] = "pending";
    if (logForTask?.status === "completed") status = "done";
    else if (logForTask?.status === "started") status = "running";
    else if (logForTask?.status === "failed") status = "failed";
    else if (project.status === "live" || project.progress_pct >= 80) status = "done";
    return { ...t, status, duration_ms: logForTask?.duration_ms, engine: logForTask?.message };
  }) || [];

  const doneCount = tasks.filter(t => t.status === "done").length;
  const runningCount = tasks.filter(t => t.status === "running").length;
  const toolsUsed = logs.length;

  return (
    <AppLayout>
      <div className="rd-page-content" style={{ maxWidth: 780 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button className="gl ico sm ghost" onClick={() => navigate("/cirius")}><ArrowLeft size={14} /></button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 18, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{project.name}</h1>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
              <span className={`chip sm ${statusChip[project.status] || "ch-gray"}`}>{statusLabels[project.status] || project.status}</span>
              {project.generation_engine && <span className="chip sm"><Wrench size={10} /> {project.generation_engine}</span>}
              {(project.vercel_url || project.netlify_url || project.github_url)
                ? <span className="chip sm ch-green"><CheckCircle2 size={10} /> Deployed</span>
                : project.has_files
                  ? <span className="chip sm ch-blue"><CheckCircle2 size={10} /> Código gerado</span>
                  : <span className="chip sm ch-gray">Aguardando geração</span>
              }
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {(project.vercel_url || project.netlify_url || (project.preview_url && !String(project.preview_url).includes("lovable.app"))) && (
              <button className={`gl sm ${showPreview ? "primary" : "ghost"}`} onClick={() => setShowPreview(p => !p)}>
                {showPreview ? <EyeOff size={12} /> : <Eye size={12} />} Preview
              </button>
            )}
            <button className="gl sm ghost" onClick={verifyProject} disabled={verifying}>
              {verifying ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />} Verificar
            </button>
          </div>
        </div>

        {/* Live Preview */}
        {showPreview && (() => {
          const deployedUrl = project.vercel_url || project.netlify_url || project.custom_domain;
          const previewUrl = deployedUrl
            ? (deployedUrl.startsWith("http") ? deployedUrl : `https://${deployedUrl}`)
            : (project.preview_url && !String(project.preview_url).includes("lovable.app") ? project.preview_url : null);
          return previewUrl ? (
            <div className="rd-card" style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 16px", borderBottom: "1px solid var(--b1)" }}>
                <span className="chip sm ch-green"><span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green-l)" }} /> Live Preview</span>
                <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="caption-sm" style={{ color: "var(--text-tertiary)" }}>
                  Abrir <ExternalLink size={10} />
                </a>
              </div>
              <iframe src={previewUrl} style={{ width: "100%", height: 420, border: 0 }} sandbox="allow-scripts allow-same-origin allow-popups allow-forms" title="Live Preview" />
            </div>
          ) : (
            <div className="rd-card body-text" style={{ textAlign: "center", marginBottom: 16 }}>Preview disponível após deploy</div>
          );
        })()}

        {/* Thinking */}
        {isActive && (
          <div className="rd-alert info" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--blue-l)", animation: "bounce 1s infinite" }} />
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--blue-l)", animation: "bounce 1s infinite 0.15s" }} />
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--blue-l)", animation: "bounce 1s infinite 0.3s" }} />
            </div>
            <span className="body-text">
              {project.status === "generating_prd" ? "Pensando" : "Processando"}
              {thinkingTime > 0 && <span style={{ marginLeft: 4, opacity: 0.6, fontSize: 10 }}>({thinkingTime}s)</span>}
            </span>
          </div>
        )}

        {/* Progress */}
        {project.progress_pct > 0 && project.status !== "live" && (
          <div className="rd-card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span className="label-lg">{project.status === "generating_prd" ? "Gerando PRD" : "Build em progresso"}</span>
              <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "var(--blue-l)" }}>{project.progress_pct}%</span>
            </div>
            <div className="rd-progress">
              <div className="rd-progress-bar blue" style={{ width: `${project.progress_pct}%` }} />
            </div>
          </div>
        )}

        {/* Tasks */}
        {tasks.length > 0 && (
          <div className="rd-card" style={{ padding: 0, marginBottom: 16, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--b1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="label-lg">Tarefas ({doneCount}/{tasks.length})</span>
              <div style={{ display: "flex", gap: 6 }}>
                {doneCount > 0 && <span className="chip sm ch-green">{doneCount} done</span>}
                {runningCount > 0 && <span className="chip sm ch-blue">{runningCount} running</span>}
              </div>
            </div>
            {tasks.map((task, i) => (
              <div key={i}>
                <button
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", background: "none", border: "none", borderBottom: "1px solid var(--b1)", cursor: "pointer", textAlign: "left" }}
                  onClick={() => setExpandedTask(expandedTask === i ? null : i)}
                >
                  {task.status === "done" && <CheckCircle2 size={16} style={{ color: "var(--green-l)", flexShrink: 0 }} />}
                  {task.status === "running" && <Loader2 size={16} className="animate-spin" style={{ color: "var(--blue-l)", flexShrink: 0 }} />}
                  {task.status === "pending" && <Circle size={16} style={{ color: "var(--text-quaternary)", flexShrink: 0 }} />}
                  {task.status === "failed" && <X size={16} style={{ color: "var(--red-l)", flexShrink: 0 }} />}
                  <span className="body-text" style={{ flex: 1, color: task.status === "pending" ? "var(--text-quaternary)" : "var(--text-primary)" }}>{task.title}</span>
                  {task.duration_ms && <span className="caption-sm" style={{ fontFamily: "var(--mono)" }}>{(task.duration_ms / 1000).toFixed(1)}s</span>}
                  {expandedTask === i ? <ChevronDown size={12} style={{ color: "var(--text-quaternary)" }} /> : <ChevronRight size={12} style={{ color: "var(--text-quaternary)" }} />}
                </button>
                {expandedTask === i && task.prompt && (
                  <div style={{ padding: "8px 16px 12px 44px" }}>
                    <pre style={{ background: "var(--bg-2)", border: "1px solid var(--b1)", borderRadius: 8, padding: 12, fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-secondary)", whiteSpace: "pre-wrap", maxHeight: 160, overflow: "auto" }}>
                      {task.prompt.slice(0, 500)}{task.prompt.length > 500 ? "..." : ""}
                    </pre>
                    {task.engine && <p className="caption-sm" style={{ marginTop: 8 }}><Wrench size={10} /> {task.engine}</p>}
                  </div>
                )}
              </div>
            ))}
            <div style={{ padding: "12px 16px", borderTop: "1px solid var(--b1)", display: "flex", gap: 8 }}>
              <button className="gl sm" style={{ flex: 1 }} onClick={() => navigate(`/cirius/editor/${id}`)}>
                <FileCode size={12} /> Abrir Editor
              </button>
              {(project.vercel_url || project.netlify_url) ? (
                <button className={`gl sm ${showPreview ? "ghost" : "primary"}`} style={{ flex: 1 }} onClick={() => setShowPreview(p => !p)}>
                  {showPreview ? <EyeOff size={12} /> : <Eye size={12} />} {showPreview ? "Fechar Preview" : "Preview"}
                </button>
              ) : (
                <button className="gl sm" style={{ flex: 1 }} disabled>Preview</button>
              )}
            </div>
          </div>
        )}

        {/* Design Summary */}
        {prd?.design && (
          <div className="rd-card" style={{ marginBottom: 16 }}>
            <span className="label-lg" style={{ marginBottom: 12, display: "block" }}>Design</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {prd.design.primary_color && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, border: "1px solid var(--b1)", background: prd.design.primary_color }} />
                  <span className="caption-sm">{prd.design.primary_color}</span>
                </div>
              )}
              {prd.design.font && <div className="caption-sm">Fonte: <span style={{ color: "var(--text-primary)" }}>{prd.design.font}</span></div>}
              {prd.design.style && <div className="caption-sm">Estilo: <span style={{ color: "var(--text-primary)" }}>{prd.design.style}</span></div>}
            </div>
            {prd.design.pages && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {(prd.design.pages as string[]).map((p: string) => <span key={p} className="chip sm">{p}</span>)}
              </div>
            )}
            {prd.design.tables && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {(prd.design.tables as string[]).map((t: string) => <span key={t} className="chip sm ch-blue"><Database size={10} /> {t}</span>)}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {project.status === "draft" && (project.prd_json || project.has_prd) && (
            <button className="gl primary" onClick={() => doAction("generate_code")} disabled={acting}><Play size={14} /> Gerar Código</button>
          )}
          {project.status === "draft" && !project.prd_json && !project.has_prd && (
            <button className="gl primary" onClick={() => doAction("generate_prd")} disabled={acting}><SparklesIcon size={14} /> Gerar PRD</button>
          )}
          {["generating_code", "generating_prd"].includes(project.status) && (
            <button className="gl ghost" onClick={() => doAction("pause")} disabled={acting}><Pause size={14} /> Pausar</button>
          )}
          {project.status === "paused" && (
            <button className="gl primary" onClick={() => doAction("resume")} disabled={acting}><Play size={14} /> Retomar</button>
          )}
          {project.status === "failed" && (
            <button className="gl ghost" onClick={() => doAction("generate_code")} disabled={acting}><RefreshCw size={14} /> Tentar Novamente</button>
          )}
          {!["draft", "live"].includes(project.status) && (
            <button className="gl sm" style={{ color: "var(--red-l)" }} onClick={() => doAction("cancel")} disabled={acting}><X size={14} /> Cancelar</button>
          )}
        </div>

        {/* Deploy Panel */}
        {(project.status === "live" || project.has_files) && (
          <div className="rd-card" style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--b1)", display: "flex", alignItems: "center", gap: 8 }}>
              <Rocket size={14} style={{ color: "var(--blue-l)" }} />
              <span className="label-lg">Deploy</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 16 }}>
              {[
                { target: "github", icon: Github, label: project.github_url ? "Conectado" : "GitHub", sub: project.github_repo, done: !!project.github_url },
                { target: "netlify", icon: Rocket, label: project.netlify_url ? "Online" : "Netlify", sub: project.netlify_url ? new URL(project.netlify_url.startsWith("http") ? project.netlify_url : `https://${project.netlify_url}`).hostname : undefined, done: !!project.netlify_url, primary: true },
                { target: "vercel", icon: Globe, label: project.vercel_url ? "Online" : "Vercel", done: !!project.vercel_url, disabled: !project.github_repo },
                { target: "supabase", icon: Database, label: project.supabase_url ? "Connected" : "Migrations", done: !!project.supabase_url },
              ].map(d => (
                <button key={d.target} className={`gl ${d.primary && !d.done ? "primary" : ""}`} style={{ justifyContent: "flex-start", height: "auto", padding: "10px 12px", gap: 8 }} onClick={() => doDeploy(d.target)} disabled={acting || d.disabled}>
                  <d.icon size={16} />
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 11, fontWeight: 600 }}>{d.label}</div>
                    {d.sub && <div className="caption-sm" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.sub}</div>}
                  </div>
                  {d.done && <CheckCircle2 size={12} style={{ color: "var(--green-l)", marginLeft: "auto" }} />}
                </button>
              ))}
            </div>
            {(project.github_url || project.vercel_url || project.netlify_url) && (
              <div style={{ padding: "0 16px 12px", display: "flex", flexWrap: "wrap", gap: 8 }}>
                {project.github_url && <a href={project.github_url} target="_blank" rel="noopener noreferrer" className="caption-sm" style={{ color: "var(--blue-l)", textDecoration: "underline", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{project.github_url}</a>}
                {project.netlify_url && <a href={project.netlify_url.startsWith("http") ? project.netlify_url : `https://${project.netlify_url}`} target="_blank" rel="noopener noreferrer" className="caption-sm" style={{ color: "var(--green-l)", textDecoration: "underline", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{project.netlify_url}</a>}
                {project.vercel_url && <a href={project.vercel_url} target="_blank" rel="noopener noreferrer" className="caption-sm" style={{ color: "var(--blue-l)", textDecoration: "underline", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{project.vercel_url}</a>}
              </div>
            )}
          </div>
        )}

        {/* Integrations Button */}
        <div style={{ marginBottom: 16 }}>
          <button className="gl" style={{ width: "100%", justifyContent: "center", gap: 8 }} onClick={() => {
            setIntegrationsOpen(o => !o);
            if (!integrationsOpen && integrations.length === 0) {
              setLoadingIntegrations(true);
              supabase.from("cirius_integrations").select("*").eq("user_id", user!.id).then(({ data }) => {
                setIntegrations(data || []);
                setLoadingIntegrations(false);
              });
            }
          }}>
            <Plug size={14} /> Integrações / Conectores
            <ChevronDown size={12} style={{ transition: "transform .2s", transform: integrationsOpen ? "rotate(180deg)" : "none", marginLeft: "auto" }} />
          </button>

          {integrationsOpen && (
            <div className="rd-card" style={{ marginTop: 8, padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--b1)" }}>
                <span className="label-lg">Conectores do Projeto</span>
                <p className="caption-sm" style={{ marginTop: 4 }}>Ative suas próprias contas OAuth ou use as contas da plataforma (acesso restrito aos seus projetos).</p>
              </div>

              {loadingIntegrations ? (
                <div style={{ padding: 24, textAlign: "center" }}><Loader2 size={16} className="animate-spin" style={{ color: "var(--text-tertiary)" }} /></div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {[
                    { provider: "github", icon: Github, label: "GitHub", desc: "Repositórios e deploy automático", color: "var(--tp)" },
                    { provider: "netlify", icon: Rocket, label: "Netlify", desc: "Hosting e CDN global", color: "var(--green-l)" },
                    { provider: "vercel", icon: Globe, label: "Vercel", desc: "Hosting serverless", color: "var(--blue-l)" },
                    { provider: "supabase", icon: Database, label: "Supabase", desc: "Banco de dados e auth", color: "var(--purple-l)" },
                  ].map(conn => {
                    const userInt = integrations.find(i => i.provider === conn.provider);
                    const isConnected = !!userInt?.is_active;
                    const isOwnAccount = !!userInt?.account_login;

                    return (
                      <div key={conn.provider} style={{
                        display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                        borderBottom: "1px solid var(--b1)",
                      }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: "var(--r2)",
                          background: "var(--bg-3)", display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <conn.icon size={16} style={{ color: conn.color }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--tp)" }}>{conn.label}</div>
                          <div className="caption-sm">{conn.desc}</div>
                          {isConnected && (
                            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                              {isOwnAccount ? (
                                <span className="chip sm ch-green" style={{ fontSize: 9 }}>
                                  <CheckCircle2 size={8} /> Sua conta: {userInt.account_login}
                                </span>
                              ) : (
                                <span className="chip sm ch-orange" style={{ fontSize: 9 }}>
                                  <AlertTriangle size={8} /> Conta da plataforma
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          {isConnected ? (
                            <>
                              <button className="gl ico xs ghost" title="Reconectar" onClick={async () => {
                                toast.info(`Reconectando ${conn.label}...`);
                                const { data } = await supabase.functions.invoke("cirius-oauth-callback", {
                                  body: { action: "start_oauth", provider: conn.provider, project_id: id },
                                });
                                if (data?.url) window.open(data.url, "_blank", "width=600,height=700");
                                else toast.error("Não foi possível iniciar OAuth");
                              }}>
                                <RefreshCw size={11} />
                              </button>
                              <button className="gl ico xs ghost" title="Desconectar" style={{ color: "var(--red-l)" }} onClick={async () => {
                                await supabase.from("cirius_integrations").update({ is_active: false }).eq("id", userInt.id);
                                setIntegrations(prev => prev.map(i => i.id === userInt.id ? { ...i, is_active: false } : i));
                                toast.success(`${conn.label} desconectado`);
                              }}>
                                <Unlink size={11} />
                              </button>
                            </>
                          ) : (
                            <button className="gl sm" onClick={async () => {
                              toast.info(`Conectando ${conn.label}...`);
                              const { data } = await supabase.functions.invoke("cirius-oauth-callback", {
                                body: { action: "start_oauth", provider: conn.provider, project_id: id },
                              });
                              if (data?.url) window.open(data.url, "_blank", "width=600,height=700");
                              else toast.info(`${conn.label} usará a conta da plataforma`);
                            }}>
                              <Link2 size={11} /> Conectar
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ padding: "10px 16px", background: "var(--bg-1)", borderTop: "1px solid var(--b1)" }}>
                <p style={{ fontSize: 10, color: "var(--text-quaternary)", lineHeight: 1.5 }}>
                  <Shield size={9} style={{ display: "inline", marginRight: 4 }} />
                  Sem integração própria, seus projetos usam as contas da plataforma com permissões limitadas ao seu escopo.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {project.error_message && (
          <div className="rd-alert warning" style={{ marginBottom: 16, color: "var(--red-l)" }}>{project.error_message}</div>
        )}

        {/* Logs Timeline */}
        {logs.length > 0 && (
          <div className="rd-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--b1)", display: "flex", alignItems: "center", gap: 8 }}>
              <FileCode size={14} style={{ color: "var(--text-tertiary)" }} />
              <span className="label-lg">Timeline</span>
              <span className="chip sm" style={{ marginLeft: "auto" }}>{logs.length}</span>
            </div>
            <div style={{ maxHeight: 240, overflow: "auto" }}>
              {logs.map((l: any, i: number) => (
                <div key={l.id || i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "8px 16px", borderBottom: "1px solid var(--b1)" }}>
                  <div style={{ marginTop: 2 }}>
                    {l.level === "error" && <X size={12} style={{ color: "var(--red-l)" }} />}
                    {l.level === "warning" && <Clock size={12} style={{ color: "var(--orange-l)" }} />}
                    {l.level === "info" && l.status === "completed" && <CheckCircle2 size={12} style={{ color: "var(--green-l)" }} />}
                    {l.level === "info" && l.status !== "completed" && <Circle size={12} style={{ color: "var(--text-quaternary)" }} />}
                  </div>
                  <span className="caption-sm" style={{ fontFamily: "var(--mono)", minWidth: 48 }}>
                    {new Date(l.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="body-text" style={{ flex: 1 }}>{l.message}</span>
                  {l.duration_ms && <span className="caption-sm" style={{ fontFamily: "var(--mono)" }}>{l.duration_ms}ms</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function SparklesIcon(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>;
}
