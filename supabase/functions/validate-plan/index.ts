// Starble — validate-plan v1.1.0 (with max_projects support)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Fetch max_projects from plans table if plan_id available
    let maxProjects: number | null = null;
    if (data.plan_id) {
      try {
        const sbUrl = Deno.env.get("SUPABASE_URL") || "";
        const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
        if (sbUrl && sbKey) {
          const sb = createClient(sbUrl, sbKey);
          const { data: planRow } = await sb.from("plans").select("max_projects").eq("id", data.plan_id).maybeSingle();
          if (planRow) maxProjects = planRow.max_projects;
        }
      } catch { /* non-critical */ }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        plan,
        addons,
        allowedExtensions,
        maxProjects,
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
