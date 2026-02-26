// Starble — validate-plan v2.0.0
// DB-driven extension access, Labs restricted to tenant owners, device binding enforced

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WORKER_URL = "https://codelove-fix-api.eusoueduoficial.workers.dev";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-clf-token, x-clf-hwid",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const clfToken = req.headers.get("x-clf-token") || "";
  const hwid = req.headers.get("x-clf-hwid") || "";

  if (!clfToken.startsWith("CLF1.")) {
    return new Response(JSON.stringify({ ok: false, error: "Token inválido." }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sbUrl = Deno.env.get("SUPABASE_URL")!;
  const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(sbUrl, sbKey);

  try {
    // Validate CLF token against worker
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

    // Find license in DB
    const { data: license } = await sb
      .from("licenses")
      .select("id, user_id, plan_id, device_id, plan")
      .eq("key", clfToken)
      .eq("active", true)
      .maybeSingle();

    if (!license) {
      return new Response(JSON.stringify({ ok: false, error: "Licença não encontrada." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Device binding ──
    if (hwid) {
      if (!license.device_id) {
        // First use: bind device
        await sb.from("licenses").update({ device_id: hwid }).eq("id", license.id);
      } else if (license.device_id !== hwid) {
        return new Response(JSON.stringify({ ok: false, error: "Dispositivo não autorizado. Esta licença está vinculada a outro computador." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Resolve allowed extensions from DB (plan_extensions) ──
    let allowedExtensions: string[] = [];
    if (license.plan_id) {
      const { data: peData } = await sb
        .from("plan_extensions")
        .select("extension_id")
        .eq("plan_id", license.plan_id);
      if (peData && peData.length > 0) {
        const extIds = peData.map((pe: any) => pe.extension_id);
        const { data: exts } = await sb
          .from("extension_catalog")
          .select("slug")
          .in("id", extIds);
        allowedExtensions = (exts || []).map((e: any) => e.slug);
      }
    }

    // ── Labs restriction: ONLY tenant owners can access ──
    if (allowedExtensions.includes("labs")) {
      const { data: tenantUser } = await sb
        .from("tenant_users")
        .select("role")
        .eq("user_id", license.user_id)
        .eq("role", "tenant_owner")
        .maybeSingle();

      if (!tenantUser) {
        // Remove labs from allowed extensions for non-tenant-owners
        allowedExtensions = allowedExtensions.filter(e => e !== "labs");
      }
    }

    // Fetch max_projects
    let maxProjects: number | null = null;
    if (license.plan_id) {
      const { data: planRow } = await sb.from("plans").select("max_projects").eq("id", license.plan_id).maybeSingle();
      if (planRow) maxProjects = planRow.max_projects;
    }

    const plan = (license.plan || data.plan || "free").toLowerCase();

    return new Response(
      JSON.stringify({
        ok: true,
        plan,
        allowedExtensions,
        maxProjects,
        name: data.name || data.n || null,
        email: data.email || data.e || null,
        exp: data.exp || null,
        tenant: data.tenant || null,
        branding: data.branding || null,
        deviceBound: !!license.device_id || !!hwid,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("validate-plan error:", err);
    return new Response(JSON.stringify({ ok: false, error: "Erro de conexão." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
