// Starble — send-message v2.1.0
// REGRA: Nunca apague esta função. SHA de produção: 9810ecd6b501b23b14c5d4ee731d8cda244d003b
// v2.1.0: Added daily usage enforcement + increment

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
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-clf-token, x-clf-extension",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PLAN_PERMISSIONS: Record<string, string[]> = {
  free:    [],
  trial:   [],
  speed:   ["speed"],
  booster: ["speed", "booster"],
  labs:    ["speed", "booster", "labs"],
  pro:     ["speed", "booster", "labs"],
};

interface ValidateResult {
  ok: boolean;
  error?: string;
  plan?: string;
  licenseData?: Record<string, unknown>;
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
    const addons: string[] = data.addons || [];

    // Free/trial plans can use the default "speed" extension (the base one)
    if ((plan === "free" || plan === "trial") && extensionRequested === "speed") {
      return { ok: true, plan, licenseData: data };
    }

    const allowedByPlan = PLAN_PERMISSIONS[plan] || [];
    const allowedByAddon = addons.map((a: string) => a.toLowerCase());
    const allAllowed = [...allowedByPlan, ...allowedByAddon];

    if (!allAllowed.includes(extensionRequested)) {
      const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
      return {
        ok: false,
        error: `Seu plano ${planLabel} não inclui a extensão "${extensionRequested}". Faça upgrade em starble.lovable.app.`,
        plan,
      };
    }

    return { ok: true, plan, licenseData: data };
  } catch {
    return { ok: false, error: "Erro de conexão ao validar licença." };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const clfToken     = req.headers.get("x-clf-token")     || "";
  const extensionId  = req.headers.get("x-clf-extension") || "speed";

  const auth = await validateCLFToken(clfToken, extensionId);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error, plan: auth.plan }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // Find the active license for this CLF token and check extension access
  const { data: licenseRow } = await adminClient
    .from("licenses")
    .select("id, daily_messages, plan, user_id, plan_id")
    .eq("key", clfToken)
    .eq("active", true)
    .maybeSingle();

  // Validate extension access via plan_extensions table
  if (licenseRow?.plan_id) {
    const { data: peData } = await adminClient
      .from("plan_extensions")
      .select("extension_id")
      .eq("plan_id", licenseRow.plan_id);
    
    if (peData) {
      const extIds = peData.map((pe: any) => pe.extension_id);
      if (extIds.length > 0) {
        const { data: exts } = await adminClient
          .from("extension_catalog")
          .select("slug")
          .in("id", extIds);
        const allowedSlugs = (exts || []).map((e: any) => e.slug);
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
    }
  }

  let usedToday = 0;
  let dailyLimit: number | null = null;

  if (licenseRow) {
    dailyLimit = licenseRow.daily_messages;
    const today = new Date().toISOString().split("T")[0];

    // Check current usage
    const { data: usageRow } = await adminClient
      .from("daily_usage")
      .select("messages_used")
      .eq("license_id", licenseRow.id)
      .eq("date", today)
      .maybeSingle();

    usedToday = usageRow?.messages_used || 0;

    // Enforce limit if set
    if (dailyLimit !== null && usedToday >= dailyLimit) {
      return new Response(
        JSON.stringify({
          error: `Limite diário atingido (${dailyLimit} mensagens). Faça upgrade para continuar.`,
          plan: auth.plan,
          usedToday,
          dailyLimit,
          blocked: true,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: "Body inválido." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

  const {
    projectId,
    lovableToken,
    message,
    mode = "fix",
  } = body as {
    projectId: string;
    lovableToken: string;
    message: string;
    mode?: string;
  };

  if (!projectId || !lovableToken || !message) {
    return new Response(JSON.stringify({ error: "projectId, lovableToken e message são obrigatórios." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const aiMsgId = genId("aimsg_");
  const msgId   = uuid4();

  const modeConfigs: Record<string, Record<string, unknown>> = {
    fix: {
      intent: "security_fix_v2",
      chat_only: false,
      view: "security",
      view_description: "The user is currently viewing the security view for their project.",
    },
    chat: {
      intent: "security_fix_v2",
      chat_only: true,
      view: null,
      view_description: null,
    },
    build: {
      intent: null,
      chat_only: false,
      view: null,
      view_description: null,
    },
    debug: {
      intent: "security_fix_v2",
      chat_only: false,
      view: "security",
      view_description: "The user is currently viewing the security view for their project.",
    },
    task: {
      intent: "security_fix_v2",
      chat_only: false,
      view: null,
      view_description: null,
    },
  };

  const cfg = modeConfigs[mode] || modeConfigs.fix;

  const payload = {
    id: msgId,
    message,
    intent: cfg.intent ?? null,
    chat_only: cfg.chat_only,
    ai_message_id: aiMsgId,
    thread_id: "main",
    view: cfg.view ?? null,
    view_description: cfg.view_description ?? null,
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

    // ── INCREMENT USAGE after successful send ──
    if (lovableRes.ok && licenseRow) {
      try {
        const today = new Date().toISOString().split("T")[0];
        const { data: newCount } = await adminClient.rpc("increment_daily_usage", {
          p_license_id: licenseRow.id,
          p_date: today,
        });
        usedToday = newCount || usedToday + 1;
      } catch (e) {
        console.error("Failed to increment usage:", e);
      }
    }

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
