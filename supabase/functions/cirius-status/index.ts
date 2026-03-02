/**
 * Cirius Status — Lightweight polling endpoint
 * Actions: get, list
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function getUser(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const sc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } }
  );
  const { data: { user } } = await sc.auth.getUser();
  return user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const user = await getUser(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const sc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const body = await req.json().catch(() => ({}));
  const action = (body.action as string) || "list";

  if (action === "get") {
    const projectId = body.project_id;
    if (!projectId) return json({ error: "project_id required" }, 400);

    const { data: project } = await sc.from("cirius_projects")
      .select("id, name, status, current_step, progress_pct, generation_engine, error_message, preview_url, github_url, vercel_url, netlify_url, supabase_url, template_type, created_at, updated_at, deployed_at")
      .eq("id", projectId).eq("user_id", user.id).single();
    if (!project) return json({ error: "Not found" }, 404);

    const { data: logs } = await sc.from("cirius_generation_log")
      .select("step, status, level, message, created_at, duration_ms")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(15);

    return json({
      project,
      logs: logs || [],
      deploy: {
        github_url: project.github_url,
        vercel_url: project.vercel_url,
        netlify_url: project.netlify_url,
        supabase_url: project.supabase_url,
      },
    });
  }

  // LIST
  const { data: projects } = await sc.from("cirius_projects")
    .select("id, name, status, template_type, generation_engine, progress_pct, github_url, vercel_url, netlify_url, preview_url, created_at, updated_at, deployed_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return json({ projects: projects || [] });
});
