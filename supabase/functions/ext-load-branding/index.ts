import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-extension, x-speed-client",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const extensionKey = req.headers.get("x-extension") || "speed";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: config } = await supabase
      .from("whitelabel_config")
      .select("app_name, logo_url, theme, colors, links, modules")
      .eq("extension_key", extensionKey)
      .maybeSingle();

    if (!config) {
      return new Response(
        JSON.stringify({
          ok: true,
          branding: {
            appName: "Speed",
            logoUrl: null,
            theme: "dark",
            colors: {
              acc: "#3b5bff",
              acc2: "#7b4fff",
              bg: "#1a1a1f",
              surf: "#222228",
              brd: "rgba(255,255,255,0.08)",
              txt: "#f0f0f2",
              txt2: "#8c8c99",
              sendBg: "#f0f0f2",
              sendIc: "#1a1a1f",
            },
            links: {
              sso: "https://starble.lovable.app/lovable/connect",
              upgrade: "https://starble.lovable.app/planos",
              dashboard: "https://starble.lovable.app/dashboard",
            },
            modules: [],
          },
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=300",
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        branding: {
          appName: config.app_name || "Speed",
          logoUrl: config.logo_url,
          theme: config.theme || "dark",
          colors: config.colors || {},
          links: config.links || {},
          modules: config.modules || [],
        },
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300",
        },
      }
    );
  } catch (err) {
    console.error("[ext-load-branding] Error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
