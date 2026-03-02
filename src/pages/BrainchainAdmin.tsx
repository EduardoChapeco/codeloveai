import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { toast } from "sonner";
import { Plus, Trash2, Power, PowerOff, Unlock, RefreshCw, Brain, Server, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface BrainchainAccount {
  id: string;
  email: string | null;
  label: string | null;
  brain_type: string;
  is_active: boolean;
  is_busy: boolean;
  access_expires_at: string | null;
  brain_project_id: string | null;
  request_count: number;
  error_count: number;
  last_used_at: string | null;
  created_at: string;
}

interface PoolStatus {
  [key: string]: { total: number; active: number; busy: number; queued: number };
}

const BRAIN_TYPES = ["general", "codigo", "design", "seguranca", "dados", "seo", "devops", "mobile"];

export default function BrainchainAdmin() {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const [accounts, setAccounts] = useState<BrainchainAccount[]>([]);
  const [poolStatus, setPoolStatus] = useState<PoolStatus>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BrainchainAccount | null>(null);

  // Form state
  const [formEmail, setFormEmail] = useState("");
  const [formLabel, setFormLabel] = useState("");
  const [formBrainType, setFormBrainType] = useState("general");
  const [formRefreshToken, setFormRefreshToken] = useState("");
  const [formAccessToken, setFormAccessToken] = useState("");
  const [formProjectId, setFormProjectId] = useState("");

  const callAdmin = async (action: string, extra: Record<string, unknown> = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/brainchain-admin`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({ action, ...extra }),
      }
    );
    return res.json();
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [accountsRes, statusRes] = await Promise.all([
        callAdmin("list_accounts"),
        callAdmin("pool_status"),
      ]);
      setAccounts(accountsRes.accounts || []);
      setPoolStatus(statusRes.pool || {});
    } catch (e) {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && isAdmin) loadData();
  }, [user, isAdmin]);

  const resetForm = () => {
    setFormEmail("");
    setFormLabel("");
    setFormBrainType("general");
    setFormRefreshToken("");
    setFormAccessToken("");
    setFormProjectId("");
    setEditingAccount(null);
  };

  const openNew = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (acc: BrainchainAccount) => {
    setEditingAccount(acc);
    setFormEmail(acc.email || "");
    setFormLabel(acc.label || "");
    setFormBrainType(acc.brain_type);
    setFormProjectId(acc.brain_project_id || "");
    setFormRefreshToken("");
    setFormAccessToken("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingAccount && !formRefreshToken) {
      toast.error("Refresh token é obrigatório para nova conta");
      return;
    }
    const payload: Record<string, unknown> = {
      email: formEmail || null,
      label: formLabel || null,
      brain_type: formBrainType,
      brain_project_id: formProjectId || null,
    };
    if (editingAccount) payload.id = editingAccount.id;
    if (formRefreshToken) payload.refresh_token = formRefreshToken;
    else if (editingAccount) payload.refresh_token = "KEEP_EXISTING";
    if (formAccessToken) payload.access_token = formAccessToken;

    // For edits without new refresh_token, we need to pass the existing one
    // The edge function requires refresh_token, so for edits we'll handle differently
    if (editingAccount && !formRefreshToken) {
      // Direct update via supabase client for edits without token change
      const updateData: Record<string, unknown> = {
        email: formEmail || null,
        label: formLabel || null,
        brain_type: formBrainType,
        brain_project_id: formProjectId || null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("brainchain_accounts" as any)
        .update(updateData)
        .eq("id", editingAccount.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Conta atualizada");
    } else {
      const data = await callAdmin("upsert_account", payload);
      if (data.error) {
        toast.error(data.error);
        return;
      }
      toast.success(editingAccount ? "Conta atualizada" : "Conta adicionada");
    }

    setDialogOpen(false);
    resetForm();
    loadData();
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await callAdmin("toggle_account", { id, is_active: !isActive });
    toast.success(isActive ? "Conta desativada" : "Conta ativada");
    loadData();
  };

  const handleRelease = async (id: string) => {
    await callAdmin("force_release", { id });
    toast.success("Conta liberada");
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta conta do pool?")) return;
    await callAdmin("delete_account", { id });
    toast.success("Conta removida");
    loadData();
  };

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-muted-foreground">Acesso restrito a administradores.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="w-6 h-6 text-primary" />
              Brainchain — Pool de Contas
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie contas mestres, vincule projetos Brain e monitore o pool.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={openNew}>
                  <Plus className="w-4 h-4 mr-1" /> Adicionar Conta
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingAccount ? "Editar Conta" : "Nova Conta Mestre"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Email</Label>
                      <Input placeholder="conta@email.com" value={formEmail} onChange={e => setFormEmail(e.target.value)} />
                    </div>
                    <div>
                      <Label>Label</Label>
                      <Input placeholder="conta-01-codigo" value={formLabel} onChange={e => setFormLabel(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label>Tipo do Brain</Label>
                    <Select value={formBrainType} onValueChange={setFormBrainType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {BRAIN_TYPES.map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Refresh Token {editingAccount && "(deixe vazio para manter)"}</Label>
                    <Input
                      placeholder="Firebase refresh_token"
                      value={formRefreshToken}
                      onChange={e => setFormRefreshToken(e.target.value)}
                      type="password"
                    />
                  </div>
                  <div>
                    <Label>Access Token (opcional)</Label>
                    <Input
                      placeholder="JWT access_token"
                      value={formAccessToken}
                      onChange={e => setFormAccessToken(e.target.value)}
                      type="password"
                    />
                  </div>
                  <div>
                    <Label>Brain Project ID (UUID do Lovable)</Label>
                    <Input
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      value={formProjectId}
                      onChange={e => setFormProjectId(e.target.value)}
                    />
                  </div>
                  <Button className="w-full" onClick={handleSave}>
                    {editingAccount ? "Salvar Alterações" : "Adicionar ao Pool"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Pool Status Cards */}
        {Object.keys(poolStatus).length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(poolStatus).map(([type, s]) => (
              <Card key={type} className="bg-card/50 border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Server className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-sm capitalize">{type}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                    <span>Total: <strong className="text-foreground">{s.total}</strong></span>
                    <span>Ativas: <strong className="text-green-400">{s.active}</strong></span>
                    <span>Busy: <strong className="text-yellow-400">{s.busy}</strong></span>
                    <span>Fila: <strong className="text-orange-400">{s.queued}</strong></span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Accounts List */}
        <div className="space-y-3">
          {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {!loading && accounts.length === 0 && (
            <Card className="bg-card/50 border-dashed border-border/50">
              <CardContent className="p-8 text-center">
                <Brain className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Nenhuma conta cadastrada.</p>
                <p className="text-xs text-muted-foreground mt-1">Clique em "Adicionar Conta" para começar.</p>
              </CardContent>
            </Card>
          )}
          {accounts.map(acc => (
            <Card key={acc.id} className={`bg-card/50 border-border/50 ${!acc.is_active ? "opacity-50" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm truncate">{acc.label || acc.email || acc.id.slice(0, 8)}</span>
                      <Badge variant="outline" className="text-xs capitalize">{acc.brain_type}</Badge>
                      {acc.is_busy && <Badge variant="destructive" className="text-xs">Busy</Badge>}
                      {!acc.is_active && <Badge variant="secondary" className="text-xs">Inativa</Badge>}
                      {acc.error_count >= 3 && <Badge variant="destructive" className="text-xs">Erros: {acc.error_count}</Badge>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      {acc.email && <span>{acc.email}</span>}
                      <span>Reqs: {acc.request_count}</span>
                      {acc.brain_project_id && <span className="truncate max-w-[200px]">Projeto: {acc.brain_project_id}</span>}
                      {acc.access_expires_at && (
                        <span className={new Date(acc.access_expires_at) < new Date() ? "text-destructive" : "text-green-400"}>
                          Token: {new Date(acc.access_expires_at) < new Date() ? "expirado" : "válido"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(acc)} title="Editar">
                      <Activity className="w-4 h-4" />
                    </Button>
                    {acc.is_busy && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRelease(acc.id)} title="Liberar">
                        <Unlock className="w-4 h-4 text-yellow-400" />
                      </Button>
                    )}
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8"
                      onClick={() => handleToggle(acc.id, acc.is_active)}
                      title={acc.is_active ? "Desativar" : "Ativar"}
                    >
                      {acc.is_active ? <PowerOff className="w-4 h-4 text-orange-400" /> : <Power className="w-4 h-4 text-green-400" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(acc.id)} title="Excluir">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
