import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * starcrawl — Firecrawl integration (presented to client as StarCrawl)
 *
 * Actions:
 *  scrape         → scrape a single URL (content + optional screenshot)
 *  crawl          → crawl a site up to N pages
 *  search         → web search via Firecrawl
 *  generate_prompt → scrape URL then generate a Lovable-ready prompt
 *
 * POST { action, url, options? }
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const FIRECRAWL_API = "https://api.firecrawl.dev/v1";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function firecrawlReq(path: string, body: unknown, apiKey: string) {
  const resp = await fetch(`${FIRECRAWL_API}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Firecrawl ${resp.status}: ${err.slice(0, 200)}`);
  }
  return resp.json();
}

function buildLovablePrompt(data: {
  url: string;
  title?: string;
  content?: string;
  screenshot?: string;
  action: string;
}): string {
  const { url, title, content = "", action } = data;
  const snippet = content.slice(0, 3000);

  const actionGuide: Record<string, string> = {
    scrape: "Recrie um site/landing page com design e conteúdo similar",
    crawl:  "Use os dados e estrutura do site como base para criar um novo projeto",
    search: "Use os resultados de pesquisa para criar uma análise de mercado ou dashboard",
  };

  return `${actionGuide[action] || "Analise e reproduza"} ao seguinte referencial:

URL Original: ${url}
Título: ${title || "(sem título)"}

Conteúdo extraído (resumo):
${snippet}${snippet.length < content.length ? "\n[... conteúdo truncado para brevidade ...]" : ""}

INSTRUÇÕES:
- Crie uma versão moderna, responsiva e visualmente atraente
- Use React + Tailwind CSS
- Mantenha a estrutura e hierarquia de informações do original
- Adicione melhorias de UX onde fizer sentido
- Use componentes shadcn/ui para elementos de UI
- NÃO copie conteúdo protegido por copyright — crie com inspiração no design e estrutura`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Auth — validate JWT
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "Unauthorized" }, 401);

  const sc = createClient(supabaseUrl, serviceKey);

  try {
    const { action = "scrape", url, options = {} } = await req.json() as {
      action: "scrape" | "crawl" | "search" | "generate_prompt";
      url?: string;
      options?: Record<string, unknown>;
    };

    // Get Firecrawl key
    const keyResp = await sc.functions.invoke("api-key-router", {
      body: { action: "get", provider: "firecrawl" },
    });

    const apiKey: string = keyResp.data?.key || Deno.env.get("FIRECRAWL_API_KEY") || "";
    if (!apiKey) return json({ error: "Nenhuma chave Firecrawl disponível. Configure em Admin > Integrações." }, 503);
    const keyId: string = keyResp.data?.id;

    let result: unknown;

    if (action === "scrape" || action === "generate_prompt") {
      if (!url) return json({ error: "url required" }, 400);
      const scraped = await firecrawlReq("/scrape", {
        url,
        formats: ["markdown", "html"],
        actions: options.screenshot ? [{ type: "screenshot" }] : undefined,
        ...options,
      }, apiKey);

      if (action === "generate_prompt") {
        const prompt = buildLovablePrompt({
          url,
          title:      scraped.data?.metadata?.title,
          content:    scraped.data?.markdown || scraped.data?.html || "",
          action:     "scrape",
        });
        result = { prompt, scraped: scraped.data };
      } else {
        result = scraped.data;
      }

    } else if (action === "crawl") {
      if (!url) return json({ error: "url required" }, 400);
      result = await firecrawlReq("/crawl", {
        url,
        limit: (options.limit as number) || 5,
        scrapeOptions: { formats: ["markdown"] },
        ...options,
      }, apiKey);

    } else if (action === "search") {
      const query = (options.query as string) || url;
      if (!query) return json({ error: "query or url required" }, 400);
      result = await firecrawlReq("/search", {
        query,
        limit: (options.limit as number) || 5,
        ...options,
      }, apiKey);
    } else {
      return json({ error: `Unknown action: ${action}` }, 400);
    }

    // Update usage
    if (keyId) {
      await sc.functions.invoke("api-key-router", {
        body: { action: "update_usage", id: keyId },
      });
    }

    return json({ ok: true, action, data: result });

  } catch (e) {
    console.error("[starcrawl]", e);
    return json({ error: (e as Error).message }, 500);
  }
});
