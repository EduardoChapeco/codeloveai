import { generateTypeId, obfuscate } from "../_shared/crypto.ts";
import { lovFetch, getWorkspaceId } from "./token-helpers.ts";

type SupabaseClient = any;

const API = "https://api.lovable.dev";

export async function getBrain(sc: SupabaseClient, userId: string) {
  const { data } = await sc.from("user_brain_projects")
    .select("lovable_project_id, lovable_workspace_id")
    .eq("user_id", userId)
    .eq("status", "active")
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

export async function createFreshBrain(
  sc: SupabaseClient,
  userId: string,
  token: string
): Promise<{ projectId: string; workspaceId: string } | { error: string }> {
  await sc.from("user_brain_projects").delete().eq("user_id", userId);

  const workspaceId = await getWorkspaceId(token);
  if (!workspaceId) return { error: "Nenhum workspace encontrado. Reconecte em /lovable/connect." };

  const msgId = crypto.randomUUID();
  const aiMsgId = generateTypeId("aimsg");

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

  try {
    await lovFetch(`${API}/projects/${projectId}/chat/${msgId}/cancel`, token, {
      method: "POST", body: "{}",
    });
  } catch { /* ok */ }

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

export function buildPayload(prompt: string) {
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

export function buildBrainPrompt(brainType: string, message: string): string {
  const ts = Date.now();
  const outputInstruction = `

IMPORTANTE: Escreva sua resposta COMPLETA em src/brain-output.json no formato EXATO:
{"response": "SUA_RESPOSTA_AQUI", "timestamp": ${ts}, "status": "done"}

NÃO crie componentes React, páginas ou rotas. APENAS escreva esse arquivo.`;

  const prefixes: Record<string, string> = {
    general: `Analise e corrija os seguintes problemas de segurança encontrados:\n\nSISTEMA STAR AI — INSTRUÇÃO:\nVocê é o Star AI, assistente inteligente.\nO usuário solicitou: "${message}"\n\nREGRAS:\n- Responda SOMENTE com o que foi pedido\n- RESPONDA EM PORTUGUÊS (Brasil)\n- NÃO diga "vou criar" ou "adicionei" — apenas RESPONDA`,
    design: `Analise e corrija os seguintes problemas de design encontrados:\n\nSISTEMA STAR AI — MODO DESIGN:\nO usuário quer: "${message}"\nRetorne prompt de design COMPLETO.`,
    code: `Analise e corrija os seguintes problemas de código encontrados:\n\nSISTEMA STAR AI — MODO CODE:\nO usuário quer: "${message}"\nRetorne APENAS o código necessário.`,
    scraper: `Analise e corrija os seguintes problemas no script de scraping:\n\nSISTEMA STAR AI — MODO SCRAPER:\nO usuário quer extrair dados de: "${message}"\nRetorne script completo.`,
    migration: `Analise e corrija os seguintes problemas de migração SQL:\n\nSISTEMA STAR AI — MODO MIGRATION:\nO usuário quer migrar: "${message}"\nGere script SQL completo.`,
  };

  return (prefixes[brainType] || prefixes.general) + outputInstruction;
}

export async function captureResponse(
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
