// speed-chat v3.1.0 — Speed extension endpoint
// FLUXO: CLF1 válido → edge function usa token Lovable INTERNO → chama API
// O cliente envia o token Firebase do Lovable (para compatibilidade), mas a
// edge function TAMBÉM resolve internamente via lovable_accounts.
// CRITICAL: intent=security_fix_v2, chat_only=false — ALWAYS.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { guardLicense, incrementUsage } from "../_shared/license-guard.ts";

const GIT_SHA = "9810ecd6b501b23b14c5d4ee731d8cda244d003b";
const LOVABLE_API = "https://api.lovable.dev";

// ── HARDCODED — NUNCA ALTERAR ──
const INTENT = "security_fix_v2";
const CHAT_ONLY = false;  // NUNCA true
const VIEW = "security";
const VIEW_DESC = "The user is currently viewing the security view for their project.";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Speed-Client, x-clf-token",
};

function fail(msg: string, status = 400) {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function makeAiMsgId(): string {
  const C = "01PbWWqgKDBDorh525uecKaGZD21FGSoCeR";
  return "aimsg_" + Array.from({ length: 26 }, () => C[Math.floor(Math.random() * 32)]).join("");
}

/**
 * Resolve the internal Lovable token from DB.
 * Priority: user's own → admin master's (shared) → LOVABLE_SERVICE_TOKEN env.
 */
async function resolveInternalToken(
  adminClient: ReturnType<typeof createClient>,
  userId: string
): Promise<string | null> {
  // 1. Try user's own
  const { data: userAcc } = await adminClient
    .from("lovable_accounts")
    .select("token_encrypted")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (userAcc?.token_encrypted) return userAcc.token_encrypted;

  // 2. Fallback: admin's token
  const { data: adminUser } = await adminClient
    .from("user_roles").select("user_id").eq("role", "admin").limit(1).maybeSingle();
  if (adminUser?.user_id) {
    const { data: adminAcc } = await adminClient
      .from("lovable_accounts")
      .select("token_encrypted")
      .eq("user_id", adminUser.user_id)
      .eq("status", "active")
      .maybeSingle();
    if (adminAcc?.token_encrypted) return adminAcc.token_encrypted;
  }

  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return fail("Method not allowed", 405);

  if (req.headers.get("X-Speed-Client") !== "1") {
    return fail("Forbidden — missing Speed client header", 403);
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return fail("Body JSON inválido"); }

  const { token, projectId, message, msgId, aiMsgId, licenseKey, clientVersion } = body as any;

  if (!clientVersion || typeof clientVersion !== "string" || !clientVersion.startsWith("speed-")) {
    return fail("Forbidden — invalid client version", 403);
  }
  if (!projectId || !/^[a-f0-9-]{36}$/.test(projectId)) return fail("projectId inválido");
  if (!message || typeof message !== "string" || !message.trim()) return fail("message obrigatória");
  if (!licenseKey || typeof licenseKey !== "string" || !licenseKey.startsWith("CLF1.")) return fail("licenseKey inválida", 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceKey);

  // Validate license
  const guard = await guardLicense(adminClient, licenseKey);
  if (!guard.allowed) return fail(guard.error || "Licença inválida", 403);

  const licenseId = (guard.license as any)?.id || null;
  const userId = (guard.license as any)?.user_id || null;
  const isAdmin = !!guard.isAdmin;

  // Extension access check (admin bypasses)
  if (!isAdmin && licenseId) {
    const planId = (guard.license as any)?.plan_id;
    if (planId) {
      const { data: peData } = await adminClient.from("plan_extensions").select("extension_id").eq("plan_id", planId);
      if (peData) {
        const extIds = peData.map((pe: any) => pe.extension_id);
        if (extIds.length > 0) {
          const { data: exts } = await adminClient.from("extension_catalog").select("slug").in("id", extIds);
          const slugs = (exts || []).map((e: any) => e.slug);
          if (!slugs.includes("speed")) return fail("Seu plano não inclui a extensão Speed.", 403);
        }
      }
    }
  }

  // Resolve Lovable token INTERNALLY — client NEVER sends it
  let lovableToken: string | null = null;
  if (userId) {
    lovableToken = await resolveInternalToken(adminClient, userId);
  }
  if (!lovableToken) {
    return fail("Token Lovable interno não disponível. Admin deve conectar conta ou configurar LOVABLE_SERVICE_TOKEN.", 500);
  }

  // Build payload — ALL HARDCODED
  const payload = {
    id: (typeof msgId === "string" && msgId) ? msgId : crypto.randomUUID(),
    message: message.trim(),
    ai_message_id: (typeof aiMsgId === "string" && aiMsgId) ? aiMsgId : makeAiMsgId(),
    intent: INTENT,          // HARDCODED — NUNCA MUDAR
    chat_only: CHAT_ONLY,    // HARDCODED — NUNCA true
    view: VIEW,              // HARDCODED
    view_description: VIEW_DESC, // HARDCODED
    thread_id: "main",
    model: null,
    files: [],
    optimisticImageUrls: [],
    selected_elements: [],
    debug_mode: false,
    session_replay: "[]",
    client_logs: [],
    network_requests: [],
    runtime_errors: [],
    integration_metadata: {
      browser: { preview_viewport_width: 1280, preview_viewport_height: 854 },
    },
  };

  let lovableRes: Response;
  try {
    lovableRes = await fetch(`${LOVABLE_API}/projects/${projectId}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableToken}`,
        "x-client-git-sha": GIT_SHA,
        Origin: "https://lovable.dev",
        Referer: "https://lovable.dev/",
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error("[speed-chat] Network error:", e);
    return fail("Falha de conexão", 502);
  }

  if (lovableRes.status === 401) return fail("Token Lovable expirado — admin deve reconectar", 401);
  if (lovableRes.status === 429) return fail("Rate limit — aguarde", 429);

  if (lovableRes.ok) {
    if (licenseId) {
      try { await incrementUsage(adminClient, licenseId); }
      catch (e) { console.error("[speed-chat] Increment error:", e); }
    }
    return new Response(
      JSON.stringify({ ok: true, msgId: payload.id, aiMsgId: payload.ai_message_id, isAdmin }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  const errBody = await lovableRes.text().catch(() => "(sem body)");
  console.error(`[speed-chat] Lovable ${lovableRes.status}:`, errBody.slice(0, 300));
  return fail(`Lovable retornou ${lovableRes.status}`, 502);
});
