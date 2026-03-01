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

    const EVOLUTION_URL = (Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/+$/, "");
    const EVOLUTION_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";

    if (!EVOLUTION_URL || !EVOLUTION_KEY) return json({ error: "Evolution API not configured" }, 500);

    const stateRes = await requestEvolution(EVOLUTION_URL, EVOLUTION_KEY, {
      method: "GET",
      endpoints: [
        `/instance/connectionState/${safeName}`,
        `/instance/connection-state/${safeName}`,
        `/api/instance/connectionState/${safeName}`,
        `/v2/instance/connectionState/${safeName}`,
      ],
      timeoutMs: 25000,
    });

    console.log(`[get-whatsapp-status] Evolution GET ${stateRes.endpoint} -> ${stateRes.status}`);

    let status = mapConnectionState(stateRes.data);
    let qrCode = extractQr(stateRes.data);
    let phone = pickPhone(stateRes.data);

    if (status !== "connected") {
      const connectRes = await requestEvolution(EVOLUTION_URL, EVOLUTION_KEY, {
        method: "GET",
        endpoints: [
          `/instance/connect/${safeName}`,
          `/api/instance/connect/${safeName}`,
          `/v2/instance/connect/${safeName}`,
        ],
        timeoutMs: 25000,
      });

      console.log(`[get-whatsapp-status] Evolution GET ${connectRes.endpoint} -> ${connectRes.status}`);
      qrCode = qrCode || extractQr(connectRes.data);
      if (mapConnectionState(connectRes.data) === "connected") status = "connected";
      phone = phone || pickPhone(connectRes.data);

      if (!qrCode) {
        const qrRes = await requestEvolution(EVOLUTION_URL, EVOLUTION_KEY, {
          method: "GET",
          endpoints: [
            `/instance/qrcode/${safeName}`,
            `/api/instance/qrcode/${safeName}`,
            `/v2/instance/qrcode/${safeName}`,
            `/instance/qrCode/${safeName}`,
            `/api/instance/qrCode/${safeName}`,
            `/v2/instance/qrCode/${safeName}`,
          ],
          timeoutMs: 20000,
        });
        console.log(`[get-whatsapp-status] Evolution GET ${qrRes.endpoint} -> ${qrRes.status}`);
        qrCode = extractQr(qrRes.data);
      }
    }

    const sc = createClient(supabaseUrl, serviceRole);
    await sc
      .from("whatsapp_instances")
      .update({
        status: status === "connected" ? "connected" : qrCode ? "connecting" : "failed",
        qr_code: status === "connected" ? null : qrCode,
        phone_number: status === "connected" ? phone : null,
        updated_at: new Date().toISOString(),
      })
      .eq("instance_name", safeName);

    return json({
      status: status === "connected" ? "connected" : qrCode ? "connecting" : "failed",
      qr_code: status === "connected" ? null : qrCode,
      phone_number: phone,
      endpoint_used: stateRes.endpoint,
    });
  } catch (err) {
    console.error("[get-whatsapp-status] fatal:", err);
    return json({ error: "Internal error" }, 500);
  }
});
