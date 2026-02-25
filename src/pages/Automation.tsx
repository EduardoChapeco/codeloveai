import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Play, Trash2, Loader2, Clock, Zap, Globe,
  Shield, Search, RefreshCw, FileText, CheckCircle, XCircle,
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

export default function Automation() {
  const { user } = useAuth();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

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
    // Load projects
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
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Automações</h1>
            <p className="text-muted-foreground text-sm">
              Configure ações automáticas para seus projetos Lovable
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
              <Plus className="w-4 h-4 mr-1" />
              Nova Automação
            </Button>
          </div>
        </div>

        {/* Create Form */}
        {showCreate && (
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="text-lg">Nova Automação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Nome da automação"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select value={newActionType} onValueChange={setNewActionType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="security_fix">Fix de Segurança</SelectItem>
                    <SelectItem value="seo_fix">Fix de SEO</SelectItem>
                    <SelectItem value="send_message">Enviar Mensagem</SelectItem>
                    <SelectItem value="publish">Publicar</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={newTriggerType} onValueChange={setNewTriggerType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="schedule">Agendado</SelectItem>
                    <SelectItem value="webhook">Webhook</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={newProjectId} onValueChange={setNewProjectId}>
                  <SelectTrigger><SelectValue placeholder="Selecione projeto" /></SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.lovable_project_id} value={p.lovable_project_id}>
                        {p.display_name || p.name || p.lovable_project_id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {newTriggerType === "schedule" && (
                <Input
                  placeholder="Cron expression (ex: 0 */6 * * *)"
                  value={newCron}
                  onChange={(e) => setNewCron(e.target.value)}
                />
              )}
              {(newActionType === "send_message" || newActionType === "security_fix" || newActionType === "seo_fix") && (
                <Textarea
                  placeholder="Template da mensagem a enviar ao projeto..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  rows={3}
                />
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                  Criar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="rules">
          <TabsList>
            <TabsTrigger value="rules">
              <Zap className="w-4 h-4 mr-1" />
              Regras ({rules.length})
            </TabsTrigger>
            <TabsTrigger value="logs">
              <FileText className="w-4 h-4 mr-1" />
              Logs ({runs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rules" className="space-y-3 mt-4">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : rules.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Zap className="w-10 h-10 mb-3 opacity-30" />
                  <p>Nenhuma automação configurada</p>
                  <p className="text-xs">Clique em "Nova Automação" para começar</p>
                </CardContent>
              </Card>
            ) : (
              rules.map((rule) => (
                <Card key={rule.id} className={!rule.is_active ? "opacity-60" : ""}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">{rule.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {ACTION_LABELS[rule.action_type] || rule.action_type}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {TRIGGER_LABELS[rule.trigger_type] || rule.trigger_type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>Projeto: {rule.project_id.slice(0, 8)}...</span>
                        <span>Execuções: {rule.run_count}</span>
                        {rule.last_run_at && (
                          <span>Última: {new Date(rule.last_run_at).toLocaleString("pt-BR")}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={() => handleToggle(rule.id, rule.is_active)}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRun(rule.id)}
                        disabled={running === rule.id || !rule.is_active}
                      >
                        {running === rule.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => handleDelete(rule.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="logs" className="mt-4">
            {runs.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <FileText className="w-10 h-10 mb-3 opacity-30" />
                  <p>Nenhuma execução registrada</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {runs.map((run) => (
                  <Card key={run.id}>
                    <CardContent className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-3">
                        {run.status === "success" ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-destructive" />
                        )}
                        <div>
                          <p className="text-sm font-medium">
                            {run.status === "success" ? "Sucesso" : "Erro"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(run.created_at).toLocaleString("pt-BR")}
                          </p>
                        </div>
                      </div>
                      {run.result && (
                        <span className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {run.result}
                        </span>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
