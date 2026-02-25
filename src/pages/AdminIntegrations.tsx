import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus, Key, Trash2, Power, PowerOff, RefreshCw, Loader2,
  AlertTriangle, CheckCircle, Info, ChevronDown, ChevronUp,
  Eye, EyeOff, Zap, Globe, Mic, Brain, Mail, Send,
  FileText, Clock, Check, X,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────

interface ApiKey {
  id: string;
  provider: string;
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

interface EmailTemplate {
  id: string;
  name: string;
  slug: string;
  subject: string;
  html_body: string;
  description: string;
  variables: string[];
  is_active: boolean;
  created_at: string;
}

interface EmailLog {
  id: string;
  template_slug: string | null;
  to_email: string;
  to_name: string | null;
  subject: string;
  status: string;
  resend_id: string | null;
  error_message: string | null;
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
  resend: {
    name: "Resend (Email)",
    icon: Mail,
    color: "text-rose-500",
    bg: "bg-rose-500/10 border-rose-400/30",
    badge: "bg-rose-500/20 text-rose-600",
    description: "Envio de emails transacionais — boas-vindas, notificações, faturas e mais.",
    fields: [
      { key: "api_key", label: "API Key", placeholder: "re_...", secret: true },
      { key: "from_email", label: "Email remetente", placeholder: "noreply@seudominio.com", secret: false },
    ],
    rateDoc: "https://resend.com/docs",
    limitInfo: "Free: 100 emails/dia, 3.000/mês. Domínio verificado recomendado.",
  },
} as const;

type Provider = keyof typeof PROVIDERS;

// ─── Status Badge ─────────────────────────────────────────────

function UsageBadge({ apiKey }: { apiKey: ApiKey }) {
  const pct = apiKey.daily_limit ? (apiKey.requests_today / apiKey.daily_limit) * 100 : 0;
  if (!apiKey.is_active) return (
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
        <div className={`border-b border-border/50 px-6 py-4 rounded-t-2xl border ${cfg.bg}`}>
          <div className="flex items-center gap-2">
            <cfg.icon className={`h-4 w-4 ${cfg.color}`} />
            <p className="font-semibold text-sm">{cfg.name} — Nova Chave</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{cfg.description}</p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-medium mb-1 block">Label / Apelido</label>
            <input
              className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="ex: Conta Principal, Backup 1..."
              value={label}
              onChange={e => setLabel(e.target.value)}
            />
          </div>

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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Limite diário (req)</label>
              <input
                type="number"
                className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Sem limite"
                value={dailyLimit}
                onChange={e => setDailyLimit(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Limite mensal (req)</label>
              <input
                type="number"
                className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Sem limite"
                value={monthlyLimit}
                onChange={e => setMonthlyLimit(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-start gap-2 bg-muted/30 rounded-lg px-3 py-2">
            <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground">{cfg.limitInfo}</p>
          </div>

          <div>
            <label className="text-xs font-medium mb-1 block">Notas (opcional)</label>
            <input
              className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Conta pessoal, expira em 2026-06..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <a href={cfg.rateDoc} target="_blank" rel="noopener noreferrer"
            className="text-[11px] text-primary hover:underline">
            📄 Documentação e limites do {cfg.name} ↗
          </a>
        </div>

        <div className="px-6 pb-6 flex gap-2 justify-end">
          <button onClick={onClose}
            className="h-9 px-4 rounded-lg text-sm font-medium bg-muted hover:bg-muted/80 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="h-9 px-4 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5">
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
  provider, keys, onAdd, onToggle, onDelete, onRefreshUsage,
}: {
  provider: Provider; keys: ApiKey[];
  onAdd: (p: Provider) => void; onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void; onRefreshUsage: () => void;
}) {
  const cfg = PROVIDERS[provider];
  const [expanded, setExpanded] = useState(true);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const activeKeys = keys.filter(k => k.is_active);
  const exhausted = activeKeys.filter(k => k.daily_limit && k.requests_today >= k.daily_limit);

  return (
    <div className={`rounded-2xl border overflow-hidden ${cfg.bg}`}>
      <button className="w-full flex items-center gap-3 px-5 py-4 hover:bg-black/5 transition-colors"
        onClick={() => setExpanded(e => !e)}>
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
          <button onClick={e => { e.stopPropagation(); onAdd(provider); }}
            className="h-7 w-7 flex items-center justify-center rounded-lg bg-background/80 border border-border hover:bg-background transition-colors"
            title="Adicionar nova chave">
            <Plus className="h-3.5 w-3.5" />
          </button>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/10">
          {keys.length === 0 ? (
            <div className="px-5 py-6 text-center">
              <Key className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Nenhuma chave configurada</p>
              <button onClick={() => onAdd(provider)}
                className="mt-3 h-8 px-4 rounded-lg text-xs font-medium bg-background border border-border hover:bg-muted transition-colors flex items-center gap-1.5 mx-auto">
                <Plus className="h-3.5 w-3.5" /> Adicionar Chave
              </button>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {keys.map(k => (
                <div key={k.id} className={`px-5 py-3.5 flex items-center gap-3 ${!k.is_active ? "opacity-50" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{k.label}</span>
                      <UsageBadge apiKey={k} />
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {showKeys[k.id] ? k.key_encrypted : k.key_encrypted.slice(0, 6) + "••••••••" + k.key_encrypted.slice(-4)}
                      </span>
                      <button onClick={() => setShowKeys(s => ({ ...s, [k.id]: !s[k.id] }))}>
                        {showKeys[k.id] ? <EyeOff className="h-3 w-3 text-muted-foreground" /> : <Eye className="h-3 w-3 text-muted-foreground" />}
                      </button>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-muted-foreground">
                        Hoje: <strong>{k.requests_today}</strong>{k.daily_limit ? `/${k.daily_limit}` : ""}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Mês: <strong>{k.requests_month}</strong>{k.monthly_limit ? `/${k.monthly_limit}` : ""}
                      </span>
                      {k.daily_limit && (
                        <div className="flex-1 h-1 bg-black/10 rounded-full overflow-hidden max-w-[80px]">
                          <div className={`h-full rounded-full transition-all ${
                            k.requests_today / k.daily_limit >= 0.95 ? "bg-red-500"
                            : k.requests_today / k.daily_limit >= 0.75 ? "bg-amber-500"
                            : "bg-emerald-500"
                          }`} style={{ width: `${Math.min(100, (k.requests_today / k.daily_limit) * 100)}%` }} />
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
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => onToggle(k.id, !k.is_active)}
                      title={k.is_active ? "Desativar" : "Ativar"}
                      className="h-7 w-7 flex items-center justify-center rounded-lg bg-background/60 border border-border hover:bg-background transition-colors">
                      {k.is_active ? <Power className="h-3 w-3 text-emerald-500" /> : <PowerOff className="h-3 w-3 text-muted-foreground" />}
                    </button>
                    <button onClick={() => onDelete(k.id)} title="Excluir"
                      className="h-7 w-7 flex items-center justify-center rounded-lg bg-background/60 border border-red-400/30 hover:bg-red-500/10 hover:border-red-400/60 transition-colors">
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {keys.length > 0 && (
            <div className="border-t border-white/10 px-5 py-2.5 flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">
                {activeKeys.length} ativa{activeKeys.length !== 1 ? "s" : ""} de {keys.length} — rotação automática por uso
              </p>
              <button onClick={onRefreshUsage}
                className="h-6 w-6 flex items-center justify-center rounded hover:bg-black/10 transition-colors" title="Atualizar dados">
                <RefreshCw className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Email Panel ──────────────────────────────────────────────

function EmailPanel() {
  const [tab, setTab] = useState<"templates" | "send" | "logs">("templates");
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Send form
  const [sendTo, setSendTo] = useState("");
  const [sendSubject, setSendSubject] = useState("");
  const [sendTemplate, setSendTemplate] = useState("");
  const [sendVars, setSendVars] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  const fetchTemplates = useCallback(async () => {
    const { data } = await supabase.functions.invoke("send-email", {
      body: { action: "list_templates" },
    });
    if (data?.templates) setTemplates(data.templates);
  }, []);

  const fetchLogs = useCallback(async () => {
    const { data } = await supabase.functions.invoke("send-email", {
      body: { action: "list_logs", limit: 50 },
    });
    if (data?.logs) setLogs(data.logs);
  }, []);

  useEffect(() => {
    fetchTemplates();
    fetchLogs();
  }, [fetchTemplates, fetchLogs]);

  const testConnection = async () => {
    setLoading(true);
    setTestResult(null);
    const { data, error } = await supabase.functions.invoke("send-email", {
      body: { action: "test_connection" },
    });
    setLoading(false);
    if (error || !data?.ok) {
      setTestResult(`❌ Erro: ${data?.error || error?.message || "Falha"}`);
    } else {
      const domains = data.domains?.map((d: any) => d.name).join(", ") || "nenhum";
      setTestResult(`✅ Conexão OK! Domínios: ${domains}`);
    }
  };

  const handleSend = async () => {
    if (!sendTo) return toast.error("Informe o email destinatário");
    setSending(true);
    const body: Record<string, unknown> = { to: sendTo };
    if (sendTemplate) {
      body.template = sendTemplate;
      body.variables = sendVars;
    } else {
      if (!sendSubject) { setSending(false); return toast.error("Informe o assunto"); }
      body.subject = sendSubject;
      body.html = `<p>${sendSubject}</p>`;
    }
    const { data, error } = await supabase.functions.invoke("send-email", { body });
    setSending(false);
    if (error || !data?.ok) {
      toast.error(data?.error || error?.message || "Erro ao enviar");
    } else {
      toast.success("Email enviado com sucesso!");
      setSendTo(""); setSendSubject(""); setSendTemplate(""); setSendVars({});
      fetchLogs();
    }
  };

  const selectedTpl = templates.find(t => t.slug === sendTemplate);

  return (
    <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-rose-500" />
          <span className="font-semibold text-sm">Sistema de Emails (Resend)</span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          Gerencie templates, envie emails e monitore entregas.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        {[
          { id: "templates" as const, label: "Templates", icon: FileText },
          { id: "send" as const, label: "Enviar", icon: Send },
          { id: "logs" as const, label: "Logs", icon: Clock },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors ${
              tab === t.id ? "bg-rose-500/20 text-rose-600 border-b-2 border-rose-500" : "text-muted-foreground hover:text-foreground"
            }`}>
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-5">
        {/* Test connection */}
        <div className="flex items-center gap-2 mb-4">
          <button onClick={testConnection} disabled={loading}
            className="h-8 px-3 rounded-lg text-xs font-medium bg-background border border-border hover:bg-muted transition-colors flex items-center gap-1.5 disabled:opacity-50">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
            Testar Conexão Resend
          </button>
          {testResult && <span className="text-xs">{testResult}</span>}
        </div>

        {/* Templates Tab */}
        {tab === "templates" && (
          <div className="space-y-3">
            {templates.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum template encontrado</p>
            ) : templates.map(t => (
              <div key={t.id} className="bg-background/60 rounded-xl border border-border/50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{t.name}</span>
                      <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">{t.slug}</span>
                      {t.is_active ? (
                        <span className="text-[10px] bg-emerald-500/15 text-emerald-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Check className="h-2.5 w-2.5" />Ativo
                        </span>
                      ) : (
                        <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Inativo</span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{t.description}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Assunto: <span className="font-mono">{t.subject}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Variáveis: {(t.variables || []).map(v => `{{${v}}}`).join(", ") || "nenhuma"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Send Tab */}
        {tab === "send" && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium mb-1 block">Destinatário</label>
              <input type="email" className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="email@exemplo.com" value={sendTo} onChange={e => setSendTo(e.target.value)} />
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block">Template (opcional)</label>
              <select className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={sendTemplate} onChange={e => { setSendTemplate(e.target.value); setSendVars({}); }}>
                <option value="">— Envio direto (sem template) —</option>
                {templates.filter(t => t.is_active).map(t => (
                  <option key={t.slug} value={t.slug}>{t.name} ({t.slug})</option>
                ))}
              </select>
            </div>

            {sendTemplate && selectedTpl ? (
              <div className="space-y-2">
                <p className="text-xs font-medium">Variáveis do template:</p>
                {(selectedTpl.variables || []).map(v => (
                  <div key={v}>
                    <label className="text-[11px] text-muted-foreground mb-0.5 block">{`{{${v}}}`}</label>
                    <input className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder={v} value={sendVars[v] || ""} onChange={e => setSendVars(prev => ({ ...prev, [v]: e.target.value }))} />
                  </div>
                ))}
              </div>
            ) : !sendTemplate ? (
              <div>
                <label className="text-xs font-medium mb-1 block">Assunto</label>
                <input className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Assunto do email" value={sendSubject} onChange={e => setSendSubject(e.target.value)} />
              </div>
            ) : null}

            <button onClick={handleSend} disabled={sending}
              className="h-9 px-4 rounded-lg text-sm font-medium bg-rose-500 text-white hover:bg-rose-600 transition-colors disabled:opacity-50 flex items-center gap-1.5">
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Enviar Email
            </button>
          </div>
        )}

        {/* Logs Tab */}
        {tab === "logs" && (
          <div className="space-y-2">
            <div className="flex justify-end mb-2">
              <button onClick={fetchLogs}
                className="h-7 px-2 rounded text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1">
                <RefreshCw className="h-3 w-3" /> Atualizar
              </button>
            </div>
            {logs.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum email enviado ainda</p>
            ) : logs.map(l => (
              <div key={l.id} className="bg-background/60 rounded-lg border border-border/50 px-4 py-2.5 flex items-center gap-3">
                <div className="shrink-0">
                  {l.status === "sent" ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <X className="h-4 w-4 text-red-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium truncate">{l.to_email}</span>
                    {l.template_slug && (
                      <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">{l.template_slug}</span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{l.subject}</p>
                  {l.error_message && <p className="text-[10px] text-red-500 truncate">{l.error_message}</p>}
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {new Date(l.created_at).toLocaleString("pt-BR")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
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
    const { data, error } = await supabase.functions.invoke("api-key-router", {
      body: { action: "list_all" },
    });
    if (!error && Array.isArray(data?.keys)) {
      setKeys(data.keys as ApiKey[]);
    } else {
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

  const keysByProvider = (provider: Provider) => keys.filter(k => k.provider === provider);

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Key className="h-5 w-5" /> Integrações — Orquestrador de Chaves de API
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie múltiplas chaves por provedor. O sistema rotaciona automaticamente entre elas conforme o uso.
        </p>
      </div>

      <div className="rounded-xl bg-muted/40 border border-border/60 px-5 py-4">
        <p className="text-xs font-semibold mb-2">Como funciona o orquestrador</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] text-muted-foreground">
          <div className="flex items-start gap-2">
            <span className="text-primary font-bold">1.</span>
            Quando o sistema precisa chamar uma API, consulta o orquestrador
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary font-bold">2.</span>
            O orquestrador seleciona a chave com menor uso do dia (load balance)
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary font-bold">3.</span>
            Se todas atingiram o limite, o sistema pausa e alerta — nunca ultrapassa
          </div>
        </div>
      </div>

      {(Object.keys(PROVIDERS) as Provider[]).map(provider => (
        <ProviderSection key={provider} provider={provider} keys={keysByProvider(provider)}
          onAdd={setAddingFor} onToggle={handleToggle} onDelete={handleDelete} onRefreshUsage={fetchKeys} />
      ))}

      {/* Email System Panel */}
      <EmailPanel />

      {addingFor && (
        <AddKeyModal provider={addingFor} onSave={handleAdd} onClose={() => setAddingFor(null)} />
      )}
    </div>
  );
}
