import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API = "https://api.lovable.dev";
const CROCKFORD = "0123456789abcdefghjkmnpqrstvwxyz";

function generateTypeId(prefix: string): string {
  const now = BigInt(Date.now());
  const bytes = new Uint8Array(16);
  bytes[0] = Number((now >> 40n) & 0xFFn);
  bytes[1] = Number((now >> 32n) & 0xFFn);
  bytes[2] = Number((now >> 24n) & 0xFFn);
  bytes[3] = Number((now >> 16n) & 0xFFn);
  bytes[4] = Number((now >> 8n) & 0xFFn);
  bytes[5] = Number(now & 0xFFn);
  const randBytes = new Uint8Array(10);
  crypto.getRandomValues(randBytes);
  bytes[6] = (0x70 | (randBytes[0] & 0x0F));
  bytes[7] = randBytes[1];
  bytes[8] = (0x80 | (randBytes[2] & 0x3F));
  bytes[9] = randBytes[3];
  for (let i = 4; i < 10; i++) bytes[6 + i] = randBytes[i];

  let val = 0n;
  for (const b of bytes) val = (val << 8n) | BigInt(b);
  const chars: string[] = [];
  for (let i = 0; i < 26; i++) {
    chars.unshift(CROCKFORD[Number(val & 31n)]);
    val >>= 5n;
  }
  return `${prefix}_${chars.join("")}`;
}

async function hashText(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ─── Token helpers ───
async function getLovableToken(sc: any, uid: string): Promise<{ token: string; expired: boolean }> {
  const { data } = await sc.from("lovable_accounts").select("token_encrypted, status").eq("user_id", uid).maybeSingle();
  if (!data || data.status !== "active") return { token: "", expired: true };
  return { token: data.token_encrypted, expired: false };
}

async function tryRefreshToken(sc: any, uid: string): Promise<string | null> {
  const key = Deno.env.get("LOVABLE_FIREBASE_API_KEY");
  const { data: a } = await sc.from("lovable_accounts").select("refresh_token_encrypted, auto_refresh_enabled").eq("user_id", uid).maybeSingle();
  if (!key || !a?.refresh_token_encrypted || !a?.auto_refresh_enabled) return null;
  try {
    const r = await fetch(`https://securetoken.googleapis.com/v1/token?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(a.refresh_token_encrypted)}`,
    });
    if (r.ok) {
      const d = await r.json();
      if (d.id_token) {
        const exp = parseInt(d.expires_in || "3600", 10);
        await sc.from("lovable_accounts").update({
          token_encrypted: d.id_token,
          refresh_token_encrypted: d.refresh_token || a.refresh_token_encrypted,
          token_expires_at: new Date(Date.now() + (exp - 300) * 1000).toISOString(),
          last_verified_at: new Date().toISOString(),
          status: "active",
          refresh_failure_count: 0,
        }).eq("user_id", uid);
        return d.id_token;
      }
    }
  } catch (e) { console.error("[Brain] refresh failed:", e); }
  return null;
}

async function lovableFetch(url: string, opts: RequestInit, sc: any, uid: string, token: string): Promise<{ res: Response; token: string }> {
  // HAR-required headers: Origin + Referer are mandatory for Lovable API
  const h: any = {
    ...opts.headers,
    Authorization: `Bearer ${token}`,
    "Origin": "https://lovable.dev",
    "Referer": "https://lovable.dev/",
  };
  if (!h["Content-Type"] && opts.method === "POST") {
    h["Content-Type"] = "application/json";
  }
  let res = await fetch(url, { ...opts, headers: h });
  if (res.status === 401) {
    const nt = await tryRefreshToken(sc, uid);
    if (nt) {
      h.Authorization = `Bearer ${nt}`;
      res = await fetch(url, { ...opts, headers: h });
      return { res, token: nt };
    }
  }
  return { res, token };
}

// ═══════════════════════════════════════════════════════════════
// PAYLOAD BUILDERS — Exact HAR-matched payloads for free modes
// ═══════════════════════════════════════════════════════════════

type ChatMode = "security_fix" | "error_fix" | "seo_fix" | "tool_approve";

function buildChatPayload(
  mode: ChatMode,
  prompt: string,
  msgId: string,
  aiMsgId: string,
  extra?: {
    view_description?: string;
    prev_session_id?: string;
    tool_use_id?: string;
  }
): any {
  const base = {
    id: msgId,
    ai_message_id: aiMsgId,
    thread_id: "main",
    model: null,
    session_replay: "[]",
    client_logs: [],
    network_requests: [],
    runtime_errors: [],
  };

  // ─── MODE 1: security_fix_v2 (HAR-exact) ───
  if (mode === "security_fix") {
    return {
      ...base,
      message: prompt,
      intent: "security_fix_v2",
      chat_only: false,
      debug_mode: false,
      view: "security",
      view_description: extra?.view_description ||
        "The user is currently viewing the security view for their project.",
      files: [],
      selected_elements: [],
      optimisticImageUrls: [],
      integration_metadata: {
        browser: { preview_viewport_width: 1280, preview_viewport_height: 854 },
      },
    };
  }

  // ─── MODE 2: error_fix / instant (HAR-exact) ───
  if (mode === "error_fix") {
    return {
      ...base,
      message: `For the code present, I get the error below.\n\nPlease think step-by-step in order to resolve it.\n\`\`\`\n${prompt}\n\`\`\``,
      mode: "instant",
      debug_mode: false,
      view: "error",
      view_description:
        "The user is currently viewing the error for their project. This shows a static version of the code, with a diff view available. Editing is only possible for paid users and for the latest edit. It shows the actual error in their code at the top.",
    };
  }

  // ─── MODE 3: seo_fix (HAR-exact) ───
  if (mode === "seo_fix") {
    return {
      ...base,
      message: prompt, // Already fully formatted by caller
      intent: "seo_fix",
      chat_only: false,
      view: "seo",
      view_description: extra?.view_description ||
        "The user is currently viewing the Page Speed analysis view for their project. This uses Google Lighthouse to analyze the actual performance of the user's app and gives separate scores for both mobile and desktop performance.",
    };
  }

  // ─── MODE 4: tool_approve / instant (HAR-exact) ───
  if (mode === "tool_approve") {
    return {
      ...base,
      message: "Lovable tool use: Approved.\n\nSkipped questions",
      mode: "instant",
      debug_mode: false,
      prev_session_id: extra?.prev_session_id || "",
      tool_use_id: extra?.tool_use_id || "",
      tool_decision: "approved",
      user_input: {},
      current_page: "/",
      view: "preview",
      view_description: "The user is currently viewing the preview.",
    };
  }

  // Fallback
  return {
    ...base,
    message: prompt,
    intent: "security_fix_v2",
    chat_only: false,
    view: "security",
    view_description: "The user is currently viewing the security view for their project.",
  };
}

// ─── Build SEO fix message from PageSpeed audit (HAR-exact template) ───
function buildSeoFixMessage(auditTitle: string, auditDescription: string, score: number, details: any): string {
  return `SEO Audit Issue (error): ${auditTitle}

Description: ${auditDescription}

Current Score: ${score}

Additional Details: ${JSON.stringify(details, null, 2)}

IMPORTANT INSTRUCTIONS FOR FIXING THIS SEO ISSUE:
- STRICTLY preserve the existing functional behavior, design, and UX of the application
- ONLY make changes that are absolutely necessary to fix this specific SEO issue
- DO NOT modify the application's visual design, layout, or user experience unless it's essential for the SEO fix
- If you cannot clearly determine how to fix this issue safely, simply provide the analysis in chat mode instead of making code changes
- Focus on technical SEO fixes like meta tags, HTML structure, accessibility attributes, etc. that don't affect the user experience

Please analyze this SEO issue and implement only the minimal necessary changes to improve the website's SEO performance without affecting the application's functionality or user experience.`;
}

function buildSeoViewDescription(results: any): string {
  const s = results.score || results.categories || {};
  return `The user is currently viewing the Page Speed analysis view for their project. This uses Google Lighthouse to analyze the actual performance of the user's app and gives separate scores for both mobile and desktop performance. The page speed view is currently using the desktop version. The page speed view is currently showing the performance category. Page speed analysis was last run at Updated just now. The main scores for each category are performance: ${s.performance ?? "N/A"}, accessibility: ${s.accessibility ?? "N/A"}, best-practices: ${s.bestPractices ?? s["best-practices"] ?? "N/A"}, seo: ${s.seo ?? "N/A"}. The detailed results are ${JSON.stringify(results)}.`;
}

// ─── Build brain prompt based on brain_type ───
function buildBrainPrompt(brainType: string, message: string): string {
  const ts = Date.now();

  // For error/seo modes, the message IS the prompt (already formatted)
  if (brainType === "error" || brainType === "seo") return message;

  const prompts: Record<string, string> = {
    general: `Analise e corrija os seguintes problemas de segurança encontrados:

SISTEMA CODELOVE BRAIN — INSTRUÇÃO:
Você é LoveAI, assistente de código e design da plataforma CodeLove.
O usuário solicitou: "${message}"

REGRAS DE RESPOSTA:
- Responda SOMENTE com o que foi pedido, sem criar páginas ou alterar o projeto
- Se for uma pergunta técnica: responda em texto claro e objetivo
- Se for um prompt de design/código: retorne um prompt estruturado e completo
- Formato: plaintext legível
- NÃO diga "vou criar", "adicionei" — apenas RESPONDA
- RESPONDA EM PORTUGUÊS (Brasil)

IMPORTANTE: Escreva sua resposta COMPLETA no arquivo src/brain-output.json no formato:
{"response": "SUA_RESPOSTA_AQUI", "timestamp": ${ts}, "status": "done"}`,

    design: `Analise e corrija os seguintes problemas de design encontrados no scan:

SISTEMA CODELOVE BRAIN — MODO DESIGN:
O usuário quer: "${message}"
Retorne um prompt de design COMPLETO e DETALHADO. Inclua: paleta de cores (hex), tipografia, espaçamentos, componentes, layout grid, sombras, bordas, animações, responsividade, tema light/dark.
Escreva sua resposta no arquivo src/brain-output.json: {"response": "...", "timestamp": ${ts}, "status": "done"}`,

    code: `Analise e corrija os seguintes problemas de código encontrados:

SISTEMA CODELOVE BRAIN — MODO CODE:
O usuário quer: "${message}"
Retorne APENAS o código necessário. Formato: arquivos separados com caminho completo.
Priorize: TypeScript, React, TailwindCSS, shadcn/ui, Supabase.
Escreva sua resposta no arquivo src/brain-output.json: {"response": "...", "timestamp": ${ts}, "status": "done"}`,

    scraper: `Analise e corrija os seguintes problemas no script de scraping:

SISTEMA CODELOVE BRAIN — MODO SCRAPER:
O usuário quer extrair dados de: "${message}"
Retorne um script completo para captura dos dados. Inclua tratamento de erros e formato JSON.
Escreva sua resposta no arquivo src/brain-output.json: {"response": "...", "timestamp": ${ts}, "status": "done"}`,

    migration: `Analise e corrija os seguintes problemas de migração SQL:

SISTEMA CODELOVE BRAIN — MODO MIGRATION:
O usuário quer migrar: "${message}"
Gere o script SQL completo de migração incluindo: schemas, tabelas, RLS policies, triggers, functions e seed data.
Escreva sua resposta no arquivo src/brain-output.json: {"response": "...", "timestamp": ${ts}, "status": "done"}`,
  };

  return prompts[brainType] || prompts.general;
}

function brainTypeToMode(bt: string): ChatMode {
  if (bt === "seo") return "seo_fix";
  if (bt === "error") return "error_fix";
  return "security_fix";
}

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Não autenticado" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return json({ error: "Token inválido" }, 401);

    const userId = claimsData.claims.sub as string;
    const sc = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json();
    const action = body.action;

    // ─── STATUS ───
    if (action === "status") {
      const { token: lToken, expired } = await getLovableToken(sc, userId);
      if (expired || !lToken) return json({ active: false, connected: false, reason: "token_expired" });

      // Actually validate the token against the Lovable API
      let tokenValid = true;
      try {
        const { res: validateRes } = await lovableFetch(
          `${LOVABLE_API}/user/workspaces`,
          { method: "GET" }, sc, userId, lToken
        );
        if (validateRes.status === 401 || validateRes.status === 403) {
          // Token is invalid on Lovable's side — mark as expired
          await sc.from("lovable_accounts").update({ status: "expired" }).eq("user_id", userId);
          tokenValid = false;
        }
      } catch {
        // Network error — don't mark as expired, just report unknown
      }

      if (!tokenValid) {
        return json({ active: false, connected: false, reason: "token_expired" });
      }

      const { data: brain } = await sc.from("user_brain_projects")
        .select("lovable_project_id, status, last_message_at, created_at")
        .eq("user_id", userId).eq("status", "active").maybeSingle();

      return json({ active: !!brain, connected: true, brain: brain || null });
    }

    // ─── HISTORY ───
    if (action === "history") {
      const limit = Math.min(body.limit || 50, 100);
      const { data } = await supabase.from("loveai_conversations")
        .select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
      return json({ conversations: data || [] });
    }

    // ─── Require Lovable connection for remaining actions ───
    const { token: lovableToken, expired } = await getLovableToken(sc, userId);
    if (expired || !lovableToken) return json({ error: "Lovable não conectado.", code: "not_connected" }, 403);

    // ─── SETUP ───
    if (action === "setup") {
      const { data: existing } = await sc.from("user_brain_projects")
        .select("lovable_project_id, status").eq("user_id", userId).eq("status", "active").maybeSingle();

      if (existing) return json({ success: true, brain_project_id: existing.lovable_project_id, already_exists: true });

      // Get workspace
      const { res: wsRes, token: t1 } = await lovableFetch(`${LOVABLE_API}/user/workspaces`, { method: "GET" }, sc, userId, lovableToken);
      if (!wsRes.ok) {
        if (wsRes.status === 401) {
          await sc.from("lovable_accounts").update({ status: "expired" }).eq("user_id", userId);
          return json({ error: "Token expirado. Reconecte.", code: "token_expired" }, 401);
        }
        return json({ error: "Falha ao obter workspaces." }, 502);
      }
      const wsBody = await wsRes.json();
      let wsList: any[] = Array.isArray(wsBody) ? wsBody : (wsBody?.workspaces || wsBody?.data || wsBody?.results || wsBody?.items || []);
      if (wsList.length === 0 && wsBody?.id) wsList = [wsBody];
      const workspaceId = wsList?.[0]?.id;
      if (!workspaceId) return json({ error: "Nenhum workspace encontrado" }, 404);

      const msgId = generateTypeId("umsg");
      const aiMsgId = generateTypeId("aimsg");

      const { res: createRes, token: t2 } = await lovableFetch(
        `${LOVABLE_API}/workspaces/${workspaceId}/projects`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: "CodeLove Brain - AI Assistant",
            visibility: "private",
            env_vars: {},
            metadata: { chat_mode_enabled: false },
            initial_message: {
              id: msgId,
              message: "Crie uma pagina em branco com um div id='brain-response' vazio",
              files: [], optimisticImageUrls: [],
              chat_only: false, agent_mode_enabled: false,
              ai_message_id: aiMsgId,
            },
          }),
        }, sc, userId, t1
      );
      if (!createRes.ok) return json({ error: "Falha ao criar Brain project" }, 502);

      const project = await createRes.json();
      const brainProjectId = project?.id || project?.project_id;
      if (!brainProjectId) return json({ error: "ID do projeto não retornado" }, 502);

      // Cancel initial message to save credits
      try {
        await lovableFetch(
          `${LOVABLE_API}/projects/${brainProjectId}/chat/${msgId}/cancel`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) },
          sc, userId, t2
        );
      } catch { /* ok */ }

      await sc.from("user_brain_projects").insert({
        user_id: userId, lovable_project_id: brainProjectId,
        lovable_workspace_id: workspaceId, status: "active",
      });

      // Inject brain config
      try {
        await lovableFetch(`${LOVABLE_API}/projects/${brainProjectId}/edit-code`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            changes: [
              { path: "src/brain-config.md", content: "# CodeLove Brain System\n\nEste projeto é o Brain da plataforma CodeLove.\nQuando receber mensagens via chat, responda SOMENTE com o resultado solicitado.\nNÃO crie páginas, componentes ou código a menos que explicitamente solicitado.\nFormato de resposta padrão: texto puro ou JSON conforme instruído no prompt.\n\nRESPONDA SEMPRE EM PORTUGUÊS (Brasil)." },
              { path: "src/brain-output.json", content: JSON.stringify({ response: "", timestamp: 0, status: "idle" }) },
            ],
          }),
        }, sc, userId, t2);
      } catch { /* ok */ }

      return json({ success: true, brain_project_id: brainProjectId, workspace_id: workspaceId });
    }

    // ─── PAGE_SPEED — Free Lighthouse analysis ───
    if (action === "page_speed") {
      const { project_id, strategy = "desktop", categories = ["seo"] } = body;

      // Use brain project if not specified
      let pid = project_id;
      if (!pid) {
        const { data: brain } = await sc.from("user_brain_projects")
          .select("lovable_project_id").eq("user_id", userId).eq("status", "active").maybeSingle();
        pid = brain?.lovable_project_id;
      }
      if (!pid) return json({ error: "Nenhum projeto especificado" }, 400);

      const { res: speedRes } = await lovableFetch(
        `${LOVABLE_API}/projects/${pid}/preview-page-speed`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url_source: "publish", strategy, categories }),
        }, sc, userId, lovableToken
      );
      if (!speedRes.ok) return json({ error: "Falha ao executar PageSpeed" }, 502);

      const speedData = await speedRes.json();
      return json({ success: true, ...speedData });
    }

    // ─── SEND — Send message to Brain (all modes) ───
    if (action === "send") {
      const { message, brain_type = "general", target_project_id, chat_mode: requestedMode } = body;

      if (!message || typeof message !== "string" || message.length < 1 || message.length > 10000) {
        return json({ error: "Mensagem inválida (1-10000 chars)" }, 400);
      }

      const { data: brain } = await sc.from("user_brain_projects")
        .select("lovable_project_id").eq("user_id", userId).eq("status", "active").maybeSingle();
      if (!brain) return json({ error: "Brain não configurado. Execute setup primeiro." }, 404);

      const brainProjectId = brain.lovable_project_id;
      const chatMode: ChatMode = (requestedMode as ChatMode) || brainTypeToMode(brain_type);

      // ─── SEO MODE: Auto-fetch PageSpeed and build proper message ───
      let finalPrompt: string;
      let seoViewDesc: string | undefined;

      if (chatMode === "seo_fix") {
        // Step 1: Fetch PageSpeed data
        let speedData: any = null;
        try {
          const { res: speedRes } = await lovableFetch(
            `${LOVABLE_API}/projects/${brainProjectId}/preview-page-speed`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url_source: "publish", strategy: "desktop", categories: ["seo"] }),
            }, sc, userId, lovableToken
          );
          if (speedRes.ok) speedData = await speedRes.json();
        } catch (e) { console.warn("[Brain] PageSpeed fetch failed:", e); }

        if (speedData?.results?.audits) {
          // Step 2: Find error audits or use user message as context
          const errorAudits = speedData.results.audits.filter((a: any) => a.severity === "error");
          const targetAudit = errorAudits[0]; // Fix first error audit

          if (targetAudit) {
            finalPrompt = buildSeoFixMessage(
              targetAudit.title || message,
              targetAudit.description || "",
              targetAudit.score ?? 0,
              targetAudit.details || {}
            );
          } else {
            // No error audits — use user message as SEO issue
            finalPrompt = buildSeoFixMessage(message, "", 0, {});
          }
          seoViewDesc = buildSeoViewDescription(speedData.results);
        } else {
          // PageSpeed unavailable — fallback to simple SEO prompt
          finalPrompt = buildSeoFixMessage(message, "", 0, {});
        }
      } else if (chatMode === "error_fix") {
        // error_fix: message is the error text, template applied in buildChatPayload
        finalPrompt = message;
      } else {
        // security_fix: build brain prompt
        finalPrompt = buildBrainPrompt(brain_type, message);
      }

      // Take source snapshot for capture strategy 4
      try {
        const { res: srcRes } = await lovableFetch(
          `${LOVABLE_API}/projects/${brainProjectId}/source-code`,
          { method: "GET" }, sc, userId, lovableToken
        );
        if (srcRes.ok) {
          const srcText = await srcRes.text();
          const snapshotHash = await hashText(srcText);
          await sc.from("project_source_snapshots").upsert({
            project_id: brainProjectId,
            snapshot_hash: snapshotHash,
            last_checked: new Date().toISOString(),
          }, { onConflict: "project_id" });
        }
      } catch { /* ok */ }

      const msgId = generateTypeId("umsg");
      const aiMsgId = generateTypeId("aimsg");
      const payload = buildChatPayload(chatMode, finalPrompt, msgId, aiMsgId, {
        view_description: seoViewDesc,
      });

      console.log(`[Brain] Sending mode=${chatMode}, brain_type=${brain_type}, project=${brainProjectId}`);

      const { res: chatRes } = await lovableFetch(
        `${LOVABLE_API}/projects/${brainProjectId}/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }, sc, userId, lovableToken
      );

      if (!chatRes.ok) {
        const errText = await chatRes.text().catch(() => "");
        console.error(`[Brain] Chat failed (${chatMode}):`, chatRes.status, errText.substring(0, 500));
        if (chatRes.status === 401 || chatRes.status === 403) {
          await sc.from("lovable_accounts").update({ status: "expired" }).eq("user_id", userId);
          return json({ error: "Token expirado. Reconecte.", code: "token_expired" }, 401);
        }
        return json({ error: "Falha ao enviar para o Brain." }, 502);
      }

      console.log(`[Brain] ✅ Sent via ${chatMode}`);

      // Save conversation
      const { data: convo } = await sc.from("loveai_conversations").insert({
        user_id: userId,
        target_project_id: target_project_id || null,
        brain_message_id: msgId,
        brain_type,
        user_message: message,
        status: "processing",
      }).select("id").single();

      await sc.from("user_brain_projects")
        .update({ last_message_at: new Date().toISOString() })
        .eq("user_id", userId).eq("status", "active");

      return json({
        success: true,
        conversation_id: convo?.id,
        brain_message_id: msgId,
        ai_message_id: aiMsgId,
        brain_project_id: brainProjectId,
        chat_mode: chatMode,
      });
    }

    // ─── TOOL_APPROVE — Auto-approve tool use step (Mode 4, free) ───
    if (action === "tool_approve") {
      const { brain_project_id, prev_session_id, tool_use_id } = body;

      if (!brain_project_id || !prev_session_id || !tool_use_id) {
        return json({ error: "brain_project_id, prev_session_id e tool_use_id obrigatórios" }, 400);
      }

      const msgId = generateTypeId("umsg");
      const aiMsgId = generateTypeId("aimsg");
      const payload = buildChatPayload("tool_approve", "", msgId, aiMsgId, {
        prev_session_id,
        tool_use_id,
      });

      const { res: approveRes } = await lovableFetch(
        `${LOVABLE_API}/projects/${brain_project_id}/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }, sc, userId, lovableToken
      );

      if (!approveRes.ok) {
        return json({ error: "Falha ao aprovar tool use" }, 502);
      }

      console.log(`[Brain] ✅ Tool approved: ${tool_use_id}`);
      return json({ success: true, message_id: msgId, ai_message_id: aiMsgId });
    }

    // ─── CAPTURE — Extract response (4-tier strategy) ───
    if (action === "capture") {
      const { conversation_id, brain_project_id, brain_message_id } = body;
      if (!conversation_id || !brain_project_id) return json({ error: "conversation_id e brain_project_id obrigatórios" }, 400);

      const { token: captureToken, expired: te } = await getLovableToken(sc, userId);
      const activeToken = te ? lovableToken : captureToken;

      let response: string | null = null;

      // ═══ STRATEGY 1: latest-message (HAR-exact pattern) ═══
      // HAR pattern: just check !is_streaming && content — that's it
      try {
        const { res: r } = await lovableFetch(
          `${LOVABLE_API}/projects/${brain_project_id}/latest-message`,
          { method: "GET" }, sc, userId, activeToken
        );
        if (r.ok) {
          const msg = await r.json();
          console.log("[Capture] S1 latest-message:", JSON.stringify({
            is_streaming: msg?.is_streaming,
            content_len: (msg?.content || msg?.message || "").length,
            role: msg?.role,
            keys: Object.keys(msg || {}),
          }));

          if (msg && !msg.is_streaming) {
            const content = msg.content || msg.message || msg.text || "";
            if (content.length > 10) {
              response = content;
              console.log("[Capture] ✅ S1 /latest-message, len:", response!.length);
            }
          } else if (msg?.is_streaming) {
            console.log("[Capture] S1 still streaming...");
          }
        }
      } catch (e) { console.warn("[Capture] S1 err:", e); }

      // ═══ STRATEGY 2: messages list ═══
      if (!response) {
        try {
          const { res: r } = await lovableFetch(
            `${LOVABLE_API}/projects/${brain_project_id}/messages?limit=5&order=desc`,
            { method: "GET" }, sc, userId, activeToken
          );
          if (r.ok) {
            const d = await r.json();
            const msgs = Array.isArray(d) ? d : (d?.messages || d?.data || d?.items || []);
            console.log("[Capture] S2 messages count:", msgs.length);
            // Find first AI message (not user message)
            for (const m of msgs) {
              const c = m.content || m.message || m.text || "";
              const role = m.role || m.type || "";
              // Skip if this looks like our sent user prompt
              if (role === "user" || role === "human") continue;
              if (c.length > 10) {
                response = c;
                console.log("[Capture] ✅ S2 /messages, len:", response!.length);
                break;
              }
            }
          }
        } catch (e) { console.warn("[Capture] S2 err:", e); }
      }

      // ═══ STRATEGY 3: chat-history ═══
      if (!response) {
        try {
          const { res: r } = await lovableFetch(
            `${LOVABLE_API}/projects/${brain_project_id}/chat-history?limit=5`,
            { method: "GET" }, sc, userId, activeToken
          );
          if (r.ok) {
            const d = await r.json();
            const items = Array.isArray(d) ? d : (d?.messages || d?.history || d?.data || d?.items || []);
            for (const it of items) {
              const c = it.content || it.message || it.text || it.response || "";
              const role = it.role || it.type || "";
              if (role === "user" || role === "human") continue;
              if (c.length > 10) {
                response = c;
                console.log("[Capture] ✅ S3 /chat-history, len:", response!.length);
                break;
              }
            }
          }
        } catch (e) { console.warn("[Capture] S3 err:", e); }
      }

      // ═══ STRATEGY 4: source-code diff (brain-output.json) ═══
      if (!response) {
        try {
          const { data: snap } = await sc.from("project_source_snapshots")
            .select("snapshot_hash").eq("project_id", brain_project_id).maybeSingle();
          const prevHash = snap?.snapshot_hash || null;

          const { res: srcRes } = await lovableFetch(
            `${LOVABLE_API}/projects/${brain_project_id}/source-code`,
            { method: "GET" }, sc, userId, activeToken
          );

          if (srcRes.ok) {
            const rawText = await srcRes.text();
            const curHash = await hashText(rawText);

            if (prevHash && curHash === prevHash) {
              return json({ success: true, status: "processing" });
            }

            let srcData: any;
            try { srcData = JSON.parse(rawText); } catch { srcData = {}; }
            const files: any = srcData?.files || srcData?.data?.files || srcData?.source?.files || srcData;

            let outputContent: string | null = null;
            if (Array.isArray(files)) {
              const f = files.find((f: any) => f.path === "src/brain-output.json" || f.name === "brain-output.json");
              outputContent = f?.content || f?.source || null;
            } else if (files && typeof files === "object") {
              outputContent = files["src/brain-output.json"] || null;
            }

            if (outputContent) {
              try {
                let clean = outputContent.trim();
                if (clean.startsWith("```")) clean = clean.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
                const parsed = JSON.parse(clean);
                if (parsed.response && parsed.response.length > 0 && parsed.status === "done") {
                  response = parsed.response;
                  console.log("[Capture] ✅ via source-code brain-output.json");
                }
              } catch {
                if (outputContent.length > 20 && !outputContent.includes('"status":"idle"')) {
                  response = outputContent.trim();
                }
              }
            }

            await sc.from("project_source_snapshots").upsert({
              project_id: brain_project_id, snapshot_hash: curHash, last_checked: new Date().toISOString(),
            }, { onConflict: "project_id" });
          }
        } catch (e) { console.warn("[Capture] source-code err:", e); }
      }

      if (response) {
        await sc.from("loveai_conversations").update({
          ai_response: response, status: "completed",
        }).eq("id", conversation_id);
        return json({ success: true, response, status: "completed" });
      }

      return json({ success: true, status: "processing" });
    }

    return json({ error: "Ação não reconhecida" }, 400);
  } catch (error) {
    console.error("LoveAI Brain error:", error);
    return json({ error: "Erro interno" }, 500);
  }
});

// ─── Helper: JSON response ───
function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
