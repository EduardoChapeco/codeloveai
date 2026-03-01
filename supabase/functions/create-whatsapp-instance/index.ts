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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function evoFetch(
  base: string,
  key: string,
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; data: any; isHtml: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);

  try {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });

    const contentType = res.headers.get("content-type") || "";
    const text = await res.text().catch(() => "");
    const isHtml = contentType.includes("text/html") ||
      text.trimStart().startsWith("<!") ||
      text.trimStart().startsWith("<html");

    let data: any = null;
    if (!isHtml && text) {
      try { data = JSON.parse(text); } catch { /* not json */ }
    }

    console.log(
      `[create-wa] ${method} ${path} -> ${res.status} ${isHtml ? "(HTML/cold-start)" : ""} | ${text.slice(0, 300)}`,
    );
    return { status: res.status, data, isHtml };
  } catch (err) {
    const isAbort = err instanceof DOMException && err.name === "AbortError";
    console.log(`[create-wa] ${method} ${path} -> ${isAbort ? "TIMEOUT" : "ERROR"}: ${err}`);
    return { status: isAbort ? 504 : 502, data: null, isHtml: false };
  } finally {
    clearTimeout(timer);
  }
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
    const reqBody = await req.json().catch(() => ({}));
    const tenantId = String(reqBody.tenant_id || "").trim();
    if (
      !tenantId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)
    )
      return json({ error: "tenant_id required" }, 400);

    const sc = createClient(supabaseUrl, serviceRole);

    // ── Tenant membership check ──
    const { data: membership } = await sc
      .from("tenant_users")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!membership) return json({ error: "Forbidden" }, 403);

    // ── Evolution config ──
    const EVO_URL = (Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/+$/, "");
    const EVO_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";
    if (!EVO_URL || !EVO_KEY)
      return json({ error: "Evolution API not configured" }, 500);

    // ── Instance name (deterministic per user) ──
    const instanceName = `starcrm_${user.id.replace(/-/g, "").slice(0, 8)}`;

    // ── Check if already connected ──
    const { data: existing } = await sc
      .from("whatsapp_instances")
      .select("instance_name, status")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing?.status === "connected") {
      return json({
        instance_name: existing.instance_name,
        status: "connected",
        qr_code: null,
      });
    }

    // ══════════════════════════════════════════════════════
    // STEP 0: Wake-up ping (force Render out of hibernation)
    // ══════════════════════════════════════════════════════
    console.log("[create-wa] STEP 0: Wake-up ping...");
    const wakeUp = await evoFetch(EVO_URL, EVO_KEY, "GET", "/instance/fetchInstances");
    if (wakeUp.isHtml) {
      // Render is waking up, wait and retry
      console.log("[create-wa] Render cold start detected, waiting 8s...");
      await sleep(8000);
      const retry = await evoFetch(EVO_URL, EVO_KEY, "GET", "/instance/fetchInstances");
      if (retry.isHtml || retry.status >= 500) {
        return json({
          instance_name: instanceName,
          status: "render_hibernating",
          error: "Servidor Evolution está inicializando. Tente novamente em 30 segundos.",
          qr_code: null,
        });
      }
    }

    // ══════════════════════════════════════════════════════
    // STEP 1: Delete old instance (ignore errors)
    // ══════════════════════════════════════════════════════
    console.log("[create-wa] STEP 1: Delete old instance...");
    await evoFetch(EVO_URL, EVO_KEY, "DELETE", `/instance/delete/${instanceName}`);
    await sleep(2000);

    // ══════════════════════════════════════════════════════
    // STEP 2: Create new instance
    // ══════════════════════════════════════════════════════
    console.log("[create-wa] STEP 2: Create instance...");
    const createResult = await evoFetch(EVO_URL, EVO_KEY, "POST", "/instance/create", {
      instanceName,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
    });

    if (createResult.status >= 400 && createResult.status !== 409) {
      return json({
        instance_name: instanceName,
        status: "failed",
        error: `Evolution create falhou: ${createResult.status} - ${JSON.stringify(createResult.data || {}).slice(0, 200)}`,
        qr_code: null,
      });
    }

    // Check if QR came directly in create response
    let qrCode: string | null = createResult.data?.qrcode?.base64 || createResult.data?.base64 || null;
    let finalStatus = "connecting";

    if (qrCode) {
      console.log("[create-wa] QR found in create response!");
      finalStatus = "connecting";
    } else {
      // ══════════════════════════════════════════════════════
      // STEP 3: Wait for Baileys to initialize
      // ══════════════════════════════════════════════════════
      console.log("[create-wa] STEP 3: Waiting 4s for Baileys init...");
      await sleep(4000);

      // ══════════════════════════════════════════════════════
      // STEP 4: Poll GET /instance/connect/{name} up to 10x (50s)
      // ══════════════════════════════════════════════════════
      console.log("[create-wa] STEP 4: Polling for QR code...");
      for (let i = 0; i < 10; i++) {
        if (i > 0) await sleep(5000);

        const connectResult = await evoFetch(
          EVO_URL, EVO_KEY, "GET",
          `/instance/connect/${instanceName}`,
        );
        const d = connectResult.data;

        // Already connected (scanned from phone)
        if (d?.instance?.state === "open") {
          finalStatus = "connected";
          qrCode = null;
          console.log("[create-wa] Instance already connected!");
          break;
        }

        // QR code available
        const foundQr = d?.base64 || d?.qrcode?.base64 || null;
        if (foundQr) {
          qrCode = foundQr;
          finalStatus = "connecting";
          console.log(`[create-wa] QR found on attempt ${i + 1}!`);
          break;
        }

        console.log(
          `[create-wa] Attempt ${i + 1}/10 - no QR (count=${d?.qrcode?.count ?? d?.count ?? "?"}, state=${d?.instance?.state ?? "?"})`,
        );
      }
    }

    // ══════════════════════════════════════════════════════
    // STEP 5: Persist to DB
    // ══════════════════════════════════════════════════════
    const dbStatus = finalStatus === "connected" ? "connected" : "connecting";

    await sc.from("whatsapp_instances").upsert(
      {
        tenant_id: tenantId,
        user_id: user.id,
        instance_name: instanceName,
        status: dbStatus,
        qr_code: finalStatus === "connected" ? null : qrCode,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "instance_name" },
    );

    return json({
      instance_name: instanceName,
      qr_code: finalStatus === "connected" ? null : qrCode,
      status: qrCode ? "connecting" : finalStatus === "connected" ? "connected" : "waiting",
    });
  } catch (err) {
    console.error("[create-wa] fatal:", err);
    return json({ error: "Internal error" }, 500);
  }
});
