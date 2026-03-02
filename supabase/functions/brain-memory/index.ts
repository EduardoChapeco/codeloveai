/**
 * Brain Memory — Persistent project memory via .cirius/knowledge/base.md
 * Actions: append, read, reset
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MEMORY_PATH = ".cirius/knowledge/base.md";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Auth — support both user JWT and service key
  const authHeader = req.headers.get("Authorization") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const isServiceKey = authHeader === `Bearer ${serviceRoleKey}`;

  let userId: string | null = null;
  if (isServiceKey) {
    // Service key calls pass user_id in body
  } else {
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    userId = user?.id || null;
  }

  const sc = createClient(supabaseUrl, serviceRoleKey);
  const body = await req.json().catch(() => ({}));
  const action = (body.action as string) || "read";
  const projectId = typeof body.project_id === "string" ? body.project_id.trim() : "";

  if (!projectId || projectId.length < 10) return json({ error: "project_id required" }, 400);

  const effectiveUserId = userId || (isServiceKey ? body.user_id : null);

  // Load project
  let projectQuery = sc.from("cirius_projects").select("id, source_files_json, user_id").eq("id", projectId);
  if (!isServiceKey && effectiveUserId) projectQuery = projectQuery.eq("user_id", effectiveUserId);
  const { data: project } = await projectQuery.maybeSingle();
  if (!project) return json({ error: "Project not found" }, 404);

  const files = (project.source_files_json || {}) as Record<string, string>;

  // ─── READ ───
  if (action === "read") {
    const memory = files[MEMORY_PATH] || "";
    return json({ memory, length: memory.length, path: MEMORY_PATH });
  }

  // ─── APPEND ───
  if (action === "append") {
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!content) return json({ error: "content required" }, 400);
    if (content.length > 50_000) return json({ error: "content too large (max 50KB)" }, 400);

    const existing = files[MEMORY_PATH] || "";
    const timestamp = new Date().toISOString();
    const separator = existing ? `\n\n---\n_${timestamp}_\n\n` : `# Project Memory\n_Created: ${timestamp}_\n\n`;
    const updated = existing + separator + content;

    // Cap total memory at 200KB
    const capped = updated.length > 200_000 ? updated.slice(updated.length - 200_000) : updated;

    const updatedFiles = { ...files, [MEMORY_PATH]: capped };
    await sc.from("cirius_projects").update({
      source_files_json: updatedFiles,
      updated_at: new Date().toISOString(),
    }).eq("id", projectId);

    return json({ ok: true, length: capped.length, path: MEMORY_PATH });
  }

  // ─── RESET ───
  if (action === "reset") {
    const updatedFiles = { ...files };
    delete updatedFiles[MEMORY_PATH];
    await sc.from("cirius_projects").update({
      source_files_json: updatedFiles,
      updated_at: new Date().toISOString(),
    }).eq("id", projectId);
    return json({ ok: true, cleared: true });
  }

  return json({ error: "unknown action — use read, append, or reset" }, 400);
});
