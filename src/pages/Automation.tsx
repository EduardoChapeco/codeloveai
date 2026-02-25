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
  id: string;
  name: string;
  trigger_type: string;
  action_type: string;
  project_id: string;
  message_template: string;
  cron_expression: string | null;
  is_active: boolean;
  last_run_at: string | null;
  run_count: number;
  created_at: string;
}

interface AutomationRun {
  id: string;
  rule_id: string;
  status: string;
  result: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  send_message: "Enviar Mensagem",
  publish: "Publicar Projeto",
  security_fix: "Fix de Segurança",
  seo_fix: "Fix de SEO",
};

const TRIGGER_LABELS: Record<string, string> = {
  manual: "Manual",
  schedule: "Agendado",
  webhook: "Webhook",
};

const ACTION_ICONS: Record<string, typeof Shield> = {
  security_fix: Shield,
  seo_fix: Globe,
  send_message: FileText,
  publish: Zap,
};

export default function Automation() {
  const { user } = useAuth();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState<"rules" | "logs">("rules");

  // Create form
  const [newName, setNewName] = useState("");
  const [newActionType, setNewActionType] = useState("security_fix");
  const [newTriggerType, setNewTriggerType] = useState("manual");
  const [newProjectId, setNewProjectId] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [newCron, setNewCron] = useState("");
  const [creating, setCreating] = useState(false);

  const [projects, setProjects] = useState<{ lovable_project_id: string; display_name: string | null; name: string | null }[]>([]);

  const invoke = useCallback(async (action: string, body: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("lovable-automation", {
      body: { action, ...body },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rulesRes, logsRes] = await Promise.all([
        invoke("list"),
        invoke("logs"),
      ]);
      setRules(rulesRes.rules || []);
      setRuns(logsRes.logs || []);
    } catch (e: any) {
      toast.error(e.message);
    }
    setLoading(false);
  }, [invoke]);

  useEffect(() => {
    if (!user) return;
    fetchAll();
    supabase
      .from("lovable_projects")
      .select("lovable_project_id, display_name, name")
      .eq("user_id", user.id)
      .then(({ data }) => setProjects(data || []));
  }, [user, fetchAll]);

  const handleCreate = async () => {
    if (!newName.trim() || !newProjectId) {
      toast.error("Nome e projeto são obrigatórios");
      return;
    }
    setCreating(true);
    try {
      await invoke("create", {
        name: newName.trim(),
        action_type: newActionType,
        trigger_type: newTriggerType,
        project_id: newProjectId,
        message_template: newMessage,
        cron_expression: newCron || null,
      });
      toast.success("Automação criada!");
      setShowCreate(false);
      setNewName("");
      setNewMessage("");
      setNewCron("");
      fetchAll();
    } catch (e: any) {
      toast.error(e.message);
    }
    setCreating(false);
  };

  const handleRun = async (id: string) => {
    setRunning(id);
    try {
      const res = await invoke("run", { id });
      toast.success(res.status === "success" ? "Executado com sucesso!" : "Execução falhou");
      fetchAll();
    } catch (e: any) {
      toast.error(e.message);
    }
    setRunning(null);
  };

  const handleToggle = async (id: string, active: boolean) => {
    try {
      await invoke("update", { id, is_active: !active });
      setRules((prev) => prev.map((r) => (r.id === id ? { ...r, is_active: !active } : r)));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await invoke("delete", { id });
      toast.success("Automação removida");
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (!user) return null;

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="lv-overline mb-1">Ferramentas</p>
            <h1 className="lv-heading-lg">Automações</h1>
            <p className="lv-body mt-1">Configure ações automáticas para seus projetos</p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchAll} disabled={loading} className="lv-btn-secondary h-9 px-4 text-xs">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </button>
            <button onClick={() => setShowCreate(!showCreate)} className="lv-btn-primary h-9 px-4 text-xs">
              <Plus className="h-3.5 w-3.5" />
              Nova Automação
            </button>
          </div>
        </div>

        {/* Create Form */}
        {showCreate && (
          <div className="lv-card space-y-4 border-l-3 border-l-primary/30">
            <p className="lv-heading-sm">Nova Automação</p>

            <div>
              <label className="lv-caption block mb-1.5">Nome da automação</label>
              <input
                placeholder="Ex: Fix de segurança diário"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="lv-input"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="lv-caption block mb-1.5">Ação</label>
                <div className="relative">
                  <select
                    value={newActionType}
                    onChange={(e) => setNewActionType(e.target.value)}
                    className="lv-input appearance-none pr-8 cursor-pointer"
                  >
                    <option value="security_fix">Fix de Segurança</option>
                    <option value="seo_fix">Fix de SEO</option>
                    <option value="send_message">Enviar Mensagem</option>
                    <option value="publish">Publicar</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="lv-caption block mb-1.5">Gatilho</label>
                <div className="relative">
                  <select
                    value={newTriggerType}
                    onChange={(e) => setNewTriggerType(e.target.value)}
                    className="lv-input appearance-none pr-8 cursor-pointer"
                  >
                    <option value="manual">Manual</option>
                    <option value="schedule">Agendado</option>
                    <option value="webhook">Webhook</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="lv-caption block mb-1.5">Projeto</label>
                <div className="relative">
                  <select
                    value={newProjectId}
                    onChange={(e) => setNewProjectId(e.target.value)}
                    className="lv-input appearance-none pr-8 cursor-pointer"
                  >
                    <option value="">Selecione projeto</option>
                    {projects.map((p) => (
                      <option key={p.lovable_project_id} value={p.lovable_project_id}>
                        {p.display_name || p.name || p.lovable_project_id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>

            {newTriggerType === "schedule" && (
              <div>
                <label className="lv-caption block mb-1.5">Expressão Cron</label>
                <input
                  placeholder="Ex: 0 */6 * * *"
                  value={newCron}
                  onChange={(e) => setNewCron(e.target.value)}
                  className="lv-input font-mono"
                />
              </div>
            )}

            {(newActionType === "send_message" || newActionType === "security_fix" || newActionType === "seo_fix") && (
              <div>
                <label className="lv-caption block mb-1.5">Template da mensagem</label>
                <textarea
                  placeholder="Mensagem a enviar ao projeto..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  rows={3}
                  className="lv-textarea"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCreate(false)} className="lv-btn-secondary h-9 px-4 text-xs">
                Cancelar
              </button>
              <button onClick={handleCreate} disabled={creating} className="lv-btn-primary h-9 px-4 text-xs">
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Criar
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("rules")}
            className={`h-9 px-4 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === "rules"
                ? "lv-btn-primary"
                : "lv-btn-secondary"
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            Regras ({rules.length})
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`h-9 px-4 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === "logs"
                ? "lv-btn-primary"
                : "lv-btn-secondary"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            Logs ({runs.length})
          </button>
        </div>

        {/* Rules Tab */}
        {activeTab === "rules" && (
          <div className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : rules.length === 0 ? (
              <div className="lv-card text-center py-16">
                <Zap className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="lv-body-strong">Nenhuma automação configurada</p>
                <p className="lv-caption mt-1">Clique em "Nova Automação" para começar</p>
              </div>
            ) : (
              rules.map((rule) => {
                const ActionIcon = ACTION_ICONS[rule.action_type] || Zap;
                return (
                  <div key={rule.id} className={`clf-liquid-glass rounded-[18px] p-5 transition-opacity ${!rule.is_active ? "opacity-50" : ""}`}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                          rule.is_active ? "bg-primary/10" : "bg-muted"
                        }`}>
                          <ActionIcon className={`h-5 w-5 ${rule.is_active ? "text-primary" : "text-muted-foreground"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="lv-body-strong truncate">{rule.name}</span>
                            <span className="lv-badge lv-badge-primary">
                              {ACTION_LABELS[rule.action_type] || rule.action_type}
                            </span>
                            <span className="lv-badge lv-badge-muted">
                              {TRIGGER_LABELS[rule.trigger_type] || rule.trigger_type}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 lv-caption">
                            <span>Projeto: {rule.project_id.slice(0, 8)}…</span>
                            <span>Execuções: {rule.run_count}</span>
                            {rule.last_run_at && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(rule.last_run_at).toLocaleString("pt-BR")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Toggle */}
                        <button
                          onClick={() => handleToggle(rule.id, rule.is_active)}
                          className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all ${
                            rule.is_active
                              ? "bg-green-500/10 text-green-600 hover:bg-green-500/20"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                          title={rule.is_active ? "Desativar" : "Ativar"}
                        >
                          <Power className="h-4 w-4" />
                        </button>

                        {/* Run */}
                        <button
                          onClick={() => handleRun(rule.id)}
                          disabled={running === rule.id || !rule.is_active}
                          className="lv-btn-secondary h-8 w-8 !p-0"
                          title="Executar"
                        >
                          {running === rule.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(rule.id)}
                          className="h-8 w-8 rounded-lg flex items-center justify-center text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-all"
                          title="Remover"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === "logs" && (
          <div className="space-y-2">
            {runs.length === 0 ? (
              <div className="lv-card text-center py-16">
                <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="lv-body-strong">Nenhuma execução registrada</p>
              </div>
            ) : (
              runs.map((run) => (
                <div key={run.id} className="lv-card-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {run.status === "success" ? (
                      <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </div>
                    ) : (
                      <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                        <XCircle className="h-4 w-4 text-destructive" />
                      </div>
                    )}
                    <div>
                      <p className="lv-body-strong text-sm">
                        {run.status === "success" ? "Sucesso" : "Erro"}
                      </p>
                      <p className="lv-caption">
                        {new Date(run.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  {run.result && (
                    <span className="lv-caption max-w-[200px] truncate">
                      {run.result}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
