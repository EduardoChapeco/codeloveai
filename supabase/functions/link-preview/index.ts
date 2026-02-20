import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "URL inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return new Response(JSON.stringify({ error: "URL inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only allow http/https
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return new Response(JSON.stringify({ error: "Protocolo não suportado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch(url, {
      headers: { "User-Agent": "CodeLoveBot/1.0" },
      redirect: "follow",
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ title: parsedUrl.hostname, description: "", image: "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = await response.text();
    const maxLen = 50000; // Only parse first 50k chars
    const snippet = html.substring(0, maxLen);

    const getMetaContent = (property: string): string => {
      // Try og: tags first
      const ogMatch = snippet.match(new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"));
      if (ogMatch) return ogMatch[1];
      // Try reversed order
      const ogMatch2 = snippet.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`, "i"));
      if (ogMatch2) return ogMatch2[1];
      return "";
    };

    const title = getMetaContent("og:title") || getMetaContent("twitter:title") ||
      (snippet.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || parsedUrl.hostname);
    const description = getMetaContent("og:description") || getMetaContent("twitter:description") ||
      getMetaContent("description");
    const image = getMetaContent("og:image") || getMetaContent("twitter:image") || "";

    return new Response(JSON.stringify({
      title: title.substring(0, 200),
      description: description.substring(0, 500),
      image: image.substring(0, 500),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Link preview error:", error);
    return new Response(JSON.stringify({ error: "Erro ao buscar preview" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
