import { generateTypeId, obfuscate } from "../_shared/crypto.ts";
import { lovFetch, getWorkspaceId } from "./token-helpers.ts";

type SupabaseClient = any;

const API = "https://api.lovable.dev";

export async function getBrain(sc: SupabaseClient, userId: string) {
  const { data } = await sc.from("user_brain_projects")
    .select("lovable_project_id, lovable_workspace_id, status, skill_phase")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || data.status === "creating" || data.status === "injecting") return null;
  if (data.status !== "active") return null;
  return data;
}

export async function getBrainRaw(sc: SupabaseClient, userId: string) {
  const { data } = await sc.from("user_brain_projects")
    .select("lovable_project_id, lovable_workspace_id, status, skill_phase, created_at")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

export async function verifyProject(projectId: string, token: string): Promise<boolean> {
  try {
    const res = await lovFetch(`${API}/projects/${projectId}`, token, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

async function acquireBrainLock(sc: SupabaseClient, userId: string): Promise<boolean> {
  const existing = await getBrainRaw(sc, userId);

  if (existing?.status === "creating" || existing?.status === "injecting") {
    if (existing.created_at) {
      const age = Date.now() - new Date(existing.created_at).getTime();
      if (age > 180_000) {
        await sc.from("user_brain_projects").delete().eq("user_id", userId);
      } else {
        console.log(`[Brain] Lock held for ${obfuscate(userId)}, age ${Math.round(age / 1000)}s`);
        return false;
      }
    }
  }

  if (existing?.status === "active" && existing.lovable_project_id !== "creating") {
    return false;
  }

  await sc.from("user_brain_projects").delete().eq("user_id", userId);

  const { error } = await sc.from("user_brain_projects").insert({
    user_id: userId,
    lovable_project_id: "creating",
    lovable_workspace_id: "pending",
    status: "creating",
    brain_owner: "user",
    skill_phase: 0,
  });

  if (error) {
    console.error(`[Brain] Lock insert failed:`, error.message);
    return false;
  }
  return true;
}

// ─── Dynamic Skill Injection Prompts (5 phases) ───
// Generated at runtime with actual secrets/URLs so the Brain project
// can communicate back to our backend.

interface BrainContext {
  supabaseUrl: string;
  anonKey: string;
  userId: string;
  projectId: string;
}

function buildSkillPrompts(ctx: BrainContext): string[] {
  const { supabaseUrl, anonKey, userId, projectId } = ctx;
  const callbackUrl = `${supabaseUrl}/functions/v1/brain-capture-cron`;
  const relayUrl = `${supabaseUrl}/functions/v1/relay-response`;

  return [
    // Phase 1: Project config + env file with real credentials
    `Create these project configuration files:

1. Create .env with the backend connection settings:
\`\`\`
SUPABASE_URL=${supabaseUrl}
SUPABASE_ANON_KEY=${anonKey}
BRAIN_USER_ID=${userId}
BRAIN_PROJECT_ID=${projectId}
CALLBACK_URL=${callbackUrl}
\`\`\`

2. Create src/brain-output.md:
\`\`\`
---
status: idle
timestamp: 0
---
\`\`\`

3. Create src/config.json:
\`\`\`json
{"version":"2.0","output_file":"src/brain-output.md","callback_url":"${callbackUrl}","relay_url":"${relayUrl}","user_id":"${userId}"}
\`\`\``,

    // Phase 2: Instructions with callback protocol
    `Create src/INSTRUCTIONS.md with these project rules:

# Star AI Brain — System Guidelines

This is a headless task processing system. No UI rendering.

## Response Protocol
1. Write all answers in \`src/brain-output.md\`
2. Use frontmatter: \`status: done\` when complete
3. Never create React components, pages, or visual routes
4. Respond in Brazilian Portuguese
5. For code tasks, embed code inside the markdown response

## Output Format
\`\`\`markdown
---
status: done
timestamp: (unix ms)
---

(answer here)
\`\`\`

## Backend Connection
- API Base: \`${supabaseUrl}\`
- Callback: \`${callbackUrl}\`
- This project can call the backend to report completion`,

    // Phase 3: Webhook edge function with real callback
    `Create supabase/functions/brain-webhook/index.ts — a webhook that reports task completion back to our backend:

\`\`\`typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CALLBACK = "${callbackUrl}";
const ANON_KEY = "${anonKey}";
const USER_ID = "${userId}";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const body = await req.json();
    const { task_id, response, status } = body;

    // Report back to parent system
    await fetch(CALLBACK, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + ANON_KEY,
      },
      body: JSON.stringify({
        user_id: USER_ID,
        task_id,
        response,
        status: status || "done",
        source: "brain-webhook",
      }),
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
\`\`\`

Also add to supabase/config.toml:
\`\`\`toml
[functions.brain-webhook]
verify_jwt = false
\`\`\``,

    // Phase 4: Utility helpers for response formatting + API calls
    `Create src/api-helpers.ts with helper functions:

\`\`\`typescript
const CONFIG = {
  supabaseUrl: "${supabaseUrl}",
  anonKey: "${anonKey}",
  userId: "${userId}",
  callbackUrl: "${callbackUrl}",
  relayUrl: "${relayUrl}",
};

export function formatOutput(text: string): string {
  return [
    "---",
    "status: done",
    "timestamp: " + Date.now(),
    "---",
    "",
    text,
  ].join("\\n");
}

export async function notifyCompletion(taskId: string, response: string) {
  try {
    await fetch(CONFIG.callbackUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + CONFIG.anonKey,
      },
      body: JSON.stringify({
        user_id: CONFIG.userId,
        task_id: taskId,
        response,
        status: "done",
      }),
    });
  } catch (e) {
    console.error("Callback failed:", e);
  }
}

export { CONFIG };
\`\`\``,

    // Phase 5: Final ready signal
    `Update src/brain-output.md to confirm the system is fully initialized:

\`\`\`markdown
---
status: done
timestamp: ${Date.now()}
---

Star AI Brain v2.0 initialized. Backend connected to ${supabaseUrl}. Webhook and callback system ready. Awaiting tasks.
\`\`\`

Make sure all files are saved: .env, src/config.json, src/INSTRUCTIONS.md, src/api-helpers.ts, and supabase/functions/brain-webhook/index.ts.`,
  ];
}

/**
 * Sends skill injection prompts sequentially after ghost create.
 * Uses task mode with subtle, natural prompts.
 */
async function injectSkills(
  sc: SupabaseClient,
  userId: string,
  projectId: string,
  token: string,
  ctx: BrainContext,
  startPhase: number = 0
): Promise<boolean> {
  const prompts = buildSkillPrompts(ctx);

  for (let i = startPhase; i < prompts.length; i++) {
    const phase = i + 1;
    console.log(`[Brain] Injecting skill phase ${phase}/5 for ${obfuscate(userId)}`);

    await sc.from("user_brain_projects")
      .update({ skill_phase: phase, status: "injecting" })
      .eq("user_id", userId);

    const payload = buildTaskPayload(prompts[i]);

    try {
      const res = await lovFetch(
        `${API}/projects/${projectId}/chat`,
        token,
        { method: "POST", body: JSON.stringify(payload) }
      );

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.error(`[Brain] Skill phase ${phase} failed: ${res.status} ${errText.slice(0, 200)}`);
        if (res.status === 401 || res.status === 403) return false;
        continue;
      }

      console.log(`[Brain] ✅ Skill phase ${phase} sent`);

      // Wait for Lovable to process (40s between phases for commit cooldown)
      const waitMs = i < prompts.length - 1 ? 40000 : 15000;
      await new Promise(r => setTimeout(r, waitMs));
    } catch (e) {
      console.error(`[Brain] Skill phase ${phase} error:`, e);
      continue;
    }
  }

  return true;
}

/**
 * Ghost Create + Skill Injection
 */
export async function createFreshBrain(
  sc: SupabaseClient,
  userId: string,
  token: string
): Promise<{ projectId: string; workspaceId: string } | { error: string }> {
  const locked = await acquireBrainLock(sc, userId);
  if (!locked) {
    await new Promise(r => setTimeout(r, 3000));
    const existing = await getBrain(sc, userId);
    if (existing) return { projectId: existing.lovable_project_id, workspaceId: existing.lovable_workspace_id };
    return { error: "Brain está sendo criado. Tente novamente em alguns segundos." };
  }

  try {
    const workspaceId = await getWorkspaceId(token);
    if (!workspaceId) {
      await sc.from("user_brain_projects").delete().eq("user_id", userId);
      return { error: "Nenhum workspace encontrado. Reconecte em /lovable/connect." };
    }

    console.log(`[Brain] Ghost Create in workspace ${obfuscate(workspaceId)} for ${obfuscate(userId)}`);

    // ── STEP 1: Ghost Create ──
    const payloads = [
      { name: "Star AI Brain", initial_message: "setup", visibility: "private" },
      {
        description: "Star AI Brain",
        visibility: "private",
        env_vars: {},
        initial_message: {
          id: crypto.randomUUID(),
          message: "setup",
          files: [],
          optimisticImageUrls: [],
          chat_only: false,
          agent_mode_enabled: false,
          ai_message_id: generateTypeId("aimsg"),
        },
      },
      { description: "Star AI Brain", initial_message: "setup", visibility: "private" },
    ];

    let createRes: Response | null = null;
    for (let i = 0; i < payloads.length; i++) {
      const res = await lovFetch(`${API}/workspaces/${workspaceId}/projects`, token, {
        method: "POST",
        body: JSON.stringify(payloads[i]),
      });
      if (res.ok) {
        createRes = res;
        console.log(`[Brain] ✅ Format ${String.fromCharCode(65 + i)} succeeded`);
        break;
      } else {
        const errText = await res.text().catch(() => "");
        console.error(`[Brain] Format ${String.fromCharCode(65 + i)} failed: ${res.status} ${errText.slice(0, 200)}`);
      }
    }

    if (!createRes || !createRes.ok) {
      await sc.from("user_brain_projects").delete().eq("user_id", userId);
      return { error: "Falha ao criar projeto Brain — nenhum formato aceito pela API" };
    }

    const project = await createRes.json();
    const projectId = project?.id;
    const msgId = project?.message_id;

    if (!projectId) {
      await sc.from("user_brain_projects").delete().eq("user_id", userId);
      return { error: "ID do projeto não retornado pela API" };
    }

    console.log(`[Brain] ✅ Project created: ${projectId}, msgId: ${msgId || "unknown"}`);

    // ── STEP 2: Cancel immediately ──
    if (msgId) {
      try {
        await lovFetch(`${API}/projects/${projectId}/chat/${msgId}/cancel`, token, { method: "POST" });
        console.log(`[Brain] ✅ Initial message cancelled`);
      } catch (e) {
        console.warn(`[Brain] Cancel failed (non-critical):`, e);
      }
    }

    // ── STEP 3: Update record with real project ID ──
    await sc.from("user_brain_projects")
      .update({
        lovable_project_id: projectId,
        lovable_workspace_id: workspaceId,
        status: "injecting",
        skill_phase: 0,
      })
      .eq("user_id", userId);

    // ── STEP 4: Inject skills (5 phases) with real credentials ──
    const brainCtx: BrainContext = {
      supabaseUrl: Deno.env.get("SUPABASE_URL") || "",
      anonKey: Deno.env.get("SUPABASE_ANON_KEY") || "",
      userId,
      projectId,
    };

    // Run in background — don't block the response
    (async () => {
      try {
        const success = await injectSkills(sc, userId, projectId, token, brainCtx);
        if (success) {
          await sc.from("user_brain_projects")
            .update({ status: "active", skill_phase: 5 })
            .eq("user_id", userId);
          console.log(`[Brain] ✅ All skills injected for ${obfuscate(userId)}`);
        } else {
          // Auth failure during injection — still mark as active, skills can be retried
          await sc.from("user_brain_projects")
            .update({ status: "active" })
            .eq("user_id", userId);
          console.warn(`[Brain] Skills partially injected for ${obfuscate(userId)}`);
        }
      } catch (e) {
        console.error(`[Brain] Skill injection background error:`, e);
        await sc.from("user_brain_projects")
          .update({ status: "active" })
          .eq("user_id", userId);
      }
    })();

    console.log(`[Brain] ✅ Ghost Create complete, skill injection started for ${obfuscate(userId)} → ${projectId}`);
    return { projectId, workspaceId };
  } catch (err) {
    console.error(`[Brain] createFreshBrain error:`, err);
    await sc.from("user_brain_projects").delete().eq("user_id", userId);
    throw err;
  }
}

/**
 * Build payload in TASK mode — subtle, natural task request.
 * Uses security_fix_v2 intent for free channel but with code view.
 */
function buildTaskPayload(prompt: string) {
  return {
    id: crypto.randomUUID(),
    message: prompt,
    intent: "security_fix_v2",
    chat_only: false,
    ai_message_id: generateTypeId("aimsg"),
    thread_id: "main",
    view: "code",
    view_description: "The user is currently viewing the code editor.",
    model: null,
    session_replay: "[]",
    client_logs: [],
    network_requests: [],
    runtime_errors: [],
    files: [],
    selected_elements: [],
    optimisticImageUrls: [],
    debug_mode: false,
    integration_metadata: { browser: { preview_viewport_width: 1280, preview_viewport_height: 854 } },
  };
}

/**
 * Public payload builder — used by loveai-brain/index.ts for user messages.
 * Same task mode structure.
 */
export function buildPayload(prompt: string) {
  return buildTaskPayload(prompt);
}

/**
 * Build a SUBTLE prompt for normal user messages.
 * No aggressive prefixes — just a clean task description.
 */
export function buildBrainPrompt(brainType: string, message: string): string {
  const ts = Date.now();

  // Simple, subtle output instruction
  const outputRule = `\n\nWrite your complete response in src/brain-output.md using this format:\n---\nstatus: done\ntimestamp: ${ts}\n---\n\n(your answer here)\n\nRespond in Brazilian Portuguese. Do not create React components or pages.`;

  const modes: Record<string, string> = {
    general: message + outputRule,
    design: `Help me with this design task: ${message}${outputRule}`,
    code: `Help me write this code: ${message}${outputRule}`,
    scraper: `Create a web scraper for: ${message}${outputRule}`,
    migration: `Generate SQL migration for: ${message}${outputRule}`,
  };

  return modes[brainType] || modes.general;
}

/**
 * Captures Brain response by polling source-code for brain-output.md
 */
export async function captureResponse(
  projectId: string,
  token: string,
  maxWaitMs = 90000,
  intervalMs = 4000,
  initialDelayMs = 6000
): Promise<{ response: string | null; status: "completed" | "processing" | "timeout" }> {
  await new Promise(r => setTimeout(r, initialDelayMs));
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    // Strategy 1: Check latest-message for direct AI response
    try {
      const latestRes = await lovFetch(`${API}/projects/${projectId}/latest-message`, token, { method: "GET" });
      if (latestRes.ok) {
        const msg = await latestRes.json();
        if (msg && !msg.is_streaming && msg.role !== "user") {
          const content = msg.content || msg.message || msg.text || "";
          if (content.length > 20) return { response: content, status: "completed" };
        }
      }
    } catch { /* continue */ }

    // Strategy 2: Poll source-code for brain-output.md
    try {
      const srcRes = await lovFetch(`${API}/projects/${projectId}/source-code`, token, { method: "GET" });
      if (srcRes.ok) {
        const rawText = await srcRes.text();
        let srcData: any;
        try { srcData = JSON.parse(rawText); } catch { srcData = {}; }
        const files = srcData?.files || srcData?.data?.files || srcData?.source?.files || srcData;

        const getContent = (path: string, name: string): string | null => {
          if (Array.isArray(files)) {
            const f = files.find((f: any) => f.path === path || f.name === name);
            return f?.content || f?.source || null;
          } else if (files && typeof files === "object") {
            return files[path] || null;
          }
          return null;
        };

        // Check brain-output.md (primary)
        const mdContent = getContent("src/brain-output.md", "brain-output.md");
        if (mdContent) {
          const statusMatch = mdContent.match(/status:\s*done/i);
          if (statusMatch) {
            const parts = mdContent.split("---");
            if (parts.length >= 3) {
              const body = parts.slice(2).join("---").trim();
              if (body.length > 5) return { response: body, status: "completed" };
            }
          }
        }

        // Check brain-output.json (legacy fallback)
        const jsonContent = getContent("src/brain-output.json", "brain-output.json");
        if (jsonContent) {
          let clean = jsonContent.trim();
          if (clean.startsWith("```")) clean = clean.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
          try {
            const parsed = JSON.parse(clean);
            if (parsed.response && parsed.response.length > 0 && parsed.status === "done") {
              return { response: parsed.response, status: "completed" };
            }
          } catch { /* not ready */ }
        }

        // Check .lovable/tasks/brain-response.md (fallback)
        const taskMd = getContent(".lovable/tasks/brain-response.md", "brain-response.md");
        if (taskMd) {
          const statusMatch = taskMd.match(/status:\s*done/i);
          if (statusMatch) {
            const parts = taskMd.split("---");
            if (parts.length >= 3) {
              const body = parts.slice(2).join("---").trim();
              if (body.length > 5) return { response: body, status: "completed" };
            }
          }
        }
      }
    } catch { /* continue */ }

    await new Promise(r => setTimeout(r, intervalMs));
  }

  return { response: null, status: "timeout" };
}
