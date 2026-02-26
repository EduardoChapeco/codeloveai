import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-clf-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_API = "https://api.lovable.dev";
const GIT_SHA = "9810ecd6b501b23b14c5d4ee731d8cda244d003b";
const ANTI_Q = "IMPORTANTE: Não faça perguntas, não peça confirmação, não liste planos. Execute diretamente. Se houver ambiguidade, escolha a opção mais segura e execute.\n\n";

const FREE_MODES: Record<string, { intent: string; chat_only: boolean; view: string | null; runtime_errors?: any[] }> = {
  task_error: {
    intent: "security_fix_v2",
    chat_only: false,
    view: "editor",
    runtime_errors: [
      { level: "error", message: "__TASK_MSG__", file: "src/App.tsx", line: 1 }
    ]
  },
  task: {
    intent: "security_fix_v2",
    chat_only: false,
    view: null,
  },
  chat: {
    intent: "security_fix_v2",
    chat_only: true,
    view: "security",
  },
  security: {
    intent: "security_fix_v2",
    chat_only: false,
    view: "security",
  },
  build_error: {
    intent: "security_fix_v2",
    chat_only: false,
    view: "editor",
    runtime_errors: [
      { level: "error", message: "Build failed: __TASK_MSG__", file: "vite.config.ts", line: 1 }
    ]
  },
};

function genAiMsgId(): string {
  const C = "01PLcrTZB6mu9opJtHVF2NAwyZakKLKKCeR";
  let r = "";
  for (let i = 0; i < 25; i++) r += C[Math.floor(Math.random() * 32)];
  return "aimsg_" + C[Math.floor(Math.random() * 8)] + r;
}

function decodeCLF1(token: string): Record<string, unknown> | null {
  if (!token?.startsWith("CLF1.")) return null;
  try {
    const parts = token.split(".");
    if (parts.length < 3) return null;
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    b64 += "=".repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(b64));
  } catch { return null; }
}

async function validateLicense(licenseKey: string): Promise<boolean> {
  if (!licenseKey?.startsWith("CLF1.")) return false;
  const payload = decodeCLF1(licenseKey);
  if (!payload) return false;
  const now = Date.now();
  const expMs = typeof payload.exp === "number"
    ? (payload.exp > 1e12 ? payload.exp : payload.exp * 1000) : 0;
  if (expMs > 0 && expMs < now) return false;
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const { data } = await supabase.from("licenses").select("active, expires_at")
      .eq("key", licenseKey).single();
    if (data?.active === false) return false;
    if (data?.expires_at && new Date(data.expires_at).getTime() < now) return false;
  } catch { /* trust local decode */ }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    const { token, projectId, message, mode = "task_error", msgId, aiMsgId: clientAiMsgId, files = [], licenseKey } = body;

    const authHeader = req.headers.get("authorization") || req.headers.get("x-clf-token") || "";
    const licKey = licenseKey
      || (authHeader.startsWith("Bearer CLF1.") ? authHeader.slice(7) : null)
      || (authHeader.startsWith("CLF1.") ? authHeader : null);

    if (!licKey) return new Response(JSON.stringify({ error: "Licença não informada" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
    const valid = await validateLicense(licKey);
    if (!valid) return new Response(JSON.stringify({ error: "Licença inativa ou expirada" }), { status: 403, headers: { ...CORS, "Content-Type": "application/json" } });
    if (!projectId || !message) return new Response(JSON.stringify({ error: "projectId e message são obrigatórios" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
    if (!token) return new Response(JSON.stringify({ error: "Token Lovable não disponível" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });

    const modeConfig = FREE_MODES[mode] || FREE_MODES.task_error;
    const finalAiMsgId = clientAiMsgId || genAiMsgId();
    const finalMsgId = msgId || crypto.randomUUID();

    const runtimeErrors = (modeConfig.runtime_errors || []).map((e: any) => ({
      ...e,
      message: String(e.message || "").replace("__TASK_MSG__", message.slice(0, 120))
    }));

    const lovableBody = {
      id: finalMsgId,
      message: ANTI_Q + message,
      intent: modeConfig.intent,
      chat_only: modeConfig.chat_only,
      ai_message_id: finalAiMsgId,
      thread_id: "main",
      view: modeConfig.view,
      view_description: null,
      model: null,
      session_replay: "[]",
      client_logs: [],
      network_requests: [],
      runtime_errors: runtimeErrors,
      files: files || [],
      integration_metadata: { browser: { preview_viewport_width: 1280, preview_viewport_height: 854 } },
    };

    const lovableRes = await fetch(`${LOVABLE_API}/projects/${projectId}/chat`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Client-Git-SHA": GIT_SHA,
        "Origin": "https://lovable.dev",
        "Referer": "https://lovable.dev/",
      },
      body: JSON.stringify(lovableBody),
    });

    const lovableData = await lovableRes.json().catch(() => ({}));

    if (lovableRes.status === 401) return new Response(JSON.stringify({ error: "Token Lovable expirado.", lovable_status: 401 }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
    if (lovableRes.status === 429) return new Response(JSON.stringify({ error: "Rate limit — aguarde.", lovable_status: 429 }), { status: 429, headers: { ...CORS, "Content-Type": "application/json" } });
    if (!lovableRes.ok) return new Response(JSON.stringify({ ok: false, lovable_status: lovableRes.status, details: lovableData }), { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });

    // Log de uso
    try {
      const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
      await supabase.from("usage_log").insert({ license_key: licKey, project_id: projectId, action: `venus-chat:${mode}`, created_at: new Date().toISOString() });
    } catch { /* optional */ }

    return new Response(JSON.stringify({ ok: true, status: lovableRes.status, aiMsgId: finalAiMsgId, msgId: finalMsgId, mode_used: mode, lovable: lovableData }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
