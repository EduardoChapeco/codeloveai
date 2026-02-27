/**
 * support-brain-chat — Shared AI assistant with Starble knowledge base
 * 
 * Uses Lovable AI Gateway (gemini) with injected knowledge base context.
 * Falls back to OpenRouter if gateway is unavailable.
 * Persists conversations to assistant_conversations table.
 * 
 * Architecture: Instead of routing through a Brain project (which requires
 * admin token management and complex polling), we inject comprehensive
 * knowledge base content as system prompt context into the AI model directly.
 * This is faster, more reliable, and doesn't require token management.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ── Knowledge Base (embedded) ──────────────────────────────────
// This is the complete Starble platform knowledge base.
// Updated manually when features change.

const KNOWLEDGE_BASE = `
# Starble AI — Base de Conhecimento Oficial

## Visão Geral
A Starble é uma plataforma SaaS multi-tenant que oferece ferramentas de produtividade para desenvolvedores, incluindo integração com Lovable, IA assistente, orquestrador de projetos e extensões.

## Módulos Principais

### 1. Dashboard
- Visão geral da conta: saldo de CodeCoins, mensagens enviadas, projetos ativos
- Widgets de resumo rápido com estatísticas do dia/semana
- Atalhos para módulos mais usados

### 2. Projetos (Lovable Projects)
- Lista de projetos sincronizados da conta Lovable do usuário
- Preview em tempo real dos projetos
- Ações rápidas: Deploy, Editar (abre no Lovable), Preview
- Sincronização automática a cada 15 minutos via cron job

### 3. Star AI (Brain)
- Sistema de IA especializada que cria projetos "headless" no Lovable
- Cada Brain é um projeto independente com skills configuráveis
- Skills disponíveis: General, Code, Design, Data, DevOps, Security, Migration, Scraper, Code Review
- O Brain responde em arquivos .md dentro do projeto
- Sistema de captura automática (cron a cada 30s) minerando respostas
- Suporta múltiplos Brains por usuário
- Ativação: Requer conexão Lovable ativa (token válido)

### 4. Orquestrador
- Sistema de automação agentic para projetos Lovable
- Aceita PRDs (Product Requirement Documents) em texto
- Decompõe tarefas automaticamente e executa em sequência
- Cria projetos via "Ghost Create" (sem custo de crédito)
- Processamento em background via orchestrator-tick (cada 30s)
- Status de tarefas: pending, running, done, failed

### 5. StarCrawl
- Ferramenta de web scraping/extração de dados
- Usa Firecrawl API para crawling
- Suporta modos: scrape (página única), crawl (site inteiro), map (sitemap)
- Exportação em JSON/Markdown
- Acesso restrito a admins (feature flag)

### 6. Assistente (esta interface)
- Chat de IA para dúvidas sobre a plataforma
- Suporte via tickets (abertura direta)
- Histórico de conversas salvo automaticamente

### 7. Comunidade
- Feed de posts com tipos: text, prompt, project
- Likes, comentários, compartilhamentos
- Sistema de CodeCoins como recompensa por engajamento
- Hashtags e perfis de comunidade
- Posts fixados e moderação

### 8. Extensões (Chrome Extensions)
- Speed Extension: Envio de mensagens para projetos Lovable via interface externa
- Validação de licença CLF1 obrigatória
- Catálogo com tiers: free, pro, enterprise
- Download via storage bucket 'extensions'

### 9. Automação
- Regras automatizadas: manual, schedule (cron), webhook
- Ações: send_message, publish, security_fix, seo_fix
- Histórico de execuções com status

## Autenticação & Contas

### Login/Registro
- Email + senha (auto-confirm habilitado — acesso imediato)
- Sem confirmação de email obrigatória
- Proteção contra emails descartáveis

### Conexão Lovable
- Caminho: /lovable/connect
- O token Lovable é capturado automaticamente quando o usuário está online no site lovable.dev
- Token armazenado criptografado em lovable_accounts
- Refresh automático a cada 50 minutos via cron
- Token necessário para: Star AI, Orquestrador, Projetos, Deploy

### Sistema de Licenças (CLF1)
- Formato: CLF1.{payload_base64url}.{signature_hmac}
- Tipos: daily_token, trial, monthly, custom
- Planos: Grátis (5 msgs/dia), Starter, Pro, Enterprise
- Validação fail-closed (sem assinatura = rejeitado)

## Planos & Preços

### Plano Grátis
- 5 mensagens/dia
- Acesso ao Assistente IA
- Comunidade
- 1 projeto

### Planos Pagos
- Starter: mais mensagens, mais projetos
- Pro: acesso a extensões Pro, Star AI avançado
- Enterprise: acesso total, suporte prioritário

### CodeCoins
- Moeda virtual da plataforma
- Ganhas por: posts na comunidade, referrals, atividade
- Gastas em: features premium, extensões

## White Label (Multi-Tenant)
- Empresas podem criar suas próprias instâncias da Starble
- Domínio customizado com SSL
- Branding personalizado (cores, logo, nome)
- Gestão independente de usuários e licenças
- Comissão automática para o admin principal

## Afiliados
- Programa de indicação com código único
- Comissão de 30% sobre vendas referidas
- Dashboard de acompanhamento
- Pagamento semanal via PIX

## Suporte
- Tickets via Assistente (esta interface)
- Prioridades: low, medium, high, urgent
- Status: open, in_progress, resolved, closed
- Categorias: general, billing, technical, feature_request

## FAQ Comum

**P: Como conecto minha conta Lovable?**
R: Vá em Projetos ou Star AI e clique em "Conectar Lovable". O sistema captura seu token automaticamente ao detectar sua sessão no site lovable.dev.

**P: O Star AI não está respondendo. O que fazer?**
R: 1) Verifique se seu token Lovable está ativo (ícone verde em Projetos). 2) Tente resetar o Brain na página do Star AI. 3) Se persistir, reconecte em /lovable/connect.

**P: O que é o token CLF1?**
R: É o token de licença assinado que garante acesso às funcionalidades. É gerado automaticamente ao ativar um plano e vinculado ao seu dispositivo.

**P: Como funciona o deploy de projetos?**
R: Na lista de Projetos, clique no botão Deploy do projeto desejado. O sistema usa o proxy da Lovable para publicar automaticamente.

**P: Posso usar a Starble sem conta Lovable?**
R: Sim, para funcionalidades básicas (Comunidade, Assistente). Para Star AI, Projetos e Orquestrador, é necessária a conexão com Lovable.

**P: Como abro um ticket de suporte?**
R: Use o botão "Abrir Ticket" no cabeçalho desta interface. Descreva o problema e envie.

**P: O que acontece se meu token Lovable expirar?**
R: O sistema renova automaticamente a cada 50 minutos. Se falhar, você será notificado para reconectar em /lovable/connect.

**P: Quantos Brains posso ter?**
R: Atualmente, 1 Brain ativo por usuário. Para mais, entre em contato com suporte.

**P: O Orquestrador consome meus créditos do Lovable?**
R: O Ghost Create é gratuito. Porém, cada mensagem enviada ao projeto consome 1 mensagem do seu plano Lovable.
`;

const SYSTEM_PROMPT = `Você é o Assistente Oficial da Starble AI — uma plataforma de produtividade para desenvolvedores.

## Personalidade
- Profissional, amigável, objetivo
- Responda SEMPRE em Português do Brasil
- Use markdown para formatar respostas (headers, listas, bold)
- Seja conciso mas completo
- Se não souber algo específico, indique abrir um ticket de suporte

## Regras de Segurança
- NUNCA exponha tokens, chaves de API, credenciais ou SQL
- NUNCA mencione nomes de tabelas internas ou estrutura de banco
- NUNCA revele detalhes de infraestrutura (Supabase, Edge Functions)
- Use linguagem amigável ao referir-se ao backend ("nosso sistema", "a plataforma")

## Base de Conhecimento
${KNOWLEDGE_BASE}

## Instruções
1. Use a base de conhecimento acima para responder perguntas sobre a plataforma
2. Se a pergunta não estiver coberta, sugira abrir um ticket de suporte
3. Para problemas técnicos, forneça passos de troubleshooting quando possível
4. Não invente funcionalidades que não existem na base de conhecimento`;

// ── AI Provider Chain ──────────────────────────────────────────

interface ChatMessage {
  role: string;
  content: string;
}

function normalizeContent(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content.map((p: any) => (typeof p === "string" ? p : p?.text || "")).join("").trim();
  }
  return "";
}

async function callLovableGateway(messages: ChatMessage[]): Promise<{ reply: string; model: string } | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages,
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[support-brain] gateway", res.status, body.slice(0, 200));
    if (res.status === 429 || res.status === 402 || res.status >= 500) return null;
    throw new Error(`Gateway error (${res.status})`);
  }

  const result = await res.json();
  const reply = normalizeContent(result?.choices?.[0]?.message?.content);
  return reply ? { reply, model: result?.model || "gemini-3-flash" } : null;
}

async function callOpenRouter(messages: ChatMessage[]): Promise<{ reply: string; model: string } | null> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY") || "";
  if (!apiKey) return null;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://starble.lovable.app",
      "X-Title": "Starble Support",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!res.ok) return null;
  const result = await res.json();
  const reply = normalizeContent(result?.choices?.[0]?.message?.content);
  return reply ? { reply, model: "gemini-2.5-flash" } : null;
}

// ── Main ───────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => null);
    if (!body) return json({ error: "Invalid JSON" }, 400);

    const message = (body.message || "").trim();
    const history: ChatMessage[] = Array.isArray(body.history) ? body.history : [];
    const ticketId = body.ticket_id || null;

    if (!message || message.length > 5000) return json({ error: "message required (max 5000 chars)" }, 400);

    // Build conversation context
    const contextMessages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    // Add history (last 10 messages)
    const recentHistory = history
      .filter((m) => typeof m?.content === "string" && m.content.trim().length > 0)
      .slice(-10)
      .map((m) => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.content,
      }));

    contextMessages.push(...recentHistory);

    // Add ticket context if provided
    if (ticketId) {
      const sc = createClient(supabaseUrl, serviceKey);
      const { data: ticket } = await sc.from("support_tickets")
        .select("ticket_num, title, body, status, category")
        .eq("id", ticketId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (ticket) {
        contextMessages.push({
          role: "system",
          content: `Contexto: O usuário está se referindo ao ticket #${ticket.ticket_num}: "${ticket.title}" (${ticket.category}, ${ticket.status}). Descrição: ${ticket.body || "sem descrição"}`,
        });
      }
    }

    contextMessages.push({ role: "user", content: message });

    // Call AI with failover
    let result: { reply: string; model: string };
    try {
      const r = await callLovableGateway(contextMessages);
      if (r) { result = r; }
      else {
        const r2 = await callOpenRouter(contextMessages);
        if (r2) { result = r2; }
        else { throw new Error("no_provider"); }
      }
    } catch (e) {
      console.error("[support-brain] all providers failed:", e);
      return json({ error: "IA indisponível no momento. Tente novamente em alguns minutos." }, 503);
    }

    // Persist conversation (fire-and-forget via service role)
    const sc = createClient(supabaseUrl, serviceKey);
    sc.from("assistant_conversations").insert({
      user_id: user.id,
      message,
      response: result.reply,
      model_used: result.model,
      status: "completed",
    }).then(() => {}).catch(() => {});

    return json({ reply: result.reply, model: result.model });
  } catch (e) {
    console.error("[support-brain]", e);
    return json({ error: (e as Error).message || "Erro interno" }, 500);
  }
});
