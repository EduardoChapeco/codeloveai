import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function evoFetch(
  base: string,
  key: string,
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; data: any }> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "Content-Type": "application/json", apikey: key },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text().catch(() => "");
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* not json */
  }
  console.log(`[create-wa] ${method} ${path} -> ${res.status} | ${text.slice(0, 400)}`);
  return { status: res.status, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // ── Auth ──
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer "))
      return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authErr,
    } = await anonClient.auth.getUser();
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    // ── Input ──
    const body = await req.json().catch(() => ({}));
    const tenantId = String(body.tenant_id || "").trim();
    if (
      !tenantId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        tenantId,
      )
    )
      return json({ error: "tenant_id required" }, 400);

    const sc = createClient(supabaseUrl, serviceRole);

    // ── Tenant membership check ──
    const { data: membership } = await sc
      .from("tenant_users")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!membership) return json({ error: "Forbidden" }, 403);

    // ── Evolution config ──
    const EVO_URL = (Deno.env.get("EVOLUTION_API_URL") || "").replace(
      /\/+$/,
      "",
    );
    const EVO_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";
    if (!EVO_URL || !EVO_KEY)
      return json({ error: "Evolution API not configured" }, 500);

    // ── Instance name (deterministic per user) ──
    const instanceName = `starcrm_${user.id.replace(/-/g, "").slice(0, 8)}`;

    // ── Check if already connected ──
    const { data: existing } = await sc
      .from("whatsapp_instances")
      .select("instance_name, status")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing?.status === "connected") {
      return json({
        instance_name: existing.instance_name,
        status: "connected",
        qr_code: null,
      });
    }

    // ── STEP 1: Delete old instance (ignore errors) ──
    await evoFetch(EVO_URL, EVO_KEY, "DELETE", `/instance/delete/${instanceName}`).catch(() => {});

    // ── STEP 2: Wait for cleanup ──
    await sleep(2000);

    // ── STEP 3: Create instance ──
    const createResult = await evoFetch(EVO_URL, EVO_KEY, "POST", "/instance/create", {
      instanceName,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
    });

    if (createResult.status >= 400 && createResult.status !== 409) {
      return json({
        instance_name: instanceName,
        status: "failed",
        error: `Evolution create failed: ${createResult.status}`,
        qr_code: null,
      });
    }

    // ── STEP 4: Wait for Baileys to initialize ──
    await sleep(4000);

    // ── STEP 5: Poll GET /instance/connect/{name} up to 12 times (60s total) ──
    let qrCode: string | null = null;
    let finalStatus = "connecting";

    for (let i = 0; i < 12; i++) {
      if (i > 0) await sleep(5000);

      const connectResult = await evoFetch(
        EVO_URL,
        EVO_KEY,
        "GET",
        `/instance/connect/${instanceName}`,
      );
      const d = connectResult.data;

      // Check if already connected
      if (d?.instance?.state === "open") {
        finalStatus = "connected";
        qrCode = null;
        break;
      }

      // Check for QR code in base64 field (v2.2.3 format)
      if (d?.base64) {
        qrCode = d.base64;
        finalStatus = "connecting";
        break;
      }

      // count:0 means Baileys still initializing, keep polling
      console.log(
        `[create-wa] Attempt ${i + 1}/12 - no QR yet (count=${d?.qrcode?.count ?? d?.count ?? "?"})`,
      );
    }

    // ── STEP 6: Persist to DB ──
    const dbStatus =
      finalStatus === "connected"
        ? "connected"
        : qrCode
          ? "connecting"
          : "connecting";

    await sc.from("whatsapp_instances").upsert(
      {
        tenant_id: tenantId,
        user_id: user.id,
        instance_name: instanceName,
        status: dbStatus,
        qr_code: finalStatus === "connected" ? null : qrCode,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "instance_name" },
    );

    return json({
      instance_name: instanceName,
      qr_code: finalStatus === "connected" ? null : qrCode,
      status: finalStatus,
    });
  } catch (err) {
    console.error("[create-wa] fatal:", err);
    return json({ error: "Internal error" }, 500);
  }
});
