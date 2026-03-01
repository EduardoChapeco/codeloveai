import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  extractQr,
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

function sanitizeEvolutionRaw(raw: string): string {
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const clone = structuredClone(parsed) as Record<string, unknown>;
      if (typeof clone.hash === "string") clone.hash = "[redacted]";
      if (typeof clone.token === "string") clone.token = "[redacted]";
      if (typeof clone.accessTokenWaBusiness === "string" && clone.accessTokenWaBusiness) {
        clone.accessTokenWaBusiness = "[redacted]";
      }
      return JSON.stringify(clone);
    }
    return raw;
  } catch {
    return raw;
  }
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

    // Check if instance already connected
    const { data: existing } = await sc
      .from("whatsapp_instances")
      .select("instance_name, status, qr_code")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing?.status === "connected") {
      return json({ instance_name: existing.instance_name, status: "connected", qr_code: null });
    }

    // STEP 1: Always delete old instance from Evolution first to avoid stuck state
    console.log(`[create-whatsapp-instance] Deleting old instance ${instanceName} from Evolution...`);
    const deleteRes = await requestEvolution(EVOLUTION_URL, EVOLUTION_KEY, {
      method: "DELETE" as any,
      endpoints: [
        `/instance/delete/${instanceName}`,
        `/api/instance/delete/${instanceName}`,
        `/v2/instance/delete/${instanceName}`,
      ],
      timeoutMs: 15000,
    });
    console.log(`[create-whatsapp-instance] Delete ${deleteRes.endpoint} -> ${deleteRes.status}`);

    // Small delay to let Evolution clean up
    await new Promise(r => setTimeout(r, 2000));

    // STEP 2: Create fresh instance
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

    console.log(`[create-whatsapp-instance] Create ${createRes.endpoint} -> ${createRes.status} | raw: ${sanitizeEvolutionRaw(createRes.raw).slice(0, 500)}`);

    if (!createRes.ok && createRes.status !== 409) {
      if (isLikelyColdStartHtml(createRes.raw, createRes.contentType)) {
        await sc.from("whatsapp_instances").upsert(
          { tenant_id: tenantId, user_id: user.id, instance_name: instanceName, status: "failed", qr_code: null },
          { onConflict: "instance_name" },
        );
        return json({
          instance_name: instanceName, status: "failed", qr_code: null,
          error: "Servidor do WhatsApp iniciando (cold start). Aguarde 30-60s e tente novamente.",
        });
      }
    }

    // STEP 3: Extract QR from create response
    let qrCode = extractQr(createRes.data);
    let finalState = mapConnectionState(createRes.data);

    // STEP 4: If no QR yet, try /instance/connect/ endpoint
    if (!qrCode && finalState !== "connected") {
      await new Promise(r => setTimeout(r, 1500));

      const connectRes = await requestEvolution(EVOLUTION_URL, EVOLUTION_KEY, {
        method: "GET",
        endpoints: [
          `/instance/connect/${instanceName}`,
          `/api/instance/connect/${instanceName}`,
          `/v2/instance/connect/${instanceName}`,
        ],
        timeoutMs: 35000,
      });

      console.log(`[create-whatsapp-instance] Connect ${connectRes.endpoint} -> ${connectRes.status} | raw: ${sanitizeEvolutionRaw(connectRes.raw).slice(0, 500)}`);
      qrCode = qrCode || extractQr(connectRes.data);
      if (mapConnectionState(connectRes.data) === "connected") finalState = "connected";
    }

    // STEP 5: If still no QR, try dedicated QR endpoint
    if (!qrCode && finalState !== "connected") {
      const qrRes = await requestEvolution(EVOLUTION_URL, EVOLUTION_KEY, {
        method: "GET",
        endpoints: [
          `/instance/qrcode/${instanceName}`,
          `/api/instance/qrcode/${instanceName}`,
          `/v2/instance/qrcode/${instanceName}`,
          `/instance/qrCode/${instanceName}`,
          `/v2/instance/qrCode/${instanceName}`,
        ],
        timeoutMs: 20000,
      });
      console.log(`[create-whatsapp-instance] QR ${qrRes.endpoint} -> ${qrRes.status} | raw: ${sanitizeEvolutionRaw(qrRes.raw).slice(0, 300)}`);
      qrCode = extractQr(qrRes.data);
    }

    const persistedStatus = finalState === "connected" ? "connected" : qrCode ? "connecting" : "connecting";

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
    });
  } catch (err) {
    console.error("[create-whatsapp-instance] fatal:", err);
    return json({ error: "Internal error" }, 500);
  }
});
