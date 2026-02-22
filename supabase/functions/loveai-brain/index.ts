import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API = "https://api.lovable.dev";

// Crockford's Base32 alphabet
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
  bytes[10] = randBytes[4];
  bytes[11] = randBytes[5];
  bytes[12] = randBytes[6];
  bytes[13] = randBytes[7];
  bytes[14] = randBytes[8];
  bytes[15] = randBytes[9];

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
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ─── Helper: get fresh token, auto-refresh on 401 ───
async function getLovableToken(serviceClient: any, userId: string): Promise<{ token: string; expired: boolean }> {
  const { data: account } = await serviceClient
    .from("lovable_accounts")
    .select("token_encrypted, status, refresh_token_encrypted, auto_refresh_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  if (!account || account.status !== "active") {
    return { token: "", expired: true };
  }
  return { token: account.token_encrypted, expired: false };
}

async function tryRefreshToken(serviceClient: any, userId: string, currentToken: string): Promise<string | null> {
  const firebaseApiKey = Deno.env.get("LOVABLE_FIREBASE_API_KEY");
  const { data: acct } = await serviceClient
    .from("lovable_accounts")
    .select("refresh_token_encrypted, auto_refresh_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  if (!firebaseApiKey || !acct?.refresh_token_encrypted || !acct?.auto_refresh_enabled) return null;

  try {
    const refreshRes = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${firebaseApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(acct.refresh_token_encrypted)}`,
      }
    );
    if (refreshRes.ok) {
      const rd = await refreshRes.json();
      if (rd.id_token) {
        const expiresIn = parseInt(rd.expires_in || "3600", 10);
        await serviceClient.from("lovable_accounts").update({
          token_encrypted: rd.id_token,
          refresh_token_encrypted: rd.refresh_token || acct.refresh_token_encrypted,
          token_expires_at: new Date(Date.now() + (expiresIn - 300) * 1000).toISOString(),
          last_verified_at: new Date().toISOString(),
          status: "active",
          refresh_failure_count: 0,
        }).eq("user_id", userId);
        console.log("[Brain] Token auto-refreshed successfully");
        return rd.id_token;
      }
    }
  } catch (e) {
    console.error("[Brain] Auto-refresh failed:", e);
  }
  return null;
}

// ─── Helper: Lovable API call with auto-retry on 401 ───
async function lovableFetch(
  url: string,
  options: RequestInit,
  serviceClient: any,
  userId: string,
  token: string
): Promise<{ res: Response; token: string }> {
  const headers: any = { ...options.headers, Authorization: `Bearer ${token}` };
  let res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    const newToken = await tryRefreshToken(serviceClient, userId, token);
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`;
      res = await fetch(url, { ...options, headers });
      return { res, token: newToken };
    }
  }
  return { res, token };
}

// ─── Build payload for different free modes ───
type ChatMode = "security_fix" | "error_fix" | "seo_fix";

function buildChatPayload(
  mode: ChatMode,
  prompt: string,
  msgId: string,
  aiMsgId: string,
  extra?: { view_description?: string; seo_results?: any }
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

  if (mode === "security_fix") {
    return {
      ...base,
      message: prompt,
      intent: "security_fix_v2",
      chat_only: false,
      agent_mode_enabled: true,
      view: "security",
      view_description: extra?.view_description || "The user is currently viewing the security view for their project.",
      files: [],
      selected_elements: [],
      integration_metadata: {
        browser: { preview_viewport_width: 1536, preview_viewport_height: 730 },
      },
    };
  }

  if (mode === "error_fix") {
    // mode=instant, view=error — free runtime error fix
    const errorMessage = `For the code present, I get the error below.\n\nPlease think step-by-step in order to resolve it.\n\`\`\`\n${prompt}\n\`\`\``;
    return {
      ...base,
      message: errorMessage,
      mode: "instant",
      debug_mode: false,
      view: "error",
      view_description: "The user is currently viewing the error for their project. This shows a static version of the code, with a diff view available. Editing is only possible for paid users and for the latest edit. It shows the actual error in their code at the top.",
    };
  }

  if (mode === "seo_fix") {
    const seoMessage = `SEO Audit Issue (error): ${prompt}

IMPORTANT INSTRUCTIONS FOR FIXING THIS SEO ISSUE:
- STRICTLY preserve the existing functional behavior, design, and UX of the application
- ONLY make changes that are absolutely necessary to fix this specific SEO issue
- DO NOT modify the application's visual design, layout, or user experience unless it's essential for the SEO fix
- Focus on technical SEO fixes like meta tags, HTML structure, accessibility attributes, etc. that don't affect the user experience

Please analyze this SEO issue and implement only the minimal necessary changes to improve the website's SEO performance without affecting the application's functionality or user experience.`;

    return {
      ...base,
      message: seoMessage,
      intent: "seo_fix",
      chat_only: false,
      view: "seo",
      view_description: extra?.view_description || "The user is currently viewing the Page Speed analysis view for their project.",
    };
  }

  // Fallback to security_fix
  return { ...base, message: prompt, intent: "security_fix_v2", chat_only: false, view: "security", view_description: "The user is currently viewing the security view for their project." };
}

// ─── Build brain prompt based on brain_type ───
function buildBrainPrompt(brainType: string, message: string): string {
  const ts = Date.now();
  const prompts: Record<string, string> = {
    general: `Analise e corrija os seguintes problemas encontrados no scan de segurança:

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

    design: `Analise e corrija os seguintes problemas de design encontrados:

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

    scraper: `Analise e corrija os seguintes problemas encontrados no scraper:

SISTEMA CODELOVE BRAIN — MODO SCRAPER:
O usuário quer extrair dados de: "${message}"
Retorne um script completo para captura dos dados. Inclua tratamento de erros e formato JSON.
Escreva sua resposta no arquivo src/brain-output.json: {"response": "...", "timestamp": ${ts}, "status": "done"}`,

    migration: `Analise e corrija os seguintes problemas de migração encontrados:

SISTEMA CODELOVE BRAIN — MODO MIGRATION:
O usuário quer migrar: "${message}"
Gere o script SQL completo de migração incluindo: schemas, tabelas, RLS policies, triggers, functions e seed data.
Escreva sua resposta no arquivo src/brain-output.json: {"response": "...", "timestamp": ${ts}, "status": "done"}`,
  };

  return prompts[brainType] || prompts.general;
}

// ─── Map brain_type to best Lovable chat mode ───
function brainTypeToMode(brainType: string): ChatMode {
  // All modes use security_fix by default (most flexible, accepts any prompt)
  // error_fix is used only when explicitly requested
  // seo_fix is used only for seo brain_type
  if (brainType === "seo") return "seo_fix";
  if (brainType === "error") return "error_fix";
  return "security_fix";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const action = body.action;

    // ─── ACTION: status ───
    if (action === "status") {
      const { token: lt, expired } = await getLovableToken(serviceClient, userId);
      if (expired) {
        return new Response(JSON.stringify({ active: false, connected: false, reason: "token_expired" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: brain } = await serviceClient
        .from("user_brain_projects")
        .select("lovable_project_id, status, last_message_at, created_at")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      return new Response(JSON.stringify({ active: !!brain, connected: true, brain: brain || null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── ACTION: history ───
    if (action === "history") {
      const limit = Math.min(body.limit || 50, 100);
      const { data } = await supabase
        .from("loveai_conversations")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      return new Response(JSON.stringify({ conversations: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── All other actions require Lovable connection ───
    const { token: lovableToken, expired } = await getLovableToken(serviceClient, userId);
    if (expired || !lovableToken) {
      return new Response(JSON.stringify({ error: "Lovable não conectado. Conecte primeiro.", code: "not_connected" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── ACTION: setup — Create brain project ───
    if (action === "setup") {
      const { data: existing } = await serviceClient
        .from("user_brain_projects")
        .select("lovable_project_id, status")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ success: true, brain_project_id: existing.lovable_project_id, already_exists: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get workspace
      const { res: wsRes, token: t1 } = await lovableFetch(
        `${LOVABLE_API}/user/workspaces`, { method: "GET" }, serviceClient, userId, lovableToken
      );
      if (!wsRes.ok) {
        if (wsRes.status === 401) {
          await serviceClient.from("lovable_accounts").update({ status: "expired" }).eq("user_id", userId);
          return new Response(JSON.stringify({ error: "Token Lovable expirado. Reconecte.", code: "token_expired" }), {
            status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "Falha ao obter workspaces do Lovable." }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const wsBody = await wsRes.json();
      let wsList: any[] = Array.isArray(wsBody) ? wsBody : (wsBody?.workspaces || wsBody?.data || wsBody?.results || wsBody?.items || []);
      if (wsList.length === 0 && wsBody?.id) wsList = [wsBody];
      const workspaceId = wsList?.[0]?.id;
      if (!workspaceId) {
        return new Response(JSON.stringify({ error: "Nenhum workspace encontrado" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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
              files: [],
              optimisticImageUrls: [],
              chat_only: false,
              agent_mode_enabled: false,
              ai_message_id: aiMsgId,
            },
          }),
        },
        serviceClient, userId, t1
      );

      if (!createRes.ok) {
        return new Response(JSON.stringify({ error: "Falha ao criar Brain project" }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const project = await createRes.json();
      const brainProjectId = project?.id || project?.project_id;
      if (!brainProjectId) {
        return new Response(JSON.stringify({ error: "ID do projeto não retornado" }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Cancel initial message
      try {
        await lovableFetch(
          `${LOVABLE_API}/projects/${brainProjectId}/chat/${msgId}/cancel`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) },
          serviceClient, userId, t2
        );
      } catch { /* non-critical */ }

      // Save brain project
      await serviceClient.from("user_brain_projects").insert({
        user_id: userId,
        lovable_project_id: brainProjectId,
        lovable_workspace_id: workspaceId,
        status: "active",
      });

      // Inject brain config
      try {
        await lovableFetch(
          `${LOVABLE_API}/projects/${brainProjectId}/edit-code`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              changes: [
                {
                  path: "src/brain-config.md",
                  content: `# CodeLove Brain System\n\nEste projeto é o Brain da plataforma CodeLove.\nQuando receber mensagens via chat, responda SOMENTE com o resultado solicitado.\nNÃO crie páginas, componentes ou código a menos que explicitamente solicitado.\nFormato de resposta padrão: texto puro ou JSON conforme instruído no prompt.\n\nRESPONDA SEMPRE EM PORTUGUÊS (Brasil).`,
                },
                {
                  path: "src/brain-output.json",
                  content: JSON.stringify({ response: "", timestamp: 0, status: "idle" }),
                },
              ],
            }),
          },
          serviceClient, userId, t2
        );
      } catch { /* non-critical */ }

      return new Response(JSON.stringify({ success: true, brain_project_id: brainProjectId, workspace_id: workspaceId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── ACTION: page_speed — Run Lighthouse analysis (free) ───
    if (action === "page_speed") {
      const { project_id, strategy = "desktop", categories = ["seo"] } = body;
      const targetProject = project_id;

      if (!targetProject) {
        // Use brain project if no project specified
        const { data: brain } = await serviceClient
          .from("user_brain_projects")
          .select("lovable_project_id")
          .eq("user_id", userId)
          .eq("status", "active")
          .maybeSingle();
        if (!brain) {
          return new Response(JSON.stringify({ error: "Nenhum projeto especificado" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const pid = targetProject;
      const { res: speedRes, token: t } = await lovableFetch(
        `${LOVABLE_API}/projects/${pid}/preview-page-speed`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url_source: "publish", strategy, categories }),
        },
        serviceClient, userId, lovableToken
      );

      if (!speedRes.ok) {
        return new Response(JSON.stringify({ error: "Falha ao executar PageSpeed" }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const speedData = await speedRes.json();
      return new Response(JSON.stringify({ success: true, ...speedData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── ACTION: send — Send message to Brain ───
    if (action === "send") {
      const { message, brain_type = "general", target_project_id, chat_mode: requestedMode } = body;

      if (!message || typeof message !== "string" || message.length < 1 || message.length > 10000) {
        return new Response(JSON.stringify({ error: "Mensagem inválida (1-10000 chars)" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get brain project
      const { data: brain } = await serviceClient
        .from("user_brain_projects")
        .select("lovable_project_id")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (!brain) {
        return new Response(JSON.stringify({ error: "Brain não configurado. Execute setup primeiro." }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const brainProjectId = brain.lovable_project_id;

      // Determine chat mode
      const chatMode: ChatMode = (requestedMode as ChatMode) || brainTypeToMode(brain_type);
      
      // Build the prompt
      const prompt = buildBrainPrompt(brain_type, message);

      // Take source snapshot
      try {
        const { res: srcRes } = await lovableFetch(
          `${LOVABLE_API}/projects/${brainProjectId}/source-code`,
          { method: "GET" }, serviceClient, userId, lovableToken
        );
        if (srcRes.ok) {
          const srcText = await srcRes.text();
          const snapshotHash = await hashText(srcText);
          await serviceClient.from("project_source_snapshots").upsert({
            project_id: brainProjectId,
            snapshot_hash: snapshotHash,
            last_checked: new Date().toISOString(),
          }, { onConflict: "project_id" });
        }
      } catch { /* non-critical */ }

      // Build and send payload
      const msgId = generateTypeId("umsg");
      const aiMsgId = generateTypeId("aimsg");
      const payload = buildChatPayload(chatMode, prompt, msgId, aiMsgId);

      console.log(`[Brain] Sending via mode=${chatMode}, brain_type=${brain_type}, project=${brainProjectId}`);

      const { res: fixRes, token: usedToken } = await lovableFetch(
        `${LOVABLE_API}/projects/${brainProjectId}/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        serviceClient, userId, lovableToken
      );

      if (!fixRes.ok) {
        const errText = await fixRes.text().catch(() => "");
        console.error(`[Brain] Chat failed (${chatMode}):`, fixRes.status, errText.substring(0, 500));
        if (fixRes.status === 401 || fixRes.status === 403) {
          await serviceClient.from("lovable_accounts").update({ status: "expired" }).eq("user_id", userId);
          return new Response(JSON.stringify({ error: "Token Lovable expirado. Reconecte.", code: "token_expired" }), {
            status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "Falha ao enviar para o Brain. Tente novamente." }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`[Brain] ✅ Message sent successfully via ${chatMode}`);

      // Save conversation
      const { data: convo } = await serviceClient.from("loveai_conversations").insert({
        user_id: userId,
        target_project_id: target_project_id || null,
        brain_message_id: msgId,
        brain_type,
        user_message: message,
        status: "processing",
      }).select("id").single();

      // Update last_message_at
      await serviceClient.from("user_brain_projects")
        .update({ last_message_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("status", "active");

      return new Response(JSON.stringify({
        success: true,
        conversation_id: convo?.id,
        brain_message_id: msgId,
        brain_project_id: brainProjectId,
        chat_mode: chatMode,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── ACTION: capture — Extract response ───
    if (action === "capture") {
      const { conversation_id, brain_project_id, brain_message_id } = body;

      if (!conversation_id || !brain_project_id) {
        return new Response(JSON.stringify({ error: "conversation_id e brain_project_id obrigatórios" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get fresh token
      const { token: captureToken, expired: tokenExpired } = await getLovableToken(serviceClient, userId);
      const activeToken = tokenExpired ? lovableToken : captureToken;

      let response: string | null = null;

      // ═══ STRATEGY 1: latest-message ═══
      try {
        const { res: latestMsgRes } = await lovableFetch(
          `${LOVABLE_API}/projects/${brain_project_id}/latest-message`,
          { method: "GET" }, serviceClient, userId, activeToken
        );
        if (latestMsgRes.ok) {
          const latestMsg = await latestMsgRes.json();
          console.log("[Brain Capture] latest-message keys:", Object.keys(latestMsg || {}));
          
          if (latestMsg) {
            const isStreaming = latestMsg.is_streaming === true;
            const msgContent = latestMsg.content || latestMsg.message || latestMsg.text || "";
            const msgRole = latestMsg.role || latestMsg.sender || latestMsg.type || "";
            const isAi = msgRole === "assistant" || msgRole === "ai" || msgRole === "bot" || latestMsg.is_ai === true;
            const status = latestMsg.status || "";
            const isProcessing = status === "pending" || status === "processing" || status === "streaming" || status === "in_progress" || isStreaming;

            if (!isProcessing && msgContent && msgContent.length > 10) {
              // Check it's not our sent message
              const { data: convoData } = await serviceClient
                .from("loveai_conversations")
                .select("user_message")
                .eq("id", conversation_id)
                .maybeSingle();

              const sentMsg = convoData?.user_message || "";
              if (!msgContent.startsWith("Analise e corrija") && !msgContent.startsWith("For the code present") && !msgContent.startsWith("SEO Audit Issue") && msgContent !== sentMsg) {
                response = msgContent;
                console.log("[Brain Capture] ✅ Got response via /latest-message, length:", response!.length);
              }
            } else if (isProcessing) {
              console.log("[Brain Capture] Still processing (latest-message)");
            }
          }
        }
      } catch (e) {
        console.warn("[Brain Capture] latest-message error:", e);
      }

      // ═══ STRATEGY 2: messages list ═══
      if (!response) {
        try {
          const { res: msgsRes } = await lovableFetch(
            `${LOVABLE_API}/projects/${brain_project_id}/messages?limit=5&order=desc`,
            { method: "GET" }, serviceClient, userId, activeToken
          );
          if (msgsRes.ok) {
            const msgsData = await msgsRes.json();
            const messages = Array.isArray(msgsData) ? msgsData : (msgsData?.messages || msgsData?.data || msgsData?.items || []);
            
            for (const msg of messages) {
              const role = msg.role || msg.sender || msg.type || "";
              const content = msg.content || msg.message || msg.text || "";
              const isAi = role === "assistant" || role === "ai" || role === "bot" || msg.is_ai === true;
              
              if (isAi && content && content.length > 10) {
                response = content;
                console.log("[Brain Capture] ✅ Got response via /messages, length:", response!.length);
                break;
              }
            }
          }
        } catch (e) {
          console.warn("[Brain Capture] messages error:", e);
        }
      }

      // ═══ STRATEGY 3: chat-history ═══
      if (!response) {
        try {
          const { res: histRes } = await lovableFetch(
            `${LOVABLE_API}/projects/${brain_project_id}/chat-history?limit=5`,
            { method: "GET" }, serviceClient, userId, activeToken
          );
          if (histRes.ok) {
            const histData = await histRes.json();
            const items = Array.isArray(histData) ? histData : (histData?.messages || histData?.history || histData?.data || histData?.items || []);
            
            for (const item of items) {
              const role = item.role || item.sender || item.type || "";
              const content = item.content || item.message || item.text || item.response || "";
              const isAi = role === "assistant" || role === "ai" || role === "bot" || item.is_ai === true;
              
              if (isAi && content && content.length > 10) {
                response = content;
                console.log("[Brain Capture] ✅ Got response via /chat-history, length:", response!.length);
                break;
              }
            }
          }
        } catch (e) {
          console.warn("[Brain Capture] chat-history error:", e);
        }
      }

      // ═══ STRATEGY 4: source-code fallback ═══
      if (!response) {
        try {
          const { data: snapshot } = await serviceClient
            .from("project_source_snapshots")
            .select("snapshot_hash")
            .eq("project_id", brain_project_id)
            .maybeSingle();

          const previousHash = snapshot?.snapshot_hash || null;

          const { res: srcRes } = await lovableFetch(
            `${LOVABLE_API}/projects/${brain_project_id}/source-code`,
            { method: "GET" }, serviceClient, userId, activeToken
          );

          if (srcRes.ok) {
            const rawText = await srcRes.text();
            const currentHash = await hashText(rawText);

            if (previousHash && currentHash === previousHash) {
              return new Response(JSON.stringify({ success: true, status: "processing" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }

            let srcData: any;
            try { srcData = JSON.parse(rawText); } catch { srcData = {}; }
            
            const files: any = srcData?.files || srcData?.data?.files || srcData?.source?.files || srcData;
            
            let outputContent: string | null = null;
            if (Array.isArray(files)) {
              const outputFile = files.find((f: any) => f.path === "src/brain-output.json" || f.name === "brain-output.json");
              outputContent = outputFile?.content || outputFile?.source || null;
            } else if (files && typeof files === "object") {
              outputContent = files["src/brain-output.json"] || null;
            }

            if (outputContent) {
              try {
                let clean = outputContent.trim();
                if (clean.startsWith("```")) clean = clean.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
                const parsed = JSON.parse(clean);
                if (parsed.response && parsed.response.length > 0) {
                  response = parsed.response;
                  console.log("[Brain Capture] ✅ Got response via source-code brain-output.json");
                }
              } catch {
                if (outputContent.length > 20 && !outputContent.includes('"status":"idle"')) {
                  response = outputContent.trim();
                }
              }
            }

            await serviceClient.from("project_source_snapshots").upsert({
              project_id: brain_project_id,
              snapshot_hash: currentHash,
              last_checked: new Date().toISOString(),
            }, { onConflict: "project_id" });
          }
        } catch (e) {
          console.warn("[Brain Capture] source-code fallback error:", e);
        }
      }

      if (response) {
        await serviceClient.from("loveai_conversations").update({
          ai_response: response,
          status: "completed",
        }).eq("id", conversation_id);

        return new Response(JSON.stringify({ success: true, response, status: "completed" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, status: "processing" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação não reconhecida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("LoveAI Brain error:", error);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
