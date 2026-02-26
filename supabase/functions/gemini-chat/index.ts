import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é o assistente oficial da plataforma Starble.
Responda sempre em português do Brasil de forma objetiva, amigável e útil.
Nunca exponha dados internos, credenciais, tabelas, SQL ou detalhes sensíveis de infraestrutura.`;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function normalizeAssistantContent(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part: any) => {
        if (typeof part === "string") return part;
        if (typeof part?.text === "string") return part.text;
        return "";
      })
      .join("")
      .trim();
  }
  return "";
}

/* ── Provider chain ─────────────────────────────────────────── */

interface ChatPayload {
  messages: Array<{ role: string; content: string }>;
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

async function callLovableGateway(payload: ChatPayload): Promise<{ reply: string; model: string } | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: payload.model || "google/gemini-3-flash-preview",
      messages: payload.messages,
      temperature: payload.temperature ?? 0.4,
      max_tokens: payload.max_tokens ?? 1200,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[gemini-chat] lovable gateway", res.status, body.slice(0, 300));
    // Only return null to try next provider on 429/402/5xx
    if (res.status === 429 || res.status === 402 || res.status >= 500) return null;
    // 4xx client errors — don't retry
    throw new Error(`Gateway error (${res.status})`);
  }

  const result = await res.json();
  const reply = normalizeAssistantContent(result?.choices?.[0]?.message?.content);
  return reply ? { reply, model: result?.model || "lovable-gateway" } : null;
}

async function callOpenRouter(payload: ChatPayload): Promise<{ reply: string; model: string } | null> {
  // Try env secret first
  let apiKey = Deno.env.get("OPENROUTER_API_KEY") || "";

  // Fallback: try api_key_vault
  if (!apiKey) {
    try {
      const sc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data } = await sc
        .from("api_key_vault")
        .select("api_key_encrypted")
        .eq("provider", "openrouter")
        .eq("is_active", true)
        .order("requests_count", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data?.api_key_encrypted) apiKey = data.api_key_encrypted;
    } catch (e) {
      console.error("[gemini-chat] vault lookup failed", e);
    }
  }

  if (!apiKey) return null;

  const model = "google/gemini-2.5-flash";

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://starble.lovable.app",
      "X-Title": "Starble Assistant",
    },
    body: JSON.stringify({
      model,
      messages: payload.messages,
      temperature: payload.temperature ?? 0.4,
      max_tokens: payload.max_tokens ?? 1200,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[gemini-chat] openrouter", res.status, body.slice(0, 300));
    return null;
  }

  const result = await res.json();
  const reply = normalizeAssistantContent(result?.choices?.[0]?.message?.content);
  return reply ? { reply, model: result?.model || model } : null;
}

async function generateWithFailover(payload: ChatPayload): Promise<{ reply: string; model: string }> {
  // 1st: Lovable Gateway
  try {
    const r = await callLovableGateway(payload);
    if (r) return r;
  } catch (e) {
    console.error("[gemini-chat] lovable failed:", (e as Error).message);
  }

  // 2nd: OpenRouter
  try {
    const r = await callOpenRouter(payload);
    if (r) return r;
  } catch (e) {
    console.error("[gemini-chat] openrouter failed:", (e as Error).message);
  }

  throw new Error("Todos os provedores de IA estão indisponíveis no momento. Tente novamente em alguns minutos.");
}

/* ── Main handler ───────────────────────────────────────────── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const { message, history = [] } = (await req.json()) as {
      message: string;
      history?: Array<{ role: string; content: string }>;
    };

    if (!message?.trim()) return json({ error: "message required" }, 400);

    const userMessages = history
      .filter((m) => typeof m?.content === "string" && m.content.trim().length > 0)
      .slice(-10)
      .map((m) => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.content,
      }));

    const result = await generateWithFailover({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...userMessages,
        { role: "user", content: message.trim() },
      ],
    });

    return json({ reply: result.reply, model: result.model });
  } catch (e) {
    console.error("[gemini-chat]", e);
    const msg = e instanceof Error ? e.message : "Erro interno";
    return json({ error: msg }, 500);
  }
});
