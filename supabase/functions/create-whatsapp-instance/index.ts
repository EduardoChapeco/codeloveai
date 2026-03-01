import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const tenantId = body.tenant_id;
    if (!tenantId || !/^[0-9a-f-]{36}$/i.test(tenantId)) {
      return json({ error: "tenant_id required" }, 400);
    }

    const sc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify tenant membership
    const { data: role } = await sc.from("tenant_users")
      .select("role").eq("user_id", user.id).eq("tenant_id", tenantId).maybeSingle();
    if (!role) return json({ error: "Forbidden" }, 403);

    const EVOLUTION_URL = (Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/+$/, "");
    const EVOLUTION_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";

    if (!EVOLUTION_URL || !EVOLUTION_KEY) {
      return json({ error: "Evolution API not configured" }, 500);
    }

    const instanceName = "starcrm_" + user.id.replace(/-/g, "").slice(0, 8);

    // Check if instance already exists
    const { data: existing } = await sc.from("whatsapp_instances")
      .select("*").eq("tenant_id", tenantId).eq("user_id", user.id).maybeSingle();

    if (existing?.status === "connected") {
      return json({ instance_name: existing.instance_name, status: "connected", qr_code: null });
    }

    // Create instance on Evolution API with timeout for cold starts
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    let evoRes: Response;
    try {
      evoRes = await fetch(`${EVOLUTION_URL}/instance/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: EVOLUTION_KEY },
        body: JSON.stringify({
          instanceName: instanceName,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
        }),
        signal: controller.signal,
      });
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      if (fetchErr.name === "AbortError") {
        return json({ error: "Evolution API timeout — servidor pode estar hibernando. Tente novamente em 30s." }, 504);
      }
      console.error("[create-whatsapp-instance] fetch error:", fetchErr.message);
      return json({ error: "Falha ao conectar com Evolution API" }, 502);
    }
    clearTimeout(timeout);

    const evoText = await evoRes.text();
    let evoData: any = {};
    try { evoData = JSON.parse(evoText); } catch {
      // Evolution API may return HTML when cold starting
      console.error("[create-whatsapp-instance] non-JSON response:", evoText.slice(0, 200));
      return json({ error: "Evolution API retornou resposta inválida — servidor pode estar iniciando. Tente novamente em 30s." }, 502);
    }

    const qrCode = evoData?.qrcode?.base64 || null;

    // If instance already exists in Evolution (409 or 403), try to connect
    if (!evoRes.ok && (evoRes.status === 403 || evoRes.status === 409)) {
      const connectRes = await fetch(`${EVOLUTION_URL}/instance/connect/${instanceName}`, {
        headers: { apikey: EVOLUTION_KEY },
      });
      const connectData = await connectRes.json().catch(() => ({}));
      const existingQr = connectData?.base64 || null;

      await sc.from("whatsapp_instances").upsert({
        tenant_id: tenantId, user_id: user.id, instance_name: instanceName,
        status: "connecting", qr_code: existingQr,
      }, { onConflict: "instance_name" });

      return json({ instance_name: instanceName, qr_code: existingQr, status: "connecting" });
    }

    if (!evoRes.ok) {
      console.error("[create-whatsapp-instance] Evolution error:", evoRes.status, evoData);
      return json({ error: `Evolution API error: ${evoData?.message || evoRes.status}` }, evoRes.status >= 500 ? 502 : 400);
    }

    // Save to DB
    await sc.from("whatsapp_instances").upsert({
      tenant_id: tenantId, user_id: user.id, instance_name: instanceName,
      status: "connecting", qr_code: qrCode,
    }, { onConflict: "instance_name" });

    return json({ instance_name: instanceName, qr_code: qrCode, status: "connecting" });
  } catch (err) {
    console.error("[create-whatsapp-instance]", err);
    return json({ error: "Internal error" }, 500);
  }
});
