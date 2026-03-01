import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  extractQr,
  mapConnectionState,
  pickPhone,
  requestEvolution,
} from "../_shared/evolution.ts";

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

    // Step 1: Check connection state
    const stateRes = await requestEvolution(EVOLUTION_URL, EVOLUTION_KEY, {
      method: "GET",
      endpoints: [
        `/instance/connectionState/${safeName}`,
        `/instance/connection-state/${safeName}`,
      ],
      timeoutMs: 25000,
    });

    console.log(`[get-whatsapp-status] connectionState ${stateRes.endpoint} -> ${stateRes.status} | raw: ${stateRes.raw.slice(0, 300)}`);

    let status = mapConnectionState(stateRes.data);
    let qrCode = extractQr(stateRes.data);
    let phone = pickPhone(stateRes.data);

    // Also check the raw "state" field for "connecting" (Evolution returns this before QR is ready)
    const rawState = stateRes.data?.instance
      ? (stateRes.data.instance as any)?.state
      : null;
    const isEvolutionConnecting = typeof rawState === "string" && rawState.toLowerCase() === "connecting";

    if (status === "connected") {
      // Already connected, update DB and return
      const sc = createClient(supabaseUrl, serviceRole);
      await sc.from("whatsapp_instances").update({
        status: "connected",
        qr_code: null,
        phone_number: phone,
        updated_at: new Date().toISOString(),
      }).eq("instance_name", safeName).eq("user_id", userData.user.id);

      return json({ status: "connected", qr_code: null, phone_number: phone });
    }

    // Step 2: Try /instance/connect/ to get QR code
    const connectRes = await requestEvolution(EVOLUTION_URL, EVOLUTION_KEY, {
      method: "GET",
      endpoints: [
        `/instance/connect/${safeName}`,
        `/instance/connect/${safeName}/`,
        `/api/instance/connect/${safeName}`,
        `/v2/instance/connect/${safeName}`,
      ],
      timeoutMs: 25000,
    });

    console.log(`[get-whatsapp-status] connect ${connectRes.endpoint} -> ${connectRes.status} | raw: ${connectRes.raw.slice(0, 500)}`);

    qrCode = qrCode || extractQr(connectRes.data);
    if (mapConnectionState(connectRes.data) === "connected") status = "connected";
    phone = phone || pickPhone(connectRes.data);

    // Step 2.1: dedicated QR endpoints (some Evolution builds only expose QR here)
    if (!qrCode && status !== "connected") {
      const qrRes = await requestEvolution(EVOLUTION_URL, EVOLUTION_KEY, {
        method: "GET",
        endpoints: [
          `/instance/qrcode/${safeName}`,
          `/api/instance/qrcode/${safeName}`,
          `/v2/instance/qrcode/${safeName}`,
          `/instance/qrCode/${safeName}`,
          `/v2/instance/qrCode/${safeName}`,
        ],
        timeoutMs: 20000,
      });

      console.log(`[get-whatsapp-status] qrcode ${qrRes.endpoint} -> ${qrRes.status} | raw: ${qrRes.raw.slice(0, 300)}`);
      qrCode = qrCode || extractQr(qrRes.data);
    }

    // Step 3: Resolve state without forcing false "disconnected" while Evolution is still bootstrapping QR
    const probeWorked = stateRes.ok || connectRes.ok;
    let resolvedStatus: "connected" | "connecting" | "disconnected" | "failed";

    if (status === "connected") {
      resolvedStatus = "connected";
    } else if (qrCode) {
      resolvedStatus = "connecting";
    } else if (isEvolutionConnecting || probeWorked) {
      // Evolution is alive and instance is still negotiating session/QR, keep waiting
      resolvedStatus = "connecting";
    } else if (stateRes.status >= 500 && connectRes.status >= 500) {
      resolvedStatus = "failed";
    } else {
      resolvedStatus = "disconnected";
    }

    const sc = createClient(supabaseUrl, serviceRole);
    await sc.from("whatsapp_instances").update({
      status: resolvedStatus,
      qr_code: resolvedStatus === "connected" ? null : qrCode,
      phone_number: resolvedStatus === "connected" ? phone : null,
      updated_at: new Date().toISOString(),
      }).eq("instance_name", safeName).eq("user_id", userData.user.id);

    return json({
      status: resolvedStatus,
      qr_code: resolvedStatus === "connected" ? null : qrCode,
      phone_number: phone,
    });
  } catch (err) {
    console.error("[get-whatsapp-status] fatal:", err);
    return json({ error: "Internal error" }, 500);
  }
});
