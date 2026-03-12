import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encodeTaskAsViewDesc, EXECUTE_CMD } from "../_shared/task-encoder.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FIREBASE_KEY = Deno.env.get("FIREBASE_API_KEY") || "";
const C = "0123456789abcdefghjkmnpqrstvwxyz";
const rb32 = (n: number) => Array.from({ length: n }, () => C[Math.floor(Math.random() * 32)]).join("");

function sse(ctrl: ReadableStreamDefaultController, event: string, data: unknown) {
  const enc = new TextEncoder();
  ctrl.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
}

async function selectAccount(supabase: ReturnType<typeof createClient>, brainType: string) {
  const stuckThreshold = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  await supabase.from("brainchain_accounts")
    .update({ is_busy: false, busy_since: null, busy_user_id: null })
    .eq("is_busy", true).lt("busy_since", stuckThreshold);

  for (const type of [brainType, "general"]) {
    const { data } = await supabase.from("brainchain_accounts")
      .select("id, access_token, access_expires_at, refresh_token, brain_project_id, brain_type")
      .eq("is_active", true).eq("is_busy", false).eq("brain_type", type)
      .lt("error_count", 5).not("brain_project_id", "is", null)
      .order("last_used_at", { ascending: true, nullsFirst: true }).limit(1);
    if (data?.length) return data[0];
  }
  return null;
}

async function ensureValidToken(supabase: ReturnType<typeof createClient>, account: Record<string, any>) {
  const expiresAt = account.access_expires_at ? new Date(account.access_expires_at).getTime() : 0;
  if (expiresAt > Date.now() + 60000 && account.access_token) return account.access_token;
  if (!account.refresh_token) return null;

  try {
    const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(account.refresh_token)}`,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const newToken = data.id_token || data.access_token;
    if (!newToken) return null;

    let expiresAtStr = new Date(Date.now() + 3600000).toISOString();
    try { const p = JSON.parse(atob(newToken.split(".")[1])); expiresAtStr = new Date(p.exp * 1000).toISOString(); } catch {}

    await supabase.from("brainchain_accounts").update({
      access_token: newToken, refresh_token: data.refresh_token || account.refresh_token,
      access_expires_at: expiresAtStr, error_count: 0, updated_at: new Date().toISOString(),
    }).eq("id", account.id);

    return newToken;
  } catch { return null; }
}

async function getLatestMessage(projectId: string, token: string): Promise<{ id: string; content: string; is_streaming: boolean } | null> {
  try {
    const res = await fetch(`https://api.lovable.dev/projects/${projectId}/chat/latest-message`, {
      headers: { Authorization: `Bearer ${token}`, Origin: "https://lovable.dev" },
    });
    if (!res.ok) { await res.text().catch(() => {}); return null; }
    const msg = await res.json();
    return {
      id: msg?.id || "",
      content: msg?.content || msg?.message || msg?.text || "",
      is_streaming: !!msg?.is_streaming,
    };
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const body = await req.json().catch(() => ({}));
  const { message, brain_type = "code", user_id } = body;

  // Auth: service key or JWT
  const authHeader = req.headers.get("Authorization") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  let userId = "";

  if (serviceKey && authHeader === `Bearer ${serviceKey}`) {
    userId = user_id || "";
  } else if (authHeader.startsWith("Bearer ")) {
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data } = await authClient.auth.getUser();
    userId = data?.user?.id || "";
  }

  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  if (!message?.trim()) {
    return new Response(JSON.stringify({ error: "message required" }), { status: 400, headers: corsHeaders });
  }

  const account = await selectAccount(supabase, brain_type);
  if (!account) {
    return new Response(JSON.stringify({ error: "No available brains", queued: true }), { status: 503, headers: corsHeaders });
  }

  // Mark busy
  await supabase.from("brainchain_accounts").update({
    is_busy: true, busy_since: new Date().toISOString(), busy_user_id: userId, last_used_at: new Date().toISOString(),
  }).eq("id", account.id);

  const { data: queueRecord } = await supabase.from("brainchain_queue").insert({
    user_id: userId, brain_type, message, status: "processing", account_id: account.id, started_at: new Date().toISOString(),
  }).select("id").single();

  const startedAt = Date.now();

  // Return SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const token = await ensureValidToken(supabase, account);
        if (!token) throw new Error("Token inválido");

        const projectId = account.brain_project_id;
        if (!projectId) throw new Error("Brain project not configured");

        sse(controller, "status", { phase: "connecting", brain_type: account.brain_type });

        // Snapshot current latest message
        const initial = await getLatestMessage(projectId, token);
        const initialMsgId = initial?.id || "";

        // Send message to Brain
        const msgId = "usermsg_" + rb32(26);
        const aiMsgId = "aimsg_" + rb32(26);

        const lvRes = await fetch(`https://api.lovable.dev/projects/${projectId}/chat`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`, "Content-Type": "application/json",
            Origin: "https://lovable.dev", Referer: "https://lovable.dev/",
            "X-Client-Git-SHA": "3d7a3673c6f02b606137a12ddc0ab88f6b775113",
          },
          body: JSON.stringify({
            id: msgId, message, chat_only: false, ai_message_id: aiMsgId,
            thread_id: "main", view: "editor",
            view_description: "User requesting Brain analysis.", model: null,
            session_replay: "[]", client_logs: [], network_requests: [],
            runtime_errors: [], files: [],
            integration_metadata: {
              browser: { preview_viewport_width: 1280, preview_viewport_height: 854, auth_token: token },
              supabase: { auth_token: token },
            },
          }),
        });

        if (!lvRes.ok) {
          const d = await lvRes.json().catch(() => ({}));
          throw new Error(d.error || `Brain HTTP ${lvRes.status}`);
        }
        // Consume body
        await lvRes.text().catch(() => {});

        sse(controller, "status", { phase: "thinking" });

        // Poll and stream deltas
        let lastContent = "";
        let finalContent = "";
        let found = false;

        for (let i = 0; i < 90; i++) { // up to ~90 seconds
          await new Promise(r => setTimeout(r, 1000));

          const latest = await getLatestMessage(projectId, token);
          if (!latest || !latest.id || latest.id === initialMsgId) continue;

          const currentContent = latest.content || "";

          // Send delta
          if (currentContent.length > lastContent.length) {
            const delta = currentContent.slice(lastContent.length);
            sse(controller, "delta", { content: delta });
            lastContent = currentContent;
          }

          // Check if streaming is done
          if (!latest.is_streaming && currentContent.length > 20) {
            finalContent = currentContent;
            found = true;
            // Send any remaining delta
            if (currentContent.length > lastContent.length) {
              sse(controller, "delta", { content: currentContent.slice(lastContent.length) });
            }
            break;
          }
        }

        const durationMs = Date.now() - startedAt;

        // Cleanup
        await Promise.all([
          supabase.from("brainchain_queue").update({
            status: found ? "done" : "timeout", response: finalContent || null, completed_at: new Date().toISOString(),
          }).eq("id", queueRecord?.id),
          supabase.from("brainchain_accounts").update({
            is_busy: false, busy_since: null, busy_user_id: null, error_count: 0, updated_at: new Date().toISOString(),
          }).eq("id", account.id),
          supabase.rpc("increment_requests", { acc_id: account.id }),
          supabase.from("brainchain_usage").insert({
            user_id: userId, brain_type, account_id: account.id, queue_id: queueRecord?.id, duration_ms: durationMs, success: found,
          }),
        ]);

        sse(controller, "done", { duration_ms: durationMs, success: found, content_length: finalContent.length });

      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);

        await supabase.from("brainchain_accounts").update({
          is_busy: false, busy_since: null, busy_user_id: null, updated_at: new Date().toISOString(),
        }).eq("id", account.id);
        await supabase.rpc("increment_errors", { acc_id: account.id });

        if (queueRecord?.id) {
          await supabase.from("brainchain_queue").update({
            status: "error", error_msg: errMsg, completed_at: new Date().toISOString(),
          }).eq("id", queueRecord.id);
        }

        sse(controller, "error", { error: errMsg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
});
