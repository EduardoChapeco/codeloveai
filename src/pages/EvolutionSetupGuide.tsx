import { useState, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import {
  ChevronRight, ChevronDown, Copy, Check, ExternalLink,
  Server, Database, Key, Zap, Terminal,
  ArrowRight, AlertTriangle, CheckCircle2, Info, Globe,
  Lightbulb, FileDown, ArrowLeft, Sparkles, Loader2, Smartphone, Wifi
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

/* ── Reusable sub-components ── */

function Step({ number, title, children, isActive, isComplete, onClick }: {
  number: number; title: string; children: React.ReactNode; isActive: boolean; isComplete: boolean; onClick: () => void;
}) {
  return (
    <div className={`rounded-2xl border transition-all ${
      isActive ? "border-primary/30 bg-primary/[0.03]" : isComplete ? "border-emerald-500/20 bg-emerald-500/[0.02]" : "border-white/[0.06] bg-white/[0.02]"
    }`} style={{ backdropFilter: "blur(40px) saturate(180%)" }}>
      <button onClick={onClick} className="w-full flex items-center gap-4 p-5 text-left">
        <div className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 font-black text-sm ${
          isComplete ? "bg-emerald-500/20 text-emerald-400" : isActive ? "bg-primary/20 text-primary" : "bg-white/[0.06] text-muted-foreground"
        }`}>
          {isComplete ? <CheckCircle2 className="h-5 w-5" /> : number}
        </div>
        <span className={`text-base font-bold flex-1 ${isActive || isComplete ? "text-foreground" : "text-muted-foreground"}`}>{title}</span>
        {isActive ? <ChevronDown className="h-5 w-5 text-primary" /> : <ChevronRight className="h-5 w-5 text-muted-foreground/40" />}
      </button>
      {isActive && <div className="px-5 pb-6 pt-0 space-y-4">{children}</div>}
    </div>
  );
}

function CopyBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Copiado!");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="rounded-xl border border-white/[0.08] overflow-hidden">
      {label && (
        <div className="px-4 py-2 bg-white/[0.04] border-b border-white/[0.06] flex items-center justify-between">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</span>
          <button onClick={copy} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
      )}
      <pre className="p-4 overflow-x-auto text-xs font-mono text-foreground/80 bg-black/30 leading-relaxed whitespace-pre-wrap">{code}</pre>
    </div>
  );
}

function InfoBox({ children, type = "info" }: { children: React.ReactNode; type?: "info" | "warn" | "success" }) {
  const styles = {
    info: { bg: "bg-blue-500/10 border-blue-500/20", icon: <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" /> },
    warn: { bg: "bg-amber-500/10 border-amber-500/20", icon: <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /> },
    success: { bg: "bg-emerald-500/10 border-emerald-500/20", icon: <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /> },
  };
  const s = styles[type];
  return (
    <div className={`flex gap-3 p-4 rounded-xl border ${s.bg}`}>
      {s.icon}
      <div className="text-xs text-foreground/80 leading-relaxed">{children}</div>
    </div>
  );
}

function LinkButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-2 h-11 px-5 rounded-2xl bg-primary/10 text-primary text-sm font-bold hover:bg-primary/20 transition-colors border border-primary/20">
      {children}
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}

function SmartInput({ label, placeholder, value, onChange, hint }: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
        <Key className="h-3 w-3 text-primary" /> {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-10 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/30 transition-all font-mono text-xs"
      />
      {hint && <p className="text-[10px] text-muted-foreground/60">{hint}</p>}
    </div>
  );
}

function PromptSuggestion({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    toast.success("Prompt copiado!");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.06] p-3 flex gap-3 items-start cursor-pointer hover:bg-violet-500/[0.1] transition-colors" onClick={copy}>
      <Sparkles className="h-4 w-4 text-violet-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-violet-300 uppercase tracking-wider mb-1">💡 Prompt sugerido para Lovable</p>
        <p className="text-xs text-foreground/80 leading-relaxed">{prompt}</p>
      </div>
      <button className="shrink-0 text-[10px] text-violet-400 hover:text-violet-200 flex items-center gap-1">
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  );
}

/* ── Evolution Instance Panel — replaces Hoppscotch/cURL ── */

function EvolutionInstancePanel({ serviceUrl, apiKey, instanceName }: {
  serviceUrl: string; apiKey: string; instanceName: string;
}) {
  const [status, setStatus] = useState<"idle" | "creating" | "created" | "error">("idle");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connState, setConnState] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [checkingState, setCheckingState] = useState(false);

  const callProxy = async (action: string) => {
    const { data, error } = await supabase.functions.invoke("evolution-proxy", {
      body: { action, serviceUrl, apiKey, instanceName },
    });
    if (error) throw new Error(error.message);
    return data;
  };

  const handleCreate = async () => {
    if (!apiKey || !instanceName) {
      toast.error("Preencha o nome da instância e a API Key (etapa 4)");
      return;
    }
    setStatus("creating");
    setErrorMsg("");
    setQrCode(null);
    setConnState(null);
    try {
      const data = await callProxy("create");
      if (data?.error) throw new Error(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      // Extract QR code — may come as base64 image
      const qr = data?.qrcode?.base64 || data?.qrcode?.pairingCode || data?.qrcode || null;
      setQrCode(typeof qr === "string" ? qr : null);
      setStatus("created");
      toast.success("Instância criada com sucesso!");
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err.message || "Erro ao criar instância");
      toast.error("Erro ao criar instância");
    }
  };

  const handleRefreshQR = async () => {
    setQrCode(null);
    try {
      const data = await callProxy("connect");
      const qr = data?.base64 || data?.qrcode?.base64 || data?.pairingCode || null;
      setQrCode(typeof qr === "string" ? qr : null);
      if (!qr) toast.info("QR Code não retornado — talvez já esteja conectado");
    } catch {
      toast.error("Erro ao obter QR Code");
    }
  };

  const handleCheckState = async () => {
    setCheckingState(true);
    try {
      const data = await callProxy("state");
      const state = data?.instance?.state || data?.state || "unknown";
      setConnState(state);
      if (state === "open") toast.success("WhatsApp conectado!");
      else toast.info(`Estado: ${state}`);
    } catch {
      toast.error("Erro ao verificar conexão");
    } finally {
      setCheckingState(false);
    }
  };

  return (
    <div className="rounded-2xl border-2 border-primary/30 overflow-hidden space-y-0">
      {/* Step 1 — Create */}
      <div className="p-4 space-y-3 border-b border-primary/10">
        <p className="text-xs font-bold text-foreground flex items-center gap-2">
          <span className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-black">1</span>
          Criar instância
        </p>
        <p className="text-xs text-muted-foreground">Clique no botão abaixo para criar a instância automaticamente na sua Evolution API:</p>
        <button
          onClick={handleCreate}
          disabled={status === "creating"}
          className="h-11 px-6 rounded-2xl bg-primary text-primary-foreground text-sm font-bold flex items-center gap-2 disabled:opacity-50"
        >
          {status === "creating" ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Criando...</>
          ) : status === "created" ? (
            <><CheckCircle2 className="h-4 w-4" /> Instância criada — Recriar</>
          ) : (
            <><Zap className="h-4 w-4" /> Criar instância "{instanceName}"</>
          )}
        </button>
        {status === "error" && (
          <InfoBox type="warn">
            <strong>Erro:</strong> {errorMsg}<br/>
            Verifique se a URL da API e a API Key estão corretas e se o serviço está rodando.
          </InfoBox>
        )}
      </div>

      {/* Step 2 — QR Code */}
      {status === "created" && (
        <div className="p-4 space-y-3 border-b border-primary/10">
          <p className="text-xs font-bold text-foreground flex items-center gap-2">
            <span className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-black">2</span>
            Escanear QR Code
          </p>

          {qrCode ? (
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-xl border border-white/[0.1] bg-white p-4 inline-block">
                <img
                  src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                  alt="QR Code WhatsApp"
                  className="w-64 h-64 object-contain"
                />
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4 space-y-2 w-full">
                <p className="text-xs font-bold text-primary flex items-center gap-1.5"><Smartphone className="h-3.5 w-3.5" /> No celular:</p>
                <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                  <li>Abra o <strong className="text-foreground">WhatsApp</strong></li>
                  <li>Toque nos <strong className="text-foreground">3 pontinhos ⋮</strong> → <strong className="text-foreground">"Dispositivos conectados"</strong></li>
                  <li>Toque em <strong className="text-foreground">"Conectar dispositivo"</strong></li>
                  <li>Aponte a câmera para o <strong className="text-foreground">QR Code acima</strong></li>
                </ol>
              </div>
              <button onClick={handleRefreshQR} className="text-xs text-primary hover:underline flex items-center gap-1">
                <Wifi className="h-3 w-3" /> QR expirou? Clique para gerar novo
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <InfoBox type="info">
                O QR Code não foi retornado diretamente. Clique abaixo para obtê-lo:
              </InfoBox>
              <button onClick={handleRefreshQR} className="h-10 px-5 rounded-2xl bg-primary/10 text-primary text-sm font-bold flex items-center gap-2 border border-primary/20">
                <Wifi className="h-4 w-4" /> Obter QR Code
              </button>
            </div>
          )}

          <InfoBox type="warn">
            O QR Code expira em ~30 segundos. Se expirar, clique em "gerar novo".
          </InfoBox>
        </div>
      )}

      {/* Step 3 — Verify */}
      {status === "created" && (
        <div className="p-4 space-y-3">
          <p className="text-xs font-bold text-foreground flex items-center gap-2">
            <span className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-black">3</span>
            Verificar conexão
          </p>
          <p className="text-xs text-muted-foreground">Após escanear o QR Code, clique para verificar se a conexão foi bem-sucedida:</p>
          <button
            onClick={handleCheckState}
            disabled={checkingState}
            className="h-10 px-5 rounded-2xl bg-primary/10 text-primary text-sm font-bold flex items-center gap-2 border border-primary/20 disabled:opacity-50"
          >
            {checkingState ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Verificar conexão
          </button>
          {connState && (
            <div className={`flex items-center gap-2 p-3 rounded-xl border ${
              connState === "open"
                ? "bg-emerald-500/10 border-emerald-500/20"
                : "bg-amber-500/10 border-amber-500/20"
            }`}>
              {connState === "open" ? (
                <><CheckCircle2 className="h-4 w-4 text-emerald-400" /><span className="text-xs font-bold text-emerald-400">WhatsApp conectado com sucesso! ✅</span></>
              ) : (
                <><AlertTriangle className="h-4 w-4 text-amber-400" /><span className="text-xs font-bold text-amber-400">Estado: "{connState}" — escaneie o QR Code e tente novamente</span></>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main component ── */

export default function EvolutionSetupGuide() {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Smart input state — carries forward across steps
  const [dbUrl, setDbUrl] = useState("");
  const [redisUrl, setRedisUrl] = useState("");
  const [serviceName, setServiceName] = useState("evolution-api");
  const [apiKey, setApiKey] = useState("");
  const [instanceName, setInstanceName] = useState("starcrm");

  const markComplete = (step: number) => {
    setCompletedSteps(prev => new Set([...prev, step]));
    setActiveStep(step + 1);
  };

  const serviceUrl = `https://${serviceName || "[SEU-SERVICO]"}.onrender.com`;

  // Generate .env content dynamically
  const envContent = useMemo(() => {
    const lines = [
      `# === SERVER ===`,
      `SERVER_TYPE=http`,
      `SERVER_PORT=8080`,
      `SERVER_URL=${serviceUrl}`,
      ``,
      `# === AUTENTICAÇÃO ===`,
      `AUTHENTICATION_API_KEY=${apiKey || "[CRIE_UMA_CHAVE_FORTE_AQUI]"}`,
      ``,
      `# === BANCO DE DADOS ===`,
      `DATABASE_ENABLED=true`,
      `DATABASE_PROVIDER=postgresql`,
      `DATABASE_CONNECTION_URI=${dbUrl || "[SUA_INTERNAL_DATABASE_URL]"}?schema=public`,
      `DATABASE_CONNECTION_CLIENT_NAME=evolution_render`,
      ``,
      `# === PERSISTÊNCIA ===`,
      `DATABASE_SAVE_DATA_INSTANCE=true`,
      `DATABASE_SAVE_DATA_NEW_MESSAGE=true`,
      `DATABASE_SAVE_MESSAGE_UPDATE=true`,
      `DATABASE_SAVE_DATA_CONTACTS=true`,
      `DATABASE_SAVE_DATA_CHATS=true`,
      `DATABASE_SAVE_DATA_LABELS=true`,
      `DATABASE_SAVE_DATA_HISTORIC=true`,
      ``,
      `# === REDIS/CACHE ===`,
      `CACHE_REDIS_ENABLED=true`,
      `CACHE_REDIS_URI=${redisUrl || "[SUA_INTERNAL_REDIS_URL]"}`,
      `CACHE_REDIS_PREFIX_KEY=evolution`,
      `CACHE_REDIS_SAVE_INSTANCES=false`,
      `CACHE_LOCAL_ENABLED=false`,
      ``,
      `# === CORS ===`,
      `CORS_ORIGIN=*`,
      `CORS_METHODS=GET,POST,PUT,DELETE`,
      `CORS_CREDENTIALS=true`,
      ``,
      `# === INSTÂNCIAS ===`,
      `DEL_INSTANCE=false`,
      ``,
      `# === LOGS ===`,
      `LOG_LEVEL=ERROR,WARN,INFO`,
      `LOG_COLOR=true`,
      `LOG_BAILEYS=error`,
      ``,
      `# === QRCODE ===`,
      `QRCODE_LIMIT=30`,
      ``,
      `# === SESSÃO ===`,
      `CONFIG_SESSION_PHONE_CLIENT=StarCRM`,
      `CONFIG_SESSION_PHONE_NAME=Chrome`,
      ``,
      `# === TELEMETRIA ===`,
      `TELEMETRY=false`,
      ``,
      `# === INTEGRAÇÕES (desabilitadas) ===`,
      `RABBITMQ_ENABLED=false`,
      `WEBSOCKET_ENABLED=false`,
      `SQS_ENABLED=false`,
      `CHATWOOT_ENABLED=false`,
      `OPENAI_ENABLED=false`,
      `DIFY_ENABLED=false`,
      `S3_ENABLED=false`,
    ];
    return lines.join("\n");
  }, [serviceUrl, apiKey, dbUrl, redisUrl]);

  const filledCount = [dbUrl, redisUrl, apiKey].filter(Boolean).length;

  return (
    <AppLayout>
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-10 md:py-14">

        {/* Back */}
        <button onClick={() => navigate("/setup/evolution")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-primary/20 flex items-center justify-center border border-emerald-500/20">
              <Zap className="h-7 w-7 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Evolution API no Render</h1>
              <p className="text-sm text-muted-foreground">Deploy completo: Postgres + Redis + Evolution API v2</p>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/[0.04] p-5 flex gap-4 items-start"
            style={{ backdropFilter: "blur(40px) saturate(180%)" }}>
            <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm text-foreground/80 space-y-1">
              <p className="font-bold text-foreground">Tutorial interativo</p>
              <p>Preencha os campos em cada passo e os valores são carregados automaticamente nos próximos. No final, copie o <strong>.env completo</strong> e cole no Render.</p>
            </div>
          </div>

          {/* Services overview */}
          <div className="grid grid-cols-3 gap-3 mt-6">
            {[
              { icon: Database, label: "PostgreSQL", desc: "Banco de dados" },
              { icon: Server, label: "Key Value", desc: "Redis (cache)" },
              { icon: Globe, label: "Web Service", desc: "Evolution API" },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-center"
                style={{ backdropFilter: "blur(40px)" }}>
                <item.icon className="h-5 w-5 mx-auto mb-2 text-primary" />
                <p className="text-xs font-bold text-foreground">{item.label}</p>
                <p className="text-[10px] text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-center gap-4"
            style={{ backdropFilter: "blur(40px)" }}>
            <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-xs font-black ${filledCount === 3 ? "bg-emerald-500/20 text-emerald-400" : "bg-primary/20 text-primary"}`}>
              {filledCount}/3
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold">Dados preenchidos</p>
              <p className="text-[10px] text-muted-foreground">Preencha nos passos e o .env é gerado automaticamente</p>
            </div>
            <div className="w-24 h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-500" style={{ width: `${(filledCount / 3) * 100}%` }} />
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3">

          {/* STEP 1 */}
          <Step number={1} title="Criar conta no Render" isActive={activeStep === 1} isComplete={completedSteps.has(1)} onClick={() => setActiveStep(1)}>
            <p className="text-sm text-muted-foreground">Acesse o Render e crie sua conta (pode usar GitHub para login rápido).</p>
            <LinkButton href="https://dashboard.render.com/register">Criar conta no Render</LinkButton>
            <InfoBox>Plano gratuito já permite criar Postgres, Redis e Web Services. Para produção, recomendamos o plano Starter ($7/mês).</InfoBox>
            <button onClick={() => markComplete(1)} className="h-11 px-6 rounded-2xl bg-primary text-primary-foreground text-sm font-bold flex items-center gap-2">
              Já criei minha conta <ArrowRight className="h-4 w-4" />
            </button>
          </Step>

          {/* STEP 2 — PostgreSQL */}
          <Step number={2} title="Criar banco PostgreSQL" isActive={activeStep === 2} isComplete={completedSteps.has(2)} onClick={() => setActiveStep(2)}>
            <p className="text-sm text-muted-foreground">No dashboard do Render, crie um banco PostgreSQL.</p>
            <LinkButton href="https://dashboard.render.com/new/database">Criar novo PostgreSQL</LinkButton>

            <div className="rounded-xl border border-white/[0.06] p-4 space-y-2">
              <p className="text-xs font-bold text-foreground">Preencha os campos no Render:</p>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">Name:</span> <code className="text-foreground bg-white/[0.06] px-1.5 py-0.5 rounded">evolution-db</code></div>
                <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">Database:</span> <code className="text-foreground bg-white/[0.06] px-1.5 py-0.5 rounded">evolution</code></div>
                <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">User:</span> <code className="text-foreground bg-white/[0.06] px-1.5 py-0.5 rounded">evolution_user</code></div>
                <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">Region:</span> Oregon (US West)</div>
                <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">Plan:</span> Free (ou Starter $7/mês)</div>
              </div>
            </div>

            <InfoBox type="warn">
              Após criar, o Render mostrará uma <strong>"Internal Database URL"</strong>. 
              <strong> Copie-a</strong> e cole no campo abaixo — ela será usada automaticamente no Passo 4.
            </InfoBox>

            <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4">
              <SmartInput
                label="Internal Database URL"
                placeholder="postgres://evolution_user:SENHA@dpg-xxxxx-a/evolution"
                value={dbUrl}
                onChange={setDbUrl}
                hint="Dashboard → PostgreSQL → evolution-db → aba 'Info' → 'Internal Database URL'"
              />
              {dbUrl && (
                <div className="mt-3 flex items-center gap-2 text-emerald-400 text-[11px]">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Salvo! Será usado automaticamente no Passo 4.
                </div>
              )}
            </div>

            <button onClick={() => markComplete(2)} className="h-11 px-6 rounded-2xl bg-primary text-primary-foreground text-sm font-bold flex items-center gap-2">
              PostgreSQL criado {dbUrl ? "✓" : ""} <ArrowRight className="h-4 w-4" />
            </button>
          </Step>

          {/* STEP 3 — Redis */}
          <Step number={3} title="Criar Key Value (Redis)" isActive={activeStep === 3} isComplete={completedSteps.has(3)} onClick={() => setActiveStep(3)}>
            <p className="text-sm text-muted-foreground">O Redis é usado como cache pela Evolution API.</p>

            <InfoBox>
              <strong>⚠️ O que é "Key Value"?</strong><br/>
              No Render, o Redis é chamado de <strong>"Key Value"</strong>. É o mesmo serviço.
            </InfoBox>

            <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4 space-y-3">
              <p className="text-xs font-bold text-primary">📍 Como encontrar no Render (3 formas):</p>
              <div className="space-y-3 text-xs text-muted-foreground">
                <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
                  <p className="font-bold text-foreground mb-1">Forma 1 — Link direto</p>
                  <p>Use o botão abaixo.</p>
                </div>
                <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
                  <p className="font-bold text-foreground mb-1">Forma 2 — Botão "New +"</p>
                  <p>Dashboard → canto superior direito → <strong className="text-foreground">"New +"</strong> → <strong className="text-foreground">"Key Value"</strong></p>
                </div>
                <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
                  <p className="font-bold text-foreground mb-1">Forma 3 — Menu lateral</p>
                  <p>Sidebar esquerda → <strong className="text-foreground">"Key Value"</strong> → <strong className="text-foreground">"New Key Value"</strong></p>
                </div>
              </div>
            </div>

            <LinkButton href="https://dashboard.render.com/new/redis">Criar novo Key Value (Redis)</LinkButton>

            <div className="rounded-xl border border-white/[0.06] p-4 space-y-2">
              <p className="text-xs font-bold text-foreground">Preencha:</p>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">Name:</span> <code className="text-foreground bg-white/[0.06] px-1.5 py-0.5 rounded">evolution-redis</code></div>
                <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">Region:</span> Oregon (US West)</div>
                <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">Max Memory Policy:</span> <code className="text-foreground bg-white/[0.06] px-1.5 py-0.5 rounded">allkeys-lru</code></div>
              </div>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4">
              <SmartInput
                label="Internal Redis URL"
                placeholder="redis://red-xxxxx-a:6379"
                value={redisUrl}
                onChange={setRedisUrl}
                hint="Dashboard → Key Value → evolution-redis → aba 'Info' → 'Internal Redis URL'"
              />
              {redisUrl && (
                <div className="mt-3 flex items-center gap-2 text-emerald-400 text-[11px]">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Salvo! Será usado automaticamente no Passo 4.
                </div>
              )}
            </div>

            <button onClick={() => markComplete(3)} className="h-11 px-6 rounded-2xl bg-primary text-primary-foreground text-sm font-bold flex items-center gap-2">
              Redis criado {redisUrl ? "✓" : ""} <ArrowRight className="h-4 w-4" />
            </button>
          </Step>

          {/* STEP 4 — Web Service with .env generator */}
          <Step number={4} title="Criar Web Service (Evolution API)" isActive={activeStep === 4} isComplete={completedSteps.has(4)} onClick={() => setActiveStep(4)}>
            <p className="text-sm text-muted-foreground">Deploy a Evolution API como Web Service usando Docker.</p>
            <LinkButton href="https://dashboard.render.com/new/web-service">Criar novo Web Service</LinkButton>

            <div className="rounded-xl border border-white/[0.06] p-4 space-y-3">
              <p className="text-xs font-bold text-foreground">Configuração do serviço:</p>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">Source:</span> Selecione <strong>"Deploy an existing image from a registry"</strong></div>
                <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">Image URL:</span> <code className="text-foreground bg-white/[0.06] px-1.5 py-0.5 rounded">atendai/evolution-api:v2.2.3</code></div>
                <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">Plan:</span> Starter ($7/mês) — Free hiberna a instância</div>
              </div>
            </div>

            {/* Smart inputs */}
            <div className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-5 space-y-4">
              <p className="text-sm font-bold text-foreground flex items-center gap-2">
                <Key className="h-4 w-4 text-primary" /> Configure seus dados
              </p>

              <SmartInput
                label="Nome do Web Service"
                placeholder="evolution-api"
                value={serviceName}
                onChange={setServiceName}
                hint={`URL final: ${serviceUrl}`}
              />
              <SmartInput
                label="API Key (crie uma senha forte)"
                placeholder="minha-chave-super-secreta-32chars"
                value={apiKey}
                onChange={setApiKey}
                hint="Use um gerador de senhas — mínimo 32 caracteres"
              />

              {/* Auto-filled values */}
              <div className="space-y-2 pt-2 border-t border-white/[0.06]">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Valores dos passos anteriores:</p>
                <div className="flex items-center gap-2 text-xs">
                  {dbUrl ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />}
                  <span className="text-muted-foreground">Database URL:</span>
                  <code className="text-[10px] text-foreground/60 truncate max-w-[200px]">{dbUrl || "⚠ Preencha no Passo 2"}</code>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {redisUrl ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />}
                  <span className="text-muted-foreground">Redis URL:</span>
                  <code className="text-[10px] text-foreground/60 truncate max-w-[200px]">{redisUrl || "⚠ Preencha no Passo 3"}</code>
                </div>
              </div>
            </div>

            <InfoBox type="warn">
              <strong>Como adicionar as variáveis no Render:</strong><br/>
              Na página do Web Service → aba <strong>"Environment"</strong> → clique em <strong>"Add from .env"</strong> → cole o conteúdo abaixo. O Render cria todas as variáveis automaticamente!
            </InfoBox>

            {/* .env generator */}
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] overflow-hidden">
              <div className="px-5 py-3 bg-emerald-500/[0.06] border-b border-emerald-500/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileDown className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-300">Arquivo .env gerado automaticamente</span>
                </div>
                <button
                  onClick={() => { navigator.clipboard.writeText(envContent); toast.success("Variáveis copiadas! Cole no Render em 'Add from .env'"); }}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs font-bold hover:bg-emerald-500/30 transition-colors"
                >
                  <Copy className="h-3 w-3" /> Copiar tudo
                </button>
              </div>
              <pre className="p-4 overflow-x-auto text-[11px] font-mono text-foreground/70 bg-black/30 leading-relaxed whitespace-pre-wrap max-h-[400px] overflow-y-auto">{envContent}</pre>
            </div>

            <InfoBox type="success">
              Após colar as variáveis, clique em <strong>"Create Web Service"</strong>. O deploy leva 2-5 minutos.
            </InfoBox>

            <button onClick={() => markComplete(4)} className="h-11 px-6 rounded-2xl bg-primary text-primary-foreground text-sm font-bold flex items-center gap-2">
              Web Service criado <ArrowRight className="h-4 w-4" />
            </button>
          </Step>

          {/* STEP 5 — Verify */}
          <Step number={5} title="Verificar se está rodando" isActive={activeStep === 5} isComplete={completedSteps.has(5)} onClick={() => setActiveStep(5)}>
            <p className="text-sm text-muted-foreground">Após o deploy finalizar (status "Live"), teste se a API está funcionando.</p>

            <div className="rounded-xl border border-white/[0.06] p-4 space-y-3">
              <p className="text-xs font-bold text-foreground">Teste no navegador:</p>
              <CopyBlock label="URL de teste" code={serviceUrl} />
              <p className="text-xs text-muted-foreground">Resposta esperada:</p>
              <CopyBlock label="JSON esperado" code={`{
  "status": 200,
  "message": "Welcome to the Evolution API, it is working!",
  "version": "2.2.3"
}`} />
            </div>

            <InfoBox type="warn">Se receber erro 502 ou timeout, aguarde mais 2-3 minutos. O primeiro deploy pode demorar.</InfoBox>

            <button onClick={() => markComplete(5)} className="h-11 px-6 rounded-2xl bg-primary text-primary-foreground text-sm font-bold flex items-center gap-2">
              API está rodando! <ArrowRight className="h-4 w-4" />
            </button>
          </Step>

          {/* STEP 6 — Create instance & connect WhatsApp */}
          <Step number={6} title="Criar instância e conectar WhatsApp" isActive={activeStep === 6} isComplete={completedSteps.has(6)} onClick={() => setActiveStep(6)}>
            <p className="text-sm text-muted-foreground">
              Crie a instância e conecte seu WhatsApp — <strong className="text-foreground">tudo direto aqui, sem ferramentas externas</strong>.
            </p>

            {/* Instance name input */}
            <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4">
              <SmartInput
                label="Nome da instância"
                placeholder="starcrm"
                value={instanceName}
                onChange={setInstanceName}
                hint="Nome identificador — use apenas letras minúsculas, sem espaços"
              />
            </div>

            <InfoBox>
              <strong>O que é uma instância?</strong><br/>
              Cada instância = uma conexão WhatsApp (um número de telefone). O nome serve como identificador interno.
            </InfoBox>

            <EvolutionInstancePanel
              serviceUrl={serviceUrl}
              apiKey={apiKey}
              instanceName={instanceName}
            />

            <button onClick={() => markComplete(6)} className="h-11 px-6 rounded-2xl bg-primary text-primary-foreground text-sm font-bold flex items-center gap-2">
              WhatsApp conectado! <ArrowRight className="h-4 w-4" />
            </button>
          </Step>

          {/* STEP 7 — CRM Config */}
          <Step number={7} title="Configurar no CRM da plataforma" isActive={activeStep === 7} isComplete={completedSteps.has(7)} onClick={() => setActiveStep(7)}>
            <p className="text-sm text-muted-foreground">Último passo! Configure a conexão no painel CRM.</p>

            <div className="rounded-xl border border-white/[0.06] p-4 space-y-3">
              <p className="text-xs font-bold text-foreground">No painel Admin → CRM → WhatsApp, preencha:</p>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-start gap-2">
                  <span className="text-primary font-bold shrink-0">URL da API:</span>
                  <code className="text-foreground bg-white/[0.06] px-1.5 py-0.5 rounded text-[11px] break-all">{serviceUrl}</code>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-primary font-bold shrink-0">API Key:</span>
                  <code className="text-foreground bg-white/[0.06] px-1.5 py-0.5 rounded text-[11px] break-all">{apiKey || "[sua chave do Passo 4]"}</code>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-primary font-bold shrink-0">Instância:</span>
                  <code className="text-foreground bg-white/[0.06] px-1.5 py-0.5 rounded">{instanceName}</code>
                </div>
              </div>
            </div>

            <PromptSuggestion prompt={`Configure a integração com a Evolution API usando:
- URL: ${serviceUrl}
- API Key: ${apiKey || "[sua API key]"}
- Instância: ${instanceName}
Conecte o CRM para enviar e receber mensagens WhatsApp automaticamente.`} />

            <InfoBox type="success">
              <strong>Pronto!</strong> Clique em "Salvar Configuração" e depois "Testar Conexão". Se aparecer "WhatsApp Online" ✅, está tudo configurado!
            </InfoBox>

            <button onClick={() => markComplete(7)} className="h-11 px-6 rounded-2xl bg-emerald-500 text-white text-sm font-bold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Configuração concluída!
            </button>
          </Step>
        </div>

        {/* Summary table */}
        <div className="mt-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 space-y-4" style={{ backdropFilter: "blur(40px)" }}>
          <h3 className="text-base font-bold">Resumo dos seus dados</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left py-2 text-[10px] text-muted-foreground uppercase font-bold">Dado</th>
                  <th className="text-left py-2 text-[10px] text-muted-foreground uppercase font-bold">Valor</th>
                  <th className="text-left py-2 text-[10px] text-muted-foreground uppercase font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                {[
                  { name: "Database URL", value: dbUrl, ok: !!dbUrl },
                  { name: "Redis URL", value: redisUrl, ok: !!redisUrl },
                  { name: "API Key", value: apiKey ? "••••••••" : "", ok: !!apiKey },
                  { name: "Service URL", value: serviceUrl, ok: !!serviceName },
                  { name: "Instance Name", value: instanceName, ok: !!instanceName },
                ].map((r) => (
                  <tr key={r.name} className="border-b border-white/[0.04]">
                    <td className="py-2 text-foreground font-semibold">{r.name}</td>
                    <td className="py-2 font-mono text-[10px] max-w-[200px] truncate">{r.value || "—"}</td>
                    <td className="py-2">{r.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Troubleshooting */}
        <div className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 space-y-4" style={{ backdropFilter: "blur(40px)" }}>
          <h3 className="text-base font-bold">Problemas comuns</h3>
          <div className="space-y-3">
            {[
              { q: "Erro 502 Bad Gateway", a: "O serviço ainda está iniciando. Aguarde 2-3 minutos." },
              { q: "QR Code não aparece", a: "Verifique se a API Key está correta e se a instância foi criada (Passo 6.1)." },
              { q: "WhatsApp desconecta", a: "Plano Free hiberna. Use Starter ($7/mês) para 24/7." },
              { q: "Erro de banco de dados", a: "Certifique-se que adicionou ?schema=public na DATABASE_CONNECTION_URI." },
              { q: "Mensagens não enviam", a: "Verifique se a instância está com state: 'open'." },
            ].map((item, i) => (
              <div key={i} className="rounded-xl border border-white/[0.04] p-3">
                <p className="text-xs font-bold text-foreground mb-1">{item.q}</p>
                <p className="text-[11px] text-muted-foreground">{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Prompt suggestions */}
        <div className="mt-6 space-y-3">
          <h3 className="text-base font-bold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-400" /> Prompts sugeridos para Lovable
          </h3>
          <PromptSuggestion prompt="Crie um painel de monitoramento para minha Evolution API que mostra o status da conexão WhatsApp, número de mensagens enviadas hoje e um botão para reconectar se a sessão cair." />
          <PromptSuggestion prompt="Implemente um sistema de filas para envio de mensagens WhatsApp em massa com intervalo de 3-5 segundos entre mensagens, barra de progresso e log de erros." />
          <PromptSuggestion prompt="Adicione um webhook que recebe mensagens do WhatsApp via Evolution API e salva automaticamente no CRM como novos leads, com nome, telefone e última mensagem." />
        </div>

        {/* Links */}
        <div className="mt-6 flex flex-wrap gap-3">
          <LinkButton href="https://doc.evolution-api.com/v2/en/install/docker">Docs Evolution API</LinkButton>
          <LinkButton href="https://dashboard.render.com">Dashboard Render</LinkButton>
          <LinkButton href="https://doc.evolution-api.com/v2/api-reference/get-information">API Reference</LinkButton>
        </div>
      </div>
    </div>
    </AppLayout>
  );
}
