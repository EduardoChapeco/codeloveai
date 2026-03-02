import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractFilesFromMarkdown, mergeFileMaps as mergeFileMapsMd } from "../_shared/md-assembly.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Command Detection ───────────────────────────────────────
type CommandType = "build" | "fix" | "improve" | "refine" | "chat";

function detectCommand(text: string): { type: CommandType; prompt: string } {
  const lower = text.trim().toLowerCase();

  // Build commands
  if (/^(crie|criar|cria|build|gere|gerar|construa|monte|implemente|adicione|adicionar|faça|faz)\s/i.test(lower)) {
    return { type: "build", prompt: text.trim() };
  }

  // Fix commands
  if (/^(corrija|corrigir|fix|fixe|arrume|arrumar|conserte|consertar|debug)\s/i.test(lower)) {
    return { type: "fix", prompt: text.trim() };
  }

  // Improve commands
  if (/^(melhore|melhorar|improve|otimize|otimizar|refatore|refatorar|upgrade)\s/i.test(lower)) {
    return { type: "improve", prompt: text.trim() };
  }

  // Refine commands
  if (/^(refine|refinar|revise|revisar|review|analise|analisar)\s/i.test(lower)) {
    return { type: "refine", prompt: text.trim() };
  }

  return { type: "chat", prompt: text.trim() };
}

// ─── AI Engines ──────────────────────────────────────────────

/** Route through api-key-router for OpenRouter keys */
async function sendViaOpenRouterPool(
  sc: SupabaseClient,
  supabaseUrl: string,
  serviceKey: string,
  prompt: string,
  systemPrompt: string,
  model = "anthropic/claude-sonnet-4",
): Promise<{ content: string | null; durationMs: number; error?: string }> {
  const t0 = Date.now();
  try {
    // Get key from api-key-router (round-robin pool)
    const keyRes = await fetch(`${supabaseUrl}/functions/v1/api-key-router`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ action: "get", provider: "openrouter" }),
    });
    const keyData = await keyRes.json();
    if (!keyRes.ok || !keyData?.key) {
      // Fallback to env var
      const envKey = Deno.env.get("OPENROUTER_API_KEY");
      if (!envKey) return { content: null, durationMs: Date.now() - t0, error: "No OpenRouter keys available" };
      return await directOpenRouter(envKey, prompt, systemPrompt, model, t0);
    }

    return await directOpenRouter(keyData.key, prompt, systemPrompt, model, t0);
  } catch (e) {
    return { content: null, durationMs: Date.now() - t0, error: (e as Error).message.slice(0, 120) };
  }
}

async function directOpenRouter(
  key: string, prompt: string, systemPrompt: string, model: string, t0: number
): Promise<{ content: string | null; durationMs: number; error?: string }> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://starble.lovable.app",
        "X-Title": "Cirius AI Chat",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 16000,
      }),
    });
    const durationMs = Date.now() - t0;
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return { content: null, durationMs, error: `HTTP ${res.status}: ${errBody.slice(0, 100)}` };
    }
    const result = await res.json();
    return { content: result?.choices?.[0]?.message?.content || null, durationMs };
  } catch (e) {
    return { content: null, durationMs: Date.now() - t0, error: (e as Error).message.slice(0, 120) };
  }
}

/** Gateway (Gemini) */
async function sendViaGateway(prompt: string, systemPrompt: string): Promise<{ content: string | null; durationMs: number; error?: string }> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  const t0 = Date.now();
  if (!key) return { content: null, durationMs: 0, error: "LOVABLE_API_KEY not set" };
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 16000,
      }),
    });
    const durationMs = Date.now() - t0;
    if (!res.ok) {
      if (res.status === 429) return { content: null, durationMs, error: "Rate limit exceeded" };
      if (res.status === 402) return { content: null, durationMs, error: "AI credits exhausted" };
      return { content: null, durationMs, error: `Gateway HTTP ${res.status}` };
    }
    const json = await res.json();
    return { content: json?.choices?.[0]?.message?.content || null, durationMs };
  } catch (e) {
    return { content: null, durationMs: Date.now() - t0, error: (e as Error).message.slice(0, 80) };
  }
}

/** Brainchain pool (cost-effective) */
async function sendViaBrainchain(
  supabaseUrl: string, serviceKey: string, anonKey: string,
  userId: string, message: string, brainType = "code",
): Promise<{ content: string | null; durationMs: number; error?: string }> {
  const t0 = Date.now();
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/brainchain-send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ user_id: userId, brain_type: brainType, message }),
    });
    const data = await res.json().catch(() => ({}));
    const durationMs = Date.now() - t0;
    if (res.ok && data?.ok && typeof data?.response === "string" && data.response.length > 0) {
      return { content: data.response, durationMs };
    }
    return { content: null, durationMs, error: data?.error || "Brainchain unavailable" };
  } catch (e) {
    return { content: null, durationMs: Date.now() - t0, error: (e as Error).message.slice(0, 80) };
  }
}

// ─── Prompts ─────────────────────────────────────────────────

const CODE_SYSTEM_PROMPT = `You are Cirius, an expert AI coding assistant specialised in React 18 + TypeScript + Tailwind CSS + shadcn/ui.

RESPONSE FORMAT — MANDATORY:
When you create or modify a file, wrap the COMPLETE file content with this XML tag:

<file path="src/components/Example.tsx">
// full file content here
</file>

RULES:
1. Always output the FULL file — never use "..." or "rest of code here".
2. If you modify an existing file, output the ENTIRE new version inside <file>.
3. You may create multiple files in one response — use one <file> tag per file.
4. Explain briefly BEFORE the code blocks what you are doing.
5. Use Tailwind utility classes for styling. Import from shadcn/ui when appropriate.
6. Use TypeScript with proper types.
7. Default exports for page components, named exports for utilities.
8. Keep code clean, modern, and production-ready.

TECH STACK:
- React 18 + TypeScript (JSX)
- Tailwind CSS 3
- Vite as bundler
- shadcn/ui component library`;

function buildPrdPrompt(prompt: string, projectName: string, existingFiles: Record<string, string>): string {
  const existingFilesList = Object.keys(existingFiles)
    .filter(f => !f.startsWith(".cirius/"))
    .slice(0, 30)
    .join(", ");

  return `IMPORTANTE: Não faça perguntas. Execute diretamente.

Você é um arquiteto de software sênior. O projeto "${projectName}" precisa de:

${prompt}

Arquivos existentes no projeto: ${existingFilesList || "(vazio)"}
Stack: React + Tailwind + shadcn/ui + Supabase

Quebre em 2-5 tarefas sequenciais. Retorne APENAS JSON válido:
{"tasks":[{"title":"Título curto","brain_type":"code","prompt":"Prompt detalhado e auto-contido de implementação completa"}],"summary":"Resumo em 1-2 frases do que será feito"}

Regras:
- brain_type: "code" | "design" | "prd"
- Prompts auto-contidos, detalhados, prontos para implementação
- Sem perguntas, sem clarificações
- Máximo 5 tarefas`;
}

function buildFixPrompt(prompt: string, files: Record<string, string>): string {
  const fileList = Object.entries(files)
    .filter(([p]) => !p.startsWith(".cirius/"))
    .slice(0, 20)
    .map(([p, c]) => `--- ${p} ---\n${c.slice(0, 3000)}`)
    .join("\n\n");

  return `Analise os arquivos do projeto e corrija o problema descrito:

${prompt}

ARQUIVOS ATUAIS:
${fileList.slice(0, 80000)}

Corrija todos os arquivos afetados usando o formato <file path="...">...</file>.
Explique brevemente o que foi corrigido antes dos blocos de código.`;
}

function buildImprovePrompt(prompt: string, files: Record<string, string>): string {
  const fileList = Object.entries(files)
    .filter(([p]) => !p.startsWith(".cirius/"))
    .slice(0, 20)
    .map(([p, c]) => `--- ${p} ---\n${c.slice(0, 3000)}`)
    .join("\n\n");

  return `Analise os arquivos do projeto e melhore/otimize conforme solicitado:

${prompt}

ARQUIVOS ATUAIS:
${fileList.slice(0, 80000)}

Retorne os arquivos melhorados usando <file path="...">...</file>.
Explique brevemente o que foi melhorado antes dos blocos de código.`;
}

function buildRefinePrompt(files: Record<string, string>, prdJson?: any): string {
  const fileList = Object.entries(files)
    .filter(([p]) => !p.startsWith(".cirius/"))
    .map(([p, c]) => `--- ${p} ---\n${c.slice(0, 5000)}`)
    .join("\n\n")
    .slice(0, 100000);

  let prdContext = "";
  if (prdJson?.tasks) {
    prdContext = `\nPRD Tasks:\n${prdJson.tasks.map((t: any, i: number) => `${i + 1}. ${t.title}: ${(t.prompt || "").slice(0, 100)}`).join("\n")}\n`;
  }

  return `Faça uma revisão holística completa do projeto:
${prdContext}
1. Verifique completude funcional vs PRD
2. Corrija imports quebrados
3. Garanta consistência de tipos TypeScript
4. Verifique rotas no App.tsx
5. Corrija handlers de estado
6. Garanta design responsivo

ARQUIVOS:
${fileList}

Retorne TODOS os arquivos corrigidos usando <file path="...">...</file>.`;
}

// ─── Summary Generator ──────────────────────────────────────

function generateSummary(
  commandType: CommandType,
  filesUpdated: number,
  filePaths: string[],
  rawContent: string,
): string {
  const actionMap: Record<CommandType, string> = {
    build: "🏗️ **Construção concluída**",
    fix: "🔧 **Correção aplicada**",
    improve: "✨ **Melhoria implementada**",
    refine: "🔍 **Refinamento completo**",
    chat: "💬 **Resposta**",
  };

  if (filesUpdated === 0) {
    // Extract text before any code blocks for chat-like responses
    const textBefore = rawContent.split(/<file\s/)[0]?.trim() || rawContent.slice(0, 500);
    return textBefore;
  }

  const header = actionMap[commandType];
  const fileListStr = filePaths.slice(0, 10).map(f => `  • \`${f}\``).join("\n");
  const moreFiles = filePaths.length > 10 ? `\n  • ... +${filePaths.length - 10} arquivos` : "";

  // Extract explanation text (before first <file> tag)
  const explanation = rawContent.split(/<file\s/)[0]?.trim().slice(0, 300) || "";

  return `${header}

${explanation ? explanation + "\n" : ""}
**${filesUpdated} arquivo(s) ${commandType === "fix" ? "corrigido(s)" : commandType === "improve" ? "melhorado(s)" : "atualizado(s)"}:**
${fileListStr}${moreFiles}`;
}

// ─── File Extraction ────────────────────────────────────────

function extractFileBlocks(text: string): Record<string, string> {
  const files: Record<string, string> = {};
  const re = /<file\s+path="([^"]+)">([\s\S]*?)<\/file>/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    const path = m[1].trim().replace(/^\.\//, "");
    const content = m[2].replace(/^\n/, "").replace(/\s+$/, "") + "\n";
    if (path && content.trim().length > 1) files[path] = content;
  }

  if (Object.keys(files).length === 0) {
    const cbRe = /```(?:\w+)?\s+((?:src|public|index|vite|tailwind|tsconfig|package)[^\n]*)\n([\s\S]*?)```/g;
    while ((m = cbRe.exec(text)) !== null) {
      const path = m[1].trim();
      const content = m[2].replace(/^\n/, "").replace(/\s+$/, "") + "\n";
      if (path.includes(".") && content.trim().length > 1) files[path] = content;
    }
  }

  return files;
}

// ─── PRD JSON Extraction ────────────────────────────────────

function extractPrdJSON(content: string): { tasks: Array<{ title: string; brain_type: string; prompt: string }>; summary?: string } | null {
  if (!content || content.length < 10) return null;
  let s = content.trim();
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) s = m[1].trim();
  const i = s.indexOf("{");
  if (i >= 0) s = s.slice(i);
  const j = s.lastIndexOf("}");
  if (j >= 0) s = s.slice(0, j + 1);
  try {
    const parsed = JSON.parse(s);
    if (parsed.tasks && Array.isArray(parsed.tasks) && parsed.tasks.length > 0) return parsed;
  } catch { /* invalid */ }
  return null;
}

// ─── Orchestrator Integration ───────────────────────────────

async function dispatchToOrchestrator(
  sc: SupabaseClient,
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
  projectId: string,
  prd: { tasks: Array<{ title: string; brain_type: string; prompt: string }>; summary?: string },
  projectName: string,
): Promise<{ orchestratorId: string; taskCount: number } | null> {
  try {
    // Create orchestrator project
    const { data: orchProject, error: orchErr } = await sc.from("orchestrator_projects").insert({
      user_id: userId,
      client_prompt: prd.summary || projectName,
      status: "paused",
      total_tasks: prd.tasks.length,
      prd_json: prd,
    }).select("id").single();

    if (orchErr || !orchProject) return null;

    // Get a brain project for execution
    const { data: bcAccount } = await sc.from("brainchain_accounts")
      .select("brain_project_id")
      .eq("is_active", true)
      .eq("is_busy", false)
      .lt("error_count", 5)
      .not("brain_project_id", "is", null)
      .order("last_used_at", { ascending: true, nullsFirst: true })
      .limit(1)
      .maybeSingle();

    if (bcAccount?.brain_project_id) {
      await sc.from("orchestrator_projects").update({
        lovable_project_id: bcAccount.brain_project_id,
      }).eq("id", orchProject.id);
    }

    // Build context prefix
    const prdContext = `[CONTEXTO DO PROJETO]\nNome: ${projectName}\n\n[PRD]\n${prd.tasks.map((t, i) => `${i + 1}. ${t.title}`).join("\n")}\n\n`;

    // Insert tasks
    const taskInserts = prd.tasks.map((t, i) => ({
      project_id: orchProject.id,
      task_index: i,
      title: t.title,
      intent: "security_fix_v2",
      prompt: prdContext + `[SUA TAREFA: ${t.title}]\n\n${t.prompt}`,
      brain_type: t.brain_type || "code",
    }));

    await sc.from("orchestrator_tasks").insert(taskInserts);

    // Link to cirius project
    await sc.from("cirius_projects").update({
      orchestrator_project_id: orchProject.id,
      status: "generating_code",
      progress_pct: 25,
    }).eq("id", projectId);

    // Fire orchestrator-tick
    fetch(`${supabaseUrl}/functions/v1/orchestrator-tick`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ _auto_trigger: true }),
    }).catch(() => {});

    return { orchestratorId: orchProject.id, taskCount: prd.tasks.length };
  } catch (e) {
    console.error("[cirius-ai-chat] orchestrator dispatch error:", e);
    return null;
  }
}

// ─── Main Handler ───────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, project_id, mode } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let userId: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      userId = user?.id || null;
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load project files
    let projectFiles: Record<string, string> = {};
    let projectName = "Cirius Project";
    let projectPrd: any = null;

    if (project_id) {
      const { data: proj } = await supabase
        .from("cirius_projects")
        .select("source_files_json, name, prd_json")
        .eq("id", project_id)
        .maybeSingle();

      if (proj) {
        if (proj.source_files_json && typeof proj.source_files_json === "object") {
          projectFiles = proj.source_files_json as Record<string, string>;
        }
        projectName = proj.name || projectName;
        projectPrd = proj.prd_json;
      }
    }

    // Detect command type from latest user message
    const latestMsg = messages[messages.length - 1]?.content || "";
    const command = detectCommand(latestMsg);

    console.log(`[cirius-ai-chat] Command: ${command.type}, Project: ${project_id?.slice(0, 8)}, Mode: ${mode || "auto"}`);

    let assistantContent = "";
    let provider = "brainchain";
    let orchestratorResult: { orchestratorId: string; taskCount: number } | null = null;

    // ═══════════════════════════════════════════════════════════
    // BUILD COMMAND → Generate PRD → Dispatch to Orchestrator
    // ═══════════════════════════════════════════════════════════
    if (command.type === "build" && project_id) {
      // Step 1: Generate PRD via OpenRouter (Claude) for quality
      const prdPrompt = buildPrdPrompt(command.prompt, projectName, projectFiles);

      let prd: { tasks: Array<{ title: string; brain_type: string; prompt: string }>; summary?: string } | null = null;

      // Try OpenRouter pool first (Claude for better PRD quality)
      const orResult = await sendViaOpenRouterPool(supabase, supabaseUrl, serviceRoleKey, prdPrompt,
        "Return only valid JSON, no markdown fences. No questions.", "anthropic/claude-sonnet-4");

      if (orResult.content) {
        prd = extractPrdJSON(orResult.content);
        provider = "openrouter_claude";
      }

      // Fallback to Brainchain
      if (!prd) {
        const bcResult = await sendViaBrainchain(supabaseUrl, serviceRoleKey, anonKey, userId, prdPrompt);
        if (bcResult.content) {
          prd = extractPrdJSON(bcResult.content);
          provider = "brainchain";
        }
      }

      // Fallback to Gateway
      if (!prd) {
        const gwResult = await sendViaGateway(prdPrompt, "Return only valid JSON, no markdown fences.");
        if (gwResult.content) {
          prd = extractPrdJSON(gwResult.content);
          provider = "gateway";
        }
      }

      if (prd && prd.tasks.length > 0) {
        // Step 2: Dispatch to Orchestrator for parallel Brain execution
        orchestratorResult = await dispatchToOrchestrator(
          supabase, supabaseUrl, serviceRoleKey,
          userId, project_id, prd, projectName,
        );

        // Save PRD to project
        await supabase.from("cirius_projects").update({
          prd_json: prd,
        }).eq("id", project_id);

        const taskList = prd.tasks.map((t, i) => `${i + 1}. **${t.title}** _(${t.brain_type})_`).join("\n");

        assistantContent = `🚀 **Pipeline de construção iniciado!**

${prd.summary || "Gerando código para sua solicitação..."}

**${prd.tasks.length} tarefas distribuídas para os Brains:**
${taskList}

${orchestratorResult
  ? `⚡ Orquestrador ativo (ID: \`${orchestratorResult.orchestratorId.slice(0, 8)}\`). Progresso aparecerá automaticamente.`
  : "⏳ Aguardando disponibilidade de Brain..."}

_O código será minerado, montado e refinado automaticamente._`;
      } else {
        assistantContent = "❌ Não consegui gerar o plano de construção. Tente reformular o pedido com mais detalhes.";
      }
    }

    // ═══════════════════════════════════════════════════════════
    // FIX / IMPROVE COMMANDS → Direct AI with project context
    // ═══════════════════════════════════════════════════════════
    else if ((command.type === "fix" || command.type === "improve") && project_id) {
      const prompt = command.type === "fix"
        ? buildFixPrompt(command.prompt, projectFiles)
        : buildImprovePrompt(command.prompt, projectFiles);

      const systemPrompt = CODE_SYSTEM_PROMPT + `\n\nCURRENT PROJECT FILES:\n${Object.keys(projectFiles).filter(f => !f.startsWith(".cirius/")).slice(0, 30).join(", ")}`;

      // Try Brainchain first (cost-effective), then OpenRouter, then Gateway
      const bcResult = await sendViaBrainchain(supabaseUrl, serviceRoleKey, anonKey, userId,
        `[SYSTEM]\n${systemPrompt}\n\n[USER]\n${prompt}`, "code");

      if (bcResult.content && bcResult.content.length > 50) {
        assistantContent = bcResult.content;
        provider = "brainchain";
      } else {
        const orResult = await sendViaOpenRouterPool(supabase, supabaseUrl, serviceRoleKey, prompt, systemPrompt);
        if (orResult.content) {
          assistantContent = orResult.content;
          provider = "openrouter";
        } else {
          const gwResult = await sendViaGateway(prompt, systemPrompt);
          assistantContent = gwResult.content || "";
          provider = "gateway";
        }
      }
    }

    // ═══════════════════════════════════════════════════════════
    // REFINE COMMAND → Holistic review with PRD context
    // ═══════════════════════════════════════════════════════════
    else if (command.type === "refine" && project_id) {
      const prompt = buildRefinePrompt(projectFiles, projectPrd);
      const systemPrompt = CODE_SYSTEM_PROMPT;

      // Refinement needs Claude for quality — use OpenRouter pool
      const orResult = await sendViaOpenRouterPool(supabase, supabaseUrl, serviceRoleKey, prompt, systemPrompt);
      if (orResult.content) {
        assistantContent = orResult.content;
        provider = "openrouter_claude";
      } else {
        const gwResult = await sendViaGateway(prompt, systemPrompt);
        assistantContent = gwResult.content || "";
        provider = "gateway";
      }
    }

    // ═══════════════════════════════════════════════════════════
    // CHAT → Conversational AI (Brainchain first)
    // ═══════════════════════════════════════════════════════════
    else {
      const filesContext = Object.keys(projectFiles).length > 0
        ? `\nPROJECT FILES:\n${Object.keys(projectFiles).filter(f => !f.startsWith(".cirius/")).slice(0, 30).join(", ")}`
        : "";

      const systemPrompt = CODE_SYSTEM_PROMPT + filesContext;
      const conversationText = messages
        .slice(-20)
        .map((m: any) => `${m.role.toUpperCase()}:\n${String(m.content || "").slice(0, 6000)}`)
        .join("\n\n");

      // Try Brainchain → OpenRouter → Gateway
      const bcResult = await sendViaBrainchain(supabaseUrl, serviceRoleKey, anonKey, userId,
        `[SYSTEM]\n${systemPrompt}\n\n[CONVERSATION]\n${conversationText}`, "code");

      if (bcResult.content && bcResult.content.length > 20) {
        assistantContent = bcResult.content;
        provider = "brainchain";
      } else {
        const orResult = await sendViaOpenRouterPool(supabase, supabaseUrl, serviceRoleKey,
          conversationText, systemPrompt, "anthropic/claude-sonnet-4");
        if (orResult.content) {
          assistantContent = orResult.content;
          provider = "openrouter";
        } else {
          const gwResult = await sendViaGateway(conversationText, systemPrompt);
          assistantContent = gwResult.content || "";
          provider = "gateway";
        }
      }
    }

    if (!assistantContent || assistantContent.trim().length < 2) {
      return new Response(JSON.stringify({ error: "Empty AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── File Extraction & Merge ────────────────────────────
    let filesUpdated = 0;
    let updatedPaths: string[] = [];

    if (project_id && command.type !== "build") {
      // For build commands, orchestrator handles file assembly
      let newFiles = extractFileBlocks(assistantContent);
      if (Object.keys(newFiles).length === 0) {
        newFiles = extractFilesFromMarkdown(assistantContent);
      }
      filesUpdated = Object.keys(newFiles).length;
      updatedPaths = Object.keys(newFiles);

      if (filesUpdated > 0) {
        const merged = { ...projectFiles, ...newFiles };
        await supabase
          .from("cirius_projects")
          .update({ source_files_json: merged, updated_at: new Date().toISOString() })
          .eq("id", project_id);
      }
    }

    // ─── Generate Summary for Chat ──────────────────────────
    const summary = generateSummary(command.type, filesUpdated, updatedPaths, assistantContent);

    // ─── Save Message ───────────────────────────────────────
    if (project_id) {
      await supabase.from("cirius_chat_messages").insert({
        project_id,
        user_id: userId,
        role: "assistant",
        content: summary,
        metadata: {
          command_type: command.type,
          provider,
          files_updated: filesUpdated,
          updated_paths: updatedPaths.slice(0, 20),
          orchestrator_id: orchestratorResult?.orchestratorId || null,
        },
      });

      // Append to project memory
      fetch(`${supabaseUrl}/functions/v1/brain-memory`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          action: "append",
          project_id,
          user_id: userId,
          content: `## ${command.type.toUpperCase()} — ${new Date().toISOString()}\n\n${latestMsg.slice(0, 200)}\n→ ${filesUpdated} files updated (${provider})`,
        }),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({
      ok: true,
      content: summary,
      raw_content: command.type !== "build" ? assistantContent : undefined,
      command_type: command.type,
      provider,
      files_updated: filesUpdated,
      updated_paths: updatedPaths,
      orchestrator: orchestratorResult || null,
      pipeline: command.type === "build" ? {
        status: orchestratorResult ? "executing" : "pending",
        task_count: orchestratorResult?.taskCount || 0,
      } : undefined,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("cirius-ai-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
