// Starble — validate-plan v2.1.0
// DB-driven validation only (no external worker trust), strict revocation, device binding enforced

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { guardLicense } from "../_shared/license-guard.ts";

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
    return new Response(JSON.stringify({ ok: false, purgeToken: true, error: "Token inválido." }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sbUrl = Deno.env.get("SUPABASE_URL")!;
  const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(sbUrl, sbKey);

  try {
    // Strict DB guard (includes expiry checks + auto-deactivation)
    const guard = await guardLicense(sb, clfToken);
    if (!guard.allowed) {
      return new Response(JSON.stringify({ ok: false, purgeToken: true, error: guard.error || "Licença inválida ou expirada." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const license = (guard.license || {}) as any;

    // ── Device binding ──
    if (hwid) {
      if (!license.device_id) {
        await sb.from("licenses").update({ device_id: hwid }).eq("id", license.id);
        license.device_id = hwid;
      } else if (license.device_id !== hwid) {
        return new Response(JSON.stringify({ ok: false, purgeToken: true, error: "Dispositivo não autorizado. Esta licença está vinculada a outro computador." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Resolve allowed extensions from DB (plan_extensions) ──
    let allowedExtensions: string[] = [];

    // Admin master gets ALL active extensions
    if (guard.isAdmin) {
      const { data: allExts } = await sb
        .from("extension_catalog")
        .select("slug")
        .eq("is_active", true);
      allowedExtensions = (allExts || []).map((e: any) => e.slug);
    } else if (license.plan_id) {
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
    if (!guard.isAdmin && allowedExtensions.includes("labs")) {
      const { data: tenantUser } = await sb
        .from("tenant_users")
        .select("role")
        .eq("user_id", license.user_id)
        .eq("role", "tenant_owner")
        .maybeSingle();

      if (!tenantUser) {
        allowedExtensions = allowedExtensions.filter((e) => e !== "labs");
      }
    }

    // Fetch max_projects
    let maxProjects: number | null = null;
    if (license.plan_id) {
      const { data: planRow } = await sb.from("plans").select("max_projects").eq("id", license.plan_id).maybeSingle();
      if (planRow) maxProjects = planRow.max_projects;
    }

    // Profile identity
    const { data: profile } = await sb
      .from("profiles")
      .select("name, email")
      .eq("user_id", license.user_id)
      .maybeSingle();

    const plan = (license.plan || "free").toLowerCase();

    return new Response(
      JSON.stringify({
        ok: true,
        plan,
        allowedExtensions,
        maxProjects,
        name: profile?.name || null,
        email: profile?.email || null,
        exp: license.expires_at ? new Date(license.expires_at).getTime() : null,
        tenant: license.tenant_id || null,
        deviceBound: !!license.device_id || !!hwid,
        dailyMessages: guard.dailyLimit ?? null,
        usedToday: guard.usedToday ?? 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("validate-plan error:", err);
    return new Response(JSON.stringify({ ok: false, purgeToken: true, error: "Erro de conexão." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
