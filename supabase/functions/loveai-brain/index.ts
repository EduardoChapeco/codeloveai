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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      const systemPrompts: Record<string, string> = {
        general: `SISTEMA CODELOVE BRAIN — INSTRUÇÃO:
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

        design: `SISTEMA CODELOVE BRAIN — MODO DESIGN:
O usuário quer: "${message}"
Retorne um prompt de design COMPLETO e DETALHADO. Inclua: paleta de cores (hex), tipografia, espaçamentos, componentes, layout grid, sombras, bordas, animações, responsividade, tema light/dark.
Escreva sua resposta no arquivo src/brain-output.json: {"response": "...", "timestamp": ${Date.now()}, "status": "done"}`,

        code: `SISTEMA CODELOVE BRAIN — MODO CODE:
O usuário quer: "${message}"
Retorne APENAS o código necessário. Formato: arquivos separados com caminho completo.
Priorize: TypeScript, React, TailwindCSS, shadcn/ui, Supabase.
Escreva sua resposta no arquivo src/brain-output.json: {"response": "...", "timestamp": ${Date.now()}, "status": "done"}`,

        scraper: `SISTEMA CODELOVE BRAIN — MODO SCRAPER:
O usuário quer extrair dados de: "${message}"
Retorne um script completo para captura dos dados. Inclua tratamento de erros e formato JSON.
Escreva sua resposta no arquivo src/brain-output.json: {"response": "...", "timestamp": ${Date.now()}, "status": "done"}`,

        migration: `SISTEMA CODELOVE BRAIN — MODO MIGRATION:
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

      const fixRes = await fetch(`${LOVABLE_API}/projects/${brainProjectId}/chat`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: msgId,
          message: prompt,
          intent: "security_fix_v2",
          chat_only: false,
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
        }),
      });

      if (!fixRes.ok) {
        const errText = await fixRes.text();
        console.error("Fix V2 failed:", errText);
        return new Response(JSON.stringify({ error: "Falha ao enviar para o Brain" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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

    // ─── ACTION: capture — Poll for brain response ───
    if (action === "capture") {
      const { conversation_id, brain_project_id } = body;

      if (!conversation_id || !brain_project_id) {
        return new Response(JSON.stringify({ error: "conversation_id e brain_project_id obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Poll source code for brain-output.json changes
      const maxAttempts = 30; // 60s total (2s intervals)
      let response: string | null = null;

      for (let i = 0; i < maxAttempts; i++) {
        try {
          const srcRes = await fetch(`${LOVABLE_API}/projects/${brain_project_id}/source-code`, {
            headers: { Authorization: `Bearer ${lovableToken}` },
          });

          if (srcRes.ok) {
            const srcData = await srcRes.json();
            const files = srcData?.files || srcData;
            let outputContent: string | null = null;

            if (Array.isArray(files)) {
              const outputFile = files.find((f: { path: string }) =>
                f.path === "src/brain-output.json" || f.path === "/src/brain-output.json"
              );
              if (outputFile?.content) {
                outputContent = outputFile.content;
              }
            } else if (typeof files === "object") {
              outputContent = files["src/brain-output.json"] || null;
            }

            if (outputContent) {
              try {
                const parsed = JSON.parse(outputContent);
                if (parsed.status === "done" && parsed.response) {
                  response = parsed.response;
                  break;
                }
              } catch {
                // Not valid JSON yet, keep polling
              }
            }
          }
        } catch (pollErr) {
          console.warn("Poll error:", pollErr);
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Update conversation with response
      if (response) {
        await serviceClient.from("loveai_conversations").update({
          ai_response: response,
          status: "completed",
        }).eq("id", conversation_id);

        // Reset brain-output.json for next use
        try {
          await fetch(`${LOVABLE_API}/projects/${brain_project_id}/edit-code`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${lovableToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              changes: [{
                path: "src/brain-output.json",
                content: JSON.stringify({ response: "", timestamp: 0, status: "idle" }),
              }],
            }),
          });
        } catch {
          // Non-critical
        }

        return new Response(JSON.stringify({
          success: true,
          response,
          status: "completed",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        await serviceClient.from("loveai_conversations").update({
          status: "timeout",
        }).eq("id", conversation_id);

        return new Response(JSON.stringify({
          success: false,
          status: "timeout",
          error: "Brain não respondeu em 60s",
        }), {
          status: 408,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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
