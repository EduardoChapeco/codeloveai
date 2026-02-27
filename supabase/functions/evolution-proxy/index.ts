import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ProxyAction = "create" | "connect" | "state";

type AttemptLog = {
  endpoint: string;
  status: number;
  contentType: string;
  preview: string;
};

const endpointCandidates: Record<ProxyAction, string[]> = {
  create: ["/instance/create", "/api/instance/create", "/v2/instance/create"],
  connect: ["/instance/connect", "/api/instance/connect", "/v2/instance/connect"],
  state: ["/instance/connectionState", "/api/instance/connectionState", "/v2/instance/connectionState"],
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, serviceUrl, apiKey, instanceName } = await req.json();

    if (!serviceUrl || !apiKey || !instanceName) {
      return new Response(JSON.stringify({ error: "Missing serviceUrl, apiKey, or instanceName" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["create", "connect", "state"].includes(action)) {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const typedAction = action as ProxyAction;
    const cleanUrl = String(serviceUrl).trim().replace(/\/+$/, "");
    const safeName = String(instanceName).replace(/[^a-zA-Z0-9_-]/g, "");

    const headers: Record<string, string> = {
      apikey: String(apiKey),
      "Content-Type": "application/json",
    };

    const attempts: AttemptLog[] = [];

    for (const basePath of endpointCandidates[typedAction]) {
      const url = typedAction === "create"
        ? `${cleanUrl}${basePath}`
        : `${cleanUrl}${basePath}/${safeName}`;

      const body = typedAction === "create"
        ? JSON.stringify({
            instanceName: safeName,
            integration: "WHATSAPP-BAILEYS",
            qrcode: true,
            token: String(apiKey),
          })
        : undefined;

      const resp = await fetch(url, {
        method: typedAction === "create" ? "POST" : "GET",
        headers,
        ...(body ? { body } : {}),
      });

      const contentType = resp.headers.get("content-type") || "";
      const rawText = await resp.text();

      let data: unknown = null;
      if (contentType.includes("application/json")) {
        try {
          data = rawText ? JSON.parse(rawText) : {};
        } catch {
          data = null;
        }
      }

      if (resp.ok && (data !== null || !rawText.trim())) {
        return new Response(JSON.stringify(data ?? {}), {
          status: resp.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      attempts.push({
        endpoint: url,
        status: resp.status,
        contentType,
        preview: rawText.substring(0, 180),
      });

      if (resp.status === 401 || resp.status === 403) {
        return new Response(JSON.stringify({
          error: "Falha de autenticação na Evolution API (API Key inválida ou sem permissão).",
          attempts,
        }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({
      error: "Não foi possível encontrar um endpoint compatível da Evolution API para esta ação.",
      hint: "Verifique se o serviço Render está com a imagem correta da Evolution API v2.2.3 e se as variáveis de ambiente foram aplicadas.",
      attempts,
    }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
