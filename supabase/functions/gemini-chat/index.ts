import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * gemini-chat — Star AI Company Assistant
 *
 * Answers user questions about the Starble platform using Gemini.
 * Scope: HOW to use features, plans, troubleshooting.
 * Forbidden: exposing DB schema, internal fields, credentials, technical internals.
 *
 * POST { message: string, history?: Array<{role, content}> }
 * → { reply: string, model: string }
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ── System prompt with platform knowledge ─────────────────────
const SYSTEM_PROMPT = `Você é o assistente oficial da plataforma Starble.
Sua função é ajudar usuários a entender e usar a plataforma.

MÓDULOS DA PLATAFORMA:
- Dashboard: visão geral da conta, projetos, uso de tokens
- Brain / Star AI: chat com IA diretamente integrado ao Lovable (editor de apps/sites). Possui modos: Chat, Assistente, Orquestrador
- Orquestrador: cria apps e sites automaticamente usando fases sequenciais via Lovable AI. Gera PRD → tasks → executa → audita → publica
- Projetos Lovable: integra com sua conta Lovable para editar, visualizar e publicar projetos
- StarCrawl: extrai dados, design e conteúdo de sites para gerar prompts e alimentar projetos
- Notes: sistema de anotações sincronizadas com extensão Chrome
- Planos: Free Trial (10 mensagens), Daily Token (ilimitado), planos white-label para revenda
- Admin Master: painel exclusivo do administrador para gerenciar usuários, planos, integrações de API, chaves externas

REGRAS OBRIGATÓRIAS:
1. Responda APENAS em português brasileiro
2. NUNCA mencione: nomes de tabelas de banco de dados, Edge Functions, código-fonte, variáveis de ambiente, tokens JWT, SQL
3. NUNCA exponha dados de outros usuários
4. Se não souber, diga: "Não tenho essa informação no momento. Entre em contato com o suporte."
5. Seja direto, amigável e conciso
6. Use emojis com moderação para tornar a resposta mais amigável`;

// ── Gemini API call ───────────────────────────────────────────
async function callGemini(apiKey: string, messages: Array<{ role: string; parts: Array<{ text: string }> }>) {
  const model = "gemini-1.5-flash"; // fast + free tier
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: messages,
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.7,
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_HATE_SPEECH",       threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",  threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      ],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Gemini API error ${resp.status}: ${err.slice(0, 200)}`);
  }

  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned empty response");
  return { reply: text as string, model };
}

// ── Main handler ──────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sc = createClient(supabaseUrl, serviceKey);

  // Auth check
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  try {
    const { message, history = [] } = await req.json() as {
      message: string;
      history?: Array<{ role: string; content: string }>;
    };

    if (!message?.trim()) return json({ error: "message required" }, 400);

    // Get Gemini key from orchestrator
    const keyResp = await sc.functions.invoke("api-key-router", {
      body: { action: "get", provider: "gemini" },
    });

    let apiKey: string | null = null;

    if (!keyResp.error && keyResp.data?.key) {
      apiKey = keyResp.data.key as string;
    } else {
      // Fallback to env secret
      apiKey = Deno.env.get("GEMINI_API_KEY") || null;
    }

    if (!apiKey) {
      return json({
        reply: "⚠️ O assistente está temporariamente indisponível. Todas as chaves Gemini atingiram o limite diário. O admin foi notificado.",
        model: "unavailable",
      });
    }

    // Build conversation for Gemini
    const geminiMessages: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    // Add history (convert role names)
    for (const h of history.slice(-10)) { // max 10 turns of history
      geminiMessages.push({
        role: h.role === "ai" ? "model" : "user",
        parts: [{ text: h.content }],
      });
    }

    // Add current message
    geminiMessages.push({ role: "user", parts: [{ text: message }] });

    const result = await callGemini(apiKey, geminiMessages);

    // Update token usage in api_keys (estimate: ~4 chars per token)
    if (keyResp.data?.id) {
      const estimatedTokens = Math.ceil((message.length + result.reply.length) / 4);
      await sc.functions.invoke("api-key-router", {
        body: { action: "update_usage", id: keyResp.data.id, tokens_used: estimatedTokens },
      });
    }

    return json(result);

  } catch (e) {
    console.error("[gemini-chat]", e);
    return json({ error: (e as Error).message }, 500);
  }
});
