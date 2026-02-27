import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Key, Plus, Trash2, ToggleLeft, ToggleRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ApiKeyEntry {
  id: string;
  provider: string;
  label: string;
  api_key_masked: string;
  is_active: boolean;
  requests_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

const PROVIDERS = [
  { value: "firecrawl", label: "Firecrawl", color: "text-orange-400" },
  { value: "elevenlabs", label: "ElevenLabs", color: "text-purple-400" },
  { value: "gemini", label: "Google Gemini", color: "text-blue-400" },
  { value: "openrouter", label: "OpenRouter", color: "text-green-400" },
  { value: "openai", label: "OpenAI", color: "text-emerald-400" },
  { value: "anthropic", label: "Anthropic", color: "text-amber-400" },
  { value: "custom", label: "Custom", color: "text-muted-foreground" },
];

export default function ApiKeysManagementTab() {
  const [keys, setKeys] = useState<ApiKeyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  

  // New key form
  const [newProvider, setNewProvider] = useState("firecrawl");
  const [newLabel, setNewLabel] = useState("");
  const [newApiKey, setNewApiKey] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchKeys = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("api_key_vault_safe")
      .select("*")
      .order("provider", { ascending: true });
    if (error) {
      toast.error("Erro ao carregar chaves");
    }
    setKeys((data as ApiKeyEntry[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const addKey = async () => {
    if (!newApiKey.trim()) return toast.error("Informe a API Key");
    setSaving(true);
    const { error } = await (supabase as any).from("api_key_vault").insert({
      provider: newProvider,
      label: newLabel.trim() || `${newProvider}-${Date.now().toString(36)}`,
      api_key_encrypted: newApiKey.trim(),
      is_active: true,
    });
    setSaving(false);
    if (error) return toast.error("Erro ao salvar: " + error.message);
    toast.success("Chave adicionada!");
    setNewApiKey("");
    setNewLabel("");
    fetchKeys();
  };

  const toggleActive = async (id: string, current: boolean) => {
    await (supabase as any).from("api_key_vault").update({ is_active: !current }).eq("id", id);
    toast.success(current ? "Chave desativada" : "Chave ativada");
    fetchKeys();
  };

  const deleteKey = async (id: string) => {
    await (supabase as any).from("api_key_vault").delete().eq("id", id);
    toast.success("Chave removida");
    fetchKeys();
  };

  const maskKey = (key: string) => {
    if (!key || key.length <= 4) return "••••••••";
    return "••••••••" + key.slice(-4);
  };

  const getProviderInfo = (provider: string) =>
    PROVIDERS.find(p => p.value === provider) || { value: provider, label: provider, color: "text-muted-foreground" };

  return (
    <div className="space-y-6">
      {/* Add new key */}
      <div className="lv-card">
        <p className="lv-overline mb-4">Adicionar Nova Chave</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="lv-caption block mb-1">Provider</label>
            <select
              className="lv-input w-full"
              value={newProvider}
              onChange={e => setNewProvider(e.target.value)}
            >
              {PROVIDERS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="lv-caption block mb-1">Label (opcional)</label>
            <input
              className="lv-input w-full"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="ex: prod-key-1"
            />
          </div>
          <div>
            <label className="lv-caption block mb-1">API Key</label>
            <input
              className="lv-input w-full font-mono text-xs"
              value={newApiKey}
              onChange={e => setNewApiKey(e.target.value)}
              placeholder="sk-..."
              type="password"
            />
          </div>
          <button
            onClick={addKey}
            disabled={saving}
            className="lv-btn-primary h-10 text-sm flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Adicionar
          </button>
        </div>
      </div>

      {/* Keys list */}
      <div className="lv-card">
        <div className="flex items-center justify-between mb-4">
          <p className="lv-overline">Chaves Cadastradas ({keys.length})</p>
          <button onClick={fetchKeys} className="lv-btn-secondary h-8 px-3 text-xs">
            Atualizar
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : keys.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            Nenhuma chave cadastrada. Adicione acima.
          </p>
        ) : (
          <div className="space-y-3">
            {keys.map(k => {
              const prov = getProviderInfo(k.provider);
              return (
                <div key={k.id} className="flex items-center gap-4 p-3 rounded-lg border border-border/60 bg-card/50">
                  {/* Provider badge */}
                  <div className="shrink-0">
                    <span className={`text-xs font-semibold uppercase tracking-wider ${prov.color}`}>
                      {prov.label}
                    </span>
                  </div>

                  {/* Label */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{k.label}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {maskKey(k.api_key_masked || "")}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="shrink-0 text-right hidden md:block">
                    <p className="text-xs text-muted-foreground">{k.requests_count} reqs</p>
                    <p className="text-xs text-muted-foreground">
                      {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString("pt-BR") : "nunca usado"}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleActive(k.id, k.is_active)}
                      className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted"
                      title={k.is_active ? "Desativar" : "Ativar"}
                    >
                      {k.is_active
                        ? <ToggleRight className="h-4 w-4 text-green-400" />
                        : <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                      }
                    </button>
                    <button
                      onClick={() => deleteKey(k.id)}
                      className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted text-destructive"
                      title="Remover"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="lv-card bg-muted/30">
        <p className="lv-overline mb-2">Como funciona</p>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li>As chaves são usadas pelas Edge Functions para acessar serviços externos (Firecrawl, ElevenLabs, Gemini, OpenRouter, etc).</li>
          <li>Ative/desative chaves para controlar qual provider está em uso.</li>
          <li>Use múltiplas chaves do mesmo provider para load balancing ou fallback.</li>
          <li>As chaves são armazenadas de forma segura no banco de dados com RLS restrito a administradores.</li>
        </ul>
      </div>
    </div>
  );
}
