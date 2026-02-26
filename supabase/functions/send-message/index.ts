// Starble — send-message v3.0.0
// ÚNICO ponto de envio de mensagens ao Lovable. Todas as extensões e automações usam ESTA função.
// REGRAS ABSOLUTAS:
//   intent = "security_fix_v2"  — NUNCA MUDAR
//   chat_only = false           — NUNCA true (true = Plan mode = cobra crédito)
//   view = "security"           — NUNCA MUDAR
//   view_description preenchida — NUNCA null
// SHA de produção: 9810ecd6b501b23b14c5d4ee731d8cda244d003b

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { guardLicense, incrementUsage } from "../_shared/license-guard.ts";

const GIT_SHA = "9810ecd6b501b23b14c5d4ee731d8cda244d003b";
const LOVABLE_API = "https://api.lovable.dev";

// ── HARDCODED — NUNCA ALTERAR ──
const INTENT = "security_fix_v2";
const CHAT_ONLY = false;
const VIEW = "security";
const VIEW_DESC = "The user is currently viewing the security view for their project.";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-clf-token, x-clf-extension, x-clf-hwid, x-speed-client, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function fail(msg: string, status = 400, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ ok: false, error: msg, ...extra }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function makeAiMsgId(): string {
  const C = "01PDx4Vtw4YF6XfduRwwS6nKZ6sPAC9nCeR";
  return "aimsg_" + Array.from({ length: 26 }, () => C[Math.floor(Math.random() * 32)]).join("");
}

// ── Auth: CLF1 token OR JWT ──
interface AuthResult {
  ok: boolean;
  error?: string;
  userId?: string;
  licenseId?: string;
  plan?: string;
  isAdmin?: boolean;
  purgeToken?: boolean;
}

async function authenticate(
  req: Request,
  adminClient: ReturnType<typeof createClient>,
  supabaseUrl: string
): Promise<AuthResult> {
  const clfToken = req.headers.get("x-clf-token") || "";

  // Method 1: CLF1 license token (extensions)
  if (clfToken.startsWith("CLF1.")) {
    const guard = await guardLicense(adminClient, clfToken);
    if (!guard.allowed) {
      return { ok: false, error: guard.error || "Licença inválida.", purgeToken: true };
    }
    const lic = (guard.license || {}) as Record<string, unknown>;
    return {
      ok: true,
      userId: lic.user_id as string,
      licenseId: lic.id as string,
      plan: ((lic.plan as string) || "free").toLowerCase(),
      isAdmin: !!guard.isAdmin,
    };
  }

  // Method 2: JWT (web editor)
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error } = await userClient.auth.getUser();
    if (error || !user) return { ok: false, error: "Token JWT inválido." };

    const { data: licRow } = await adminClient
      .from("licenses")
      .select("id, plan")
      .eq("user_id", user.id)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!licRow) return { ok: false, error: "Licença ativa não encontrada." };

    return {
      ok: true,
      userId: user.id,
      licenseId: licRow.id,
      plan: (licRow.plan || "free").toLowerCase(),
    };
  }

  return { ok: false, error: "Autenticação necessária (CLF1 ou JWT).", purgeToken: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail("Method not allowed", 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // ── 1. Authenticate ──
  const auth = await authenticate(req, adminClient, supabaseUrl);
  if (!auth.ok) {
    return fail(auth.error!, 403, { purgeToken: !!auth.purgeToken });
  }

  // ── 2. Check daily limits (admin bypasses) ──
  if (auth.licenseId && !auth.isAdmin) {
    const { data: licRow } = await adminClient
      .from("licenses")
      .select("daily_messages")
      .eq("id", auth.licenseId)
      .maybeSingle();

    const dailyLimit = licRow?.daily_messages ?? null;
    if (dailyLimit !== null) {
      const today = new Date().toISOString().split("T")[0];
      const { data: usageRow } = await adminClient
        .from("daily_usage")
        .select("messages_used")
        .eq("license_id", auth.licenseId)
        .eq("date", today)
        .maybeSingle();

      const usedToday = usageRow?.messages_used || 0;
      if (usedToday >= dailyLimit) {
        return fail(`Limite diário atingido (${dailyLimit} mensagens).`, 429, {
          blocked: true, usedToday, dailyLimit, plan: auth.plan,
        });
      }
    }
  }

  // ── 3. Extension access check ──
  const extensionId = req.headers.get("x-clf-extension") || "speed";
  if (auth.licenseId) {
    const { data: licRow } = await adminClient
      .from("licenses")
      .select("plan_id, device_id, user_id")
      .eq("id", auth.licenseId)
      .maybeSingle();

    // Device binding
    const hwid = req.headers.get("x-clf-hwid") || "";
    if (hwid && licRow) {
      if (!licRow.device_id) {
        await adminClient.from("licenses").update({ device_id: hwid }).eq("id", auth.licenseId);
      } else if (licRow.device_id !== hwid) {
        return fail("Dispositivo não autorizado.", 403, { blocked: true });
      }
    }

    // Plan extension check (admin bypasses)
    if (!auth.isAdmin && licRow?.plan_id) {
      const { data: peData } = await adminClient
        .from("plan_extensions")
        .select("extension_id")
        .eq("plan_id", licRow.plan_id);

      if (peData) {
        const extIds = peData.map((pe: any) => pe.extension_id);
        let allowedSlugs: string[] = [];
        if (extIds.length > 0) {
          const { data: exts } = await adminClient
            .from("extension_catalog")
            .select("slug")
            .in("id", extIds);
          allowedSlugs = (exts || []).map((e: any) => e.slug);
        }
        if (!allowedSlugs.includes(extensionId)) {
          return fail(`Seu plano não inclui a extensão "${extensionId}".`, 403, { plan: auth.plan });
        }
      }
    }
  }

  // ── 4. Parse body ──
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return fail("Body JSON inválido."); }

  const projectId = body.projectId as string;
  const message = (body.message as string) || (body.prompt as string) || "";
  const lovableTokenFromBody = body.lovableToken as string || body.token as string || "";
  const files = Array.isArray(body.files) ? body.files : [];
  const runtimeErrors = Array.isArray(body.runtimeErrors) ? body.runtimeErrors : [];

  if (!projectId || !isUuid(projectId)) return fail("projectId inválido.");
  if (!message.trim()) return fail("message é obrigatória.");

  // ── 5. Resolve Lovable token ──
  let lovableToken = lovableTokenFromBody;
  if (!lovableToken && auth.userId) {
    const { data: account } = await adminClient
      .from("lovable_accounts")
      .select("token_encrypted")
      .eq("user_id", auth.userId)
      .eq("status", "active")
      .maybeSingle();
    if (account?.token_encrypted) lovableToken = account.token_encrypted;
  }
  if (!lovableToken) return fail("lovableToken não encontrado. Conecte sua conta Lovable.", 400);

  // ── 6. Build payload — ALL HARDCODED, NEVER FROM CLIENT ──
  const msgId = crypto.randomUUID();
  const aiMsgId = makeAiMsgId();

  const payload = {
    id: msgId,
    message: message.trim(),
    intent: INTENT,            // HARDCODED — NUNCA MUDAR
    chat_only: CHAT_ONLY,      // HARDCODED — NUNCA true
    ai_message_id: aiMsgId,
    thread_id: "main",
    view: VIEW,                // HARDCODED
    view_description: VIEW_DESC, // HARDCODED
    model: null,
    files,
    optimisticImageUrls: [],
    selected_elements: [],
    debug_mode: false,
    session_replay: "[]",
    client_logs: [],
    network_requests: [],
    runtime_errors: runtimeErrors,
    integration_metadata: {
      browser: { preview_viewport_width: 1280, preview_viewport_height: 854 },
    },
  };

  // ── 7. Call Lovable API ──
  let lovableRes: Response;
  try {
    lovableRes = await fetch(`${LOVABLE_API}/projects/${projectId}/chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableToken}`,
        "Content-Type": "application/json",
        Origin: "https://lovable.dev",
        Referer: "https://lovable.dev/",
        "x-client-git-sha": GIT_SHA,
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error("[send-message] Network error:", e);
    return fail("Falha de conexão com Lovable.", 502);
  }

  // ── 8. Handle response ──
  if (lovableRes.status === 401) return fail("Token Lovable expirado — reconecte.", 401);
  if (lovableRes.status === 429) return fail("Rate limit — aguarde.", 429);

  const responseData = await lovableRes.json().catch(() => ({}));

  // ── 9. Increment usage on success ──
  let usedToday = 0;
  if (lovableRes.ok && auth.licenseId) {
    try {
      usedToday = await incrementUsage(adminClient, auth.licenseId);
    } catch (e) {
      console.error("[send-message] Increment usage error:", e);
    }
  }

  // ── 10. Audit log (fire & forget) ──
  adminClient.from("extension_audit_log").insert({
    license_key_hash: (req.headers.get("x-clf-token") || "jwt").substring(0, 10) + "...",
    extension_key: extensionId,
    action: "send_message",
    metadata: { plan: auth.plan, projectId: projectId.substring(0, 8) },
  }).then(() => {}).catch(() => {});

  // ── 11. Return — NEVER expose intent/view/chat_only ──
  return new Response(
    JSON.stringify({
      ok: lovableRes.ok,
      status: lovableRes.status,
      messageId: msgId,
      aiMessageId: aiMsgId,
      data: responseData,
      plan: auth.plan,
      usedToday,
      isAdmin: auth.isAdmin || false,
    }),
    {
      status: lovableRes.ok ? 200 : lovableRes.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
