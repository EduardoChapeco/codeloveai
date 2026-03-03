import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import {
  Plus, Play, Trash2, Loader2, Clock, Zap, Globe,
  Shield, Search, RefreshCw, FileText, CheckCircle, XCircle,
  ChevronDown, Power,
} from "lucide-react";

interface AutomationRule {
  id: string; name: string; trigger_type: string; action_type: string;
  project_id: string; message_template: string; cron_expression: string | null;
  is_active: boolean; last_run_at: string | null; run_count: number; created_at: string;
}
interface AutomationRun {
  id: string; rule_id: string; status: string; result: string | null; created_at: string;
}

const ACTION_LABELS: Record<string, string> = { send_message: "Enviar Mensagem", publish: "Publicar Projeto", security_fix: "Fix de Segurança", seo_fix: "Fix de SEO" };
const TRIGGER_LABELS: Record<string, string> = { manual: "Manual", schedule: "Agendado", webhook: "Webhook" };
const ACTION_ICONS: Record<string, typeof Shield> = { security_fix: Shield, seo_fix: Globe, send_message: FileText, publish: Zap };

export default function Automation() {
  const { user } = useAuth();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState<"rules" | "logs">("rules");
  const [newName, setNewName] = useState("");
  const [newActionType, setNewActionType] = useState("security_fix");
  const [newTriggerType, setNewTriggerType] = useState("manual");
  const [newProjectId, setNewProjectId] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [newCron, setNewCron] = useState("");
  const [creating, setCreating] = useState(false);
  const [projects, setProjects] = useState<{ lovable_project_id: string; display_name: string | null; name: string | null }[]>([]);

  const invoke = useCallback(async (action: string, body: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("lovable-automation", { body: { action, ...body } });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rulesRes, logsRes] = await Promise.all([invoke("list"), invoke("logs")]);
      setRules(rulesRes.rules || []);
      setRuns(logsRes.logs || []);
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  }, [invoke]);

  useEffect(() => {
    if (!user) return;
    fetchAll();
    supabase.from("lovable_projects").select("lovable_project_id, display_name, name").eq("user_id", user.id).then(({ data }) => setProjects(data || []));
  }, [user, fetchAll]);

  const handleCreate = async () => {
    if (!newName.trim() || !newProjectId) { toast.error("Nome e projeto são obrigatórios"); return; }
    setCreating(true);
    try {
      await invoke("create", { name: newName.trim(), action_type: newActionType, trigger_type: newTriggerType, project_id: newProjectId, message_template: newMessage, cron_expression: newCron || null });
      toast.success("Automação criada!");
      setShowCreate(false); setNewName(""); setNewMessage(""); setNewCron(""); fetchAll();
    } catch (e: any) { toast.error(e.message); }
    setCreating(false);
  };

  const handleRun = async (id: string) => {
    setRunning(id);
    try { const res = await invoke("run", { id }); toast.success(res.status === "success" ? "Executado com sucesso!" : "Execução falhou"); fetchAll(); }
    catch (e: any) { toast.error(e.message); }
    setRunning(null);
  };

  const handleToggle = async (id: string, active: boolean) => {
    try { await invoke("update", { id, is_active: !active }); setRules(prev => prev.map(r => r.id === id ? { ...r, is_active: !active } : r)); }
    catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    try { await invoke("delete", { id }); toast.success("Automação removida"); setRules(prev => prev.filter(r => r.id !== id)); }
    catch (e: any) { toast.error(e.message); }
  };

  if (!user) return null;

  return (
    <AppLayout>
      <div className="rd-page-content">
        {/* Header */}
        <div className="rd-page-head">
          <div className="flex items-center justify-between">
            <div>
              <div className="sec-label">Ferramentas</div>
              <h1>Automações</h1>
              <p>Configure ações automáticas para seus projetos</p>
            </div>
            <div className="flex gap-2">
              <button onClick={fetchAll} disabled={loading} className="gl sm ghost">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
              </button>
              <button onClick={() => setShowCreate(!showCreate)} className="gl sm orange">
                <Plus className="h-3.5 w-3.5" /> Nova Automação
              </button>
            </div>
          </div>
        </div>

        {/* Create Form */}
        {showCreate && (
          <div className="rd-card" style={{ borderLeft: "3px solid var(--orange-l)", marginBottom: 16 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Nova Automação</p>
            <div style={{ marginBottom: 12 }}>
              <label className="sec-label" style={{ display: "block", marginBottom: 6 }}>Nome da automação</label>
              <input placeholder="Ex: Fix de segurança diário" value={newName} onChange={e => setNewName(e.target.value)}
                style={{ width: "100%", height: 36, padding: "0 12px", borderRadius: "var(--r2)", background: "var(--bg-3)", border: "1px solid var(--b1)", color: "var(--text-primary)", fontSize: 13 }} />
            </div>
            <div className="rd-grid-3" style={{ marginBottom: 12 }}>
              <div>
                <label className="sec-label" style={{ display: "block", marginBottom: 6 }}>Ação</label>
                <div style={{ position: "relative" }}>
                  <select value={newActionType} onChange={e => setNewActionType(e.target.value)}
                    style={{ width: "100%", height: 36, padding: "0 12px", borderRadius: "var(--r2)", background: "var(--bg-3)", border: "1px solid var(--b1)", color: "var(--text-primary)", fontSize: 13, appearance: "none" }}>
                    <option value="security_fix">Fix de Segurança</option>
                    <option value="seo_fix">Fix de SEO</option>
                    <option value="send_message">Enviar Mensagem</option>
                    <option value="publish">Publicar</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: "var(--text-tertiary)" }} />
                </div>
              </div>
              <div>
                <label className="sec-label" style={{ display: "block", marginBottom: 6 }}>Gatilho</label>
                <div style={{ position: "relative" }}>
                  <select value={newTriggerType} onChange={e => setNewTriggerType(e.target.value)}
                    style={{ width: "100%", height: 36, padding: "0 12px", borderRadius: "var(--r2)", background: "var(--bg-3)", border: "1px solid var(--b1)", color: "var(--text-primary)", fontSize: 13, appearance: "none" }}>
                    <option value="manual">Manual</option>
                    <option value="schedule">Agendado</option>
                    <option value="webhook">Webhook</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: "var(--text-tertiary)" }} />
                </div>
              </div>
              <div>
                <label className="sec-label" style={{ display: "block", marginBottom: 6 }}>Projeto</label>
                <div style={{ position: "relative" }}>
                  <select value={newProjectId} onChange={e => setNewProjectId(e.target.value)}
                    style={{ width: "100%", height: 36, padding: "0 12px", borderRadius: "var(--r2)", background: "var(--bg-3)", border: "1px solid var(--b1)", color: "var(--text-primary)", fontSize: 13, appearance: "none" }}>
                    <option value="">Selecione projeto</option>
                    {projects.map(p => <option key={p.lovable_project_id} value={p.lovable_project_id}>{p.display_name || p.name || p.lovable_project_id.slice(0, 8)}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: "var(--text-tertiary)" }} />
                </div>
              </div>
            </div>
            {newTriggerType === "schedule" && (
              <div style={{ marginBottom: 12 }}>
                <label className="sec-label" style={{ display: "block", marginBottom: 6 }}>Expressão Cron</label>
                <input placeholder="Ex: 0 */6 * * *" value={newCron} onChange={e => setNewCron(e.target.value)}
                  style={{ width: "100%", height: 36, padding: "0 12px", borderRadius: "var(--r2)", background: "var(--bg-3)", border: "1px solid var(--b1)", color: "var(--text-primary)", fontSize: 13, fontFamily: "var(--font-mono)" }} />
              </div>
            )}
            {(newActionType === "send_message" || newActionType === "security_fix" || newActionType === "seo_fix") && (
              <div style={{ marginBottom: 12 }}>
                <label className="sec-label" style={{ display: "block", marginBottom: 6 }}>Template da mensagem</label>
                <textarea placeholder="Mensagem a enviar ao projeto..." value={newMessage} onChange={e => setNewMessage(e.target.value)} rows={3}
                  style={{ width: "100%", padding: 12, borderRadius: "var(--r2)", background: "var(--bg-3)", border: "1px solid var(--b1)", color: "var(--text-primary)", fontSize: 13, resize: "none" }} />
              </div>
            )}
            <div className="flex justify-end gap-2" style={{ paddingTop: 8 }}>
              <button onClick={() => setShowCreate(false)} className="gl sm ghost">Cancelar</button>
              <button onClick={handleCreate} disabled={creating} className="gl sm orange">
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Criar
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2" style={{ marginBottom: 16 }}>
          <button onClick={() => setActiveTab("rules")} className={activeTab === "rules" ? "gl sm orange" : "gl sm ghost"}>
            <Zap className="h-3.5 w-3.5" /> Regras ({rules.length})
          </button>
          <button onClick={() => setActiveTab("logs")} className={activeTab === "logs" ? "gl sm orange" : "gl sm ghost"}>
            <FileText className="h-3.5 w-3.5" /> Logs ({runs.length})
          </button>
        </div>

        {/* Rules Tab */}
        {activeTab === "rules" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {loading ? (
              <div className="flex justify-center" style={{ padding: "60px 0" }}>
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--text-tertiary)" }} />
              </div>
            ) : rules.length === 0 ? (
              <div className="rd-card" style={{ textAlign: "center", padding: "60px 20px" }}>
                <Zap className="h-10 w-10 mx-auto" style={{ color: "var(--text-tertiary)", opacity: 0.3, marginBottom: 12 }} />
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Nenhuma automação configurada</p>
                <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>Clique em "Nova Automação" para começar</p>
              </div>
            ) : rules.map(rule => {
              const ActionIcon = ACTION_ICONS[rule.action_type] || Zap;
              return (
                <div key={rule.id} className="rd-card" style={{ opacity: rule.is_active ? 1 : 0.5, padding: 16 }}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="rd-ico-box" style={{ background: rule.is_active ? "rgba(245,158,11,0.1)" : "var(--bg-3)" }}>
                        <ActionIcon className="h-5 w-5" style={{ color: rule.is_active ? "var(--orange-l)" : "var(--text-tertiary)" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }} className="truncate">{rule.name}</span>
                          <span className="chip orange">{ACTION_LABELS[rule.action_type] || rule.action_type}</span>
                          <span className="chip">{TRIGGER_LABELS[rule.trigger_type] || rule.trigger_type}</span>
                        </div>
                        <div className="flex items-center gap-3" style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                          <span>Projeto: {rule.project_id.slice(0, 8)}…</span>
                          <span>Execuções: {rule.run_count}</span>
                          {rule.last_run_at && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(rule.last_run_at).toLocaleString("pt-BR")}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => handleToggle(rule.id, rule.is_active)} className="gl ico xs ghost" title={rule.is_active ? "Desativar" : "Ativar"}
                        style={{ color: rule.is_active ? "var(--green-l)" : "var(--text-tertiary)" }}>
                        <Power className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleRun(rule.id)} disabled={running === rule.id || !rule.is_active} className="gl ico xs ghost" title="Executar">
                        {running === rule.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      </button>
                      <button onClick={() => handleDelete(rule.id)} className="gl ico xs ghost" title="Remover" style={{ color: "var(--red-l)" }}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === "logs" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {runs.length === 0 ? (
              <div className="rd-card" style={{ textAlign: "center", padding: "60px 20px" }}>
                <FileText className="h-10 w-10 mx-auto" style={{ color: "var(--text-tertiary)", opacity: 0.3, marginBottom: 12 }} />
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Nenhuma execução registrada</p>
              </div>
            ) : runs.map(run => (
              <div key={run.id} className="rd-card flex items-center justify-between" style={{ padding: 14 }}>
                <div className="flex items-center gap-3">
                  <div className="rd-ico-box sm" style={{ background: run.status === "success" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)" }}>
                    {run.status === "success" ? <CheckCircle className="h-4 w-4" style={{ color: "var(--green-l)" }} /> : <XCircle className="h-4 w-4" style={{ color: "var(--red-l)" }} />}
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{run.status === "success" ? "Sucesso" : "Erro"}</p>
                    <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{new Date(run.created_at).toLocaleString("pt-BR")}</p>
                  </div>
                </div>
                {run.result && <span style={{ fontSize: 11, color: "var(--text-tertiary)", maxWidth: 200 }} className="truncate">{run.result}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
