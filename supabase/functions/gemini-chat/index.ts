import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const { message, history = [] } = await req.json() as {
      message: string;
      history?: Array<{ role: string; content: string }>;
    };

    if (!message?.trim()) return json({ error: "message required" }, 400);

    const gatewayKey = Deno.env.get("LOVABLE_API_KEY");
    if (!gatewayKey) return json({ error: "Serviço de IA não configurado" }, 500);

    const userMessages = history
      .filter((m) => typeof m?.content === "string" && m.content.trim().length > 0)
      .slice(-10)
      .map((m) => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.content,
      }));

    const gatewayRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${gatewayKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...userMessages,
          { role: "user", content: message.trim() },
        ],
        temperature: 0.4,
        max_tokens: 1200,
      }),
    });

    if (!gatewayRes.ok) {
      const body = await gatewayRes.text().catch(() => "");
      console.error("[gemini-chat] gateway error", gatewayRes.status, body.slice(0, 400));

      if (gatewayRes.status === 429) {
        return json({ error: "Muitas requisições no momento. Aguarde alguns segundos e tente novamente." }, 429);
      }
      if (gatewayRes.status === 402) {
        return json({ error: "Créditos de IA insuficientes no workspace. Recarregue para continuar." }, 402);
      }

      return json({ error: `Erro no gateway de IA (${gatewayRes.status})` }, 502);
    }

    const result = await gatewayRes.json();
    const reply = normalizeAssistantContent(result?.choices?.[0]?.message?.content);

    if (!reply) {
      return json({
        reply: "Não consegui gerar uma resposta agora. Tente reformular sua pergunta em uma frase mais curta.",
        model: "google/gemini-3-flash-preview",
      });
    }

    return json({
      reply,
      model: result?.model || "google/gemini-3-flash-preview",
    });
  } catch (e) {
    console.error("[gemini-chat]", e);
    return json({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
});
