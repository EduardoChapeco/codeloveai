import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

    // Sanitize inputs
    const cleanUrl = serviceUrl.replace(/\/+$/, "");
    const safeName = instanceName.replace(/[^a-zA-Z0-9_-]/g, "");

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
        });
        break;
      case "connect":
        url = `${cleanUrl}/instance/connect/${safeName}`;
        break;
      case "state":
        url = `${cleanUrl}/instance/connectionState/${safeName}`;
        break;
      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const headers: Record<string, string> = {
      "apikey": apiKey,
      "Content-Type": "application/json",
    };

    const resp = await fetch(url, {
      method,
      headers,
      ...(body ? { body } : {}),
    });

    const contentType = resp.headers.get("content-type") || "";
    const rawText = await resp.text();

    if (!contentType.includes("application/json")) {
      console.error("Evolution API returned non-JSON:", rawText.substring(0, 300));
      return new Response(JSON.stringify({ 
        error: `A Evolution API retornou HTML em vez de JSON (status ${resp.status}). Verifique se a URL do serviço está correta e se o servidor está rodando.`,
        hint: rawText.includes("Cannot GET") ? "A rota pode estar incorreta. Confirme a URL base da API." : 
              rawText.includes("DOCTYPE") ? "O servidor retornou uma página HTML. Pode estar em modo de espera (cold start) ou a URL está errada." : undefined
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = JSON.parse(rawText);

    return new Response(JSON.stringify(data), {
      status: resp.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
