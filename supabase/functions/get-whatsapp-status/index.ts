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
    const { data: { user }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    // ── Input ──
    const body = await req.json().catch(() => ({}));
    const rawName = String(body.instance_name || "").replace(/[^a-zA-Z0-9_-]/g, "");
    if (!rawName) return json({ error: "instance_name required" }, 400);

    // ── Ownership check ──
    const sc = createClient(supabaseUrl, serviceRole);
    const { data: owned } = await sc
      .from("whatsapp_instances")
      .select("instance_name")
      .eq("instance_name", rawName)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!owned) return json({ error: "Forbidden" }, 403);

    // ── Evolution config ──
    const EVO_URL = (Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/+$/, "");
    const EVO_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";
    if (!EVO_URL || !EVO_KEY)
      return json({ error: "Evolution API not configured" }, 500);

    // ── GET /instance/connect/{instanceName} ──
    let data: any = {};
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(`${EVO_URL}/instance/connect/${rawName}`, {
        method: "GET",
        headers: { apikey: EVO_KEY, Authorization: `Bearer ${EVO_KEY}` },
        signal: controller.signal,
      });
      clearTimeout(timer);

      const contentType = res.headers.get("content-type") || "";
      const text = await res.text().catch(() => "");
      const isHtml = contentType.includes("text/html") || text.trimStart().startsWith("<!");

      console.log(`[get-wa-status] GET /instance/connect/${rawName} -> ${res.status} ${isHtml ? "(HTML)" : ""} | ${text.slice(0, 400)}`);

      if (!isHtml && text) {
        try { data = JSON.parse(text); } catch { /* not json */ }
      }

      // If Render returned HTML (cold start), return waiting
      if (isHtml) {
        return json({ status: "waiting", qr_code: null, phone_number: null });
      }
    } catch (err) {
      console.error(`[get-wa-status] fetch error: ${err}`);
      return json({ status: "waiting", qr_code: null, phone_number: null });
    }

    // ── Parse response ──
    const state = data?.instance?.state || "";
    const base64 = data?.base64 || data?.qrcode?.base64 || null;
    const count = data?.qrcode?.count ?? data?.count;

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

    // ── Update DB ──
    const dbStatus = resolvedStatus === "waiting" ? "connecting" : resolvedStatus;
    await sc
      .from("whatsapp_instances")
      .update({
        status: dbStatus,
        qr_code: qrCode,
        phone_number: resolvedStatus === "connected" ? phone : null,
        updated_at: new Date().toISOString(),
      })
      .eq("instance_name", rawName)
      .eq("user_id", user.id);

    return json({
      status: resolvedStatus,
      qr_code: qrCode,
      phone_number: phone,
    });
  } catch (err) {
    console.error("[get-wa-status] fatal:", err);
    return json({ error: "Internal error" }, 500);
  }
});
