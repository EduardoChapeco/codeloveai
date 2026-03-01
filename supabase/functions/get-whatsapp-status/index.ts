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
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const instanceNameRaw = typeof body.instance_name === "string" ? body.instance_name : "";
    if (!instanceNameRaw) return json({ error: "instance_name required" }, 400);

    const safeName = instanceNameRaw.replace(/[^a-zA-Z0-9_-]/g, "");
    if (!safeName) return json({ error: "instance_name invalid" }, 400);

    const sc = createClient(supabaseUrl, serviceRole);
    const { data: ownedInstance } = await sc
      .from("whatsapp_instances")
      .select("instance_name")
      .eq("instance_name", safeName)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (!ownedInstance) return json({ error: "Forbidden" }, 403);

    const EVOLUTION_URL = (Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/+$/, "");
    const EVOLUTION_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";

    if (!EVOLUTION_URL || !EVOLUTION_KEY) return json({ error: "Evolution API not configured" }, 500);

    // v2.2.3: GET /instance/connect/{instanceName}
    const connectRes = await fetch(`${EVOLUTION_URL}/instance/connect/${safeName}`, {
      method: "GET",
      headers: { "apikey": EVOLUTION_KEY },
    }).catch(() => null);

    const raw = await connectRes?.text().catch(() => "") || "";
    console.log(`[get-whatsapp-status] connect -> ${connectRes?.status} | raw: ${raw.slice(0, 500)}`);

    let data: any = {};
    try { data = JSON.parse(raw); } catch { /* ignore */ }

    const state = data?.instance?.state || "";
    const base64 = data?.base64 || null;
    const count = data?.qrcode?.count;

    let resolvedStatus: string;
    let qrCode: string | null = null;
    let phone: string | null = null;

    if (state === "open") {
      resolvedStatus = "connected";
      phone = data?.instance?.phone || null;
    } else if (base64) {
      resolvedStatus = "connecting";
      qrCode = base64;
    } else if (state === "connecting" || count === 0) {
      resolvedStatus = "waiting";
    } else {
      resolvedStatus = "disconnected";
    }

    // Update DB
    await sc.from("whatsapp_instances").update({
      status: resolvedStatus === "waiting" ? "connecting" : resolvedStatus,
      qr_code: qrCode,
      phone_number: resolvedStatus === "connected" ? phone : null,
      updated_at: new Date().toISOString(),
    }).eq("instance_name", safeName).eq("user_id", userData.user.id);

    return json({ status: resolvedStatus, qr_code: qrCode, phone_number: phone });
  } catch (err) {
    console.error("[get-whatsapp-status] fatal:", err);
    return json({ error: "Internal error" }, 500);
  }
});
