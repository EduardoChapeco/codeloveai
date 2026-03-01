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

type EvolutionResult = {
  ok: boolean;
  status: number;
  data: Record<string, unknown> | null;
  raw: string;
  endpoint: string;
  contentType: string;
};

function extractQr(data: Record<string, unknown> | null): string | null {
  if (!data) return null;
  const direct = data.base64;
  if (typeof direct === "string" && direct.trim()) return direct;
  const qrcode = data.qrcode as Record<string, unknown> | undefined;
  if (typeof qrcode?.base64 === "string" && qrcode.base64.trim()) return qrcode.base64;
  if (typeof data.code === "string" && data.code.startsWith("data:image")) return data.code;
  return null;
}

function mapConnectionState(data: Record<string, unknown> | null): "connected" | "disconnected" {
  const instance = data?.instance as Record<string, unknown> | undefined;
  const rawState = String(
    instance?.state ?? data?.state ?? data?.status ?? "",
  ).toLowerCase();

  if (rawState.includes("open") || rawState.includes("connected") || rawState.includes("online")) {
    return "connected";
  }

  return "disconnected";
}

function pickPhone(data: Record<string, unknown> | null): string | null {
  const instance = data?.instance as Record<string, unknown> | undefined;
  const p1 = instance?.phoneNumber;
  const p2 = instance?.number;
  const p3 = data?.phoneNumber;
  if (typeof p1 === "string" && p1) return p1;
  if (typeof p2 === "string" && p2) return p2;
  if (typeof p3 === "string" && p3) return p3;
  return null;
}

async function requestEvolution(
  baseUrl: string,
  apiKey: string,
  options: {
    method: "GET" | "POST";
    endpoints: string[];
    timeoutMs?: number;
  },
): Promise<EvolutionResult> {
  const timeoutMs = options.timeoutMs ?? 20000;
  let last: EvolutionResult | null = null;

  for (const endpoint of options.endpoints) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method: options.method,
        headers: { apikey: apiKey },
        signal: controller.signal,
      });

      const contentType = res.headers.get("content-type") || "";
      const raw = await res.text().catch(() => "");
      let data: Record<string, unknown> | null = null;

      if (contentType.includes("application/json") && raw) {
        try { data = JSON.parse(raw); } catch { data = null; }
      }

      const current: EvolutionResult = {
        ok: res.ok,
        status: res.status,
        data,
        raw,
        endpoint,
        contentType,
      };

      last = current;
      console.log(`[get-whatsapp-status] Evolution ${options.method} ${endpoint} -> ${res.status}`);

      if (res.status !== 404) return current;
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      const current: EvolutionResult = {
        ok: false,
        status: isAbort ? 504 : 502,
        data: null,
        raw: isAbort ? "timeout" : String(err),
        endpoint,
        contentType: "",
      };
      last = current;
      console.error(`[get-whatsapp-status] Evolution fetch fail ${endpoint}:`, current.raw);
    } finally {
      clearTimeout(timer);
    }
  }

  return last ?? {
    ok: false,
    status: 502,
    data: null,
    raw: "No endpoint available",
    endpoint: "",
    contentType: "",
  };
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

    if (!supabaseUrl || !anonKey || !serviceRole) {
      return json({ error: "Backend not configured" }, 500);
    }

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

    if (!EVOLUTION_URL || !EVOLUTION_KEY) {
      return json({ error: "Evolution API not configured" }, 500);
    }

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

      qrCode = qrCode || extractQr(connectRes.data);
      if (mapConnectionState(connectRes.data) === "connected") {
        status = "connected";
      }
      phone = phone || pickPhone(connectRes.data);
    }

    const sc = createClient(supabaseUrl, serviceRole);
    await sc.from("whatsapp_instances")
      .update({
        status: status === "connected" ? "connected" : "connecting",
        qr_code: status === "connected" ? null : qrCode,
        phone_number: status === "connected" ? phone : null,
        updated_at: new Date().toISOString(),
      })
      .eq("instance_name", safeName);

    return json({
      status,
      qr_code: status === "connected" ? null : qrCode,
      phone_number: phone,
      endpoint_used: stateRes.endpoint,
    });
  } catch (err) {
    console.error("[get-whatsapp-status] fatal:", err);
    return json({ error: "Internal error" }, 500);
  }
});
