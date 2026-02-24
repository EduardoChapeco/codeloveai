import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * relay-response — WebSocket bridge
 *
 * Receives AI responses captured by the browser extension's
 * WebSocket hook and stores them in orchestration_messages so
 * the OrchestratorProjectPanel can display them via Realtime.
 *
 * POST { project_id, content, task_id?, metadata? }
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sc = createClient(supabaseUrl, serviceKey);

  // Validate JWT (anon key bearer from extension)
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  try {
    const { project_id, content, task_id, metadata, role = "assistant" } = await req.json() as {
      project_id: string;
      content: string;
      task_id?: string;
      metadata?: Record<string, unknown>;
      role?: string;
    };

    if (!content || content.length < 3) return json({ ok: true }); // skip empty/noise
    if (!project_id) return json({ error: "project_id required" }, 400);

    await sc.from("orchestration_messages").insert({
      project_id,
      source:     "relay",
      role,
      content:    content.slice(0, 8000), // sanity limit
      task_id:    task_id || null,
      metadata:   metadata || {},
    });

    // Also append to orchestrator_logs so the live log panel shows it
    await sc.from("orchestrator_logs").insert({
      project_id,
      task_id:  task_id || null,
      level:    "debug",
      message:  `[WS Relay] ${content.slice(0, 200)}`,
      metadata: { source: "relay" },
    });

    return json({ ok: true });
  } catch (e) {
    console.error("[relay-response]", e);
    return json({ error: (e as Error).message }, 500);
  }
});
