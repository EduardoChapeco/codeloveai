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
    const instanceName = body.instance_name;
    if (!instanceName || typeof instanceName !== "string") {
      return json({ error: "instance_name required" }, 400);
    }

    const safeName = instanceName.replace(/[^a-zA-Z0-9_-]/g, "");

    const EVOLUTION_URL = (Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/+$/, "");
    const EVOLUTION_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";

    if (!EVOLUTION_URL || !EVOLUTION_KEY) {
      return json({ error: "Evolution API not configured" }, 500);
    }

    // Check connection state with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let stateData: any = {};
    try {
      const stateRes = await fetch(`${EVOLUTION_URL}/instance/connectionState/${safeName}`, {
        headers: { apikey: EVOLUTION_KEY },
        signal: controller.signal,
      });
      const stateText = await stateRes.text();
      try { stateData = JSON.parse(stateText); } catch { /* ignore non-JSON */ }
    } catch (e: any) {
      clearTimeout(timeout);
      if (e.name === "AbortError") {
        return json({ status: "disconnected", qr_code: null, error: "timeout" });
      }
      return json({ status: "disconnected", qr_code: null, error: "connection_failed" });
    }
    clearTimeout(timeout);

    const state = stateData?.instance?.state || "disconnected";

    // If not connected, get fresh QR code
    let qrCode = null;
    if (state !== "open") {
      try {
        const connectRes = await fetch(`${EVOLUTION_URL}/instance/connect/${safeName}`, {
          headers: { apikey: EVOLUTION_KEY },
        });
        const connectData = await connectRes.json().catch(() => ({}));
        qrCode = connectData?.base64 || null;
      } catch { /* ignore */ }
    }

    // Update DB status
    const sc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const dbStatus = state === "open" ? "connected" : "connecting";
    await sc.from("whatsapp_instances")
      .update({
        status: dbStatus,
        qr_code: qrCode,
        ...(state === "open" ? { phone_number: stateData?.instance?.phoneNumber || null } : {}),
      })
      .eq("instance_name", safeName);

    return json({
      status: state === "open" ? "connected" : "disconnected",
      qr_code: qrCode,
      phone_number: stateData?.instance?.phoneNumber || null,
    });
  } catch (err) {
    console.error("[get-whatsapp-status]", err);
    return json({ error: "Internal error" }, 500);
  }
});
