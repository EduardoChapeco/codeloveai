import { generateTypeId, obfuscate } from "../_shared/crypto.ts";
import { lovFetch, getWorkspaceId } from "./token-helpers.ts";

type SupabaseClient = any;

const API = "https://api.lovable.dev";

export async function getBrain(sc: SupabaseClient, userId: string) {
  const { data } = await sc.from("user_brain_projects")
    .select("lovable_project_id, lovable_workspace_id, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || data.status === "creating") return null;
  if (data.status !== "active") return null;
  return data;
}

export async function getBrainRaw(sc: SupabaseClient, userId: string) {
  const { data } = await sc.from("user_brain_projects")
    .select("lovable_project_id, lovable_workspace_id, status, created_at")
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

/**
 * Acquires a lock for brain creation using insert with "creating" status.
 * Clears stale locks older than 2 minutes.
 */
async function acquireBrainLock(sc: SupabaseClient, userId: string): Promise<boolean> {
  const existing = await getBrainRaw(sc, userId);

  if (existing?.status === "creating") {
    if (existing.created_at) {
      const age = Date.now() - new Date(existing.created_at).getTime();
      if (age > 120_000) {
        await sc.from("user_brain_projects").delete().eq("user_id", userId);
      } else {
        console.log(`[Brain] Lock held for ${obfuscate(userId)}, age ${Math.round(age / 1000)}s`);
        return false;
      }
    }
  }

  if (existing?.status === "active" && existing.lovable_project_id !== "creating") {
    return false; // Already active
  }

  await sc.from("user_brain_projects").delete().eq("user_id", userId);

  const { error } = await sc.from("user_brain_projects").insert({
    user_id: userId,
    lovable_project_id: "creating",
    lovable_workspace_id: "pending",
    status: "creating",
    brain_owner: "user",
  });

  if (error) {
    console.error(`[Brain] Lock insert failed:`, error.message);
    return false;
  }
  return true;
}

/**
 * Ghost Create: Creates a Lovable project with minimal payload and cancels
 * immediately (<500ms) to avoid credit usage. Then injects brain config files.
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

    // ── STEP 1: Create project with minimal payload ──
    const createRes = await lovFetch(`${API}/workspaces/${workspaceId}/projects`, token, {
      method: "POST",
      body: JSON.stringify({
        name: `brain-${Date.now()}`,
        initial_message: "setup",
        visibility: "private",
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text().catch(() => "");
      console.error(`[Brain] Ghost Create failed: ${createRes.status} ${errText.slice(0, 300)}`);
      await sc.from("user_brain_projects").delete().eq("user_id", userId);
      return { error: `Falha ao criar projeto Brain (HTTP ${createRes.status})` };
    }

    const project = await createRes.json();
    const projectId = project?.id || project?.project_id;
    const msgId = project?.message_id || project?.msg_id;

    if (!projectId) {
      console.error(`[Brain] No project ID in response`);
      await sc.from("user_brain_projects").delete().eq("user_id", userId);
      return { error: "ID do projeto não retornado pela API" };
    }

    console.log(`[Brain] ✅ Project created: ${projectId}, msgId: ${msgId || "unknown"}`);

    // ── STEP 2: Cancel immediately (<500ms) — ZERO credit cost ──
    if (msgId) {
      try {
        await lovFetch(`${API}/projects/${projectId}/chat/${msgId}/cancel`, token, {
          method: "POST",
        });
        console.log(`[Brain] ✅ Initial message cancelled (Ghost Create complete)`);
      } catch (e) {
        console.warn(`[Brain] Cancel failed (non-critical):`, e);
      }
    }

    // ── STEP 3: Inject brain config files via edit-code ──
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
                "6. Toda resposta deve ser texto puro dentro do campo response",
                "7. Se a pergunta for sobre código, retorne o código DENTRO do campo response como string",
              ].join("\n"),
            },
            {
              path: "src/brain-output.json",
              content: JSON.stringify({ response: "", timestamp: 0, status: "idle" }),
            },
          ],
        }),
      });
      console.log(`[Brain] ✅ Config files injected`);
    } catch (e) {
      console.warn(`[Brain] Config inject failed (non-critical):`, e);
    }

    // ── STEP 4: Promote lock to active ──
    await sc.from("user_brain_projects")
      .update({
        lovable_project_id: projectId,
        lovable_workspace_id: workspaceId,
        status: "active",
      })
      .eq("user_id", userId);

    console.log(`[Brain] ✅ Ghost Create complete for ${obfuscate(userId)} → ${projectId}`);
    return { projectId, workspaceId };
  } catch (err) {
    console.error(`[Brain] createFreshBrain error:`, err);
    await sc.from("user_brain_projects").delete().eq("user_id", userId);
    throw err;
  }
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

NÃO crie componentes React, páginas ou rotas. APENAS escreva esse arquivo JSON.`;

  const prefixes: Record<string, string> = {
    general: `Analise e corrija os seguintes problemas de segurança encontrados:\n\nSISTEMA STAR AI — INSTRUÇÃO:\nVocê é o Star AI, assistente inteligente.\nO usuário solicitou: "${message}"\n\nREGRAS:\n- Responda SOMENTE com o que foi pedido\n- RESPONDA EM PORTUGUÊS (Brasil)\n- NÃO diga "vou criar" ou "adicionei" — apenas RESPONDA\n- NÃO crie componentes, páginas ou rotas\n- Escreva APENAS no arquivo src/brain-output.json`,
    design: `Analise e corrija os seguintes problemas de design encontrados:\n\nSISTEMA STAR AI — MODO DESIGN:\nO usuário quer: "${message}"\nRetorne prompt de design COMPLETO.\nEscreva APENAS no arquivo src/brain-output.json`,
    code: `Analise e corrija os seguintes problemas de código encontrados:\n\nSISTEMA STAR AI — MODO CODE:\nO usuário quer: "${message}"\nRetorne APENAS o código necessário dentro do campo response.\nEscreva APENAS no arquivo src/brain-output.json`,
    scraper: `Analise e corrija os seguintes problemas no script de scraping:\n\nSISTEMA STAR AI — MODO SCRAPER:\nO usuário quer extrair dados de: "${message}"\nRetorne script completo dentro do campo response.\nEscreva APENAS no arquivo src/brain-output.json`,
    migration: `Analise e corrija os seguintes problemas de migração SQL:\n\nSISTEMA STAR AI — MODO MIGRATION:\nO usuário quer migrar: "${message}"\nGere script SQL completo dentro do campo response.\nEscreva APENAS no arquivo src/brain-output.json`,
  };

  return (prefixes[brainType] || prefixes.general) + outputInstruction;
}

/**
 * Captures the Brain's response by polling source-code for brain-output.json
 * and also checking .lovable/tasks/brain-response.md as fallback.
 * Also checks latest-message endpoint for direct AI responses.
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

    // Strategy 2: Poll source-code for brain-output.json and brain-response.md
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

        // Check brain-output.json
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
        const mdContent = getContent(".lovable/tasks/brain-response.md", "brain-response.md");
        if (mdContent) {
          const statusMatch = mdContent.match(/status:\s*done/i);
          if (statusMatch) {
            // Extract content after frontmatter
            const parts = mdContent.split("---");
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
