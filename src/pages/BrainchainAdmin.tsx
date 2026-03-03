import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { toast } from "sonner";
import { Plus, Trash2, Power, PowerOff, Unlock, RefreshCw, Brain, Server, Activity, X } from "lucide-react";

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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` },
        body: JSON.stringify({ action, ...extra }),
      }
    );
    return res.json();
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [accountsRes, statusRes] = await Promise.all([callAdmin("list_accounts"), callAdmin("pool_status")]);
      setAccounts(accountsRes.accounts || []);
      setPoolStatus(statusRes.pool || {});
    } catch { toast.error("Erro ao carregar dados"); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (user && isAdmin) loadData(); }, [user, isAdmin]);

  const resetForm = () => { setFormEmail(""); setFormLabel(""); setFormBrainType("general"); setFormRefreshToken(""); setFormAccessToken(""); setFormProjectId(""); setEditingAccount(null); };
  const openNew = () => { resetForm(); setDialogOpen(true); };
  const openEdit = (acc: BrainchainAccount) => {
    setEditingAccount(acc); setFormEmail(acc.email || ""); setFormLabel(acc.label || "");
    setFormBrainType(acc.brain_type); setFormProjectId(acc.brain_project_id || "");
    setFormRefreshToken(""); setFormAccessToken(""); setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingAccount && !formRefreshToken) { toast.error("Refresh token é obrigatório para nova conta"); return; }
    const payload: Record<string, unknown> = { email: formEmail || null, label: formLabel || null, brain_type: formBrainType, brain_project_id: formProjectId || null };
    if (editingAccount) payload.id = editingAccount.id;
    if (formRefreshToken) payload.refresh_token = formRefreshToken;
    else if (editingAccount) payload.refresh_token = "KEEP_EXISTING";
    if (formAccessToken) payload.access_token = formAccessToken;

    if (editingAccount && !formRefreshToken) {
      const updateData: Record<string, unknown> = { email: formEmail || null, label: formLabel || null, brain_type: formBrainType, brain_project_id: formProjectId || null, updated_at: new Date().toISOString() };
      const { error } = await supabase.from("brainchain_accounts" as any).update(updateData).eq("id", editingAccount.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Conta atualizada");
    } else {
      const data = await callAdmin("upsert_account", payload);
      if (data.error) { toast.error(data.error); return; }
      toast.success(editingAccount ? "Conta atualizada" : "Conta adicionada");
    }
    setDialogOpen(false); resetForm(); loadData();
  };

  const handleToggle = async (id: string, isActive: boolean) => { await callAdmin("toggle_account", { id, is_active: !isActive }); toast.success(isActive ? "Conta desativada" : "Conta ativada"); loadData(); };
  const handleRelease = async (id: string) => { await callAdmin("force_release", { id }); toast.success("Conta liberada"); loadData(); };
  const handleDelete = async (id: string) => { if (!confirm("Excluir esta conta do pool?")) return; await callAdmin("delete_account", { id }); toast.success("Conta removida"); loadData(); };

  if (!isAdmin) {
    return <AppLayout><div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}><p className="body-text">Acesso restrito a administradores.</p></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="rd-page-content" style={{ maxWidth: 1100 }}>
        {/* Header */}
        <div className="rd-page-head" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Brain size={22} style={{ color: "var(--blue-l)" }} />
              <h1>Brainchain — Pool de Contas</h1>
            </div>
            <p className="body-text" style={{ marginTop: 4 }}>Gerencie contas mestres, vincule projetos Brain e monitore o pool.</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="gl sm ghost" onClick={loadData} disabled={loading}>
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Atualizar
            </button>
            <button className="gl sm primary" onClick={openNew}>
              <Plus size={13} /> Adicionar Conta
            </button>
          </div>
        </div>

        {/* Pool Status Cards */}
        {Object.keys(poolStatus).length > 0 && (
          <div className="rd-grid-4" style={{ marginBottom: 20 }}>
            {Object.entries(poolStatus).map(([type, s]) => (
              <div key={type} className="rd-stat-card">
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Server size={14} style={{ color: "var(--blue-l)" }} />
                  <span className="label-lg" style={{ textTransform: "capitalize" }}>{type}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                  <span className="caption-sm">Total: <strong style={{ color: "var(--text-primary)" }}>{s.total}</strong></span>
                  <span className="caption-sm">Ativas: <strong style={{ color: "var(--green-l)" }}>{s.active}</strong></span>
                  <span className="caption-sm">Busy: <strong style={{ color: "var(--orange-l)" }}>{s.busy}</strong></span>
                  <span className="caption-sm">Fila: <strong style={{ color: "var(--orange-l)" }}>{s.queued}</strong></span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Accounts List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {loading && <p className="body-text">Carregando...</p>}
          {!loading && accounts.length === 0 && (
            <div className="rd-card" style={{ padding: 32, textAlign: "center" }}>
              <Brain size={40} style={{ margin: "0 auto 12px", color: "var(--text-quaternary)" }} />
              <p className="body-text">Nenhuma conta cadastrada.</p>
              <p className="caption-sm" style={{ marginTop: 4 }}>Clique em "Adicionar Conta" para começar.</p>
            </div>
          )}
          {accounts.map(acc => (
            <div key={acc.id} className="rd-card" style={{ padding: 16, opacity: acc.is_active ? 1 : 0.5 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span className="label-lg" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{acc.label || acc.email || acc.id.slice(0, 8)}</span>
                    <span className="chip sm" style={{ textTransform: "capitalize" }}>{acc.brain_type}</span>
                    {acc.is_busy && <span className="chip sm ch-red">Busy</span>}
                    {!acc.is_active && <span className="chip sm ch-gray">Inativa</span>}
                    {acc.error_count >= 3 && <span className="chip sm ch-red">Erros: {acc.error_count}</span>}
                  </div>
                  <div className="caption-sm" style={{ display: "flex", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
                    {acc.email && <span>{acc.email}</span>}
                    <span>Reqs: {acc.request_count}</span>
                    {acc.brain_project_id && <span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Projeto: {acc.brain_project_id}</span>}
                    {acc.access_expires_at && (
                      <span style={{ color: new Date(acc.access_expires_at) < new Date() ? "var(--red-l)" : "var(--green-l)" }}>
                        Token: {new Date(acc.access_expires_at) < new Date() ? "expirado" : "válido"}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button className="gl ico xs ghost" onClick={() => openEdit(acc)} title="Editar"><Activity size={14} /></button>
                  {acc.is_busy && <button className="gl ico xs ghost" onClick={() => handleRelease(acc.id)} title="Liberar"><Unlock size={14} style={{ color: "var(--orange-l)" }} /></button>}
                  <button className="gl ico xs ghost" onClick={() => handleToggle(acc.id, acc.is_active)} title={acc.is_active ? "Desativar" : "Ativar"}>
                    {acc.is_active ? <PowerOff size={14} style={{ color: "var(--orange-l)" }} /> : <Power size={14} style={{ color: "var(--green-l)" }} />}
                  </button>
                  <button className="gl ico xs ghost" onClick={() => handleDelete(acc.id)} title="Excluir"><Trash2 size={14} style={{ color: "var(--red-l)" }} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Dialog overlay */}
        {dialogOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={() => setDialogOpen(false)}>
            <div className="rd-card" style={{ maxWidth: 480, width: "90%", padding: 24 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <span className="label-lg">{editingAccount ? "Editar Conta" : "Nova Conta Mestre"}</span>
                <button className="gl ico xs ghost" onClick={() => setDialogOpen(false)}><X size={14} /></button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div><div className="sec-label" style={{ marginBottom: 4 }}>Email</div><input className="rd-input" placeholder="conta@email.com" value={formEmail} onChange={e => setFormEmail(e.target.value)} /></div>
                  <div><div className="sec-label" style={{ marginBottom: 4 }}>Label</div><input className="rd-input" placeholder="conta-01-codigo" value={formLabel} onChange={e => setFormLabel(e.target.value)} /></div>
                </div>
                <div>
                  <div className="sec-label" style={{ marginBottom: 4 }}>Tipo do Brain</div>
                  <select className="rd-input" value={formBrainType} onChange={e => setFormBrainType(e.target.value)}>
                    {BRAIN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <div className="sec-label" style={{ marginBottom: 4 }}>Refresh Token {editingAccount && "(deixe vazio para manter)"}</div>
                  <input className="rd-input" placeholder="Firebase refresh_token" value={formRefreshToken} onChange={e => setFormRefreshToken(e.target.value)} type="password" />
                </div>
                <div>
                  <div className="sec-label" style={{ marginBottom: 4 }}>Access Token (opcional)</div>
                  <input className="rd-input" placeholder="JWT access_token" value={formAccessToken} onChange={e => setFormAccessToken(e.target.value)} type="password" />
                </div>
                <div>
                  <div className="sec-label" style={{ marginBottom: 4 }}>Brain Project ID (UUID do Lovable)</div>
                  <input className="rd-input" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={formProjectId} onChange={e => setFormProjectId(e.target.value)} />
                </div>
                <button className="gl primary" style={{ width: "100%", marginTop: 8 }} onClick={handleSave}>
                  {editingAccount ? "Salvar Alterações" : "Adicionar ao Pool"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
