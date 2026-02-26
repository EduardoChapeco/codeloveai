import { createClient } from "npm:@supabase/supabase-js@2";
import { generateTypeId, obfuscate } from "../_shared/crypto.ts";

type SupabaseClient = any;

type BrainType = "general" | "design" | "code" | "scraper" | "migration";

const API = "https://api.lovable.dev";
const GIT_SHA = "3d7a3673c6f02b606137a12ddc0ab88f6b775113";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VALID_ACTIONS = new Set(["status", "history", "reset", "setup", "send", "capture"]);
const VALID_BRAIN_TYPES = new Set(["general", "design", "code", "scraper", "migration"]);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function lovFetch(url: string, token: string, opts: RequestInit = {}) {
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

async function getUserToken(sc: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await sc.from("lovable_accounts")
    .select("token_encrypted")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  return data?.token_encrypted?.trim() || null;
}

async function refreshToken(sc: SupabaseClient, userId: string): Promise<string | null> {
  try {
    const { data: acct } = await sc.from("lovable_accounts")
      .select("refresh_token_encrypted")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (!acct?.refresh_token_encrypted) return null;

    const firebaseKey = Deno.env.get("FIREBASE_API_KEY");
    if (!firebaseKey) return null;

    const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${firebaseKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(acct.refresh_token_encrypted)}`,
    });

    if (!res.ok) return null;

    const payload = await res.json();
    const newToken = payload.id_token || payload.access_token;
    if (!newToken) return null;

    await sc.from("lovable_accounts")
      .update({
        token_encrypted: newToken,
        ...(payload.refresh_token ? { refresh_token_encrypted: payload.refresh_token } : {}),
      })
      .eq("user_id", userId)
      .eq("status", "active");

    console.log(`[Brain] Token refreshed for ${obfuscate(userId)}`);
    return newToken;
  } catch (err) {
    console.error("[Brain] refreshToken error:", err);
    return null;
  }
}

async function getValidToken(sc: SupabaseClient, userId: string): Promise<string | null> {
  let token = await getUserToken(sc, userId);
  if (!token) return null;

  const probe = await lovFetch(`${API}/user/workspaces`, token, { method: "GET" });
  if (probe.ok) return token;

  if (probe.status === 401 || probe.status === 403) {
    token = await refreshToken(sc, userId);
    return token;
  }

  return token;
}

async function getWorkspaceId(token: string): Promise<string | null> {
  const res = await lovFetch(`${API}/user/workspaces`, token, { method: "GET" });
  if (!res.ok) return null;

  const body = await res.json();
  const list = Array.isArray(body) ? body : (body?.workspaces || body?.data || []);

  if (list.length === 0 && body?.id) return body.id;
  return list?.[0]?.id || null;
}

async function getBrainRaw(sc: SupabaseClient, userId: string) {
  const { data } = await sc.from("user_brain_projects")
    .select("lovable_project_id, lovable_workspace_id, status, created_at")
    .eq("user_id", userId)
    .maybeSingle();

  return data;
}

async function getBrain(sc: SupabaseClient, userId: string) {
  const { data } = await sc.from("user_brain_projects")
    .select("lovable_project_id, lovable_workspace_id, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data || data.status !== "active") return null;
  return data;
}

async function verifyProject(projectId: string, token: string): Promise<boolean> {
  try {
    const res = await lovFetch(`${API}/projects/${projectId}`, token, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

async function acquireBrainLock(sc: SupabaseClient, userId: string): Promise<boolean> {
  const existing = await getBrainRaw(sc, userId);

  if (existing?.status === "creating") {
    if (existing.created_at) {
      const ageMs = Date.now() - new Date(existing.created_at).getTime();
      if (ageMs > 120_000) {
        await sc.from("user_brain_projects").delete().eq("user_id", userId);
      } else {
        return false;
      }
    } else {
      return false;
    }
  }

  await sc.from("user_brain_projects").delete().eq("user_id", userId);

  const { error } = await sc.from("user_brain_projects").insert({
    user_id: userId,
    lovable_project_id: "creating",
    lovable_workspace_id: "pending",
    status: "creating",
    brain_owner: "user",
  });

  return !error;
}

function buildBrainPrompt(brainType: BrainType, message: string): string {
  const ts = Date.now();
  const outputInstruction = `\n\nIMPORTANTE: Escreva sua resposta COMPLETA em src/brain-output.json no formato EXATO:\n{"response":"SUA_RESPOSTA_AQUI","timestamp":${ts},"status":"done"}\n\nNÃO crie componentes React, páginas ou rotas. APENAS escreva esse arquivo JSON.`;

  const prefixes: Record<BrainType, string> = {
    general: `Analise e corrija os seguintes problemas de segurança encontrados:\n\nSISTEMA STAR AI — INSTRUÇÃO:\nVocê é o Star AI, assistente inteligente.\nO usuário solicitou: "${message}"\n\nREGRAS:\n- Responda SOMENTE com o que foi pedido\n- RESPONDA EM PORTUGUÊS (Brasil)\n- NÃO diga "vou criar" ou "adicionei" — apenas RESPONDA\n- NÃO crie componentes, páginas ou rotas\n- Escreva APENAS no arquivo src/brain-output.json`,
    design: `Analise e corrija os seguintes problemas de design encontrados:\n\nSISTEMA STAR AI — MODO DESIGN:\nO usuário quer: "${message}"\nRetorne prompt de design COMPLETO.\nEscreva APENAS no arquivo src/brain-output.json`,
    code: `Analise e corrija os seguintes problemas de código encontrados:\n\nSISTEMA STAR AI — MODO CODE:\nO usuário quer: "${message}"\nRetorne APENAS o código necessário dentro do campo response.\nEscreva APENAS no arquivo src/brain-output.json`,
    scraper: `Analise e corrija os seguintes problemas no script de scraping:\n\nSISTEMA STAR AI — MODO SCRAPER:\nO usuário quer extrair dados de: "${message}"\nRetorne script completo dentro do campo response.\nEscreva APENAS no arquivo src/brain-output.json`,
    migration: `Analise e corrija os seguintes problemas de migração SQL:\n\nSISTEMA STAR AI — MODO MIGRATION:\nO usuário quer migrar: "${message}"\nGere script SQL completo dentro do campo response.\nEscreva APENAS no arquivo src/brain-output.json`,
  };

  return prefixes[brainType] + outputInstruction;
}

function buildPayload(prompt: string) {
  return {
    id: crypto.randomUUID(),
    message: prompt,
    intent: "security_fix_v2",
    chat_only: false,
    ai_message_id: generateTypeId("aimsg"),
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

async function captureResponse(
  projectId: string,
  token: string,
  maxWaitMs = 90_000,
  intervalMs = 4_000,
  initialDelayMs = 6_000,
): Promise<{ response: string | null; status: "completed" | "processing" | "timeout" }> {
  await new Promise((r) => setTimeout(r, initialDelayMs));
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    try {
      const latestRes = await lovFetch(`${API}/projects/${projectId}/latest-message`, token, { method: "GET" });
      if (latestRes.ok) {
        const msg = await latestRes.json();
        if (msg && !msg.is_streaming && msg.role !== "user") {
          const content = msg.content || msg.message || msg.text || "";
          if (typeof content === "string" && content.trim().length > 10) {
            return { response: content.trim(), status: "completed" };
          }
        }
      }
    } catch {
      // continue polling
    }

    try {
      const srcRes = await lovFetch(`${API}/projects/${projectId}/source-code`, token, { method: "GET" });
      if (srcRes.ok) {
        const rawText = await srcRes.text();
        let parsed: any = {};
        try {
          parsed = JSON.parse(rawText);
        } catch {
          parsed = {};
        }

        const files = parsed?.files || parsed?.data?.files || parsed?.source?.files || parsed;

        const getContent = (path: string, name: string): string | null => {
          if (Array.isArray(files)) {
            const found = files.find((f: any) => f.path === path || f.name === name);
            return found?.content || found?.source || null;
          }
          if (files && typeof files === "object") {
            return files[path] || null;
          }
          return null;
        };

        const jsonContent = getContent("src/brain-output.json", "brain-output.json");
        if (jsonContent) {
          let clean = jsonContent.trim();
          if (clean.startsWith("```")) {
            clean = clean.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
          }

          try {
            const out = JSON.parse(clean);
            if (out?.status === "done" && typeof out?.response === "string" && out.response.trim().length > 0) {
              return { response: out.response.trim(), status: "completed" };
            }
          } catch {
            // ignore malformed intermediate content
          }
        }

        const mdContent = getContent(".lovable/tasks/brain-response.md", "brain-response.md");
        if (mdContent && /status:\s*done/i.test(mdContent)) {
          const parts = mdContent.split("---");
          if (parts.length >= 3) {
            const body = parts.slice(2).join("---").trim();
            if (body.length > 5) {
              return { response: body, status: "completed" };
            }
          }
        }
      }
    } catch {
      // continue polling
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  return { response: null, status: "timeout" };
}

async function createFreshBrain(
  sc: SupabaseClient,
  userId: string,
  token: string,
): Promise<{ projectId: string; workspaceId: string } | { error: string }> {
  const locked = await acquireBrainLock(sc, userId);
  if (!locked) {
    await new Promise((r) => setTimeout(r, 2_000));
    const existing = await getBrain(sc, userId);
    if (existing) return { projectId: existing.lovable_project_id, workspaceId: existing.lovable_workspace_id };
    return { error: "Brain está sendo criado. Tente novamente em alguns segundos." };
  }

  try {
    const workspaceId = await getWorkspaceId(token);
    console.log(`[Brain] WorkspaceId resolved: ${workspaceId}`);
    if (!workspaceId) {
      await sc.from("user_brain_projects").delete().eq("user_id", userId);
      return { error: "Nenhum workspace encontrado. Reconecte em /lovable/connect." };
    }

    const payload = {
      name: `project-${Date.now()}`,
      initial_message: { message: "setup" },
      visibility: "private",
    };

    const start = Date.now();
    const createRes = await lovFetch(`${API}/workspaces/${workspaceId}/projects`, token, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!createRes.ok) {
      const body = await createRes.text().catch(() => "");
      console.error(`[Brain] Ghost Create failed: ${createRes.status} ${body.slice(0, 300)}`);
      await sc.from("user_brain_projects").delete().eq("user_id", userId);
      return { error: `Falha ao criar projeto Brain (HTTP ${createRes.status})` };
    }

    const created = await createRes.json();
    const projectId = created?.id;
    const messageId = created?.message_id;

    if (!projectId) {
      await sc.from("user_brain_projects").delete().eq("user_id", userId);
      return { error: "ID do projeto não retornado pela API" };
    }

    if (messageId) {
      const elapsed = Date.now() - start;
      const cancelRes = await lovFetch(`${API}/projects/${projectId}/chat/${messageId}/cancel`, token, {
        method: "POST",
      });

      if (!cancelRes.ok) {
        const cancelText = await cancelRes.text().catch(() => "");
        console.warn(`[Brain] Cancel failed (${cancelRes.status}) after ${elapsed}ms: ${cancelText.slice(0, 200)}`);
      } else {
        console.log(`[Brain] Ghost cancel success in ${elapsed}ms`);
      }
    }

    try {
      await lovFetch(`${API}/projects/${projectId}/edit-code`, token, {
        method: "POST",
        body: JSON.stringify({
          changes: [
            {
              path: "src/brain-config.md",
              content: [
                "# Star AI Brain",
                "",
                "REGRAS ABSOLUTAS:",
                "1. NUNCA crie componentes React, páginas, rotas ou qualquer código de UI",
                "2. NUNCA modifique arquivos existentes exceto os listados abaixo",
                "3. RESPONDA APENAS escrevendo em src/brain-output.json",
                "4. Formato OBRIGATÓRIO: {\"response\":\"...\",\"timestamp\":...,\"status\":\"done\"}",
                "5. RESPONDA EM PORTUGUÊS (Brasil)",
              ].join("\n"),
            },
            {
              path: "src/brain-output.json",
              content: JSON.stringify({ response: "", timestamp: 0, status: "idle" }),
            },
          ],
        }),
      });
    } catch (err) {
      console.warn("[Brain] Non-critical edit-code injection failure:", err);
    }

    await sc.from("user_brain_projects")
      .update({
        lovable_project_id: projectId,
        lovable_workspace_id: workspaceId,
        status: "active",
      })
      .eq("user_id", userId);

    return { projectId, workspaceId };
  } catch (err) {
    console.error("[Brain] createFreshBrain unexpected error:", err);
    await sc.from("user_brain_projects").delete().eq("user_id", userId);
    return { error: "Erro inesperado ao criar Brain" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRole) {
      return json({ error: "Configuração do servidor incompleta" }, 500);
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return json({ error: "Token inválido" }, 401);

    const sc = createClient(supabaseUrl, serviceRole);
    const userId = user.id;

    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: "JSON inválido" }, 400);
    }

    const action = typeof body?.action === "string" ? body.action : "";
    if (!VALID_ACTIONS.has(action)) return json({ error: "Ação desconhecida" }, 400);

    if (action === "status") {
      const token = await getUserToken(sc, userId);
      if (!token) return json({ active: false, connected: false, reason: "no_token" });

      const brain = await getBrain(sc, userId);
      const raw = await getBrainRaw(sc, userId);
      return json({ active: !!brain, connected: true, brain: brain || null, creating: raw?.status === "creating" });
    }

    if (action === "history") {
      const requested = typeof body?.limit === "number" ? body.limit : 50;
      const limit = Math.max(1, Math.min(requested, 100));

      const { data } = await supabase
        .from("loveai_conversations")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      return json({ conversations: data || [] });
    }

    if (action === "reset") {
      await sc.from("user_brain_projects").delete().eq("user_id", userId);
      await sc.from("loveai_conversations").delete().eq("user_id", userId);
      return json({ success: true, message: "Star AI resetado completamente." });
    }

    const lovableToken = await getValidToken(sc, userId);
    if (!lovableToken) {
      return json({ error: "Token Lovable inválido. Reconecte via /lovable/connect.", code: "no_token" }, 503);
    }

    if (action === "setup") {
      const existing = await getBrain(sc, userId);
      if (existing) {
        const accessible = await verifyProject(existing.lovable_project_id, lovableToken);
        if (accessible) {
          return json({ success: true, project_id: existing.lovable_project_id, already_exists: true });
        }
        await sc.from("user_brain_projects").delete().eq("user_id", userId);
      }

      const result = await createFreshBrain(sc, userId, lovableToken);
      if ("error" in result) return json({ error: result.error }, 502);
      return json({ success: true, project_id: result.projectId });
    }

    if (action === "send") {
      const message = typeof body?.message === "string" ? body.message.trim() : "";
      const rawType = typeof body?.brain_type === "string" ? body.brain_type : "general";
      const brainType: BrainType = (VALID_BRAIN_TYPES.has(rawType) ? rawType : "general") as BrainType;

      if (!message || message.length < 1 || message.length > 10_000) {
        return json({ error: "Mensagem inválida (1-10000 chars)" }, 400);
      }

      let brain = await getBrain(sc, userId);
      const raw = await getBrainRaw(sc, userId);

      if (!brain && raw?.status === "creating") {
        await new Promise((r) => setTimeout(r, 5_000));
        brain = await getBrain(sc, userId);
      }

      if (!brain) {
        return json({ error: "Star AI não está ativo. Ative primeiro clicando em 'Ativar Star AI'.", code: "brain_inactive" }, 400);
      }

      const access = await verifyProject(brain.lovable_project_id, lovableToken);
      if (!access) {
        await sc.from("user_brain_projects").delete().eq("user_id", userId);
        return json({ error: "Brain não encontrado na conta Lovable atual. Reative o Star AI.", code: "brain_inactive" }, 400);
      }

      const prompt = buildBrainPrompt(brainType, message);
      const payload = buildPayload(prompt);

      const { data: convoRow } = await sc.from("loveai_conversations")
        .insert({
          user_id: userId,
          user_message: message,
          brain_type: brainType,
          status: "processing",
          target_project_id: brain.lovable_project_id,
        })
        .select("id")
        .single();

      const convoId = convoRow?.id;

      let chatToken = lovableToken;
      let chatRes = await lovFetch(`${API}/projects/${brain.lovable_project_id}/chat`, chatToken, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!chatRes.ok && (chatRes.status === 401 || chatRes.status === 403)) {
        const refreshed = await refreshToken(sc, userId);
        if (!refreshed) {
          if (convoId) await sc.from("loveai_conversations").update({ status: "failed" }).eq("id", convoId);
          return json({ error: "Token expirado. Reconecte via /lovable/connect.", code: "no_token" }, 503);
        }

        chatToken = refreshed;
        chatRes = await lovFetch(`${API}/projects/${brain.lovable_project_id}/chat`, chatToken, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      if (!chatRes.ok) {
        if (convoId) await sc.from("loveai_conversations").update({ status: "failed" }).eq("id", convoId);
        return json({ error: `Erro ao enviar (HTTP ${chatRes.status})` }, 502);
      }

      const capture = await captureResponse(brain.lovable_project_id, chatToken);
      const finalStatus = capture.status === "completed" ? "completed" : capture.status === "timeout" ? "timeout" : "failed";

      if (convoId) {
        await sc.from("loveai_conversations").update({
          ai_response: capture.response || null,
          status: finalStatus,
        }).eq("id", convoId);
      }

      await sc.from("user_brain_projects")
        .update({ last_message_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("status", "active");

      return json({
        conversation_id: convoId,
        response: capture.response,
        status: capture.status,
      });
    }

    if (action === "capture") {
      const conversationId = typeof body?.conversation_id === "string" ? body.conversation_id : "";
      if (!conversationId) return json({ error: "conversation_id obrigatório" }, 400);

      const { data: convo } = await sc.from("loveai_conversations")
        .select("id, user_id, ai_response, status, target_project_id")
        .eq("id", conversationId)
        .eq("user_id", userId)
        .maybeSingle();

      if (!convo) return json({ error: "Conversa não encontrada" }, 404);

      if (convo.ai_response && convo.ai_response.length > 0) {
        return json({ response: convo.ai_response, status: convo.status });
      }

      const projectId = convo.target_project_id;
      if (!projectId) return json({ response: null, status: convo.status || "processing" });

      const capture = await captureResponse(projectId, lovableToken, 45_000, 3_000, 0);
      if (capture.response) {
        const newStatus = capture.status === "completed" ? "completed" : convo.status;
        await sc.from("loveai_conversations").update({
          ai_response: capture.response,
          status: newStatus,
        }).eq("id", conversationId);
      }

      return json({ response: capture.response, status: capture.status });
    }

    return json({ error: "Ação desconhecida" }, 400);
  } catch (err) {
    console.error("[Brain] Unhandled error:", err);
    return json({ error: "Erro interno no Brain" }, 500);
  }
});
