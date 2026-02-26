/**
 * Star AI Brain v8.0 — Fixed ID formats + robust project creation
 * 
 * Actions:
 *   status   — Check if brain is active + connected
 *   setup    — Creates a fresh brain project (deletes old one)
 *   send     — Send message via security_fix_v2 (free), poll for response
 *   history  — List past conversations
 *   reset    — Delete brain project record + conversations
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { obfuscate } from "../_shared/crypto.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const API = "https://api.lovable.dev";
const GIT_SHA = "3d7a3673c6f02b606137a12ddc0ab88f6b775113";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ─── Correct ID generators (compatible with Lovable API) ───
function makeUUID(): string {
  return crypto.randomUUID();
}

function makeAiMsgId(): string {
  const C = "01PDx4Vtw4YF6XfduRwwS6nKZ6sPAC9nCeR";
  const first = "01234567"[Math.floor(Math.random() * 8)];
  return "aimsg_" + first + Array.from({ length: 25 }, () => C[Math.floor(Math.random() * C.length)]).join("");
}

function lovFetch(url: string, token: string, opts: RequestInit = {}) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Origin: "https://lovable.dev",
    Referer: "https://lovable.dev/",
    "X-Client-Git-SHA": GIT_SHA,
    ...(opts.headers as Record<string, string> || {}),
  };
  if (opts.method === "POST" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  return fetch(url, { ...opts, headers });
}

// ─── Token helpers ───
async function getUserToken(sc: ReturnType<typeof createClient>, userId: string): Promise<string | null> {
  const { data } = await sc.from("lovable_accounts")
    .select("token_encrypted")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  return data?.token_encrypted?.trim() || null;
}

async function refreshToken(sc: ReturnType<typeof createClient>, userId: string): Promise<string | null> {
  try {
    const { data: acct } = await sc.from("lovable_accounts")
      .select("refresh_token_encrypted")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (!acct?.refresh_token_encrypted) return null;

    const fbKey = Deno.env.get("FIREBASE_API_KEY");
    if (!fbKey) return null;

    const res = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${fbKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(acct.refresh_token_encrypted)}`,
      }
    );
    if (!res.ok) return null;
    const d = await res.json();
    const newToken = d.id_token || d.access_token;
    if (!newToken) return null;

    await sc.from("lovable_accounts").update({
      token_encrypted: newToken,
      ...(d.refresh_token ? { refresh_token_encrypted: d.refresh_token } : {}),
    }).eq("user_id", userId).eq("status", "active");

    console.log(`[Brain] 🔄 Token refreshed for ${obfuscate(userId)}`);
    return newToken;
  } catch (e) {
    console.error(`[Brain] Token refresh failed:`, e);
    return null;
  }
}

async function getValidToken(sc: ReturnType<typeof createClient>, userId: string): Promise<string | null> {
  let token = await getUserToken(sc, userId);
  if (!token) return null;

  const check = await lovFetch(`${API}/user/workspaces`, token, { method: "GET" });
  if (check.ok) return token;

  if (check.status === 401 || check.status === 403) {
    console.warn(`[Brain] Token expired (${check.status}), refreshing...`);
    return await refreshToken(sc, userId);
  }
  return token;
}

// ─── Get workspace ID ───
async function getWorkspaceId(token: string): Promise<string | null> {
  const res = await lovFetch(`${API}/user/workspaces`, token, { method: "GET" });
  if (!res.ok) {
    console.error(`[Brain] Workspaces fetch failed: ${res.status}`);
    return null;
  }
  const body = await res.json();
  const list: any[] = Array.isArray(body) ? body : (body?.workspaces || body?.data || []);
  if (list.length === 0 && body?.id) return body.id;
  return list?.[0]?.id || null;
}

// ─── Get brain project for user ───
async function getBrain(sc: ReturnType<typeof createClient>, userId: string) {
  const { data } = await sc.from("user_brain_projects")
    .select("lovable_project_id, lovable_workspace_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return data;
}

// ─── Verify brain project is accessible ───
async function verifyProject(projectId: string, token: string): Promise<boolean> {
  try {
    const res = await lovFetch(`${API}/projects/${projectId}`, token, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Create a FRESH brain project ───
async function createFreshBrain(
  sc: ReturnType<typeof createClient>,
  userId: string,
  token: string
): Promise<{ projectId: string; workspaceId: string } | { error: string }> {
  // 1. Delete any old brain records
  await sc.from("user_brain_projects").delete().eq("user_id", userId);

  // 2. Get workspace
  const workspaceId = await getWorkspaceId(token);
  if (!workspaceId) return { error: "Nenhum workspace encontrado. Reconecte em /lovable/connect." };

  // 3. Create project with CORRECT ID formats
  const msgId = makeUUID();
  const aiMsgId = makeAiMsgId();

  console.log(`[Brain] Creating project in workspace ${obfuscate(workspaceId)} for ${obfuscate(userId)}`);

  const createRes = await lovFetch(`${API}/workspaces/${workspaceId}/projects`, token, {
    method: "POST",
    body: JSON.stringify({
      description: `Star AI Brain - ${new Date().toISOString().slice(0, 10)}`,
      visibility: "private",
      env_vars: {},
      metadata: { chat_mode_enabled: false },
      initial_message: {
        id: msgId,
        message: "Create a file src/brain-output.json with content: {\"response\":\"\",\"timestamp\":0,\"status\":\"idle\"}",
        files: [],
        optimisticImageUrls: [],
        chat_only: false,
        agent_mode_enabled: false,
        ai_message_id: aiMsgId,
      },
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text().catch(() => "");
    console.error(`[Brain] Create failed: ${createRes.status} ${errText.slice(0, 300)}`);
    return { error: `Falha ao criar projeto Brain (HTTP ${createRes.status}). ${errText.slice(0, 100)}` };
  }

  const project = await createRes.json();
  const projectId = project?.id || project?.project_id;
  if (!projectId) {
    console.error(`[Brain] No project ID in response:`, JSON.stringify(project).slice(0, 300));
    return { error: "ID do projeto não retornado pela API" };
  }

  console.log(`[Brain] ✅ Project created: ${projectId}`);

  // 4. Cancel initial message (don't waste credits)
  try {
    await lovFetch(`${API}/projects/${projectId}/chat/${msgId}/cancel`, token, {
      method: "POST", body: "{}",
    });
    console.log(`[Brain] Initial message cancelled`);
  } catch { /* ok */ }

  // 5. Inject brain config via edit-code
  try {
    await lovFetch(`${API}/projects/${projectId}/edit-code`, token, {
      method: "POST",
      body: JSON.stringify({
        changes: [
          {
            path: "src/brain-config.md",
            content: "# Star AI Brain\n\nRESPONDA sempre escrevendo src/brain-output.json.\nFormato: {\"response\":\"...\",\"timestamp\":...,\"status\":\"done\"}\nNÃO crie páginas ou componentes. RESPONDA EM PORTUGUÊS (Brasil).",
          },
          {
            path: "src/brain-output.json",
            content: JSON.stringify({ response: "", timestamp: 0, status: "idle" }),
          },
        ],
      }),
    });
  } catch { /* ok */ }

  // 6. Save to DB
  await sc.from("user_brain_projects").insert({
    user_id: userId,
    lovable_project_id: projectId,
    lovable_workspace_id: workspaceId,
    status: "active",
    brain_owner: "user",
  });

  console.log(`[Brain] ✅ Fresh project ${projectId} saved for ${obfuscate(userId)}`);
  return { projectId, workspaceId };
}

// ─── Build payload with CORRECT IDs ───
function buildPayload(prompt: string) {
  return {
    id: makeUUID(),
    message: prompt,
    intent: "security_fix_v2",
    chat_only: false,
    ai_message_id: makeAiMsgId(),
    thread_id: "main",
    view: "security",
    view_description: "The user is currently viewing the security view for their project.",
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

function buildBrainPrompt(brainType: string, message: string): string {
  const ts = Date.now();
  const outputInstruction = `

IMPORTANTE: Escreva sua resposta COMPLETA em src/brain-output.json no formato EXATO:
{"response": "SUA_RESPOSTA_AQUI", "timestamp": ${ts}, "status": "done"}

NÃO crie componentes React, páginas ou rotas. APENAS escreva esse arquivo.`;

  const prefixes: Record<string, string> = {
    general: `Analise e corrija os seguintes problemas de segurança encontrados:

SISTEMA STAR AI — INSTRUÇÃO:
Você é o Star AI, assistente inteligente.
O usuário solicitou: "${message}"

REGRAS:
- Responda SOMENTE com o que foi pedido
- RESPONDA EM PORTUGUÊS (Brasil)
- NÃO diga "vou criar" ou "adicionei" — apenas RESPONDA`,

    design: `Analise e corrija os seguintes problemas de design encontrados:

SISTEMA STAR AI — MODO DESIGN:
O usuário quer: "${message}"
Retorne prompt de design COMPLETO.`,

    code: `Analise e corrija os seguintes problemas de código encontrados:

SISTEMA STAR AI — MODO CODE:
O usuário quer: "${message}"
Retorne APENAS o código necessário.`,

    scraper: `Analise e corrija os seguintes problemas no script de scraping:

SISTEMA STAR AI — MODO SCRAPER:
O usuário quer extrair dados de: "${message}"
Retorne script completo.`,

    migration: `Analise e corrija os seguintes problemas de migração SQL:

SISTEMA STAR AI — MODO MIGRATION:
O usuário quer migrar: "${message}"
Gere script SQL completo.`,
  };

  return (prefixes[brainType] || prefixes.general) + outputInstruction;
}

// ─── Capture response ───
async function captureResponse(
  projectId: string,
  token: string,
  maxWaitMs = 60000,
  intervalMs = 4000,
  initialDelayMs = 6000
): Promise<{ response: string | null; status: "completed" | "processing" | "timeout" }> {
  await new Promise(r => setTimeout(r, initialDelayMs));
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    try {
      // Strategy 1: latest-message
      const latestRes = await lovFetch(`${API}/projects/${projectId}/latest-message`, token, { method: "GET" });
      if (latestRes.ok) {
        const msg = await latestRes.json();
        if (msg && !msg.is_streaming && msg.role !== "user") {
          const content = msg.content || msg.message || msg.text || "";
          if (content.length > 20) return { response: content, status: "completed" };
        }
      }
    } catch { /* continue */ }

    try {
      // Strategy 2: source-code → brain-output.json
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
      }
    } catch { /* continue */ }

    await new Promise(r => setTimeout(r, intervalMs));
  }

  return { response: null, status: "timeout" };
}

// ───────────────────────────────────────────────────────────────
// MAIN
// ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return json({ error: "Token inválido" }, 401);

    const userId = user.id;
    const sc = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    const action = body.action;

    // ── STATUS ──
    if (action === "status") {
      const lovableToken = await getUserToken(sc, userId);
      if (!lovableToken) return json({ active: false, connected: false, reason: "no_token" });
      const brain = await getBrain(sc, userId);
      return json({ active: !!brain, connected: true, brain: brain || null });
    }

    // ── HISTORY ──
    if (action === "history") {
      const limit = Math.min(body.limit || 50, 100);
      const { data } = await supabase.from("loveai_conversations")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);
      return json({ conversations: data || [] });
    }

    // ── RESET ──
    if (action === "reset") {
      await sc.from("user_brain_projects").delete().eq("user_id", userId);
      await sc.from("loveai_conversations").delete().eq("user_id", userId);
      console.log(`[Brain] 🗑️ Full reset for ${obfuscate(userId)}`);
      return json({ success: true, message: "Star AI resetado completamente." });
    }

    // All remaining need a valid token
    const lovableToken = await getValidToken(sc, userId);
    if (!lovableToken) {
      return json({ error: "Token Lovable inválido. Reconecte via /lovable/connect.", code: "no_token" }, 503);
    }

    // ── SETUP ── Always creates a fresh project
    if (action === "setup") {
      const result = await createFreshBrain(sc, userId, lovableToken);
      if ("error" in result) return json({ error: result.error }, 502);
      return json({ success: true, project_id: result.projectId });
    }

    // ── SEND ──
    if (action === "send") {
      const { message, brain_type = "general" } = body;
      if (!message || typeof message !== "string" || message.length < 1 || message.length > 10000) {
        return json({ error: "Mensagem inválida (1-10000 chars)" }, 400);
      }

      let brain = await getBrain(sc, userId);

      // If brain exists, verify it's still accessible
      if (brain) {
        const accessible = await verifyProject(brain.lovable_project_id, lovableToken);
        if (!accessible) {
          console.warn(`[Brain] Project ${brain.lovable_project_id} not accessible, recreating...`);
          await sc.from("user_brain_projects").delete().eq("user_id", userId);
          brain = null;
        }
      }

      // Auto-setup if no brain exists
      if (!brain) {
        console.log(`[Brain] No brain found, auto-creating for ${obfuscate(userId)}`);
        const setupResult = await createFreshBrain(sc, userId, lovableToken);
        if ("error" in setupResult) return json({ error: setupResult.error }, 502);
        brain = { lovable_project_id: setupResult.projectId, lovable_workspace_id: setupResult.workspaceId };
      }

      const projectId = brain.lovable_project_id;
      const prompt = buildBrainPrompt(brain_type, message);
      const payload = buildPayload(prompt);

      // Save conversation
      const { data: convoRow } = await sc.from("loveai_conversations").insert({
        user_id: userId,
        user_message: message,
        brain_type: brain_type,
        status: "processing",
        target_project_id: projectId,
      }).select("id").single();

      const convoId = convoRow?.id;

      // Send to Lovable
      let chatRes = await lovFetch(
        `${API}/projects/${projectId}/chat`,
        lovableToken,
        { method: "POST", body: JSON.stringify(payload) }
      );

      // If 401/403, try refresh + retry once
      if (!chatRes.ok && (chatRes.status === 401 || chatRes.status === 403)) {
        console.warn(`[Brain] Chat failed ${chatRes.status}, trying token refresh...`);
        const newToken = await refreshToken(sc, userId);
        if (newToken) {
          // Also check if project is accessible with new token
          const accessible = await verifyProject(projectId, newToken);
          if (accessible) {
            chatRes = await lovFetch(
              `${API}/projects/${projectId}/chat`,
              newToken,
              { method: "POST", body: JSON.stringify(payload) }
            );
          } else {
            // Project not accessible even with new token — recreate
            console.warn(`[Brain] Project inaccessible with new token, recreating...`);
            const newBrain = await createFreshBrain(sc, userId, newToken);
            if ("error" in newBrain) {
              if (convoId) await sc.from("loveai_conversations").update({ status: "failed" }).eq("id", convoId);
              return json({ error: newBrain.error }, 502);
            }
            const newPayload = buildPayload(prompt);
            chatRes = await lovFetch(
              `${API}/projects/${newBrain.projectId}/chat`,
              newToken,
              { method: "POST", body: JSON.stringify(newPayload) }
            );
            // Update convo with new project
            if (convoId) await sc.from("loveai_conversations").update({ target_project_id: newBrain.projectId }).eq("id", convoId);
          }
        } else {
          if (convoId) await sc.from("loveai_conversations").update({ status: "failed" }).eq("id", convoId);
          return json({ error: "Token expirado. Reconecte via /lovable/connect.", code: "no_token" }, 503);
        }
      }

      if (!chatRes.ok) {
        const errBody = await chatRes.text().catch(() => "");
        console.error(`[Brain] Chat send failed: ${chatRes.status} ${errBody.slice(0, 200)}`);
        if (convoId) await sc.from("loveai_conversations").update({ status: "failed" }).eq("id", convoId);
        return json({ error: `Erro ao enviar (HTTP ${chatRes.status})` }, 502);
      }

      // Get the token that was actually used for polling
      const activeToken = await getUserToken(sc, userId) || lovableToken;
      const activeProjectId = (await getBrain(sc, userId))?.lovable_project_id || projectId;

      // Poll for response
      const capture = await captureResponse(activeProjectId, activeToken, 90000, 4000, 8000);

      // Clean system prefixes
      let finalResponse = capture.response;
      if (finalResponse) {
        finalResponse = finalResponse
          .replace(/^(?:SISTEMA (?:STARBLE|STAR AI|CODELOVE) BRAIN[\s\S]*?(?:REGRAS:|RESPONDA)[\s\S]*?\n)/i, "")
          .replace(/^(?:Analise e corrija[\s\S]*?\n)/i, "")
          .trim();
      }

      if (convoId) {
        await sc.from("loveai_conversations").update({
          ai_response: finalResponse || null,
          status: capture.status === "completed" ? "completed" : capture.status === "timeout" ? "timeout" : "failed",
        }).eq("id", convoId);
      }

      // Update last_message_at
      await sc.from("user_brain_projects").update({ last_message_at: new Date().toISOString() }).eq("user_id", userId).eq("status", "active");

      return json({
        conversation_id: convoId,
        response: finalResponse,
        status: capture.status,
      });
    }

    return json({ error: "Ação desconhecida" }, 400);
  } catch (err) {
    console.error("[Brain] Unhandled error:", err);
    return json({ error: "Erro interno no Star AI" }, 500);
  }
});
