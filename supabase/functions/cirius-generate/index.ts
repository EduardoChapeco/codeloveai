/**
 * Cirius Generate — Main pipeline orchestrator
 * Actions: init, generate_prd, generate_code, capture, status, pause, resume, cancel
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXT_API = "https://api.lovable.dev";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function extractJSON(content: string): any {
  if (!content || content.length < 10) return null;
  let s = content.trim();
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) s = m[1].trim();
  const i = s.indexOf("{");
  if (i >= 0) s = s.slice(i);
  const j = s.lastIndexOf("}");
  if (j >= 0) s = s.slice(0, j + 1);
  try {
    const parsed = JSON.parse(s);
    if (parsed.tasks && Array.isArray(parsed.tasks) && parsed.tasks.length > 0) return parsed;
  } catch { /* invalid */ }
  return null;
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

async function log(sc: SupabaseClient, projectId: string, step: string, status: string, message: string, extra?: Record<string, unknown>) {
  await sc.from("cirius_generation_log").insert({
    project_id: projectId, step, status, message,
    level: status === "failed" ? "error" : status === "retrying" ? "warning" : "info",
    ...extra,
  });
}

function selectEngine(config: { template_type?: string; features?: string[]; complexity_score?: number }): string {
  const { template_type, features = [], complexity_score = 0 } = config;
  if (template_type === "landing" && features.length <= 2) return "brainchain";
  if (["app", "dashboard", "ecommerce"].includes(template_type || "")) return "brain";
  if (features.length > 3 || complexity_score > 7) return "orchestrator";
  return "brainchain";
}

async function generatePRD(project: Record<string, any>): Promise<any> {
  const features = Array.isArray(project.features) ? project.features : [];
  const prompt = `You are a senior software architect. A client wants to build:
Name: ${project.name}
Type: ${project.template_type || "app"}
Description: ${project.description || ""}
Features: ${features.join(", ") || "basic"}
Source URL reference: ${project.source_url || "none"}
Stack: React + Tailwind + shadcn/ui + Supabase

Break into 3-7 sequential implementation tasks. Return ONLY valid JSON:
{"tasks":[{"title":"Short title","skill":"code","intent":"security_fix_v2","prompt":"Detailed implementation prompt","stop_condition":"file_exists:src/App.tsx","brain_type":"code"}]}

Rules:
- intent MUST be security_fix_v2
- Prompts must be self-contained, detailed, implementation-ready
- No questions, no clarifications
- Maximum 7 tasks`;

  const key = Deno.env.get("LOVABLE_API_KEY");
  if (key) {
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "Return only valid JSON, no markdown fences." },
            { role: "user", content: prompt },
          ],
          temperature: 0.2, max_tokens: 3000,
        }),
      });
      if (res.ok) {
        const result = await res.json();
        const content = result?.choices?.[0]?.message?.content || "";
        const parsed = extractJSON(content);
        if (parsed) return parsed;
      }
    } catch (e) { console.error("[cirius-generate] Gateway error:", (e as Error).message); }
  }

  // Fallback: OpenRouter
  const orKey = Deno.env.get("OPENROUTER_API_KEY");
  if (orKey) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${orKey}`, "Content-Type": "application/json",
          "HTTP-Referer": "https://starble.lovable.app", "X-Title": "Cirius Generator",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "Return only valid JSON, no markdown fences." },
            { role: "user", content: prompt },
          ],
          temperature: 0.2, max_tokens: 3000,
        }),
      });
      if (res.ok) {
        const result = await res.json();
        const content = result?.choices?.[0]?.message?.content || "";
        return extractJSON(content);
      }
    } catch (e) { console.error("[cirius-generate] OpenRouter error:", (e as Error).message); }
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const user = await getUser(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const sc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const body = await req.json().catch(() => ({}));
  const action = (body.action as string) || "";

  // ─── INIT ───
  if (action === "init") {
    const config = body.config || {};
    if (!config.name) return json({ error: "config.name required" }, 400);

    const { data: project, error } = await sc.from("cirius_projects").insert({
      user_id: user.id,
      name: config.name,
      description: config.description || null,
      template_type: config.template_type || "custom",
      source_url: config.source_url || null,
      tech_stack: config.tech_stack || { framework: "react", css: "tailwind", ui: "shadcn" },
      features: config.features || [],
      deploy_config: config.deploy_config || {},
      status: "draft",
    }).select("id, status").single();

    if (error) return json({ error: error.message }, 500);
    await log(sc, project.id, "init", "completed", "Projeto criado");
    return json({ project_id: project.id, status: "draft" });
  }

  // ─── GENERATE_PRD ───
  if (action === "generate_prd") {
    const projectId = body.project_id;
    if (!projectId) return json({ error: "project_id required" }, 400);

    const { data: project } = await sc.from("cirius_projects")
      .select("*").eq("id", projectId).eq("user_id", user.id).single();
    if (!project) return json({ error: "Project not found" }, 404);

    await sc.from("cirius_projects").update({ status: "generating_prd" }).eq("id", projectId);
    await log(sc, projectId, "prd", "started", "Gerando PRD...");

    const startMs = Date.now();
    const prd = await generatePRD(project);
    const durationMs = Date.now() - startMs;

    if (!prd) {
      await sc.from("cirius_projects").update({ status: "failed", error_message: "Falha ao gerar PRD" }).eq("id", projectId);
      await log(sc, projectId, "prd", "failed", "PRD generation failed", { duration_ms: durationMs });
      return json({ error: "PRD generation failed" }, 500);
    }

    const features = Array.isArray(project.features) ? project.features : [];
    const engine = selectEngine({
      template_type: project.template_type,
      features,
      complexity_score: features.length,
    });

    await sc.from("cirius_projects").update({
      prd_json: prd, generation_engine: engine, status: "draft", progress_pct: 15,
    }).eq("id", projectId);

    await log(sc, projectId, "prd", "completed", `PRD gerado: ${prd.tasks.length} tasks, engine: ${engine}`, {
      duration_ms: durationMs, output_json: { task_count: prd.tasks.length, engine },
    });

    return json({ prd_json: prd, engine_selected: engine, task_count: prd.tasks.length });
  }

  // ─── GENERATE_CODE ───
  if (action === "generate_code") {
    const projectId = body.project_id;
    if (!projectId) return json({ error: "project_id required" }, 400);

    const { data: project } = await sc.from("cirius_projects")
      .select("*").eq("id", projectId).eq("user_id", user.id).single();
    if (!project) return json({ error: "Project not found" }, 404);
    if (!project.prd_json) return json({ error: "PRD not generated yet" }, 400);

    const engine = project.generation_engine || "brainchain";
    await sc.from("cirius_projects").update({
      status: "generating_code", generation_started_at: new Date().toISOString(), progress_pct: 20,
    }).eq("id", projectId);
    await log(sc, projectId, "code", "started", `Iniciando geração via ${engine}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const prd = project.prd_json as { tasks: Array<{ prompt: string; brain_type?: string; title?: string }> };

    if (engine === "brainchain") {
      // Fire first task via brainchain-send
      const firstTask = prd.tasks[0];
      try {
        const bcRes = await fetch(`${supabaseUrl}/functions/v1/brainchain-send`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({
            message: `IMPORTANTE: Execute diretamente, sem perguntas.\n\n${firstTask.prompt}`,
            brain_type: firstTask.brain_type || "code",
            user_id: user.id,
          }),
        });
        const bcData = await bcRes.json();

        if (bcData.queued) {
          await sc.from("cirius_projects").update({ brainchain_queue_id: bcData.queue_id }).eq("id", projectId);
          await log(sc, projectId, "code_task_0", "started", "Enfileirado no Brainchain", { output_json: bcData });
        } else if (bcData.ok && bcData.response) {
          await sc.from("cirius_projects").update({
            source_files_json: { _raw_response: bcData.response },
            progress_pct: 80, status: "deploying",
          }).eq("id", projectId);
          await log(sc, projectId, "code_task_0", "completed", "Código gerado via Brainchain");
        }

        return json({ started: true, engine, estimated_seconds: 90 });
      } catch (e) {
        await log(sc, projectId, "code_task_0", "failed", (e as Error).message);
        return json({ error: (e as Error).message }, 500);
      }
    }

    if (engine === "orchestrator") {
      try {
        const orchRes = await fetch(`${supabaseUrl}/functions/v1/agentic-orchestrator`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
            "x-orchestrator-internal": "true",
          },
          body: JSON.stringify({
            action: "start",
            client_prompt: prd.tasks.map(t => t.prompt).join("\n\n---\n\n"),
            _internal_user_id: user.id,
          }),
        });
        const orchData = await orchRes.json();
        if (orchData.project_id) {
          await sc.from("cirius_projects").update({
            orchestrator_project_id: orchData.project_id, progress_pct: 25,
          }).eq("id", projectId);
        }
        await log(sc, projectId, "code", "started", "Orquestrador iniciado", { output_json: orchData });
        return json({ started: true, engine, estimated_seconds: 600 });
      } catch (e) {
        await log(sc, projectId, "code", "failed", (e as Error).message);
        return json({ error: (e as Error).message }, 500);
      }
    }

    // brain engine — send via brain function
    try {
      const brainRes = await fetch(`${supabaseUrl}/functions/v1/brain`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: req.headers.get("Authorization") || "" },
        body: JSON.stringify({
          action: "send",
          prompt: prd.tasks[0].prompt,
          skill: prd.tasks[0].brain_type || "code",
        }),
      });
      const brainData = await brainRes.json();
      await log(sc, projectId, "code_task_0", "started", "Enviado ao Brain pessoal", { output_json: brainData });
      return json({ started: true, engine, estimated_seconds: 300 });
    } catch (e) {
      await log(sc, projectId, "code", "failed", (e as Error).message);
      return json({ error: (e as Error).message }, 500);
    }
  }

  // ─── STATUS ───
  if (action === "status") {
    const projectId = body.project_id;
    if (!projectId) return json({ error: "project_id required" }, 400);

    const { data: project } = await sc.from("cirius_projects")
      .select("id, name, status, current_step, progress_pct, generation_engine, error_message, preview_url, github_url, vercel_url, netlify_url, supabase_url, created_at, updated_at")
      .eq("id", projectId).eq("user_id", user.id).single();
    if (!project) return json({ error: "Not found" }, 404);

    const { data: logs } = await sc.from("cirius_generation_log")
      .select("step, status, level, message, created_at, duration_ms")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(10);

    return json({ project, logs: logs || [] });
  }

  // ─── PAUSE / RESUME / CANCEL ───
  if (action === "pause" || action === "resume" || action === "cancel") {
    const projectId = body.project_id;
    if (!projectId) return json({ error: "project_id required" }, 400);

    const statusMap: Record<string, string> = { pause: "paused", resume: "generating_code", cancel: "failed" };
    const { error } = await sc.from("cirius_projects")
      .update({
        status: statusMap[action],
        ...(action === "cancel" ? { error_message: "Cancelado pelo usuário" } : {}),
      })
      .eq("id", projectId).eq("user_id", user.id);

    if (error) return json({ error: error.message }, 500);
    await log(sc, projectId, action, "completed", `Pipeline ${action === "cancel" ? "cancelado" : action === "pause" ? "pausado" : "retomado"}`);
    return json({ [action === "cancel" ? "cancelled" : action === "pause" ? "paused" : "resumed"]: true });
  }

  // ─── CAPTURE ───
  if (action === "capture") {
    const projectId = body.project_id;
    const lovableProjectId = body.lovable_project_id;
    if (!projectId) return json({ error: "project_id required" }, 400);

    const { data: project } = await sc.from("cirius_projects")
      .select("*").eq("id", projectId).eq("user_id", user.id).single();
    if (!project) return json({ error: "Not found" }, 404);

    // Try to get source-code from lovable project
    const targetProjectId = lovableProjectId || project.lovable_project_id;
    if (!targetProjectId) return json({ error: "No lovable_project_id" }, 400);

    // Get user token
    const { data: account } = await sc.from("lovable_accounts")
      .select("token_encrypted").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();

    if (!account?.token_encrypted) return json({ error: "No Lovable token" }, 503);

    const scRes = await fetch(`${EXT_API}/projects/${targetProjectId}/source-code`, {
      headers: {
        Authorization: `Bearer ${account.token_encrypted}`,
        Origin: "https://lovable.dev", Referer: "https://lovable.dev/",
        "X-Client-Git-SHA": "3d7a3673c6f02b606137a12ddc0ab88f6b775113",
      },
    });

    if (!scRes.ok) return json({ error: `Source-code fetch failed: ${scRes.status}` }, 500);

    const scData = await scRes.json();
    const files = scData.files || [];
    const filesJson: Record<string, string> = {};
    for (const f of files) {
      if (f.path && !f.path.startsWith(".lovable/")) {
        filesJson[f.path] = f.content || "";
      }
    }

    const fingerprint = files.map((f: any) => `${f.path}:${f.size ?? 0}`).sort().join("|");

    await sc.from("cirius_projects").update({
      source_files_json: filesJson,
      files_fingerprint: fingerprint,
      lovable_project_id: targetProjectId,
      progress_pct: 80,
      generation_ended_at: new Date().toISOString(),
    }).eq("id", projectId);

    await log(sc, projectId, "capture", "completed", `${Object.keys(filesJson).length} arquivos capturados`);
    return json({ files_json: filesJson, fingerprint, file_count: Object.keys(filesJson).length });
  }

  return json({ error: "unknown_action" }, 400);
});
