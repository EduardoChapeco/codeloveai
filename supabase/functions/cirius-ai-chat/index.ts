/**
 * Cirius AI Chat — 100% Claude/OpenRouter Direct Mode
 * No Brain mining, no Lovable API dependencies.
 * Flow: Prompt → OpenRouter/Claude (streaming SSE) → Extract <file> tags → Update source_files_json
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractFilesFromMarkdown } from "../_shared/md-assembly.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Command Detection ───────────────────────────────────────
type CommandType = "build" | "fix" | "improve" | "refine" | "chat";

function detectCommand(text: string): { type: CommandType; prompt: string } {
  const lower = text.trim().toLowerCase();
  if (/^(crie|criar|cria|build|gere|gerar|construa|monte|implemente|adicione|adicionar|faça|faz)\s/i.test(lower)) {
    return { type: "build", prompt: text.trim() };
  }
  if (/^(corrija|corrigir|fix|fixe|arrume|arrumar|conserte|consertar|debug)\s/i.test(lower)) {
    return { type: "fix", prompt: text.trim() };
  }
  if (/^(melhore|melhorar|improve|otimize|otimizar|refatore|refatorar|upgrade)\s/i.test(lower)) {
    return { type: "improve", prompt: text.trim() };
  }
  if (/^(refine|refinar|revise|revisar|review|analise|analisar)\s/i.test(lower)) {
    return { type: "refine", prompt: text.trim() };
  }
  return { type: "chat", prompt: text.trim() };
}

// ─── System Prompt ───────────────────────────────────────────

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
- shadcn/ui component library
- Supabase for backend (PostgreSQL + Auth + Storage)
- React Router DOM for routing`;

// ─── Prompt Builders ─────────────────────────────────────────

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

// ─── AI Engine: OpenRouter (Claude) ─────────────────────────

async function sendViaOpenRouter(
  messages: Array<{ role: string; content: string }>,
  opts: { stream?: boolean; maxTokens?: number } = {},
): Promise<Response | { content: string | null; durationMs: number; error?: string }> {
  const key = Deno.env.get("OPENROUTER_API_KEY");
  const t0 = Date.now();
  if (!key) return { content: null, durationMs: 0, error: "OPENROUTER_API_KEY not set" };

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://starble.lovable.app",
      "X-Title": "Cirius AI Editor",
    },
    body: JSON.stringify({
      model: "anthropic/claude-sonnet-4",
      messages,
      temperature: 0.3,
      max_tokens: opts.maxTokens || 16000,
      stream: opts.stream || false,
    }),
  });

  if (opts.stream) {
    return res; // Return raw response for SSE streaming
  }

  const d = Date.now() - t0;
  if (res.ok) {
    const r = await res.json();
    return { content: r?.choices?.[0]?.message?.content || null, durationMs: d };
  }
  const e = await res.text().catch(() => "");
  return { content: null, durationMs: d, error: `HTTP ${res.status}: ${e.slice(0, 100)}` };
}

// ─── AI Engine: Lovable AI Gateway (Gemini) ─────────────────

async function sendViaGateway(
  messages: Array<{ role: string; content: string }>,
  opts: { maxTokens?: number } = {},
): Promise<{ content: string | null; durationMs: number; error?: string }> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  const t0 = Date.now();
  if (!key) return { content: null, durationMs: 0, error: "LOVABLE_API_KEY not set" };

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        temperature: 0.3,
        max_tokens: opts.maxTokens || 16000,
      }),
    });
    const durationMs = Date.now() - t0;
    if (!res.ok) {
      const e = await res.text().catch(() => "");
      return { content: null, durationMs, error: `Gateway HTTP ${res.status}: ${e.slice(0, 100)}` };
    }
    const json = await res.json();
    return { content: json?.choices?.[0]?.message?.content || null, durationMs };
  } catch (e) {
    return { content: null, durationMs: Date.now() - t0, error: (e as Error).message.slice(0, 80) };
  }
}

// ─── Sequential Task Execution (Build Command) ──────────────

async function executeSequentialBuild(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  projectName: string,
  prd: { tasks: Array<{ title: string; brain_type: string; prompt: string }>; summary?: string },
  existingFiles: Record<string, string>,
): Promise<{ ok: boolean; files: Record<string, string>; tasksDone: number; error?: string }> {
  let currentFiles = { ...existingFiles };
  let tasksDone = 0;
  const totalTasks = prd.tasks.length;

  for (let i = 0; i < totalTasks; i++) {
    const task = prd.tasks[i];
    const progressPct = Math.round(20 + (60 * (i / totalTasks)));

    await supabase.from("cirius_projects").update({
      status: "generating_code",
      progress_pct: progressPct,
      current_step: `task_${i + 1}_of_${totalTasks}`,
    }).eq("id", projectId);

    await supabase.from("cirius_generation_log").insert({
      project_id: projectId,
      step: `task_${i + 1}`,
      status: "started",
      message: `Executando tarefa ${i + 1}/${totalTasks}: ${task.title}`,
      level: "info",
    });

    // Build context with existing files
    const fileContext = Object.keys(currentFiles).length > 0
      ? `\n\nARQUIVOS JÁ GERADOS (${Object.keys(currentFiles).length} arquivos):\n${Object.entries(currentFiles).filter(([p]) => !p.startsWith(".cirius/")).slice(0, 25).map(([p, c]) => `--- ${p} ---\n${c.slice(0, 3000)}`).join("\n\n")}`
      : "";

    const taskPrompt = `You are building project "${projectName}".
Stack: React 18 + Vite 5 + TypeScript + Tailwind CSS 3 + shadcn/ui + React Router DOM + Supabase

## Current Task (${i + 1}/${totalTasks}): ${task.title}

${task.prompt}
${fileContext}

Return ALL files using <file path="path/to/file.tsx">complete content</file> tags.
Output COMPLETE file content — never use "..." or placeholders.
If modifying existing files, output their FULL new version.`;

    const messages = [
      { role: "system", content: CODE_SYSTEM_PROMPT },
      { role: "user", content: taskPrompt },
    ];

    // Try OpenRouter (Claude) first, then Gateway
    let result = await sendViaOpenRouter(messages);
    let content: string | null = null;
    let engine = "openrouter";

    if ("content" in result && result.content && result.content.length > 100) {
      content = result.content;
    } else {
      const gwResult = await sendViaGateway(messages);
      if (gwResult.content && gwResult.content.length > 100) {
        content = gwResult.content;
        engine = "gateway";
      }
    }

    if (!content) {
      await supabase.from("cirius_generation_log").insert({
        project_id: projectId,
        step: `task_${i + 1}`,
        status: "failed",
        message: `Tarefa ${i + 1} falhou: sem resposta da IA`,
        level: "error",
      });
      continue; // Skip failed task, try next
    }

    // Extract files from response
    let newFiles = extractFileBlocks(content);
    if (Object.keys(newFiles).length === 0) {
      newFiles = extractFilesFromMarkdown(content);
    }

    if (Object.keys(newFiles).length > 0) {
      currentFiles = { ...currentFiles, ...newFiles };
      tasksDone++;

      // Persist intermediate result
      await supabase.from("cirius_projects").update({
        source_files_json: currentFiles,
        updated_at: new Date().toISOString(),
      }).eq("id", projectId);

      await supabase.from("cirius_generation_log").insert({
        project_id: projectId,
        step: `task_${i + 1}`,
        status: "completed",
        message: `Tarefa ${i + 1} concluída: ${Object.keys(newFiles).length} arquivos via ${engine}`,
        level: "info",
        metadata: { file_count: Object.keys(newFiles).length, engine },
      });
    } else {
      await supabase.from("cirius_generation_log").insert({
        project_id: projectId,
        step: `task_${i + 1}`,
        status: "completed",
        message: `Tarefa ${i + 1}: resposta sem arquivos (texto/explicação)`,
        level: "warning",
      });
    }
  }

  return { ok: tasksDone > 0, files: currentFiles, tasksDone };
}

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, project_id, stream: wantStream } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    const latestMsg = messages[messages.length - 1]?.content || "";
    const command = detectCommand(latestMsg);
    console.log(`[cirius-ai-chat] Command: ${command.type}, Project: ${project_id?.slice(0, 8)}, Claude Direct mode`);

    // ═══════════════════════════════════════════════════════════
    // BUILD COMMAND → PRD via Gemini Flash → Sequential Tasks via Claude
    // ═══════════════════════════════════════════════════════════
    if (command.type === "build" && project_id) {
      // Step 1: Generate PRD via Gemini Flash (fast/cheap)
      const prdPrompt = buildPrdPrompt(command.prompt, projectName, projectFiles);
      const prdMessages = [
        { role: "system", content: "Return only valid JSON, no markdown fences." },
        { role: "user", content: prdPrompt },
      ];

      const gwResult = await sendViaGateway(prdMessages);
      let prd: any = null;
      if (gwResult.content) prd = extractPrdJSON(gwResult.content);

      // Fallback: try OpenRouter for PRD
      if (!prd) {
        const orResult = await sendViaOpenRouter(prdMessages);
        if ("content" in orResult && orResult.content) prd = extractPrdJSON(orResult.content);
      }

      if (!prd || !prd.tasks?.length) {
        return new Response(JSON.stringify({
          ok: true, content: "❌ Não consegui gerar o plano. Reformule com mais detalhes.",
          command_type: "build", provider: "claude_direct", files_updated: 0, updated_paths: [],
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Save PRD
      await supabase.from("cirius_projects").update({
        prd_json: prd,
        status: "generating_code",
        progress_pct: 20,
        generation_started_at: new Date().toISOString(),
        generation_engine: "claude_direct",
      }).eq("id", project_id);

      // Step 2: Execute tasks sequentially via Claude
      const result = await executeSequentialBuild(
        supabase, userId, project_id, projectName, prd, projectFiles,
      );

      if (result.ok) {
        // Step 3: Refine holistically
        await supabase.from("cirius_projects").update({
          status: "refining",
          progress_pct: 85,
          current_step: "refining",
        }).eq("id", project_id);

        const refineMessages = [
          { role: "system", content: CODE_SYSTEM_PROMPT },
          { role: "user", content: buildRefinePrompt(result.files, prd) },
        ];

        let refinedFiles = result.files;
        const refResult = await sendViaOpenRouter(refineMessages);
        if ("content" in refResult && refResult.content) {
          const refFiles = extractFileBlocks(refResult.content);
          if (Object.keys(refFiles).length > 0) {
            refinedFiles = { ...refinedFiles, ...refFiles };
          }
        }

        await supabase.from("cirius_projects").update({
          source_files_json: refinedFiles,
          status: "live",
          progress_pct: 100,
          generation_ended_at: new Date().toISOString(),
          current_step: "completed",
        }).eq("id", project_id);

        await supabase.from("cirius_generation_log").insert({
          project_id: project_id,
          step: "complete",
          status: "completed",
          message: `Pipeline completo: ${Object.keys(refinedFiles).length} arquivos, ${result.tasksDone}/${prd.tasks.length} tarefas`,
          level: "info",
        });

        const taskList = prd.tasks.map((t: any, i: number) => `${i + 1}. **${t.title}**`).join("\n");
        return new Response(JSON.stringify({
          ok: true,
          content: `🚀 **Projeto construído com sucesso!**\n\n${prd.summary || ""}\n\n**${result.tasksDone}/${prd.tasks.length} tarefas completadas:**\n${taskList}\n\n✅ ${Object.keys(refinedFiles).length} arquivos gerados.`,
          command_type: "build",
          provider: "claude_direct",
          files_updated: Object.keys(refinedFiles).length,
          updated_paths: Object.keys(refinedFiles),
          pipeline: { status: "completed", task_count: result.tasksDone },
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } else {
        await supabase.from("cirius_projects").update({
          status: "failed",
          error_message: "Nenhuma tarefa completou com sucesso",
        }).eq("id", project_id);

        return new Response(JSON.stringify({
          ok: false, content: "❌ O build falhou. Tente com um prompt mais detalhado.",
          command_type: "build", provider: "claude_direct", files_updated: 0, updated_paths: [],
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // STREAMING SSE MODE (for chat/fix/improve/refine)
    // ═══════════════════════════════════════════════════════════

    // Build the prompt based on command type
    let userPrompt: string;
    if (command.type === "fix") {
      userPrompt = buildFixPrompt(command.prompt, projectFiles);
    } else if (command.type === "improve") {
      userPrompt = buildImprovePrompt(command.prompt, projectFiles);
    } else if (command.type === "refine") {
      userPrompt = buildRefinePrompt(projectFiles, projectPrd);
    } else {
      // Chat — include conversation history + project context
      const filesContext = Object.keys(projectFiles).length > 0
        ? `\nPROJECT FILES (${Object.keys(projectFiles).length}):\n${Object.keys(projectFiles).filter(f => !f.startsWith(".cirius/")).slice(0, 30).join(", ")}` : "";

      userPrompt = messages.slice(-20)
        .map((m: any) => `${m.role.toUpperCase()}:\n${String(m.content || "").slice(0, 6000)}`)
        .join("\n\n") + filesContext;
    }

    const aiMessages = [
      { role: "system", content: CODE_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ];

    // ─── Try streaming via OpenRouter ───
    if (wantStream) {
      try {
        const streamRes = await sendViaOpenRouter(aiMessages, { stream: true });
        if (streamRes instanceof Response && streamRes.ok && streamRes.body) {
          return new Response(streamRes.body, {
            headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
          });
        }
      } catch (e) {
        console.warn("[cirius-ai-chat] Streaming failed, falling back to sync:", e);
      }
    }

    // ─── Sync mode: OpenRouter → Gateway fallback ───
    let assistantContent = "";
    let provider = "gateway";

    const orResult = await sendViaOpenRouter(aiMessages);
    if ("content" in orResult && orResult.content && orResult.content.length > 10) {
      assistantContent = orResult.content;
      provider = "openrouter_claude";
    }

    if (!assistantContent || assistantContent.length < 10) {
      const gwResult = await sendViaGateway(aiMessages);
      if (gwResult.content && gwResult.content.length > 10) {
        assistantContent = gwResult.content;
        provider = "gateway_gemini";
      }
    }

    if (!assistantContent || assistantContent.trim().length < 2) {
      return new Response(JSON.stringify({
        ok: false,
        error: "Empty AI response",
        content: "⚠️ Não consegui gerar resposta. Tente novamente.",
        command_type: command.type, provider,
        files_updated: 0, updated_paths: [],
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── Extract files from response ───
    let filesUpdated = 0;
    let updatedPaths: string[] = [];
    if (project_id) {
      let newFiles = extractFileBlocks(assistantContent);
      if (Object.keys(newFiles).length === 0) {
        newFiles = extractFilesFromMarkdown(assistantContent);
      }
      filesUpdated = Object.keys(newFiles).length;
      updatedPaths = Object.keys(newFiles);
      if (filesUpdated > 0) {
        const merged = { ...projectFiles, ...newFiles };
        await supabase.from("cirius_projects").update({
          source_files_json: merged, updated_at: new Date().toISOString(),
        }).eq("id", project_id);
      }
    }

    const summary = filesUpdated > 0
      ? `${filesUpdated} arquivo(s) atualizado(s):\n${updatedPaths.slice(0, 10).map(f => `• \`${f}\``).join("\n")}`
      : assistantContent.split(/<file\s/)[0]?.trim().slice(0, 400) || assistantContent.slice(0, 400);

    if (project_id) {
      await supabase.from("cirius_chat_messages").insert({
        project_id, user_id: userId, role: "assistant", content: summary,
        metadata: { command_type: command.type, provider, files_updated: filesUpdated },
      });
    }

    return new Response(JSON.stringify({
      ok: true, content: summary, raw_content: assistantContent,
      command_type: command.type, provider,
      files_updated: filesUpdated, updated_paths: updatedPaths,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("cirius-ai-chat error:", e);
    return new Response(JSON.stringify({
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
      content: "⚠️ O Cirius teve uma falha temporária. Tente novamente.",
      files_updated: 0, updated_paths: [],
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
