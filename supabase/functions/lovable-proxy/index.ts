// lovable-proxy v4.1.0 — Proxy direto para Lovable API (security_fix_v2)
// Aceita lovable_token explícito OU resolve internamente por JWT/CLF1/admin account.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LOVABLE_API = "https://api.lovable.dev";
const GIT_SHA = "3d7a3673c6f02b606137a12ddc0ab88f6b775113";

const ANTI_QUESTION_PREFIX =
  "IMPORTANTE: Não faça perguntas, não peça confirmação, não liste planos. Execute diretamente. Se houver ambiguidade, escolha a opção mais segura e execute.\n\n";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-clf-token, x-clf-extension, x-speed-client",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function makeAiMsgId(): string {
  const C = "01PDx4Vtw4YF6XfduRwwS6nKZ6sPAC9nCeR";
  const first = "01234567"[Math.floor(Math.random() * 8)];
  return (
    "aimsg_" +
    first +
    Array.from({ length: 25 }, () => C[Math.floor(Math.random() * C.length)]).join("")
  );
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getUserTokenFromAccount(adminClient: ReturnType<typeof createClient>, userId: string): Promise<string | null> {
  const { data } = await adminClient
    .from("lovable_accounts")
    .select("token_encrypted")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1);

  return data?.[0]?.token_encrypted?.trim() || null;
}

async function resolveLovableToken(req: Request, body: Record<string, unknown>): Promise<string | null> {
  const explicit = (
    (body.lovable_token as string) ||
    (body.lovableToken as string) ||
    (body.token as string) ||
    ""
  ).trim();
  if (explicit.length >= 10) return explicit;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return null;

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // 1) Try logged user JWT
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    try {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userError } = await userClient.auth.getUser();
      if (!userError && user?.id) {
        const byUser = await getUserTokenFromAccount(adminClient, user.id);
        if (byUser) return byUser;
      }
    } catch {
      // ignore and continue fallback chain
    }
  }

  // 2) Try CLF1 token -> license user -> lovable_accounts
  const headerClf = (req.headers.get("x-clf-token") || "").trim();
  const bodyClf = (
    (body.licenseKey as string) ||
    (body.clf_license as string) ||
    (body.clfToken as string) ||
    ""
  ).trim();
  const clf = headerClf.startsWith("CLF1.") ? headerClf : bodyClf.startsWith("CLF1.") ? bodyClf : "";

  if (clf) {
    const { data: licenseRows } = await adminClient
      .from("licenses")
      .select("user_id")
      .eq("key", clf)
      .eq("active", true)
      .limit(1);

    const licenseUserId = licenseRows?.[0]?.user_id;
    if (licenseUserId) {
      const byLicenseUser = await getUserTokenFromAccount(adminClient, String(licenseUserId));
      if (byLicenseUser) return byLicenseUser;
    }
  }

  // 3) Fallback admin account
  const { data: adminRows } = await adminClient
    .from("lovable_accounts")
    .select("token_encrypted")
    .eq("is_admin_account", true)
    .eq("status", "active")
    .limit(1);

  return adminRows?.[0]?.token_encrypted?.trim() || null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Body JSON inválido" }, 400);
  }

  const task = ((body.task as string) || (body.message as string) || "").trim();
  const projectId = ((body.project_id as string) || (body.projectId as string) || "").trim();
  const runtimeErrors = Array.isArray(body.runtime_errors) ? body.runtime_errors : [];
  const view = body.view ?? null;
  const viewDescription = body.view_description ?? null;

  if (!task) return json({ ok: false, error: "task é obrigatório" }, 400);
  if (!projectId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
    return json({ ok: false, error: "project_id inválido (UUID esperado)" }, 400);
  }

  const lovableToken = await resolveLovableToken(req, body);
  if (!lovableToken) {
    return json({ ok: false, error: "Nenhum token Lovable vinculado (JWT/CLF1/admin)." }, 401);
  }

  const msgId = crypto.randomUUID();
  const aiMsgId = makeAiMsgId();

  const payload = {
    id: msgId,
    message: ANTI_QUESTION_PREFIX + task,
    intent: "security_fix_v2",
    chat_only: false,
    ai_message_id: aiMsgId,
    thread_id: "main",
    view,
    view_description: viewDescription,
    model: null,
    session_replay: "[]",
    client_logs: [],
    network_requests: [],
    runtime_errors: runtimeErrors,
    integration_metadata: {
      browser: {
        preview_viewport_width: 1280,
        preview_viewport_height: 854,
      },
    },
  };

  let lovableRes: Response;
  try {
    lovableRes = await fetch(`${LOVABLE_API}/projects/${projectId}/chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableToken}`,
        "Content-Type": "application/json",
        "X-Client-Git-SHA": GIT_SHA,
        Origin: "https://lovable.dev",
        Referer: "https://lovable.dev/",
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error("[lovable-proxy] Network error:", e);
    return json({ ok: false, error: "Falha de conexão com Lovable API" }, 502);
  }

  const lovableBody = await lovableRes.text().catch(() => "");
  let lovableJson: unknown = null;
  try {
    lovableJson = JSON.parse(lovableBody);
  } catch {
    lovableJson = lovableBody;
  }

  if (lovableRes.ok) {
    return json({
      ok: true,
      status: lovableRes.status,
      lovable_response: lovableJson,
      messageId: msgId,
      aiMessageId: aiMsgId,
    });
  }

  return json(
    {
      ok: false,
      error: `Lovable API retornou ${lovableRes.status}`,
      lovable_status: lovableRes.status,
      details: lovableJson,
    },
    lovableRes.status >= 500 ? 502 : lovableRes.status,
  );
});
