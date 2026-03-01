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
  if (typeof qrcode?.code === "string" && qrcode.code.trim().startsWith("data:image")) return qrcode.code;

  if (typeof data.code === "string" && data.code.trim().startsWith("data:image")) return data.code;

  return null;
}

function hasInstanceAlreadyExists(status: number, raw: string, data: Record<string, unknown> | null): boolean {
  if (status === 409 || status === 403) return true;
  const text = `${raw} ${JSON.stringify(data || {})}`.toLowerCase();
  return text.includes("already exists") || text.includes("já existe") || text.includes("instance exists");
}

async function requestEvolution(
  baseUrl: string,
  apiKey: string,
  options: {
    method: "GET" | "POST";
    endpoints: string[];
    body?: Record<string, unknown>;
    timeoutMs?: number;
  },
): Promise<EvolutionResult> {
  const timeoutMs = options.timeoutMs ?? 45000;
  let last: EvolutionResult | null = null;

  for (const endpoint of options.endpoints) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method: options.method,
        headers: {
          "Content-Type": "application/json",
          apikey: apiKey,
        },
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
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
      console.log(`[create-whatsapp-instance] Evolution ${options.method} ${endpoint} -> ${res.status}`);

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
      console.error(`[create-whatsapp-instance] Evolution fetch fail ${endpoint}:`, current.raw);
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
    const user = userData?.user;
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const tenantId = typeof body.tenant_id === "string" ? body.tenant_id.trim() : "";
    if (!tenantId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      return json({ error: "tenant_id required" }, 400);
    }

    const sc = createClient(supabaseUrl, serviceRole);

    const { data: role } = await sc.from("tenant_users")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!role) return json({ error: "Forbidden" }, 403);

    const EVOLUTION_URL = (Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/+$/, "");
    const EVOLUTION_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";

    if (!EVOLUTION_URL || !EVOLUTION_KEY) {
      return json({ error: "Evolution API not configured" }, 500);
    }

    const instanceName = `starcrm_${user.id.replace(/-/g, "").slice(0, 8)}`;

    const { data: existing } = await sc.from("whatsapp_instances")
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

    let qrCode = extractQr(createRes.data);

    if (!createRes.ok && !hasInstanceAlreadyExists(createRes.status, createRes.raw, createRes.data)) {
      const isHtml = createRes.raw.trim().startsWith("<!") || createRes.raw.toLowerCase().includes("<html");
      if (isHtml) {
        return json({
          error: "Evolution API em inicialização (cold start). Aguarde 30-60s e tente novamente.",
          endpoint: createRes.endpoint,
        }, 502);
      }

      return json({
        error: `Evolution API error (${createRes.status})`,
        endpoint: createRes.endpoint,
        details: createRes.data || createRes.raw || null,
      }, createRes.status >= 500 ? 502 : 400);
    }

    if (!qrCode) {
      const connectRes = await requestEvolution(EVOLUTION_URL, EVOLUTION_KEY, {
        method: "GET",
        endpoints: [
          `/instance/connect/${instanceName}`,
          `/api/instance/connect/${instanceName}`,
          `/v2/instance/connect/${instanceName}`,
        ],
        timeoutMs: 30000,
      });

      qrCode = extractQr(connectRes.data);
    }

    await sc.from("whatsapp_instances").upsert({
      tenant_id: tenantId,
      user_id: user.id,
      instance_name: instanceName,
      status: "connecting",
      qr_code: qrCode,
    }, { onConflict: "instance_name" });

    return json({
      instance_name: instanceName,
      qr_code: qrCode,
      status: "connecting",
      endpoint_used: createRes.endpoint,
    });
  } catch (err) {
    console.error("[create-whatsapp-instance] fatal:", err);
    return json({ error: "Internal error" }, 500);
  }
});
