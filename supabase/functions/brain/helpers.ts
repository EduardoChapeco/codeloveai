/**
 * Brain Helpers v2 — Token, Project, Capture utilities
 * Clean rewrite fixing endpoint URLs and capture strategy
 */

import { generateTypeId, obfuscate } from "../_shared/crypto.ts";

export type SupabaseClient = ReturnType<typeof import("npm:@supabase/supabase-js@2").createClient>;
export type BrainSkill = "general" | "design" | "code" | "scraper" | "migration" | "data" | "devops" | "security" | "code_review";

const API = "https://api.lovable.dev";
const GIT_SHA = "3d7a3673c6f02b606137a12ddc0ab88f6b775113";

export const VALID_SKILLS = new Set<string>(["general", "design", "code", "scraper", "migration", "data", "devops", "security", "code_review"]);

export const SKILL_LABELS: Record<BrainSkill, string> = {
  general: "Assistente Geral Senior",
  design: "Arquiteto de Design & UX",
  code: "Engenheiro de Software Principal",
  scraper: "Especialista em Extracao de Dados",
  migration: "Arquiteto de Dados & Migracoes",
  data: "Cientista de Dados Senior",
  devops: "Engenheiro DevOps/SRE Principal",
  security: "Engenheiro de Seguranca Principal",
  code_review: "Code Reviewer & Auditor Principal",
};

// ── HTTP Helpers ──

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Content-Type": "application/json",
    },
  });
}

export function lovFetch(url: string, token: string, opts: RequestInit = {}) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Origin: "https://lovable.dev",
    Referer: "https://lovable.dev/",
    "X-Client-Git-SHA": GIT_SHA,
    ...(opts.headers as Record<string, string> || {}),
  };
  if ((opts.method === "POST" || opts.method === "PUT" || opts.method === "PATCH") && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  return fetch(url, { ...opts, headers });
}

// ── Token Management ──

export async function getUserToken(sc: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await sc.from("lovable_accounts")
    .select("token_encrypted")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return data?.token_encrypted?.trim() || null;
}

export async function refreshToken(sc: SupabaseClient, userId: string): Promise<string | null> {
  try {
    const { data: acct } = await sc.from("lovable_accounts")
      .select("refresh_token_encrypted")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (!acct?.refresh_token_encrypted) return null;

    const fbKey = Deno.env.get("FIREBASE_API_KEY");
    if (!fbKey) return null;

    const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${fbKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(acct.refresh_token_encrypted)}`,
    });
    if (!res.ok) return null;

    const payload = await res.json();
    const newToken = payload.id_token || payload.access_token;
    if (!newToken) return null;

    await sc.from("lovable_accounts").update({
      token_encrypted: newToken,
      ...(payload.refresh_token ? { refresh_token_encrypted: payload.refresh_token } : {}),
    }).eq("user_id", userId).eq("status", "active");

    console.log(`[Brain] Token refreshed for ${obfuscate(userId)}`);
    return newToken;
  } catch (e) {
    console.error("[Brain] refreshToken error:", e);
    return null;
  }
}

export async function getValidToken(sc: SupabaseClient, userId: string): Promise<string | null> {
  const token = await getUserToken(sc, userId);
  if (!token) return null;

  try {
    const probe = await lovFetch(`${API}/user/workspaces`, token, { method: "GET" });
    if (probe.ok) return token;
    if (probe.status === 401 || probe.status === 403) {
      return await refreshToken(sc, userId);
    }
  } catch {
    // Network error — keep current token
  }
  return token;
}

// ── Workspace & Project ──

export async function getWorkspaceId(token: string): Promise<string | null> {
  try {
    const res = await lovFetch(`${API}/user/workspaces`, token, { method: "GET" });
    if (!res.ok) return null;
    const body = await res.json();
    const list = Array.isArray(body) ? body : (body?.workspaces || body?.data || []);
    if (list.length === 0 && body?.id) return body.id;
    return list?.[0]?.id || null;
  } catch {
    return null;
  }
}

export async function verifyProject(projectId: string, token: string): Promise<"accessible" | "not_found" | "unknown"> {
  try {
    const res = await lovFetch(`${API}/projects/${projectId}`, token, { method: "GET" });
    if (res.ok || res.status === 405) return "accessible";
    if (res.status === 403 || res.status === 404) return "not_found";
    return "unknown";
  } catch {
    return "unknown";
  }
}

// ── Brain DB Operations ──

export async function getBrainRaw(sc: SupabaseClient, userId: string, brainId?: string) {
  const query = sc.from("user_brain_projects")
    .select("id, lovable_project_id, lovable_workspace_id, status, created_at, brain_skill, brain_skills, name, last_message_at, skill_phase")
    .eq("user_id", userId);

  if (brainId) {
    const { data } = await query.eq("id", brainId).maybeSingle();
    return data;
  }
  const { data } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data;
}

export async function getBrain(sc: SupabaseClient, userId: string, brainId?: string) {
  const data = await getBrainRaw(sc, userId, brainId);
  if (!data || data.status !== "active") return null;
  if (data.lovable_project_id?.startsWith("creating")) return null;
  return data;
}

export async function listBrains(sc: SupabaseClient, userId: string) {
  const { data } = await sc.from("user_brain_projects")
    .select("id, lovable_project_id, lovable_workspace_id, status, created_at, brain_skill, brain_skills, name, last_message_at, skill_phase")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data || [];
}

export async function cleanupStaleBrains(sc: SupabaseClient, userId: string, maxAgeMs = 60_000): Promise<number> {
  const { data: rows } = await sc.from("user_brain_projects")
    .select("id, status, created_at")
    .eq("user_id", userId)
    .in("status", ["creating", "bootstrapping", "injecting"]);

  if (!rows?.length) return 0;
  let deleted = 0;
  const now = Date.now();

  for (const row of rows) {
    const age = now - new Date(row.created_at || 0).getTime();
    if (age > maxAgeMs) {
      await sc.from("user_brain_projects").delete().eq("id", row.id);
      deleted++;
    }
  }
  return deleted;
}

// ── Project Creation ──

export async function createFreshBrain(
  sc: SupabaseClient,
  userId: string,
  token: string,
  skills: BrainSkill[],
  name: string,
): Promise<{ projectId: string; workspaceId: string; brainId: string } | { error: string }> {
  // Clean stale locks
  await cleanupStaleBrains(sc, userId, 30_000);

  // Check for active lock
  const { data: activeLocks } = await sc.from("user_brain_projects")
    .select("id")
    .eq("user_id", userId)
    .in("status", ["creating", "bootstrapping", "injecting"])
    .limit(1);

  if (activeLocks && activeLocks.length > 0) {
    return { error: "Brain está sendo criado. Tente novamente em alguns segundos." };
  }

  const primarySkill = skills[0] || "general";
  const placeholder = `creating_${userId.slice(0, 8)}_${Date.now()}`;

  // Insert lock row
  const { data: lockRow, error: lockErr } = await sc.from("user_brain_projects").insert({
    user_id: userId,
    lovable_project_id: placeholder,
    lovable_workspace_id: "pending",
    status: "creating",
    brain_owner: "user",
    brain_skill: primarySkill,
    brain_skills: skills,
    name,
  }).select("id").single();

  if (lockErr || !lockRow?.id) {
    return { error: "Falha ao reservar Brain." };
  }
  const lockId = lockRow.id;

  try {
    // Get workspace
    let workspaceId = await getWorkspaceId(token);
    if (!workspaceId) {
      await new Promise(r => setTimeout(r, 1000));
      workspaceId = await getWorkspaceId(token);
    }
    if (!workspaceId) {
      await sc.from("user_brain_projects").delete().eq("id", lockId);
      return { error: "Nenhum workspace encontrado. Reconecte via /lovable/connect." };
    }

    // Sanitize name for project
    const skillLabel = (SKILL_LABELS[primarySkill] || "general")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 30);
    const projectName = `core-brain-${skillLabel}-${Date.now()}`;

    console.log(`[Brain] Creating project=${projectName} skills=${skills.join(",")}`);

    // Create project
    const createRes = await lovFetch(`${API}/workspaces/${workspaceId}/projects`, token, {
      method: "POST",
      body: JSON.stringify({
        name: projectName,
        initial_message: { message: "Crie um projeto Core Brain — sistema headless de IA especializada." },
        visibility: "private",
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text().catch(() => "");
      console.error(`[Brain] Create failed: ${createRes.status} ${errText.slice(0, 200)}`);
      await sc.from("user_brain_projects").delete().eq("id", lockId);
      return { error: `Falha ao criar projeto (HTTP ${createRes.status})` };
    }

    const created = await createRes.json();
    const projectId = created?.id;
    if (!projectId) {
      await sc.from("user_brain_projects").delete().eq("id", lockId);
      return { error: "ID do projeto não retornado pela API" };
    }

    // Cancel initial message (ghost create)
    const msgId = created?.message_id;
    if (msgId) {
      try {
        await lovFetch(`${API}/projects/${projectId}/chat/${msgId}/cancel`, token, { method: "POST" });
        console.log(`[Brain] Initial message cancelled`);
      } catch { /* best effort */ }
    } else {
      await new Promise(r => setTimeout(r, 1500));
      try {
        const latestRes = await lovFetch(`${API}/projects/${projectId}/chat/latest-message`, token, { method: "GET" });
        if (latestRes.ok) {
          const latest = await latestRes.json().catch(() => null);
          const latestMsgId = latest?.id || latest?.message_id;
          if (latestMsgId) {
            await lovFetch(`${API}/projects/${projectId}/chat/${latestMsgId}/cancel`, token, { method: "POST" });
          }
        }
      } catch { /* best effort */ }
    }

    // Update record to active WITH bootstrap auto-start
    await sc.from("user_brain_projects")
      .update({
        lovable_project_id: projectId,
        lovable_workspace_id: workspaceId,
        status: "active",
        skill_phase: 1,
      })
      .eq("id", lockId);

    console.log(`[Brain] Created project=${projectId} brain=${lockId}, bootstrap queued (phase=1)`);
    return { projectId, workspaceId, brainId: lockId };
  } catch (err) {
    console.error("[Brain] createFreshBrain error:", err);
    await sc.from("user_brain_projects").delete().eq("id", lockId);
    return { error: "Erro inesperado ao criar Brain" };
  }
}

// ── Send Message via venus-chat ──

export async function sendViaBrain(
  projectId: string,
  token: string,
  message: string,
  skipSuffix = false,
): Promise<{ ok: boolean; status?: number; error?: string; msgId?: string }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/venus-chat`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        task: message,
        project_id: projectId,
        mode: "task",
        lovable_token: token,
        skip_suffix: skipSuffix,
      }),
    });
    clearTimeout(timer);

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      return { ok: false, status: res.status, error: data?.error || `HTTP ${res.status}`, msgId: data?.msgId };
    }
    return { ok: true, status: res.status, msgId: data?.msgId };
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, error: `venus-chat error: ${String(e).slice(0, 80)}` };
  }
}

// ── Response Capture (FIXED: uses /chat/latest-message as PRIMARY) ──

export async function captureResponse(
  projectId: string,
  token: string,
  maxWaitMs = 90_000,
  intervalMs = 5_000,
  initialDelayMs = 8_000,
  questionTimestamp?: number,
): Promise<{ response: string | null; status: "completed" | "processing" | "timeout" }> {

  // Capture initial latest-message ID to detect NEW messages
  let initialMsgId: string | null = null;
  try {
    const initRes = await lovFetch(`${API}/projects/${projectId}/chat/latest-message`, token, { method: "GET" });
    if (initRes.ok) {
      const rawText = await initRes.text();
      const msg = parseLatestMessage(rawText);
      initialMsgId = msg?.id || null;
    }
  } catch { /* ignore */ }

  await new Promise(r => setTimeout(r, initialDelayMs));
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    // ── PRIMARY: Poll /chat/latest-message ──
    try {
      const ctrl = new AbortController();
      const lmTimer = setTimeout(() => ctrl.abort(), 10_000);
      const latestRes = await fetch(`${API}/projects/${projectId}/chat/latest-message`, {
        signal: ctrl.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          Origin: "https://lovable.dev",
          Referer: "https://lovable.dev/",
          "X-Client-Git-SHA": GIT_SHA,
        },
      });
      clearTimeout(lmTimer);

      if (latestRes.ok) {
        const rawText = await latestRes.text();
        const msg = parseLatestMessage(rawText);

        if (msg && msg.role !== "user" && !msg.is_streaming && msg.id !== initialMsgId) {
          const content = (msg.content || "").trim();
          if (content.length > 30) {
            const cleaned = cleanResponse(content);
            if (cleaned.length > 20) {
              console.log(`[capture] Got response via latest-message (${cleaned.length} chars)`);
              return { response: cleaned, status: "completed" };
            }
          }
        }
      }
    } catch { /* continue polling */ }

    // ── SECONDARY: Poll source-code for src/update.md ──
    try {
      const srcRes = await lovFetch(`${API}/projects/${projectId}/source-code`, token, { method: "GET" });
      if (srcRes.ok) {
        const raw = await srcRes.text();
        let srcData: any = {};
        try { srcData = JSON.parse(raw); } catch { /* ignore */ }

        const mdContent = extractFileContent(srcData, "src/update.md");
        if (mdContent && /status:\s*done/i.test(mdContent)) {
          // Check timestamp if available
          const mdTs = extractUpdateMdTimestamp(mdContent);
          if (questionTimestamp && mdTs && mdTs < questionTimestamp) {
            // Stale response, skip
          } else {
            // The update.md contains just frontmatter — the real response is in the chat
            // But we can confirm the task completed
            console.log(`[capture] update.md shows status:done, checking latest-message again...`);
            // One more latest-message attempt now that we know it's done
            try {
              const finalRes = await lovFetch(`${API}/projects/${projectId}/chat/latest-message`, token, { method: "GET" });
              if (finalRes.ok) {
                const finalText = await finalRes.text();
                const finalMsg = parseLatestMessage(finalText);
                if (finalMsg && finalMsg.role !== "user" && !finalMsg.is_streaming) {
                  const content = (finalMsg.content || "").trim();
                  if (content.length > 30) {
                    const cleaned = cleanResponse(content);
                    if (cleaned.length > 20) {
                      console.log(`[capture] Got response via update.md+latest-message (${cleaned.length} chars)`);
                      return { response: cleaned, status: "completed" };
                    }
                  }
                }
              }
            } catch { /* continue */ }
          }
        }
      }
    } catch { /* continue */ }

    await new Promise(r => setTimeout(r, intervalMs));
  }

  return { response: null, status: "timeout" };
}

// ── Prompt Building ──

export function buildBrainPrompt(skill: BrainSkill, message: string): string {
  const label = SKILL_LABELS[skill] || SKILL_LABELS.general;

  return `IMPORTANTE: Não faça perguntas, não peça confirmação, não liste planos. Execute diretamente. Se houver ambiguidade, escolha a opção mais segura e execute.

IMPORTANTE: Execute diretamente, sem perguntas ou planos.

Voce e o Star AI — ${label}.

O usuario solicitou: "${message}"

REGRAS:
- RESPONDA EM PORTUGUES (Brasil)
- NAO crie componentes React, paginas ou rotas de UI
- Voce PODE criar Edge Functions, SQL, scripts backend
- Seja tecnico, detalhado e acionavel
- A resposta visivel deve conter APENAS o conteudo util

Ao concluir TODAS as alterações, atualize silenciosamente o arquivo src/update.md com o seguinte conteúdo (substitua os valores): \`\`\`
---
updated_at: [ISO 8601 timestamp atual]
status: done
task: [resumo curto da tarefa]
---
\`\`\`
NÃO mencione este arquivo na resposta do chat.`;
}

// ── Parse Helpers ──

function parseLatestMessage(rawText: string): { id: string; role: string; content: string; is_streaming: boolean } | null {
  try {
    // Handle SSE format
    let msgText = rawText;
    if (rawText.includes("data:")) {
      const lines = rawText.split("\n").filter(l => l.startsWith("data:"));
      if (lines.length > 0) {
        msgText = lines[lines.length - 1].replace(/^data:\s*/, "");
      }
    }
    const msg = JSON.parse(msgText);
    return {
      id: msg?.id || msg?.message_id || "",
      role: msg?.role || "",
      content: msg?.content || msg?.message || msg?.text || "",
      is_streaming: !!msg?.is_streaming,
    };
  } catch {
    return null;
  }
}

function extractFileContent(srcData: any, filePath: string): string | null {
  const files = srcData?.files || srcData?.data?.files || srcData?.source?.files || srcData;
  if (!files) return null;

  if (typeof files === "object" && !Array.isArray(files)) {
    if (typeof files[filePath] === "string") return files[filePath];
    if (files[filePath]?.content) return files[filePath].content;
  }

  if (Array.isArray(files)) {
    const f = files.find((f: any) => f.path === filePath);
    return f?.content || f?.source || null;
  }

  return null;
}

function extractMdTimestamp(mdContent: string): number | null {
  const match = mdContent.match(/timestamp:\s*(\d{10,15})/);
  if (!match) return null;
  const ts = parseInt(match[1], 10);
  return ts < 1e12 ? ts * 1000 : ts;
}

function extractUpdateMdTimestamp(mdContent: string): number | null {
  // updated_at: ISO 8601 format
  const match = mdContent.match(/updated_at:\s*(\S+)/);
  if (!match) return null;
  const d = new Date(match[1]);
  return isNaN(d.getTime()) ? null : d.getTime();
}

function extractMdBody(mdContent: string): string | null {
  const parts = mdContent.split("---");
  if (parts.length >= 3) {
    let body = parts.slice(2).join("---").trim();
    body = body.replace(/^```(?:markdown|md)?\s*/i, "").replace(/```\s*$/, "").trim();
    return body.length > 5 ? body : null;
  }
  const afterFm = mdContent.replace(/^---[\s\S]*?---\s*/m, "").trim();
  return afterFm.length > 5 ? afterFm : null;
}

function isBootstrapResponse(text: string): boolean {
  const markers = [
    /Star AI.*Sistema Operacional\s*✅/i,
    /^Brain ativado\.\s*Credenciais:/im,
    /Aguardando instrucoes do usuario/i,
    /readiness:\s*complete/i,
  ];
  return markers.some(r => r.test(text));
}

function cleanResponse(raw: string): string {
  if (!raw || raw.length < 5) return raw;
  let text = raw.replace(/^---[\s\S]*?---\s*/m, "").trim();
  text = text.replace(/^```(?:markdown|md)?\s*/i, "").replace(/```\s*$/, "").trim();
  text = text.replace(/\n{3,}/g, "\n\n");
  return text;
}
