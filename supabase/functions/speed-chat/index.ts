// speed-chat — alias for lovable-proxy v4.0.0
// Exact copy: security_fix_v2, chat_only=false

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
  return "aimsg_" + first + Array.from({ length: 25 }, () => C[Math.floor(Math.random() * C.length)]).join("");
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ ok: false, error: "Invalid JSON" }, 400); }

  // Accept both lovable-proxy format and legacy speed-chat format
  const task = (body.task as string) || (body.message as string) || "";
  const lovableToken = (body.lovable_token as string) || (body.token as string) || "";
  const projectId = (body.project_id as string) || (body.projectId as string) || "";
  const runtimeErrors = Array.isArray(body.runtime_errors) ? body.runtime_errors : [];
  const view = body.view ?? null;
  const viewDescription = body.view_description ?? null;

  if (!task.trim()) return json({ ok: false, error: "task/message is required" }, 400);
  if (!lovableToken || lovableToken.length < 10) return json({ ok: false, error: "lovable_token is required" }, 400);
  if (!projectId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId))
    return json({ ok: false, error: "project_id invalid (UUID expected)" }, 400);

  const msgId = crypto.randomUUID();
  const aiMsgId = makeAiMsgId();

  const payload = {
    id: msgId,
    message: ANTI_QUESTION_PREFIX + task.trim(),
    intent: "security_fix_v2",
    chat_only: false,
    ai_message_id: aiMsgId,
    thread_id: "main",
    view, view_description: viewDescription,
    model: null, session_replay: "[]",
    client_logs: [], network_requests: [],
    runtime_errors: runtimeErrors,
    integration_metadata: { browser: { preview_viewport_width: 1280, preview_viewport_height: 854 } },
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
    console.error("[speed-chat] Network error:", e);
    return json({ ok: false, error: "Connection failed" }, 502);
  }

  const lovableBody = await lovableRes.text().catch(() => "");
  let lovableJson: unknown = null;
  try { lovableJson = JSON.parse(lovableBody); } catch { lovableJson = lovableBody; }

  if (lovableRes.ok) {
    return json({ ok: true, status: lovableRes.status, lovable_response: lovableJson, messageId: msgId, aiMessageId: aiMsgId });
  }
  return json({ ok: false, error: `Lovable API returned ${lovableRes.status}`, lovable_status: lovableRes.status, details: lovableJson },
    lovableRes.status >= 500 ? 502 : lovableRes.status);
});
