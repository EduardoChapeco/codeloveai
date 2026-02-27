import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, serviceUrl, apiKey, instanceName } = await req.json();

    if (!serviceUrl) {
      return jsonRes({ error: "serviceUrl é obrigatório" }, 400);
    }

    const cleanUrl = String(serviceUrl).trim().replace(/\/+$/, "");
    const safeName = instanceName ? String(instanceName).replace(/[^a-zA-Z0-9_-]/g, "") : "default";
    const key = apiKey ? String(apiKey) : "";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(key ? { apikey: key } : {}),
    };

    // ── HEALTH CHECK ──
    if (action === "healthCheck") {
      try {
        const resp = await fetch(cleanUrl, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        const rawText = await resp.text();

        // Evolution API returns JSON with status/message/version
        let parsed: Record<string, unknown> | null = null;
        try {
          parsed = JSON.parse(rawText);
        } catch {
          // not json
        }

        const isEvolution =
          parsed !== null &&
          (typeof parsed.version === "string" || typeof parsed.message === "string");

        return jsonRes({
          ok: isEvolution,
          httpStatus: resp.status,
          isEvolution,
          version: parsed?.version || null,
          message: parsed?.message || null,
          hint: isEvolution
            ? null
            : `A URL ${cleanUrl} não retornou uma resposta válida da Evolution API. Resposta: ${rawText.substring(0, 200)}`,
        });
      } catch (err) {
        return jsonRes({
          ok: false,
          isEvolution: false,
          hint: `Não foi possível conectar em ${cleanUrl}: ${String(err)}`,
        });
      }
    }

    // ── Validate required fields for other actions ──
    if (!key || !safeName) {
      return jsonRes({ error: "apiKey e instanceName são obrigatórios para esta ação" }, 400);
    }

    if (!["create", "connect", "state"].includes(action)) {
      return jsonRes({ error: `Ação inválida: ${action}` }, 400);
    }

    // ── Build request ──
    let url = "";
    let method = "GET";
    let body: string | undefined;

    switch (action) {
      case "create":
        url = `${cleanUrl}/instance/create`;
        method = "POST";
        body = JSON.stringify({
          instanceName: safeName,
          integration: "WHATSAPP-BAILEYS",
          qrcode: true,
          token: key,
        });
        break;
      case "connect":
        url = `${cleanUrl}/instance/connect/${safeName}`;
        break;
      case "state":
        url = `${cleanUrl}/instance/connectionState/${safeName}`;
        break;
    }

    const resp = await fetch(url, {
      method,
      headers,
      ...(body ? { body } : {}),
    });

    const contentType = resp.headers.get("content-type") || "";
    const rawText = await resp.text();

    // Auth errors
    if (resp.status === 401 || resp.status === 403) {
      return jsonRes({
        error: "Falha de autenticação. Verifique se a API Key está correta.",
        httpStatus: resp.status,
      }, 401);
    }

    // Non-JSON response
    if (!contentType.includes("application/json")) {
      console.error(`[evolution-proxy] ${action} → ${url} returned ${resp.status} non-JSON:`, rawText.substring(0, 300));

      const isHtml = rawText.trim().startsWith("<!") || rawText.includes("<html");
      const isCannotRoute = rawText.includes("Cannot POST") || rawText.includes("Cannot GET");

      let hint = "Verifique se o servidor está rodando e a URL está correta.";
      if (isCannotRoute) {
        hint = "O servidor está online mas não reconhece esta rota. Verifique se o deploy da Evolution API foi concluído com a imagem correta (atendai/evolution-api:latest) e se as variáveis de ambiente foram aplicadas no Render.";
      } else if (isHtml) {
        hint = "O servidor retornou HTML. Pode estar em cold start ou com erro de configuração.";
      }

      return jsonRes({
        error: `Evolution API retornou status ${resp.status} com conteúdo não-JSON.`,
        hint,
        endpoint: url,
      }, 502);
    }

    // JSON response
    let data: unknown = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      return jsonRes({ error: "Resposta JSON inválida da Evolution API", raw: rawText.substring(0, 300) }, 502);
    }

    return jsonRes(data, resp.status);
  } catch (err) {
    return jsonRes({ error: String(err) }, 500);
  }
});
