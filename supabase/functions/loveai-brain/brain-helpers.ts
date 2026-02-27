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
    // Phase 1: PRD-format project setup with expert persona
    `Criar Projeto (Brain Specialist — Star AI Assistente Geral Sênior):

Este projeto é um sistema headless de IA especializada. Todas as perguntas serão respondidas de forma coerente e profissional como um especialista PhD em Ciência da Computação (MIT), MBA (Harvard), com 50 anos de experiência.

## PRD — Product Requirements Document

### Objetivo
Sistema de resposta especializada com persona PhD/Sênior. O corpo da resposta deve ser anexado sempre em .md, JSON e HTML5.

### Estrutura Inicial

1. Create .env with backend connection:
\`\`\`
SUPABASE_URL=${supabaseUrl}
SUPABASE_ANON_KEY=${anonKey}
BRAIN_USER_ID=${userId}
BRAIN_PROJECT_ID=${projectId}
CALLBACK_URL=${callbackUrl}
\`\`\`

2. Create src/brain-output.md:
\`\`\`markdown
---
status: idle
timestamp: 0
---
\`\`\`

3. Create src/config.json:
\`\`\`json
{"version":"4.0","output_file":"src/brain-output.md","callback_url":"${callbackUrl}","relay_url":"${relayUrl}","user_id":"${userId}"}
\`\`\`

NÃO crie componentes React, páginas ou rotas visuais.`,

    // Phase 2: Instructions with callback protocol
    `Create src/INSTRUCTIONS.md with these project rules:

# Star AI Brain — System Guidelines (v4.0)

This is a headless task processing system. No UI rendering.

## Identity
PhD em Ciência da Computação (MIT), MBA (Harvard), 50 anos de experiência.
Responda como especialista sênior em todas as áreas.

## Response Protocol
1. Write ALL answers in \`src/brain-output.md\`
2. Use frontmatter: \`status: done\` when complete
3. Never create React components, pages, or visual routes
4. Respond in Brazilian Portuguese
5. For code tasks, embed code inside the markdown response
6. Support .md, .json and .html output formats

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

    // Phase 4: Audit — verify structure and create capability manifest
    `Verifique que todos os arquivos foram criados corretamente e crie o manifesto de capacidades:

1. Verifique: .env, src/brain-output.md, src/config.json, src/INSTRUCTIONS.md
2. Crie src/capabilities.json:
\`\`\`json
{
  "brain": "Star AI — Assistente Geral Sênior",
  "capabilities": ["análise técnica", "geração de código", "revisão de arquitetura", "documentação"],
  "response_formats": ["markdown", "json", "html"],
  "output_file": "src/brain-output.md",
  "callback_url": "${callbackUrl}",
  "version": "4.0",
  "status": "operational"
}
\`\`\`

3. Crie src/api-helpers.ts with helper functions:
\`\`\`typescript
const CONFIG = {
  supabaseUrl: "${supabaseUrl}",
  anonKey: "${anonKey}",
  userId: "${userId}",
  callbackUrl: "${callbackUrl}",
  relayUrl: "${relayUrl}",
};

export function formatOutput(text: string): string {
  return ["---", "status: done", "timestamp: " + Date.now(), "---", "", text].join("\\n");
}

export async function notifyCompletion(taskId: string, response: string) {
  try {
    await fetch(CONFIG.callbackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + CONFIG.anonKey },
      body: JSON.stringify({ user_id: CONFIG.userId, task_id: taskId, response, status: "done" }),
    });
  } catch (e) { console.error("Callback failed:", e); }
}

export { CONFIG };
\`\`\``,

    // Phase 5: Final ready signal + self-test
    `Realize um auto-teste e confirme que o sistema está operacional. Atualize src/brain-output.md:

\`\`\`markdown
---
status: done
timestamp: ${Date.now()}
readiness: complete
---

# Star AI Brain v4.0 — Sistema Operacional ✅

Backend conectado a ${supabaseUrl}. Webhook e callback prontos.

## Status
- Estrutura de arquivos: ✅
- Protocolo de resposta: ✅
- Webhook configurado: ✅
- Helpers de API: ✅
- Auto-teste: ✅

Aguardando instruções do usuário.
\`\`\`

Make sure all files are saved: .env, src/config.json, src/INSTRUCTIONS.md, src/api-helpers.ts, src/capabilities.json, and supabase/functions/brain-webhook/index.ts.`,
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
  const supabaseUrl = ctx.supabaseUrl;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  for (let i = startPhase; i < prompts.length; i++) {
    const phase = i + 1;
    console.log(`[Brain] Injecting skill phase ${phase}/5 for ${obfuscate(userId)}`);

    await sc.from("user_brain_projects")
      .update({ skill_phase: phase, status: "injecting" })
      .eq("user_id", userId);

    try {
      // Route skill injection through venus-chat (task mode)
      const result = await sendViaBrain(projectId, token, prompts[i], supabaseUrl, serviceKey);

      if (!result.ok) {
        console.error(`[Brain] Skill phase ${phase} failed: ${result.status} ${result.error || ""}`);
        if (result.status === 401 || result.status === 403) return false;
        continue;
      }

      console.log(`[Brain] ✅ Skill phase ${phase} sent via venus-chat`);

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

    // ── STEP 4: Wait for project readiness then inject skills ──
    const brainCtx: BrainContext = {
      supabaseUrl: Deno.env.get("SUPABASE_URL") || "",
      anonKey: Deno.env.get("SUPABASE_ANON_KEY") || "",
      userId,
      projectId,
    };

    // Run in background — don't block the response
    (async () => {
      try {
        // Wait for project to be fully ready before injecting
        await new Promise(r => setTimeout(r, 8000));
        
        // Verify project is accessible
        for (let attempt = 0; attempt < 3; attempt++) {
          const ready = await verifyProject(projectId, token);
          if (ready) break;
          console.warn(`[Brain] Project not ready for injection (attempt ${attempt + 1}/3)`);
          await new Promise(r => setTimeout(r, 5000));
        }
        
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
 * Send a message to a Brain project via venus-chat edge function (centralized proxy).
 * This avoids duplicating payload logic — venus-chat handles intent, view, ANTI_Q prefix, etc.
 */
export async function sendViaBrain(
  projectId: string,
  token: string,
  message: string,
  supabaseUrl: string,
  serviceKey: string,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const url = `${supabaseUrl}/functions/v1/venus-chat`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      task: message,
      project_id: projectId,
      mode: "task",
      lovable_token: token,
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && data?.ok !== false, status: res.status, error: data?.error };
}

/**
 * Build payload in TASK mode — used ONLY for skill injection during ghost create.
 * For normal user messages, use sendViaBrain() which routes through venus-chat.
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
 * @deprecated Use sendViaBrain() for user messages. This is kept for skill injection only.
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

  // Simple, direct instruction — respond naturally AND save to .md
  const outputRule = `

Responda em Português Brasileiro de forma direta e completa.

Após responder, salve sua resposta completa no arquivo src/brain-output.md neste formato:
---
status: done
timestamp: ${ts}
type: ${brainType}
---

(sua resposta aqui)`;

  // No wrappers — just the user message + output rule
  return message + outputRule;
}

/**
 * Captures Brain response by polling source-code for brain-output.md
 */
export async function captureResponse(
  projectId: string,
  token: string,
  maxWaitMs = 90000,
  intervalMs = 3000,
  initialDelayMs = 5000
): Promise<{ response: string | null; status: "completed" | "processing" | "timeout" }> {
  await new Promise(r => setTimeout(r, initialDelayMs));
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    // Strategy 1: Poll source-code for brain-output.md (PRIMARY — most reliable)
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
        if (mdContent && /status:\s*done/i.test(mdContent)) {
          const parts = mdContent.split("---");
          if (parts.length >= 3) {
            let body = parts.slice(2).join("---").trim();
            // Strip wrapping code fences
            body = body.replace(/^```(?:markdown|md)?\s*/i, "").replace(/```\s*$/, "").trim();
            if (body.length > 5) return { response: body, status: "completed" };
          }
        }

        // Check brain-output.json (secondary)
        const jsonContent = getContent("src/brain-output.json", "brain-output.json");
        if (jsonContent) {
          let clean = jsonContent.trim();
          if (clean.startsWith("```")) clean = clean.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
          try {
            const parsed = JSON.parse(clean);
            if (parsed.status === "done" && typeof parsed.response === "string" && parsed.response.length > 0) {
              return { response: parsed.response, status: "completed" };
            }
          } catch { /* not ready */ }
        }

        // Check brain-output.html (tertiary)
        const htmlContent = getContent("src/brain-output.html", "brain-output.html");
        if (htmlContent) {
          const bodyMatch = htmlContent.match(/<(?:body|main)[^>]*>([\s\S]*?)<\/(?:body|main)>/i);
          if (bodyMatch) {
            const text = bodyMatch[1]
              .replace(/<script[\s\S]*?<\/script>/gi, "")
              .replace(/<style[\s\S]*?<\/style>/gi, "")
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim();
            if (text.length > 30) return { response: text, status: "completed" };
          }
        }

        // Check .lovable/tasks/*.md with status: done
        if (Array.isArray(files)) {
          const taskFiles = files
            .filter((f: any) => f.path?.startsWith(".lovable/tasks/") && f.path?.endsWith(".md"))
            .sort((a: any, b: any) => (b.path || "").localeCompare(a.path || ""));
          for (const tf of taskFiles) {
            const content = tf.content || tf.source || "";
            if (/status:\s*done/i.test(content)) {
              const parts = content.split("---");
              if (parts.length >= 3) {
                const body = parts.slice(2).join("---").trim();
                if (body.length > 10) return { response: body, status: "completed" };
              }
            }
          }
        }
      }
    } catch { /* continue */ }

    // Strategy 2: Check latest-message API (fallback)
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

    await new Promise(r => setTimeout(r, intervalMs));
  }

  return { response: null, status: "timeout" };
}
