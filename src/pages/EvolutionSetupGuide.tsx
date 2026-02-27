import { useState } from "react";
import { 
  ChevronRight, ChevronDown, Copy, Check, ExternalLink, 
  Server, Database, Key, Wifi, Shield, Zap, Terminal,
  ArrowRight, AlertTriangle, CheckCircle2, Info, Globe
} from "lucide-react";
import { toast } from "sonner";

interface StepProps {
  number: number;
  title: string;
  children: React.ReactNode;
  isActive: boolean;
  isComplete: boolean;
  onClick: () => void;
}

function Step({ number, title, children, isActive, isComplete, onClick }: StepProps) {
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

function CodeBlock({ code, label }: { code: string; label?: string }) {
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

export default function EvolutionSetupGuide() {
  const [activeStep, setActiveStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const markComplete = (step: number) => {
    setCompletedSteps(prev => new Set([...prev, step]));
    setActiveStep(step + 1);
  };

  const SUPABASE_URL = "https://qlhhmmboxlufvdtpbrsm.supabase.co";
  const EDGE_FN_WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/crm-dispatch`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-primary/20 flex items-center justify-center border border-emerald-500/20">
              <Zap className="h-7 w-7 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground tracking-tight">Evolution API no Render</h1>
              <p className="text-sm text-muted-foreground">Deploy completo: Postgres + Redis + Evolution API v2</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-6">
            {[
              { icon: Database, label: "PostgreSQL", desc: "Render Postgres" },
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
        </div>

        {/* Steps */}
        <div className="space-y-3">

          {/* STEP 1 — Render Account */}
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
            <p className="text-sm text-muted-foreground">No dashboard do Render, crie um banco PostgreSQL que será usado pela Evolution API para persistir instâncias, mensagens e contatos.</p>
            
            <LinkButton href="https://dashboard.render.com/new/database">Criar novo PostgreSQL</LinkButton>

            <div className="space-y-3 mt-2">
              <div className="rounded-xl border border-white/[0.06] p-4 space-y-2">
                <p className="text-xs font-bold text-foreground">Preencha os campos:</p>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">Name:</span> <span><code className="text-foreground bg-white/[0.06] px-1.5 py-0.5 rounded">evolution-db</code></span></div>
                  <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">Database:</span> <span><code className="text-foreground bg-white/[0.06] px-1.5 py-0.5 rounded">evolution</code></span></div>
                  <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">User:</span> <span><code className="text-foreground bg-white/[0.06] px-1.5 py-0.5 rounded">evolution_user</code></span></div>
                  <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">Region:</span> <span>Oregon (US West) — mesmo da API</span></div>
                  <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">Plan:</span> <span>Free (ou Starter $7/mês para produção)</span></div>
                </div>
              </div>

              <InfoBox type="warn">
                Após criar, o Render mostrará uma <strong>"Internal Database URL"</strong> e uma <strong>"External Database URL"</strong>. 
                <strong> Copie a "Internal Database URL"</strong> — ela começa com <code>postgres://</code>. Você vai precisar dela no Passo 4.
              </InfoBox>

              <div className="rounded-xl border border-white/[0.06] p-4">
                <p className="text-xs font-bold text-foreground mb-2">Onde encontrar a URL:</p>
                <p className="text-xs text-muted-foreground">Dashboard → PostgreSQL → <strong>evolution-db</strong> → aba <strong>"Info"</strong> → campo <strong>"Internal Database URL"</strong></p>
                <p className="text-xs text-muted-foreground mt-2">Formato: <code className="text-foreground bg-white/[0.06] px-1.5 py-0.5 rounded text-[10px]">postgres://evolution_user:SENHA@dpg-xxxxx-a/evolution</code></p>
              </div>
            </div>

            <button onClick={() => markComplete(2)} className="h-11 px-6 rounded-2xl bg-primary text-primary-foreground text-sm font-bold flex items-center gap-2">
              PostgreSQL criado, tenho a URL <ArrowRight className="h-4 w-4" />
            </button>
          </Step>

          {/* STEP 3 — Redis (Key Value) */}
          <Step number={3} title="Criar Key Value (Redis)" isActive={activeStep === 3} isComplete={completedSteps.has(3)} onClick={() => setActiveStep(3)}>
            <p className="text-sm text-muted-foreground">O Redis é usado como cache pela Evolution API para melhorar a performance e armazenar sessões temporárias.</p>

            <LinkButton href="https://dashboard.render.com/new/redis">Criar novo Key Value (Redis)</LinkButton>

            <div className="rounded-xl border border-white/[0.06] p-4 space-y-2">
              <p className="text-xs font-bold text-foreground">Preencha os campos:</p>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">Name:</span> <span><code className="text-foreground bg-white/[0.06] px-1.5 py-0.5 rounded">evolution-redis</code></span></div>
                <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">Region:</span> <span>Oregon (US West) — mesmo do Postgres</span></div>
                <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">Plan:</span> <span>Free (ou Starter para produção)</span></div>
                <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">Max Memory Policy:</span> <span><code className="text-foreground bg-white/[0.06] px-1.5 py-0.5 rounded">allkeys-lru</code></span></div>
              </div>
            </div>

            <InfoBox type="warn">
              Após criar, copie a <strong>"Internal Redis URL"</strong>. Ela começa com <code>redis://</code>. Você vai precisar no Passo 4.
            </InfoBox>

            <div className="rounded-xl border border-white/[0.06] p-4">
              <p className="text-xs font-bold text-foreground mb-2">Onde encontrar:</p>
              <p className="text-xs text-muted-foreground">Dashboard → Key Value → <strong>evolution-redis</strong> → aba <strong>"Info"</strong> → campo <strong>"Internal Redis URL"</strong></p>
              <p className="text-xs text-muted-foreground mt-2">Formato: <code className="text-foreground bg-white/[0.06] px-1.5 py-0.5 rounded text-[10px]">redis://red-xxxxx-a:6379</code></p>
            </div>

            <button onClick={() => markComplete(3)} className="h-11 px-6 rounded-2xl bg-primary text-primary-foreground text-sm font-bold flex items-center gap-2">
              Redis criado, tenho a URL <ArrowRight className="h-4 w-4" />
            </button>
          </Step>

          {/* STEP 4 — Web Service (Evolution API) */}
          <Step number={4} title="Criar Web Service (Evolution API)" isActive={activeStep === 4} isComplete={completedSteps.has(4)} onClick={() => setActiveStep(4)}>
            <p className="text-sm text-muted-foreground">Agora vamos deployar a Evolution API como um Web Service usando a imagem Docker oficial.</p>

            <LinkButton href="https://dashboard.render.com/new/web-service">Criar novo Web Service</LinkButton>

            <div className="rounded-xl border border-white/[0.06] p-4 space-y-3">
              <p className="text-xs font-bold text-foreground">Configuração do serviço:</p>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">Source:</span> <span>Selecione <strong>"Deploy an existing image from a registry"</strong></span></div>
                <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">Image URL:</span> <span><code className="text-foreground bg-white/[0.06] px-1.5 py-0.5 rounded">atendai/evolution-api:v2.2.3</code></span></div>
                <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">Name:</span> <span><code className="text-foreground bg-white/[0.06] px-1.5 py-0.5 rounded">evolution-api</code></span></div>
                <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">Region:</span> <span>Oregon (mesmo dos outros)</span></div>
                <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">Plan:</span> <span>Starter ($7/mês) — Free pode hibernar a instância</span></div>
              </div>
            </div>

            <InfoBox type="warn">
              <strong>Importante:</strong> Se usar o plano Free, o serviço "dorme" após 15min de inatividade e leva ~30s para reiniciar.
              Para uso em produção com WhatsApp, use no mínimo o plano <strong>Starter</strong> para manter a conexão ativa 24/7.
            </InfoBox>

            <p className="text-sm font-bold text-foreground mt-4 mb-2">Variáveis de Ambiente (Environment Variables)</p>
            <p className="text-xs text-muted-foreground mb-3">Na seção <strong>"Environment"</strong> do Web Service, adicione cada variável abaixo. Substitua os valores entre colchetes pelos dados reais.</p>

            <CodeBlock label="Variáveis de Ambiente — copie uma por vez" code={`# === SERVER ===
SERVER_TYPE=http
SERVER_PORT=8080
SERVER_URL=https://[SEU-SERVICO].onrender.com

# === AUTENTICAÇÃO ===
AUTHENTICATION_API_KEY=[CRIE_UMA_CHAVE_FORTE_AQUI]

# === BANCO DE DADOS ===
DATABASE_ENABLED=true
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=[SUA_INTERNAL_DATABASE_URL_DO_PASSO_2]?schema=public
DATABASE_CONNECTION_CLIENT_NAME=evolution_render

# === PERSISTÊNCIA ===
DATABASE_SAVE_DATA_INSTANCE=true
DATABASE_SAVE_DATA_NEW_MESSAGE=true
DATABASE_SAVE_MESSAGE_UPDATE=true
DATABASE_SAVE_DATA_CONTACTS=true
DATABASE_SAVE_DATA_CHATS=true
DATABASE_SAVE_DATA_LABELS=true
DATABASE_SAVE_DATA_HISTORIC=true

# === REDIS/CACHE ===
CACHE_REDIS_ENABLED=true
CACHE_REDIS_URI=[SUA_INTERNAL_REDIS_URL_DO_PASSO_3]
CACHE_REDIS_PREFIX_KEY=evolution
CACHE_REDIS_SAVE_INSTANCES=false
CACHE_LOCAL_ENABLED=false

# === CORS ===
CORS_ORIGIN=*
CORS_METHODS=GET,POST,PUT,DELETE
CORS_CREDENTIALS=true

# === INSTÂNCIAS ===
DEL_INSTANCE=false

# === LOGS ===
LOG_LEVEL=ERROR,WARN,INFO
LOG_COLOR=true
LOG_BAILEYS=error

# === QRCODE ===
QRCODE_LIMIT=30

# === SESSÃO ===
CONFIG_SESSION_PHONE_CLIENT=StarCRM
CONFIG_SESSION_PHONE_NAME=Chrome

# === TELEMETRIA ===
TELEMETRY=false

# === INTEGRAÇÕES (desabilitadas) ===
RABBITMQ_ENABLED=false
WEBSOCKET_ENABLED=false
SQS_ENABLED=false
CHATWOOT_ENABLED=false
OPENAI_ENABLED=false
DIFY_ENABLED=false
S3_ENABLED=false`} />

            <InfoBox>
              <strong>Onde preencher os valores:</strong><br/>
              • <code>[SEU-SERVICO]</code> → O nome que você deu ao Web Service (ex: <code>evolution-api</code>). A URL final será <code>https://evolution-api.onrender.com</code><br/>
              • <code>[CRIE_UMA_CHAVE_FORTE]</code> → Gere uma chave aleatória segura (use um gerador de senha de 32+ caracteres)<br/>
              • <code>[SUA_INTERNAL_DATABASE_URL]</code> → A URL interna do PostgreSQL do Passo 2<br/>
              • <code>[SUA_INTERNAL_REDIS_URL]</code> → A URL interna do Redis do Passo 3
            </InfoBox>

            <InfoBox type="warn">
              Certifique-se de adicionar <code>?schema=public</code> ao final da DATABASE_CONNECTION_URI. Sem isso, a Evolution API pode ter erros de migração.
            </InfoBox>

            <p className="text-xs text-muted-foreground mt-3">Após preencher todas as variáveis, clique em <strong>"Create Web Service"</strong>. O deploy levará de 2 a 5 minutos.</p>

            <button onClick={() => markComplete(4)} className="h-11 px-6 rounded-2xl bg-primary text-primary-foreground text-sm font-bold flex items-center gap-2">
              Web Service criado e deployando <ArrowRight className="h-4 w-4" />
            </button>
          </Step>

          {/* STEP 5 — Verificar deploy */}
          <Step number={5} title="Verificar se está rodando" isActive={activeStep === 5} isComplete={completedSteps.has(5)} onClick={() => setActiveStep(5)}>
            <p className="text-sm text-muted-foreground">Após o deploy finalizar (status "Live"), teste se a API está funcionando.</p>

            <div className="rounded-xl border border-white/[0.06] p-4 space-y-3">
              <p className="text-xs font-bold text-foreground">Teste no navegador:</p>
              <CodeBlock label="URL de teste" code="https://[SEU-SERVICO].onrender.com/" />
              <p className="text-xs text-muted-foreground">Você deve ver um JSON com informações da API, algo como:</p>
              <CodeBlock label="Resposta esperada" code={`{
  "status": 200,
  "message": "Welcome to the Evolution API, it is working!",
  "version": "2.2.3",
  "documentation": "https://doc.evolution-api.com"
}`} />
            </div>

            <InfoBox type="warn">Se receber erro 502 ou timeout, aguarde mais 2-3 minutos. O primeiro deploy pode demorar. Verifique os logs no dashboard do Render: Dashboard → Web Services → evolution-api → Logs.</InfoBox>

            <button onClick={() => markComplete(5)} className="h-11 px-6 rounded-2xl bg-primary text-primary-foreground text-sm font-bold flex items-center gap-2">
              API está rodando! <ArrowRight className="h-4 w-4" />
            </button>
          </Step>

          {/* STEP 6 — Create instance */}
          <Step number={6} title="Criar instância e conectar WhatsApp" isActive={activeStep === 6} isComplete={completedSteps.has(6)} onClick={() => setActiveStep(6)}>
            <p className="text-sm text-muted-foreground">Agora crie uma instância na Evolution API e escaneie o QR Code para conectar seu WhatsApp.</p>

            <div className="space-y-4">
              <div className="rounded-xl border border-white/[0.06] p-4">
                <p className="text-xs font-bold text-foreground mb-3">1. Criar instância via API:</p>
                <CodeBlock label="cURL — Criar instância" code={`curl -X POST 'https://[SEU-SERVICO].onrender.com/instance/create' \\
  -H 'Content-Type: application/json' \\
  -H 'apikey: [SUA_AUTHENTICATION_API_KEY]' \\
  -d '{
    "instanceName": "starcrm",
    "integration": "WHATSAPP-BAILEYS",
    "qrcode": true
  }'`} />
                <p className="text-xs text-muted-foreground mt-2">Isso retorna um QR Code em base64. Copie o campo <code>qrcode.base64</code> da resposta.</p>
              </div>

              <div className="rounded-xl border border-white/[0.06] p-4">
                <p className="text-xs font-bold text-foreground mb-3">2. Escanear QR Code:</p>
                <p className="text-xs text-muted-foreground mb-2">Acesse o endpoint de QR Code no navegador:</p>
                <CodeBlock label="URL do QR Code" code="https://[SEU-SERVICO].onrender.com/instance/connect/starcrm" />
                <p className="text-xs text-muted-foreground mt-2">
                  Abra o <strong>WhatsApp no celular</strong> → <strong>Configurações</strong> → <strong>Dispositivos conectados</strong> → <strong>Conectar dispositivo</strong> → Escaneie o QR Code exibido.
                </p>
              </div>

              <div className="rounded-xl border border-white/[0.06] p-4">
                <p className="text-xs font-bold text-foreground mb-3">3. Verificar conexão:</p>
                <CodeBlock label="cURL — Verificar status" code={`curl -X GET 'https://[SEU-SERVICO].onrender.com/instance/connectionState/starcrm' \\
  -H 'apikey: [SUA_AUTHENTICATION_API_KEY]'`} />
                <p className="text-xs text-muted-foreground mt-2">Resposta esperada: <code className="text-emerald-400">{`{"instance":{"state":"open"}}`}</code></p>
              </div>
            </div>

            <InfoBox type="success">
              Quando o estado for <code>"open"</code>, seu WhatsApp está conectado e pronto para enviar mensagens!
            </InfoBox>

            <button onClick={() => markComplete(6)} className="h-11 px-6 rounded-2xl bg-primary text-primary-foreground text-sm font-bold flex items-center gap-2">
              WhatsApp conectado! <ArrowRight className="h-4 w-4" />
            </button>
          </Step>

          {/* STEP 7 — Configure CRM */}
          <Step number={7} title="Configurar no CRM da plataforma" isActive={activeStep === 7} isComplete={completedSteps.has(7)} onClick={() => setActiveStep(7)}>
            <p className="text-sm text-muted-foreground">Último passo! Configure a conexão no painel CRM da sua White Label.</p>

            <div className="rounded-xl border border-white/[0.06] p-4 space-y-3">
              <p className="text-xs font-bold text-foreground">No painel Admin → CRM → WhatsApp, preencha:</p>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-start gap-2">
                  <span className="text-primary font-bold shrink-0">URL da API:</span>
                  <span><code className="text-foreground bg-white/[0.06] px-1.5 py-0.5 rounded">https://[SEU-SERVICO].onrender.com</code></span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-primary font-bold shrink-0">API Key:</span>
                  <span>A mesma <code className="text-foreground bg-white/[0.06] px-1.5 py-0.5 rounded">AUTHENTICATION_API_KEY</code> que você criou no Passo 4</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-primary font-bold shrink-0">Instância:</span>
                  <span><code className="text-foreground bg-white/[0.06] px-1.5 py-0.5 rounded">starcrm</code> (ou o nome que deu no Passo 6)</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mt-3">Clique em <strong>"Salvar Configuração"</strong> e depois <strong>"Testar Conexão"</strong>. Se aparecer "WhatsApp Online" ✅, está tudo pronto!</p>

            <InfoBox type="success">
              <strong>Pronto!</strong> Agora você pode importar contatos via CSV e criar campanhas de disparo automático de mensagens no CRM.
              As mensagens são enviadas uma a uma com intervalo de 3-5 segundos para evitar bloqueio do WhatsApp.
            </InfoBox>

            <button onClick={() => markComplete(7)} className="h-11 px-6 rounded-2xl bg-emerald-500 text-white text-sm font-bold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Configuração concluída!
            </button>
          </Step>
        </div>

        {/* Summary */}
        <div className="mt-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 space-y-4" style={{ backdropFilter: "blur(40px)" }}>
          <h3 className="text-base font-bold text-foreground">Resumo dos dados que você precisa</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left py-2 text-[10px] text-muted-foreground uppercase font-bold">Dado</th>
                  <th className="text-left py-2 text-[10px] text-muted-foreground uppercase font-bold">Onde encontrar</th>
                  <th className="text-left py-2 text-[10px] text-muted-foreground uppercase font-bold">Usado em</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-white/[0.04]">
                  <td className="py-2 text-foreground font-semibold">Internal Database URL</td>
                  <td className="py-2">Render → PostgreSQL → Info</td>
                  <td className="py-2">Passo 4 (DATABASE_CONNECTION_URI)</td>
                </tr>
                <tr className="border-b border-white/[0.04]">
                  <td className="py-2 text-foreground font-semibold">Internal Redis URL</td>
                  <td className="py-2">Render → Key Value → Info</td>
                  <td className="py-2">Passo 4 (CACHE_REDIS_URI)</td>
                </tr>
                <tr className="border-b border-white/[0.04]">
                  <td className="py-2 text-foreground font-semibold">AUTHENTICATION_API_KEY</td>
                  <td className="py-2">Você cria (senha forte)</td>
                  <td className="py-2">Passo 4 + Passo 7 (API Key no CRM)</td>
                </tr>
                <tr className="border-b border-white/[0.04]">
                  <td className="py-2 text-foreground font-semibold">URL do Web Service</td>
                  <td className="py-2">Render → Web Service → Settings</td>
                  <td className="py-2">Passo 4 (SERVER_URL) + Passo 7 (URL da API)</td>
                </tr>
                <tr>
                  <td className="py-2 text-foreground font-semibold">Nome da instância</td>
                  <td className="py-2">Você define (ex: starcrm)</td>
                  <td className="py-2">Passo 6 + Passo 7 (Instância no CRM)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Troubleshooting */}
        <div className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 space-y-4" style={{ backdropFilter: "blur(40px)" }}>
          <h3 className="text-base font-bold text-foreground">Problemas comuns</h3>
          <div className="space-y-3">
            {[
              { q: "Erro 502 Bad Gateway", a: "O serviço ainda está iniciando. Aguarde 2-3 minutos. Verifique os logs no Render para erros de conexão com o banco." },
              { q: "QR Code não aparece", a: "Verifique se a AUTHENTICATION_API_KEY está correta no header. Tente acessar via navegador: /instance/connect/starcrm" },
              { q: "WhatsApp desconecta após horas", a: "Pode ser o plano Free do Render hibernando. Upgrade para Starter ($7/mês) para manter 24/7." },
              { q: "Erro de banco de dados", a: "Certifique-se que adicionou ?schema=public no final da DATABASE_CONNECTION_URI e que o Postgres está na mesma região." },
              { q: "Mensagens não enviam", a: "Verifique se a instância está com state: 'open'. Se desconectou, re-escaneie o QR Code." },
            ].map((item, i) => (
              <div key={i} className="rounded-xl border border-white/[0.04] p-3">
                <p className="text-xs font-bold text-foreground mb-1">{item.q}</p>
                <p className="text-[11px] text-muted-foreground">{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Links */}
        <div className="mt-6 flex flex-wrap gap-3">
          <LinkButton href="https://doc.evolution-api.com/v2/en/install/docker">Docs Evolution API</LinkButton>
          <LinkButton href="https://dashboard.render.com">Dashboard Render</LinkButton>
          <LinkButton href="https://doc.evolution-api.com/v2/api-reference/get-information">API Reference</LinkButton>
        </div>
      </div>
    </div>
  );
}
