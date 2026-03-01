import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  extractQr,
  hasInstanceAlreadyExists,
  isLikelyColdStartHtml,
  mapConnectionState,
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

    const { data: existing } = await sc
      .from("whatsapp_instances")
      .select("instance_name, status, qr_code")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing?.status === "connected") {
      return json({ instance_name: existing.instance_name, status: "connected", qr_code: null });
    }

    const createRes = await requestEvolution(EVOLUTION_URL, EVOLUTION_KEY, {
      method: "POST",
      endpoints: ["/instance/create", "/api/instance/create", "/v2/instance/create"],
      timeoutMs: 58000,
      body: {
        instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
        token: EVOLUTION_KEY,
      },
    });

    console.log(`[create-whatsapp-instance] Evolution POST ${createRes.endpoint} -> ${createRes.status}`);

    const alreadyExists = hasInstanceAlreadyExists(createRes.status, createRes.raw, createRes.data);
    let recoveredExistingInstance = false;

    if (!createRes.ok && (alreadyExists || createRes.status === 403 || createRes.status === 422)) {
      const stateProbe = await requestEvolution(EVOLUTION_URL, EVOLUTION_KEY, {
        method: "GET",
        endpoints: [
          `/instance/connectionState/${instanceName}`,
          `/instance/connection-state/${instanceName}`,
          `/api/instance/connectionState/${instanceName}`,
          `/v2/instance/connectionState/${instanceName}`,
        ],
        timeoutMs: 25000,
      });

      console.log(
        `[create-whatsapp-instance] Evolution RECOVERY ${stateProbe.endpoint} -> ${stateProbe.status}`,
      );

      recoveredExistingInstance = stateProbe.ok || stateProbe.status === 200;
    }

    if (!createRes.ok && !recoveredExistingInstance && !alreadyExists) {
      const providerMessage = isLikelyColdStartHtml(createRes.raw, createRes.contentType)
        ? "Servidor do WhatsApp iniciando (cold start). Aguarde 30-60s e tente novamente."
        : `Evolution API indisponível no momento (${createRes.status}).`;

      await sc.from("whatsapp_instances").upsert(
        {
          tenant_id: tenantId,
          user_id: user.id,
          instance_name: instanceName,
          status: "failed",
          qr_code: null,
        },
        { onConflict: "instance_name" },
      );

      return json({
        instance_name: instanceName,
        status: "failed",
        qr_code: null,
        error: providerMessage,
        endpoint: createRes.endpoint,
        details: createRes.data || createRes.raw || null,
      });
    }

    let qrCode = extractQr(createRes.data);
    let finalState: "connected" | "disconnected" = mapConnectionState(createRes.data);

    const connectRes = await requestEvolution(EVOLUTION_URL, EVOLUTION_KEY, {
      method: "GET",
      endpoints: [
        `/instance/connect/${instanceName}`,
        `/api/instance/connect/${instanceName}`,
        `/v2/instance/connect/${instanceName}`,
      ],
      timeoutMs: 35000,
    });

    console.log(`[create-whatsapp-instance] Evolution GET ${connectRes.endpoint} -> ${connectRes.status}`);
    qrCode = qrCode || extractQr(connectRes.data);
    finalState = mapConnectionState(connectRes.data);

    if (!qrCode && finalState !== "connected") {
      const qrRes = await requestEvolution(EVOLUTION_URL, EVOLUTION_KEY, {
        method: "GET",
        endpoints: [
          `/instance/qrcode/${instanceName}`,
          `/api/instance/qrcode/${instanceName}`,
          `/v2/instance/qrcode/${instanceName}`,
          `/instance/qrCode/${instanceName}`,
          `/api/instance/qrCode/${instanceName}`,
          `/v2/instance/qrCode/${instanceName}`,
        ],
        timeoutMs: 25000,
      });
      console.log(`[create-whatsapp-instance] Evolution GET ${qrRes.endpoint} -> ${qrRes.status}`);
      qrCode = extractQr(qrRes.data);
    }

    const shouldKeepConnecting =
      finalState !== "connected" && (connectRes.ok || Boolean(qrCode) || recoveredExistingInstance || alreadyExists || createRes.ok);
    const persistedStatus = finalState === "connected" ? "connected" : shouldKeepConnecting ? "connecting" : "failed";

    await sc.from("whatsapp_instances").upsert(
      {
        tenant_id: tenantId,
        user_id: user.id,
        instance_name: instanceName,
        status: persistedStatus,
        qr_code: finalState === "connected" ? null : qrCode,
      },
      { onConflict: "instance_name" },
    );

    return json({
      instance_name: instanceName,
      qr_code: finalState === "connected" ? null : qrCode,
      status: persistedStatus,
      endpoint_used: createRes.endpoint,
    });
  } catch (err) {
    console.error("[create-whatsapp-instance] fatal:", err);
    return json({ error: "Internal error" }, 500);
  }
});
