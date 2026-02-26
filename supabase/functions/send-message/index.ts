// Starble — send-message v2.2.0
// REGRA: Nunca apague esta função. SHA de produção: 9810ecd6b501b23b14c5d4ee731d8cda244d003b
// v2.2.0: Added JWT auth for web editor + auto-fetch lovable token from DB

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GIT_SHA      = "9810ecd6b501b23b14c5d4ee731d8cda244d003b";
const LOVABLE_API  = "https://api.lovable.dev";
const WORKER_URL   = "https://codelove-fix-api.eusoueduoficial.workers.dev";

function uuid4(): string {
  return crypto.randomUUID();
}

function genId(prefix: string): string {
  const C = "01PDx4Vtw4YF6XfduRwwS6nKZ6sPAC9nCeR";
  let ts = Date.now(), tsPart = "";
  for (let i = 0; i < 10; i++) { tsPart = C[ts % 32] + tsPart; ts = Math.floor(ts / 32); }
  let rand = "";
  for (let i = 0; i < 16; i++) rand += C[Math.floor(Math.random() * 32)];
  return prefix + tsPart + rand;
}

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-clf-token, x-clf-extension, x-clf-hwid, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Extension permissions are now resolved from DB (plan_extensions table).
// Hardcoded fallback removed to prevent bypasses.

interface ValidateResult {
  ok: boolean;
  error?: string;
  plan?: string;
  licenseData?: Record<string, unknown>;
}

interface AuthResult {
  ok: boolean;
  error?: string;
  plan?: string;
  userId?: string;
  licenseId?: string;
  authMethod: "clf" | "jwt";
}

async function validateCLFToken(
  token: string,
  extensionRequested: string
): Promise<ValidateResult> {
  if (!token?.startsWith("CLF1.")) {
    return { ok: false, error: "Token inválido. Use uma licença CLF1." };
  }
  try {
    const res = await fetch(WORKER_URL + "/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (res.status === 401) return { ok: false, error: "Licença expirada ou revogada." };
    if (!res.ok) return { ok: false, error: "Erro ao validar licença." };

    const data = await res.json();
    if (!data.valid) return { ok: false, error: "Licença inválida." };

    const plan: string = (data.plan || data.plan_type || "free").toLowerCase();

    // Extension access is validated later against DB (plan_extensions).
    // CLF token validation only checks license validity here.
    return { ok: true, plan, licenseData: data };
  } catch {
    return { ok: false, error: "Erro de conexão ao validar licença." };
  }
}

async function authenticateRequest(
  req: Request,
  adminClient: any,
  supabaseUrl: string
): Promise<AuthResult> {
  const clfToken = req.headers.get("x-clf-token") || "";
  const extensionId = req.headers.get("x-clf-extension") || "speed";

  // Method 1: CLF1 license token (Chrome extension)
  if (clfToken.startsWith("CLF1.")) {
    const auth = await validateCLFToken(clfToken, extensionId);
    if (!auth.ok) return { ok: false, error: auth.error, plan: auth.plan, authMethod: "clf" };

    const { data: licenseRow } = await adminClient
      .from("licenses")
      .select("id, user_id, plan_id")
      .eq("key", clfToken)
      .eq("active", true)
      .maybeSingle();

    return {
      ok: true,
      plan: auth.plan,
      userId: licenseRow?.user_id,
      licenseId: licenseRow?.id,
      authMethod: "clf",
    };
  }

  // Method 2: JWT auth (web editor)
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return { ok: false, error: "Token JWT inválido.", authMethod: "jwt" };
    }

    const userId = user.id;

    // Find user's active license
    const { data: licenseRow } = await adminClient
      .from("licenses")
      .select("id, plan, plan_id, daily_messages")
      .eq("user_id", userId)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      ok: true,
      plan: licenseRow?.plan?.toLowerCase() || "free",
      userId,
      licenseId: licenseRow?.id,
      authMethod: "jwt",
    };
  }

  return { ok: false, error: "Autenticação necessária (CLF1 ou JWT).", authMethod: "clf" };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const extensionId = req.headers.get("x-clf-extension") || "speed";
  const clfToken = req.headers.get("x-clf-token") || "";

  const auth = await authenticateRequest(req, adminClient, supabaseUrl);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error, plan: auth.plan }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Validate extension access via plan_extensions table (ALL auth methods)
  if (auth.licenseId) {
    const { data: licRow } = await adminClient
      .from("licenses")
      .select("plan_id, device_id, user_id")
      .eq("id", auth.licenseId)
      .maybeSingle();

    // ── Device binding check ──
    const hwid = req.headers.get("x-clf-hwid") || "";
    if (hwid && licRow) {
      if (!licRow.device_id) {
        await adminClient.from("licenses").update({ device_id: hwid }).eq("id", auth.licenseId);
      } else if (licRow.device_id !== hwid) {
        return new Response(
          JSON.stringify({ error: "Dispositivo não autorizado. Esta licença está vinculada a outro computador.", blocked: true }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (licRow?.plan_id) {
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

        // ── Labs restriction: only tenant_owners ──
        if (allowedSlugs.includes("labs") && extensionId === "labs") {
          const { data: tenantUser } = await adminClient
            .from("tenant_users")
            .select("role")
            .eq("user_id", licRow.user_id || auth.userId)
            .eq("role", "tenant_owner")
            .maybeSingle();
          if (!tenantUser) {
            return new Response(
              JSON.stringify({
                error: "Starble Labs é exclusivo para proprietários de White Label.",
                plan: auth.plan,
              }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        if (!allowedSlugs.includes(extensionId)) {
          return new Response(
            JSON.stringify({
              error: `Seu plano não inclui a extensão "${extensionId}". Faça upgrade em starble.lovable.app.`,
              plan: auth.plan,
              allowedExtensions: allowedSlugs,
            }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    } else {
      // No plan_id linked = no extension access (except speed for free/trial via plan_extensions)
      if (extensionId !== "speed") {
        return new Response(
          JSON.stringify({
            error: `Seu plano não inclui a extensão "${extensionId}". Faça upgrade em starble.lovable.app.`,
            plan: auth.plan,
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
  }

  // Check daily usage limits (admin master bypasses)
  let usedToday = 0;
  let dailyLimit: number | null = null;
  let isAdmin = false;

  if (auth.licenseId && auth.userId) {
    // Check if admin master
    const { data: adminRole } = await adminClient
      .from("user_roles").select("role").eq("user_id", auth.userId).eq("role", "admin").maybeSingle();
    isAdmin = !!adminRole;
  }

  if (auth.licenseId && !isAdmin) {
    const { data: licRow } = await adminClient
      .from("licenses")
      .select("daily_messages, expires_at, type, token_valid_until, trial_expires_at")
      .eq("id", auth.licenseId)
      .maybeSingle();

    // Auto-deactivate expired licenses
    const now = new Date();
    if (licRow?.expires_at && new Date(licRow.expires_at) < now) {
      await adminClient.from("licenses").update({ active: false, status: "expired" }).eq("id", auth.licenseId);
      return new Response(JSON.stringify({ error: "Licença expirada.", blocked: true }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (licRow?.type === "trial" && licRow?.trial_expires_at && new Date(licRow.trial_expires_at) < now) {
      await adminClient.from("licenses").update({ active: false, status: "expired" }).eq("id", auth.licenseId);
      return new Response(JSON.stringify({ error: "Trial expirado.", blocked: true }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (licRow?.type === "daily_token" && licRow?.token_valid_until && new Date(licRow.token_valid_until) < now) {
      await adminClient.from("licenses").update({ active: false, status: "expired" }).eq("id", auth.licenseId);
      return new Response(JSON.stringify({ error: "Token expirado. Renove.", blocked: true }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    dailyLimit = licRow?.daily_messages ?? null;
    const today = new Date().toISOString().split("T")[0];

    const { data: usageRow } = await adminClient
      .from("daily_usage")
      .select("messages_used")
      .eq("license_id", auth.licenseId)
      .eq("date", today)
      .maybeSingle();

    usedToday = usageRow?.messages_used || 0;

    if (dailyLimit !== null && usedToday >= dailyLimit) {
      return new Response(
        JSON.stringify({
          error: `Limite diário atingido (${dailyLimit} mensagens). Faça upgrade para continuar.`,
          plan: auth.plan,
          usedToday,
          dailyLimit,
          blocked: true,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: "Body inválido." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

  const {
    projectId,
    message,
    mode = "fix",
  } = body as {
    projectId: string;
    message: string;
    mode?: string;
  };

  let lovableToken = (body as { lovableToken?: string }).lovableToken || "";

  if (!projectId || !message) {
    return new Response(JSON.stringify({ error: "projectId e message são obrigatórios." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Auto-fetch lovable token from DB if not provided (web editor flow)
  if (!lovableToken && auth.userId) {
    const { data: account } = await adminClient
      .from("lovable_accounts")
      .select("token_encrypted, status")
      .eq("user_id", auth.userId)
      .eq("status", "active")
      .maybeSingle();

    if (account?.token_encrypted) {
      lovableToken = account.token_encrypted;
    }
  }

  if (!lovableToken) {
    return new Response(JSON.stringify({ error: "lovableToken não encontrado. Conecte sua conta Lovable." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const aiMsgId = genId("aimsg_");
  const msgId   = uuid4();

  // CRITICAL: ALL modes MUST include intent=security_fix_v2, view=security,
  // and a view_description to prevent Lovable from activating plan mode (which costs credits).
  // Setting view/view_description to null triggers plan mode automatically.
  const SECURITY_VIEW = "security";
  const SECURITY_VIEW_DESC = "The user is currently viewing the security view for their project.";

  const modeConfigs: Record<string, Record<string, unknown>> = {
    fix: {
      intent: "security_fix_v2",
      chat_only: false,
      view: SECURITY_VIEW,
      view_description: SECURITY_VIEW_DESC,
    },
    chat: {
      intent: "security_fix_v2",
      chat_only: false,
      view: SECURITY_VIEW,
      view_description: SECURITY_VIEW_DESC,
    },
    build: {
      intent: "security_fix_v2",
      chat_only: false,
      view: SECURITY_VIEW,
      view_description: SECURITY_VIEW_DESC,
    },
    debug: {
      intent: "security_fix_v2",
      chat_only: false,
      view: SECURITY_VIEW,
      view_description: SECURITY_VIEW_DESC,
    },
    task: {
      intent: "security_fix_v2",
      chat_only: false,
      view: SECURITY_VIEW,
      view_description: SECURITY_VIEW_DESC,
    },
  };

  const cfg = modeConfigs[mode] || modeConfigs.fix;

  // NEVER use ?? null for intent/view/view_description — null values trigger plan mode
  const payload = {
    id: msgId,
    message,
    intent: cfg.intent,
    chat_only: cfg.chat_only,
    ai_message_id: aiMsgId,
    thread_id: "main",
    view: cfg.view,
    view_description: cfg.view_description,
    model: null,
    files: (body.files as unknown[]) || [],
    optimisticImageUrls: [],
    selected_elements: [],
    debug_mode: false,
    session_replay: "[]",
    client_logs: [],
    network_requests: [],
    runtime_errors: (body.runtimeErrors as unknown[]) || [],
    integration_metadata: {
      browser: {
        preview_viewport_width: 1280,
        preview_viewport_height: 854,
      },
    },
  };

  try {
    const lovableRes = await fetch(`${LOVABLE_API}/projects/${projectId}/chat`, {
      method: "POST",
      headers: {
        Authorization:        `Bearer ${lovableToken}`,
        "Content-Type":       "application/json",
        Origin:               "https://lovable.dev",
        Referer:              "https://lovable.dev/",
        "X-Client-Git-SHA":   GIT_SHA,
      },
      body: JSON.stringify(payload),
    });

    const responseData = lovableRes.ok
      ? await lovableRes.json().catch(() => ({}))
      : { error: `Lovable retornou status ${lovableRes.status}` };

    // INCREMENT USAGE after successful send
    if (lovableRes.ok && auth.licenseId) {
      try {
        const today = new Date().toISOString().split("T")[0];
        const { data: newCount } = await adminClient.rpc("increment_daily_usage", {
          p_license_id: auth.licenseId,
          p_date: today,
        });
        usedToday = newCount || usedToday + 1;
      } catch (e) {
        console.error("Failed to increment usage:", e);
      }
    }

    // Audit log (fire and forget)
    adminClient.from("extension_audit_log").insert({
      license_key_hash: auth.authMethod === "clf" ? clfToken.substring(0, 10) + "..." : "jwt-web",
      extension_key: extensionId,
      action: "send_message",
      metadata: { plan: auth.plan, mode, authMethod: auth.authMethod, projectId: projectId.substring(0, 8) },
    }).then(() => {}).catch(() => {});

    return new Response(
      JSON.stringify({
        ok: lovableRes.ok,
        status: lovableRes.status,
        messageId: msgId,
        aiMessageId: aiMsgId,
        data: responseData,
        plan: auth.plan,
        usedToday,
        dailyLimit,
      }),
      {
        status: lovableRes.ok ? 200 : lovableRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
