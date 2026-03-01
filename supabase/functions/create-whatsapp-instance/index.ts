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
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const token = authHeader.replace("Bearer ", "").trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !anonKey || !serviceRole) return json({ error: "Backend not configured" }, 500);

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await anonClient.auth.getUser(token);
    const user = userData?.user;
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const tenantId = typeof body.tenant_id === "string" ? body.tenant_id.trim() : "";
    if (!tenantId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      return json({ error: "tenant_id required" }, 400);
    }

    const sc = createClient(supabaseUrl, serviceRole);

    const { data: role } = await sc
      .from("tenant_users")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!role) return json({ error: "Forbidden" }, 403);

    const EVOLUTION_URL = (Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/+$/, "");
    const EVOLUTION_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";

    if (!EVOLUTION_URL || !EVOLUTION_KEY) return json({ error: "Evolution API not configured" }, 500);

    const instanceName = `starcrm_${user.id.replace(/-/g, "").slice(0, 8)}`;

    // Check if already connected
    const { data: existing } = await sc
      .from("whatsapp_instances")
      .select("instance_name, status")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing?.status === "connected") {
      return json({ instance_name: existing.instance_name, status: "connected", qr_code: null });
    }

    // STEP 1: Delete old instance (ignore errors)
    console.log(`[create-wa] Deleting ${instanceName}...`);
    await fetch(`${EVOLUTION_URL}/instance/delete/${instanceName}`, {
      method: "DELETE",
      headers: { "apikey": EVOLUTION_KEY },
    }).catch(() => {});

    // STEP 2: Wait 2s
    await new Promise(r => setTimeout(r, 2000));

    // STEP 3: Create instance
    console.log(`[create-wa] Creating ${instanceName}...`);
    const createRes = await fetch(`${EVOLUTION_URL}/instance/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": EVOLUTION_KEY },
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
      }),
    });
    const createRaw = await createRes.text().catch(() => "");
    console.log(`[create-wa] Create -> ${createRes.status} | ${createRaw.slice(0, 300)}`);

    // STEP 4: Wait 4s for Baileys to initialize
    await new Promise(r => setTimeout(r, 4000));

    // STEP 5-8: Poll GET /instance/connect/{instanceName} up to 5 times
    let qrCode: string | null = null;
    let finalStatus = "connecting";

    for (let attempt = 0; attempt < 5; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 3000));

      console.log(`[create-wa] Connect attempt ${attempt + 1}...`);
      const connectRes = await fetch(`${EVOLUTION_URL}/instance/connect/${instanceName}`, {
        method: "GET",
        headers: { "apikey": EVOLUTION_KEY },
      }).catch(() => null);

      const raw = await connectRes?.text().catch(() => "") || "";
      console.log(`[create-wa] Connect -> ${connectRes?.status} | ${raw.slice(0, 300)}`);

      let data: any = {};
      try { data = JSON.parse(raw); } catch { /* ignore */ }

      if (data?.instance?.state === "open") {
        finalStatus = "connected";
        qrCode = null;
        break;
      }

      if (data?.base64) {
        qrCode = data.base64;
        finalStatus = "connecting";
        break;
      }

      // count=0 means QR not ready yet, keep retrying
      console.log(`[create-wa] No QR yet (count=${data?.qrcode?.count}), retrying...`);
    }

    const persistedStatus = finalStatus === "connected" ? "connected" : qrCode ? "connecting" : "connecting";

    await sc.from("whatsapp_instances").upsert(
      {
        tenant_id: tenantId,
        user_id: user.id,
        instance_name: instanceName,
        status: persistedStatus,
        qr_code: finalStatus === "connected" ? null : qrCode,
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
