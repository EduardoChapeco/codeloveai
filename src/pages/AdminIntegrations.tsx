import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus, Key, Trash2, Power, PowerOff, RefreshCw, Loader2,
  AlertTriangle, CheckCircle, Info, ChevronDown, ChevronUp,
  Eye, EyeOff, Zap, Globe, Mic, Brain,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────

interface ApiKey {
  id: string;
  provider: "openrouter" | "gemini" | "firecrawl" | "elevenlabs";
  label: string;
  key_encrypted: string;
  extra_config: Record<string, string>;
  daily_limit: number | null;
  monthly_limit: number | null;
  requests_today: number;
  requests_month: number;
  tokens_today: number;
  tokens_month: number;
  is_active: boolean;
  last_used_at: string | null;
  notes: string | null;
  created_at: string;
}

// ─── Provider Config ──────────────────────────────────────────

const PROVIDERS = {
  openrouter: {
    name: "OpenRouter",
    icon: Brain,
    color: "text-purple-500",
    bg: "bg-purple-500/10 border-purple-400/30",
    badge: "bg-purple-500/20 text-purple-600",
    description: "Orquestrador de IA — 100+ modelos. Usado no Brain, PRD e Orquestrador.",
    fields: [{ key: "api_key", label: "API Key", placeholder: "sk-or-...", secret: true }],
    rateDoc: "https://openrouter.ai/docs",
    limitInfo: "Depende do plano — configure daily_limit por chave.",
  },
  gemini: {
    name: "Google Gemini",
    icon: Zap,
    color: "text-blue-500",
    bg: "bg-blue-500/10 border-blue-400/30",
    badge: "bg-blue-500/20 text-blue-600",
    description: "Chat assistente do sistema (Star AI Suporte). Free: 60 req/min, 1.500/dia.",
    fields: [{ key: "api_key", label: "API Key", placeholder: "AIza...", secret: true }],
    rateDoc: "https://ai.google.dev/pricing",
    limitInfo: "Free tier: 1.500 req/dia. Recomendado: daily_limit = 1400.",
  },
  firecrawl: {
    name: "Firecrawl (StarCrawl)",
    icon: Globe,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10 border-emerald-400/30",
    badge: "bg-emerald-500/20 text-emerald-600",
    description: "Raspagem e mineração de dados. Apresentado ao cliente como StarCrawl.",
    fields: [{ key: "api_key", label: "API Key", placeholder: "fc-...", secret: true }],
    rateDoc: "https://docs.firecrawl.dev",
    limitInfo: "Free: 500 créditos/mês. Recomendado: monthly_limit = 480.",
  },
  elevenlabs: {
    name: "ElevenLabs",
    icon: Mic,
    color: "text-amber-500",
    bg: "bg-amber-500/10 border-amber-400/30",
    badge: "bg-amber-500/20 text-amber-600",
    description: "TTS — Respostas por voz do sistema. Free: 10.000 caracteres/mês.",
    fields: [
      { key: "api_key", label: "API Key", placeholder: "sk_...", secret: true },
      { key: "voice_id", label: "Voice ID (padrão)", placeholder: "21m00Tc...", secret: false },
    ],
    rateDoc: "https://elevenlabs.io/docs",
    limitInfo: "Free: 10k chars/mês. Cada resposta ~200-500 chars.",
  },
} as const;

type Provider = keyof typeof PROVIDERS;

// ─── Status Badge ─────────────────────────────────────────────

function UsageBadge({ key: k }: { key: any }) {
  const pct = k.daily_limit ? (k.requests_today / k.daily_limit) * 100 : 0;
  if (!k.is_active) return (
    <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
      Desativada
    </span>
  );
  if (pct >= 95) return (
    <span className="text-[10px] bg-red-500/15 text-red-600 px-2 py-0.5 rounded-full flex items-center gap-1">
      <AlertTriangle className="h-3 w-3" />Esgotada
    </span>
  );
  if (pct >= 75) return (
    <span className="text-[10px] bg-amber-500/15 text-amber-600 px-2 py-0.5 rounded-full flex items-center gap-1">
      <AlertTriangle className="h-3 w-3" />Próximo do limite
    </span>
  );
  return (
    <span className="text-[10px] bg-emerald-500/15 text-emerald-600 px-2 py-0.5 rounded-full flex items-center gap-1">
      <CheckCircle className="h-3 w-3" />OK
    </span>
  );
}

// ─── Add Key Modal ────────────────────────────────────────────

interface AddKeyModalProps {
  provider: Provider;
  onSave: (data: Partial<ApiKey>) => Promise<void>;
  onClose: () => void;
}

function AddKeyModal({ provider, onSave, onClose }: AddKeyModalProps) {
  const cfg = PROVIDERS[provider];
  const [label, setLabel] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [dailyLimit, setDailyLimit] = useState("");
  const [monthlyLimit, setMonthlyLimit] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const handleSave = async () => {
    const mainKey = fieldValues["api_key"];
    if (!label.trim() || !mainKey?.trim()) return toast.error("Preencha o label e a API Key.");
    setSaving(true);
    const extraConfig: Record<string, string> = {};
    for (const f of cfg.fields) {
      if (f.key !== "api_key" && fieldValues[f.key]) extraConfig[f.key] = fieldValues[f.key];
    }
    await onSave({
      provider,
      label: label.trim(),
      key_encrypted: mainKey.trim(),
      extra_config: extraConfig,
      daily_limit: dailyLimit ? parseInt(dailyLimit) : null,
      monthly_limit: monthlyLimit ? parseInt(monthlyLimit) : null,
      notes: notes.trim() || null,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className={`border-b border-border/50 px-6 py-4 rounded-t-2xl border ${cfg.bg}`}>
          <div className="flex items-center gap-2">
            <cfg.icon className={`h-4 w-4 ${cfg.color}`} />
            <p className="font-semibold text-sm">{cfg.name} — Nova Chave</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{cfg.description}</p>
        </div>

        <div className="p-6 space-y-4">
          {/* Label */}
          <div>
            <label className="text-xs font-medium mb-1 block">Label / Apelido</label>
            <input
              className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="ex: Conta Principal, Backup 1..."
              value={label}
              onChange={e => setLabel(e.target.value)}
            />
          </div>

          {/* Dynamic fields per provider */}
          {cfg.fields.map(f => (
            <div key={f.key}>
              <label className="text-xs font-medium mb-1 block">{f.label}</label>
              <div className="relative">
                <input
                  type={f.secret && !showSecrets[f.key] ? "password" : "text"}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm pr-9 focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
                  placeholder={f.placeholder}
                  value={fieldValues[f.key] || ""}
                  onChange={e => setFieldValues(v => ({ ...v, [f.key]: e.target.value }))}
                />
                {f.secret && (
                  <button
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowSecrets(s => ({ ...s, [f.key]: !s[f.key] }))}
                  >
                    {showSecrets[f.key] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Limits */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Limite diário (req)</label>
              <input
                type="number"
                className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Deixe vazio = sem limite"
                value={dailyLimit}
                onChange={e => setDailyLimit(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Limite mensal (req)</label>
              <input
                type="number"
                className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Deixe vazio = sem limite"
                value={monthlyLimit}
                onChange={e => setMonthlyLimit(e.target.value)}
              />
            </div>
          </div>

          {/* Limit info */}
          <div className="flex items-start gap-2 bg-muted/30 rounded-lg px-3 py-2">
            <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground">{cfg.limitInfo}</p>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium mb-1 block">Notas (opcional)</label>
            <input
              className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Conta pessoal, expira em 2026-06..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {/* Doc link */}
          <a
            href={cfg.rateDoc}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-primary hover:underline"
          >
            📄 Documentação e limites do {cfg.name} ↗
          </a>
        </div>

        <div className="px-6 pb-6 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg text-sm font-medium bg-muted hover:bg-muted/80 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-9 px-4 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Salvar Chave
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Provider Section ─────────────────────────────────────────

function ProviderSection({
  provider,
  keys,
  onAdd,
  onToggle,
  onDelete,
  onRefreshUsage,
}: {
  provider: Provider;
  keys: ApiKey[];
  onAdd: (provider: Provider) => void;
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
  onRefreshUsage: () => void;
}) {
  const cfg = PROVIDERS[provider];
  const [expanded, setExpanded] = useState(true);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const activeKeys = keys.filter(k => k.is_active);
  const exhausted  = activeKeys.filter(k => k.daily_limit && k.requests_today >= k.daily_limit);

  return (
    <div className={`rounded-2xl border overflow-hidden ${cfg.bg}`}>
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-black/5 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <cfg.icon className={`h-5 w-5 ${cfg.color} shrink-0`} />
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{cfg.name}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>
              {activeKeys.length} ativa{activeKeys.length !== 1 ? "s" : ""}
            </span>
            {exhausted.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-500/15 text-red-600">
                {exhausted.length} esgotada{exhausted.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{cfg.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={e => { e.stopPropagation(); onAdd(provider); }}
            className="h-7 w-7 flex items-center justify-center rounded-lg bg-background/80 border border-border hover:bg-background transition-colors"
            title="Adicionar nova chave"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Keys list */}
      {expanded && (
        <div className="border-t border-white/10">
          {keys.length === 0 ? (
            <div className="px-5 py-6 text-center">
              <Key className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Nenhuma chave configurada</p>
              <button
                onClick={() => onAdd(provider)}
                className="mt-3 h-8 px-4 rounded-lg text-xs font-medium bg-background border border-border hover:bg-muted transition-colors flex items-center gap-1.5 mx-auto"
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar Chave
              </button>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {keys.map(k => (
                <div key={k.id} className={`px-5 py-3.5 flex items-center gap-3 ${!k.is_active ? "opacity-50" : ""}`}>
                  {/* Key label + masked value */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{k.label}</span>
                      <UsageBadge key={k.id} />
                    </div>

                    {/* Masked key */}
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {showKeys[k.id]
                          ? k.key_encrypted
                          : k.key_encrypted.slice(0, 6) + "••••••••" + k.key_encrypted.slice(-4)
                        }
                      </span>
                      <button onClick={() => setShowKeys(s => ({ ...s, [k.id]: !s[k.id] }))}>
                        {showKeys[k.id]
                          ? <EyeOff className="h-3 w-3 text-muted-foreground" />
                          : <Eye className="h-3 w-3 text-muted-foreground" />
                        }
                      </button>
                    </div>

                    {/* Usage stats */}
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-muted-foreground">
                        Hoje: <strong>{k.requests_today}</strong>
                        {k.daily_limit ? `/${k.daily_limit}` : ""}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Mês: <strong>{k.requests_month}</strong>
                        {k.monthly_limit ? `/${k.monthly_limit}` : ""}
                      </span>
                      {k.daily_limit && (
                        <div className="flex-1 h-1 bg-black/10 rounded-full overflow-hidden max-w-[80px]">
                          <div
                            className={`h-full rounded-full transition-all ${
                              k.requests_today / k.daily_limit >= 0.95 ? "bg-red-500"
                              : k.requests_today / k.daily_limit >= 0.75 ? "bg-amber-500"
                              : "bg-emerald-500"
                            }`}
                            style={{ width: `${Math.min(100, (k.requests_today / k.daily_limit) * 100)}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {k.last_used_at && (
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                        Último uso: {new Date(k.last_used_at).toLocaleString("pt-BR")}
                      </p>
                    )}
                    {k.notes && <p className="text-[10px] text-muted-foreground italic mt-0.5">{k.notes}</p>}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => onToggle(k.id, !k.is_active)}
                      title={k.is_active ? "Desativar" : "Ativar"}
                      className="h-7 w-7 flex items-center justify-center rounded-lg bg-background/60 border border-border hover:bg-background transition-colors"
                    >
                      {k.is_active
                        ? <Power className="h-3 w-3 text-emerald-500" />
                        : <PowerOff className="h-3 w-3 text-muted-foreground" />
                      }
                    </button>
                    <button
                      onClick={() => onDelete(k.id)}
                      title="Excluir"
                      className="h-7 w-7 flex items-center justify-center rounded-lg bg-background/60 border border-red-400/30 hover:bg-red-500/10 hover:border-red-400/60 transition-colors"
                    >
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer stats */}
          {keys.length > 0 && (
            <div className="border-t border-white/10 px-5 py-2.5 flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">
                {activeKeys.length} ativa{activeKeys.length !== 1 ? "s" : ""} de {keys.length} — rotação automática por uso
              </p>
              <button
                onClick={onRefreshUsage}
                className="h-6 w-6 flex items-center justify-center rounded hover:bg-black/10 transition-colors"
                title="Atualizar dados"
              >
                <RefreshCw className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────

export default function AdminIntegrations() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingFor, setAddingFor] = useState<Provider | null>(null);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    // Admin reads api_keys via service-role edge function call
    // Since api_keys has no RLS public policy, we call through the admin endpoint
    const { data, error } = await supabase.functions.invoke("api-key-router", {
      body: { action: "list_all" },
    });
    if (!error && Array.isArray(data?.keys)) {
      setKeys(data.keys as ApiKey[]);
    } else {
      // Fallback: try direct fetch (works only if admin secret is passed)
      // For now, show empty state — keys are managed via Edge Functions
      setKeys([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const handleAdd = async (payload: Partial<ApiKey>) => {
    const { error } = await supabase.functions.invoke("api-key-router", {
      body: { action: "add", ...payload },
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Chave adicionada com sucesso!");
    setAddingFor(null);
    fetchKeys();
  };

  const handleToggle = async (id: string, active: boolean) => {
    const { error } = await supabase.functions.invoke("api-key-router", {
      body: { action: "toggle", id, is_active: active },
    });
    if (error) return toast.error(error.message);
    toast.success(active ? "Chave ativada" : "Chave desativada");
    setKeys(prev => prev.map(k => k.id === id ? { ...k, is_active: active } : k));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta chave de API? Esta ação é irreversível.")) return;
    const { error } = await supabase.functions.invoke("api-key-router", {
      body: { action: "delete", id },
    });
    if (error) return toast.error(error.message);
    toast.success("Chave excluída");
    setKeys(prev => prev.filter(k => k.id !== id));
  };

  const keysByProvider = (provider: Provider) =>
    keys.filter(k => k.provider === provider);

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Key className="h-5 w-5" /> Integrações — Orquestrador de Chaves de API
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie múltiplas chaves por provedor. O sistema rotaciona automaticamente entre elas conforme o uso, nunca ultrapassando os limites configurados.
        </p>
      </div>

      {/* How it works banner */}
      <div className="rounded-xl bg-muted/40 border border-border/60 px-5 py-4">
        <p className="text-xs font-semibold mb-2">Como funciona o orquestrador</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] text-muted-foreground">
          <div className="flex items-start gap-2">
            <span className="text-primary font-bold">1.</span>
            Quando o sistema precisa chamar uma API (Gemini, OpenRouter etc.), consulta o orquestrador
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary font-bold">2.</span>
            O orquestrador seleciona a chave com menor uso do dia (load balance automático)
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary font-bold">3.</span>
            Se todas as chaves atingiram o limite, o sistema pausa e alerta — nunca ultrapassa
          </div>
        </div>
      </div>

      {/* Provider sections */}
      {(Object.keys(PROVIDERS) as Provider[]).map(provider => (
        <ProviderSection
          key={provider}
          provider={provider}
          keys={keysByProvider(provider)}
          onAdd={setAddingFor}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onRefreshUsage={fetchKeys}
        />
      ))}

      {/* Add Key Modal */}
      {addingFor && (
        <AddKeyModal
          provider={addingFor}
          onSave={handleAdd}
          onClose={() => setAddingFor(null)}
        />
      )}
    </div>
  );
}
