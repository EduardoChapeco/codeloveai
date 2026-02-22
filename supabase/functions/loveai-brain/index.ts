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
  // UUIDv7: 48-bit timestamp (big-endian) in first 6 bytes
  bytes[0] = Number((now >> 40n) & 0xFFn);
  bytes[1] = Number((now >> 32n) & 0xFFn);
  bytes[2] = Number((now >> 24n) & 0xFFn);
  bytes[3] = Number((now >> 16n) & 0xFFn);
  bytes[4] = Number((now >> 8n) & 0xFFn);
  bytes[5] = Number(now & 0xFFn);
  // Random bytes for the rest
  const randBytes = new Uint8Array(10);
  crypto.getRandomValues(randBytes);
  bytes[6] = (0x70 | (randBytes[0] & 0x0F)); // version 7
  bytes[7] = randBytes[1];
  bytes[8] = (0x80 | (randBytes[2] & 0x3F)); // variant
  bytes[9] = randBytes[3];
  bytes[10] = randBytes[4];
  bytes[11] = randBytes[5];
  bytes[12] = randBytes[6];
  bytes[13] = randBytes[7];
  bytes[14] = randBytes[8];
  bytes[15] = randBytes[9];

  // Encode 128 bits into 26 base32 chars
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

    const user = { id: claimsData.claims.sub as string };

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get Lovable token
    const { data: account } = await serviceClient
      .from("lovable_accounts")
      .select("token_encrypted, status")
      .eq("user_id", user.id)
      .maybeSingle();

    const body = await req.json();
    const action = body.action;

    // For status and history actions, don't require Lovable connection
    if (action === "status") {
      if (!account || account.status !== "active") {
        return new Response(JSON.stringify({
          active: false,
          connected: false,
          reason: !account ? "no_account" : "token_expired",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: brain } = await serviceClient
        .from("user_brain_projects")
        .select("lovable_project_id, status, last_message_at, created_at")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      return new Response(JSON.stringify({
        active: !!brain,
        connected: true,
        brain: brain || null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "history") {
      const limit = Math.min(body.limit || 50, 100);
      const { data } = await supabase
        .from("loveai_conversations")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit);

      return new Response(JSON.stringify({ conversations: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // All other actions require active Lovable connection
    if (!account || account.status !== "active") {
      return new Response(JSON.stringify({ error: "Lovable não conectado. Conecte primeiro.", code: "not_connected" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lovableToken = account.token_encrypted;

    // ─── ACTION: setup — Create brain project ───
    if (action === "setup") {
      // Check if already exists
      const { data: existing } = await serviceClient
        .from("user_brain_projects")
        .select("lovable_project_id, status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({
          success: true,
          brain_project_id: existing.lovable_project_id,
          already_exists: true,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get workspace ID
      const wsRes = await fetch(`${LOVABLE_API}/user/workspaces`, {
        headers: { Authorization: `Bearer ${lovableToken}` },
      });
      if (!wsRes.ok) {
        const wsStatus = wsRes.status;
        console.error("Workspace fetch failed:", wsStatus, await wsRes.text().catch(() => ""));
        if (wsStatus === 401) {
          await serviceClient
            .from("lovable_accounts")
            .update({ status: "expired" })
            .eq("user_id", user.id);
          return new Response(JSON.stringify({ error: "Token Lovable expirado. Reconecte sua conta em Configurações > Lovable." }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "Falha ao obter workspaces do Lovable. Tente novamente." }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const wsBody = await wsRes.json();
      console.log("Workspace API raw response:", JSON.stringify(wsBody).substring(0, 500));
      // Handle multiple response formats: array, { workspaces: [...] }, { data: [...] }, or { results: [...] }
      let wsList: any[] = [];
      if (Array.isArray(wsBody)) {
        wsList = wsBody;
      } else if (wsBody && typeof wsBody === "object") {
        // Try all known keys
        wsList = wsBody.workspaces || wsBody.data || wsBody.results || wsBody.items || [];
        // If still empty but wsBody has an 'id' field, it might be a single workspace object
        if (wsList.length === 0 && wsBody.id) {
          wsList = [wsBody];
        }
      }
      const workspaceId = wsList?.[0]?.id;
      if (!workspaceId) {
        console.error("No workspace found. Full response:", JSON.stringify(wsBody).substring(0, 1000));
        return new Response(JSON.stringify({ error: "Nenhum workspace encontrado", debug_keys: Object.keys(wsBody || {}) }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create project with minimal message
      const msgId = generateTypeId("umsg");
      const aiMsgId = generateTypeId("aimsg");
      console.log("Generated IDs - msgId:", msgId, "aiMsgId:", aiMsgId);

      const createRes = await fetch(`${LOVABLE_API}/workspaces/${workspaceId}/projects`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableToken}`,
          "Content-Type": "application/json",
        },
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
      });

      if (!createRes.ok) {
        const errText = await createRes.text();
        console.error("Create project failed:", errText);
        return new Response(JSON.stringify({ error: "Falha ao criar Brain project" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const project = await createRes.json();
      const brainProjectId = project?.id || project?.project_id;

      if (!brainProjectId) {
        return new Response(JSON.stringify({ error: "ID do projeto não retornado" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Cancel the initial message to save credits
      try {
        await fetch(`${LOVABLE_API}/projects/${brainProjectId}/chat/${msgId}/cancel`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });
      } catch (cancelErr) {
        console.warn("Cancel failed (non-critical):", cancelErr);
      }

      // Save brain project
      await serviceClient.from("user_brain_projects").insert({
        user_id: user.id,
        lovable_project_id: brainProjectId,
        lovable_workspace_id: workspaceId,
        status: "active",
      });

      // Inject brain system file via edit-code
      try {
        await fetch(`${LOVABLE_API}/projects/${brainProjectId}/edit-code`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            changes: [
              {
                path: "src/brain-config.md",
                content: `# CodeLove Brain System

Este projeto é o Brain da plataforma CodeLove.
Quando receber mensagens via chat, responda SOMENTE com o resultado solicitado.
NÃO crie páginas, componentes ou código a menos que explicitamente solicitado.
Formato de resposta padrão: texto puro ou JSON conforme instruído no prompt.

RESPONDA SEMPRE EM PORTUGUÊS (Brasil).`,
              },
              {
                path: "src/brain-output.json",
                content: JSON.stringify({ response: "", timestamp: 0, status: "idle" }),
              },
            ],
          }),
        });
      } catch (injectErr) {
        console.warn("Inject failed (non-critical):", injectErr);
      }

      return new Response(JSON.stringify({
        success: true,
        brain_project_id: brainProjectId,
        workspace_id: workspaceId,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── ACTION: send — Send message to Brain via Fix V2 ───
    if (action === "send") {
      const { message, brain_type = "general", target_project_id } = body;

      if (!message || typeof message !== "string" || message.length < 1 || message.length > 10000) {
        return new Response(JSON.stringify({ error: "Mensagem inválida (1-10000 chars)" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get brain project
      const { data: brain } = await serviceClient
        .from("user_brain_projects")
        .select("lovable_project_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (!brain) {
        return new Response(JSON.stringify({ error: "Brain não configurado. Execute setup primeiro." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const brainProjectId = brain.lovable_project_id;

      // Build system prompt based on brain_type
      // IMPORTANT: All prompts MUST start with "Fix" to trigger Lovable to process and respond
      const systemPrompts: Record<string, string> = {
        general: `Fix the file src/brain-output.json with the following content:

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
{"response": "SUA_RESPOSTA_AQUI", "timestamp": ${Date.now()}, "status": "done"}`,

        design: `Fix the file src/brain-output.json with the following content:

SISTEMA CODELOVE BRAIN — MODO DESIGN:
O usuário quer: "${message}"
Retorne um prompt de design COMPLETO e DETALHADO. Inclua: paleta de cores (hex), tipografia, espaçamentos, componentes, layout grid, sombras, bordas, animações, responsividade, tema light/dark.
Escreva sua resposta no arquivo src/brain-output.json: {"response": "...", "timestamp": ${Date.now()}, "status": "done"}`,

        code: `Fix the file src/brain-output.json with the following content:

SISTEMA CODELOVE BRAIN — MODO CODE:
O usuário quer: "${message}"
Retorne APENAS o código necessário. Formato: arquivos separados com caminho completo.
Priorize: TypeScript, React, TailwindCSS, shadcn/ui, Supabase.
Escreva sua resposta no arquivo src/brain-output.json: {"response": "...", "timestamp": ${Date.now()}, "status": "done"}`,

        scraper: `Fix the file src/brain-output.json with the following content:

SISTEMA CODELOVE BRAIN — MODO SCRAPER:
O usuário quer extrair dados de: "${message}"
Retorne um script completo para captura dos dados. Inclua tratamento de erros e formato JSON.
Escreva sua resposta no arquivo src/brain-output.json: {"response": "...", "timestamp": ${Date.now()}, "status": "done"}`,

        migration: `Fix the file src/brain-output.json with the following content:

SISTEMA CODELOVE BRAIN — MODO MIGRATION:
O usuário quer migrar: "${message}"
Gere o script SQL completo de migração incluindo: schemas, tabelas, RLS policies, triggers, functions e seed data.
Escreva sua resposta no arquivo src/brain-output.json: {"response": "...", "timestamp": ${Date.now()}, "status": "done"}`,
      };

      const prompt = systemPrompts[brain_type] || systemPrompts.general;

      // Take source snapshot before sending
      let snapshotBefore: string | null = null;
      try {
        const srcRes = await fetch(`${LOVABLE_API}/projects/${brainProjectId}/source-code`, {
          headers: { Authorization: `Bearer ${lovableToken}` },
        });
        if (srcRes.ok) {
          const srcText = await srcRes.text();
          snapshotBefore = await hashText(srcText);
          await serviceClient.from("project_source_snapshots").upsert({
            project_id: brainProjectId,
            snapshot_hash: snapshotBefore,
            last_checked: new Date().toISOString(),
          }, { onConflict: "project_id" });
        }
      } catch (e) {
        console.warn("Snapshot failed:", e);
      }

      // Send Fix V2 message
      const msgId = generateTypeId("umsg");
      const aiMsgId = generateTypeId("aimsg");

      const fixPayload = JSON.stringify({
        id: msgId,
        message: prompt,
        intent: "security_fix_v2",
        chat_only: false,
        agent_mode_enabled: true,
        ai_message_id: aiMsgId,
        thread_id: "main",
        view: "security",
        view_description: "The user is currently viewing the security view for their project.",
        model: null,
        files: [],
        optimisticImageUrls: [],
        selected_elements: [],
        debug_mode: false,
        session_replay: "[]",
        client_logs: [],
        network_requests: [],
        runtime_errors: [],
        integration_metadata: {
          browser: { preview_viewport_width: 1536, preview_viewport_height: 730 },
        },
      });

      let currentLovableToken = lovableToken;

      let fixRes = await fetch(`${LOVABLE_API}/projects/${brainProjectId}/chat`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${currentLovableToken}`,
          "Content-Type": "application/json",
        },
        body: fixPayload,
      });

      // Auto-refresh token on 401
      if (fixRes.status === 401) {
        const firebaseApiKey = Deno.env.get("LOVABLE_FIREBASE_API_KEY");
        const { data: fullAccount } = await serviceClient
          .from("lovable_accounts")
          .select("refresh_token_encrypted, auto_refresh_enabled")
          .eq("user_id", user.id)
          .maybeSingle();

        if (firebaseApiKey && fullAccount?.refresh_token_encrypted && fullAccount?.auto_refresh_enabled) {
          try {
            const refreshRes = await fetch(
              `https://securetoken.googleapis.com/v1/token?key=${firebaseApiKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(fullAccount.refresh_token_encrypted)}`,
              }
            );

            if (refreshRes.ok) {
              const refreshData = await refreshRes.json();
              if (refreshData.id_token) {
                const expiresIn = parseInt(refreshData.expires_in || "3600", 10);
                await serviceClient
                  .from("lovable_accounts")
                  .update({
                    token_encrypted: refreshData.id_token,
                    refresh_token_encrypted: refreshData.refresh_token || fullAccount.refresh_token_encrypted,
                    token_expires_at: new Date(Date.now() + (expiresIn - 300) * 1000).toISOString(),
                    last_verified_at: new Date().toISOString(),
                    status: "active",
                    refresh_failure_count: 0,
                  })
                  .eq("user_id", user.id);

                currentLovableToken = refreshData.id_token;
                console.log("[Brain] Token auto-refreshed, retrying Fix V2...");

                // Retry with new token
                fixRes = await fetch(`${LOVABLE_API}/projects/${brainProjectId}/chat`, {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${currentLovableToken}`,
                    "Content-Type": "application/json",
                  },
                  body: fixPayload,
                });
              }
            }
          } catch (refreshErr) {
            console.error("[Brain] Auto-refresh failed:", refreshErr);
          }
        }
      }

      if (!fixRes.ok) {
        const errText = await fixRes.text();
        console.error("Fix V2 failed:", fixRes.status, errText.substring(0, 500));
        if (fixRes.status === 401 || fixRes.status === 403) {
          await serviceClient
            .from("lovable_accounts")
            .update({ status: "expired" })
            .eq("user_id", user.id);
          return new Response(JSON.stringify({ 
            error: "Token Lovable expirado. Reconecte sua conta em Configurações > Lovable.",
            code: "token_expired" 
          }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "Falha ao enviar para o Brain. Tente novamente." }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("[Brain] Fix V2 sent successfully for project:", brainProjectId);

      // Save conversation
      const { data: convo } = await serviceClient.from("loveai_conversations").insert({
        user_id: user.id,
        target_project_id: target_project_id || null,
        brain_message_id: msgId,
        brain_type,
        user_message: message,
        status: "processing",
      }).select("id").single();

      // Update last_message_at
      await serviceClient
        .from("user_brain_projects")
        .update({ last_message_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("status", "active");

      return new Response(JSON.stringify({
        success: true,
        conversation_id: convo?.id,
        brain_message_id: msgId,
        brain_project_id: brainProjectId,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── ACTION: capture — Extract response using chat message endpoints ───
    if (action === "capture") {
      const { conversation_id, brain_project_id, brain_message_id } = body;

      if (!conversation_id || !brain_project_id) {
        return new Response(JSON.stringify({ error: "conversation_id e brain_project_id obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Re-fetch latest token (might have been refreshed by a previous send/proxy call)
      const { data: latestAccount } = await serviceClient
        .from("lovable_accounts")
        .select("token_encrypted, status")
        .eq("user_id", user.id)
        .maybeSingle();

      const captureToken = (latestAccount?.status === "active" && latestAccount?.token_encrypted) 
        ? latestAccount.token_encrypted 
        : lovableToken;

      let response: string | null = null;

      // ═══ STRATEGY 1: Read latest message from Lovable chat (most reliable) ═══
      try {
        const latestMsgRes = await fetch(`${LOVABLE_API}/projects/${brain_project_id}/latest-message`, {
          headers: { Authorization: `Bearer ${captureToken}` },
        });
        
        if (latestMsgRes.ok) {
          const latestMsg = await latestMsgRes.json();
          console.log("[Brain Capture] latest-message response:", JSON.stringify(latestMsg).substring(0, 500));
          
          // Check if the AI has responded (the latest message should be from the AI, not the user)
          if (latestMsg) {
            // Multiple possible structures: { role, content, status } or { message, sender } etc.
            const msgRole = latestMsg.role || latestMsg.sender || latestMsg.type || "";
            const msgContent = latestMsg.content || latestMsg.message || latestMsg.text || "";
            const msgStatus = latestMsg.status || "";
            
            // If the latest message is from AI and has content
            const isAiMessage = msgRole === "assistant" || msgRole === "ai" || msgRole === "bot" || 
                                latestMsg.is_ai === true || latestMsg.from_ai === true;
            
            // Check if processing is still ongoing
            const isProcessing = msgStatus === "pending" || msgStatus === "processing" || 
                                 msgStatus === "streaming" || msgStatus === "in_progress";
            
            if (isProcessing) {
              console.log("[Brain Capture] Message still processing via latest-message");
              // Don't return yet - try other strategies
            } else if (isAiMessage && msgContent && msgContent.length > 5) {
              response = msgContent;
              console.log("[Brain Capture] ✅ Got response via /latest-message, length:", response!.length);
            } else if (msgContent && msgContent.length > 5 && !isProcessing) {
              // Maybe the structure is flat - try to use content directly
              // Only if it doesn't look like our sent message
              const { data: convoData } = await serviceClient
                .from("loveai_conversations")
                .select("user_message")
                .eq("id", conversation_id)
                .maybeSingle();
              
              if (convoData && msgContent !== convoData.user_message && !msgContent.startsWith("Fix the file")) {
                response = msgContent;
                console.log("[Brain Capture] ✅ Got response via /latest-message (flat structure), length:", response!.length);
              }
            }
          }
        } else {
          console.warn("[Brain Capture] latest-message failed:", latestMsgRes.status);
        }
      } catch (e) {
        console.warn("[Brain Capture] latest-message error:", e);
      }

      // ═══ STRATEGY 2: Read messages list (gets full conversation) ═══
      if (!response) {
        try {
          const msgsRes = await fetch(`${LOVABLE_API}/projects/${brain_project_id}/messages?limit=5&order=desc`, {
            headers: { Authorization: `Bearer ${captureToken}` },
          });
          
          if (msgsRes.ok) {
            const msgsData = await msgsRes.json();
            console.log("[Brain Capture] messages response type:", typeof msgsData, Array.isArray(msgsData) ? `array(${msgsData.length})` : "");
            
            const messages = Array.isArray(msgsData) ? msgsData : 
                            (msgsData?.messages || msgsData?.data || msgsData?.items || []);
            
            // Find the latest AI message
            for (const msg of messages) {
              const role = msg.role || msg.sender || msg.type || "";
              const content = msg.content || msg.message || msg.text || "";
              const isAi = role === "assistant" || role === "ai" || role === "bot" || 
                          msg.is_ai === true || msg.from_ai === true;
              
              if (isAi && content && content.length > 5) {
                response = content;
                console.log("[Brain Capture] ✅ Got response via /messages, length:", response!.length);
                break;
              }
            }
          } else {
            console.warn("[Brain Capture] messages failed:", msgsRes.status);
          }
        } catch (e) {
          console.warn("[Brain Capture] messages error:", e);
        }
      }

      // ═══ STRATEGY 3: Read chat-history ═══
      if (!response) {
        try {
          const histRes = await fetch(`${LOVABLE_API}/projects/${brain_project_id}/chat-history?limit=5`, {
            headers: { Authorization: `Bearer ${captureToken}` },
          });
          
          if (histRes.ok) {
            const histData = await histRes.json();
            console.log("[Brain Capture] chat-history response:", JSON.stringify(histData).substring(0, 500));
            
            const items = Array.isArray(histData) ? histData : 
                         (histData?.messages || histData?.history || histData?.data || histData?.items || []);
            
            for (const item of items) {
              const role = item.role || item.sender || item.type || "";
              const content = item.content || item.message || item.text || item.response || "";
              const isAi = role === "assistant" || role === "ai" || role === "bot" || 
                          item.is_ai === true || item.from_ai === true;
              
              if (isAi && content && content.length > 5) {
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

      // ═══ STRATEGY 4: Fallback to source-code parsing (original approach) ═══
      if (!response) {
        try {
          const { data: snapshot } = await serviceClient
            .from("project_source_snapshots")
            .select("snapshot_hash")
            .eq("project_id", brain_project_id)
            .maybeSingle();

          const previousHash = snapshot?.snapshot_hash || null;

          const srcRes = await fetch(`${LOVABLE_API}/projects/${brain_project_id}/source-code`, {
            headers: { Authorization: `Bearer ${captureToken}` },
          });

          if (srcRes.ok) {
            const rawText = await srcRes.text();
            const currentHash = await hashText(rawText);

            // If hash hasn't changed, still processing
            if (previousHash && currentHash === previousHash) {
              return new Response(JSON.stringify({ success: true, status: "processing" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }

            // Source changed - try to find brain-output.json
            let srcData: any;
            try { srcData = JSON.parse(rawText); } catch { srcData = {}; }
            
            let files: any = srcData?.files || srcData?.data?.files || srcData?.source?.files || srcData;
            
            let outputContent: string | null = null;
            if (Array.isArray(files)) {
              const outputFile = files.find((f: any) =>
                f.path === "src/brain-output.json" || f.name === "brain-output.json"
              );
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

            // Update snapshot
            await serviceClient.from("project_source_snapshots").upsert({
              project_id: brain_project_id,
              snapshot_hash: currentHash,
              last_checked: new Date().toISOString(),
            }, { onConflict: "project_id" });
          } else {
            console.warn("[Brain Capture] source-code fetch failed:", srcRes.status);
          }
        } catch (e) {
          console.warn("[Brain Capture] source-code fallback error:", e);
        }
      }

      if (response) {
        // Update conversation with response
        await serviceClient.from("loveai_conversations").update({
          ai_response: response,
          status: "completed",
        }).eq("id", conversation_id);

        return new Response(JSON.stringify({
          success: true,
          response,
          status: "completed",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Not ready yet — client should poll again
      return new Response(JSON.stringify({
        success: true,
        status: "processing",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação não reconhecida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("LoveAI Brain error:", error);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
