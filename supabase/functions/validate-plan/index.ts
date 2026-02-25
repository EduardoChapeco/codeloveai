// Starble — validate-plan v1.0.0

const WORKER_URL = "https://codelove-fix-api.eusoueduoficial.workers.dev";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-clf-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PLAN_PERMISSIONS: Record<string, string[]> = {
  free:    [],
  speed:   ["speed"],
  booster: ["speed", "booster"],
  labs:    ["speed", "booster", "labs"],
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const clfToken = req.headers.get("x-clf-token") || "";
  if (!clfToken.startsWith("CLF1.")) {
    return new Response(JSON.stringify({ ok: false, error: "Token inválido." }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const res = await fetch(WORKER_URL + "/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: clfToken }),
    });
    const data = await res.json();
    if (!data.valid) {
      return new Response(JSON.stringify({ ok: false, error: "Licença inválida ou expirada." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const plan: string = (data.plan || data.plan_type || "free").toLowerCase();
    const addons: string[] = (data.addons || []).map((a: string) => a.toLowerCase());
    const allowedExtensions = [...(PLAN_PERMISSIONS[plan] || []), ...addons];

    return new Response(
      JSON.stringify({
        ok: true,
        plan,
        addons,
        allowedExtensions,
        name: data.name || data.n || null,
        email: data.email || data.e || null,
        exp: data.exp || null,
        tenant: data.tenant || null,
        branding: data.branding || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Erro de conexão." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
