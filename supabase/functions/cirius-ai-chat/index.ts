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
    const { data: orchProject, error: orchErr } = await sc.from("orchestrator_projects").insert({
      user_id: userId,
      client_prompt: prd.summary || projectName,
      status: "paused",
      total_tasks: prd.tasks.length,
      prd_json: prd,
    }).select("id").single();

    if (orchErr || !orchProject) return null;

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

    const prdContext = `[CONTEXTO DO PROJETO]\nNome: ${projectName}\n\n[PRD]\n${prd.tasks.map((t, i) => `${i + 1}. ${t.title}`).join("\n")}\n\n`;

    const taskInserts = prd.tasks.map((t, i) => ({
      project_id: orchProject.id,
      task_index: i,
      title: t.title,
      intent: "security_fix_v2",
      prompt: prdContext + `[SUA TAREFA: ${t.title}]\n\n${t.prompt}`,
      brain_type: t.brain_type || "code",
    }));

    await sc.from("orchestrator_tasks").insert(taskInserts);

    await sc.from("cirius_projects").update({
      orchestrator_project_id: orchProject.id,
      status: "generating_code",
      progress_pct: 25,
    }).eq("id", projectId);

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

// ─── SSE Streaming via Gateway ──────────────────────────────

async function streamViaGateway(prompt: string, systemPrompt: string): Promise<ReadableStream | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        stream: true,
        temperature: 0.3,
        max_tokens: 16000,
      }),
    });
    if (!res.ok || !res.body) return null;
    return res.body;
  } catch {
    return null;
  }
}

// Non-streaming fallbacks
async function sendViaOpenRouterPool(
  sc: SupabaseClient, supabaseUrl: string, serviceKey: string,
  prompt: string, systemPrompt: string, model = "anthropic/claude-sonnet-4",
): Promise<{ content: string | null; durationMs: number; error?: string }> {
  const t0 = Date.now();
  try {
    const keyRes = await fetch(`${supabaseUrl}/functions/v1/api-key-router`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ action: "get", provider: "openrouter" }),
    });
    const keyData = await keyRes.json();
    const apiKey = (keyRes.ok && keyData?.key) ? keyData.key : Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) return { content: null, durationMs: Date.now() - t0, error: "No OpenRouter keys" };
    return await directOpenRouter(apiKey, prompt, systemPrompt, model, t0);
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
        Authorization: `Bearer ${key}`, "Content-Type": "application/json",
        "HTTP-Referer": "https://starble.lovable.app", "X-Title": "Cirius AI Chat",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }],
        temperature: 0.3, max_tokens: 16000,
      }),
    });
    const durationMs = Date.now() - t0;
    if (!res.ok) return { content: null, durationMs, error: `HTTP ${res.status}` };
    const result = await res.json();
    return { content: result?.choices?.[0]?.message?.content || null, durationMs };
  } catch (e) {
    return { content: null, durationMs: Date.now() - t0, error: (e as Error).message.slice(0, 120) };
  }
}

async function sendViaGatewaySync(prompt: string, systemPrompt: string): Promise<{ content: string | null; durationMs: number; error?: string }> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  const t0 = Date.now();
  if (!key) return { content: null, durationMs: 0, error: "LOVABLE_API_KEY not set" };
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }],
        temperature: 0.3, max_tokens: 16000,
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

async function sendViaBrainchain(
  supabaseUrl: string, serviceKey: string, anonKey: string,
  userId: string, message: string, brainType = "code",
): Promise<{ content: string | null; durationMs: number; error?: string }> {
  const t0 = Date.now();
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/brainchain-send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}`, apikey: anonKey,
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

// ─── Brain Streaming SSE proxy ──────────────────────────────
async function streamViaBrainchain(
  supabaseUrl: string, serviceKey: string,
  userId: string, message: string, brainType = "code",
): Promise<ReadableStream | null> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/brainchain-stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ user_id: userId, brain_type: brainType, message }),
    });
    if (!res.ok || !res.body) return null;
    
    // Transform brain SSE events into OpenAI-compatible SSE format
    const brainStream = res.body;
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = "";

    return new ReadableStream({
      async start(controller) {
        const reader = brainStream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("event: delta")) continue;
              if (line.startsWith("event: status")) continue;
              if (line.startsWith("event: done")) continue;
              if (line.startsWith("event: error")) continue;
              if (!line.startsWith("data: ")) continue;

              const payload = line.slice(6).trim();
              try {
                const data = JSON.parse(payload);
                if (data.content) {
                  // Transform to OpenAI SSE format
                  const chunk = { choices: [{ delta: { content: data.content } }] };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                }
                if (data.error) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: data.error })}\n\n`));
                }
                if (data.success !== undefined) {
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                }
              } catch { /* skip non-json */ }
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch { /* stream error */ } finally {
          controller.close();
        }
      }
    });
  } catch {
    return null;
  }
}

// ─── Main Handler ───────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, project_id, mode, stream: wantStream } = await req.json();
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
    console.log(`[cirius-ai-chat] Command: ${command.type}, Project: ${project_id?.slice(0, 8)}, Stream: ${!!wantStream}`);

    // ═══════════════════════════════════════════════════════════
    // BUILD COMMAND → Generate PRD → Dispatch to Orchestrator
    // (Never streamed — returns JSON)
    // ═══════════════════════════════════════════════════════════
    if (command.type === "build" && project_id) {
      const prdPrompt = buildPrdPrompt(command.prompt, projectName, projectFiles);
      let prd: any = null;
      let provider = "brainchain";

      const orResult = await sendViaOpenRouterPool(supabase, supabaseUrl, serviceRoleKey, prdPrompt,
        "Return only valid JSON, no markdown fences. No questions.", "anthropic/claude-sonnet-4");
      if (orResult.content) { prd = extractPrdJSON(orResult.content); provider = "openrouter_claude"; }

      if (!prd) {
        const gwResult = await sendViaGatewaySync(prdPrompt, "Return only valid JSON, no markdown fences.");
        if (gwResult.content) { prd = extractPrdJSON(gwResult.content); provider = "gateway"; }
      }

      if (prd && prd.tasks.length > 0) {
        const orchestratorResult = await dispatchToOrchestrator(
          supabase, supabaseUrl, serviceRoleKey, userId, project_id, prd, projectName,
        );
        await supabase.from("cirius_projects").update({ prd_json: prd }).eq("id", project_id);
        const taskList = prd.tasks.map((t: any, i: number) => `${i + 1}. **${t.title}** _(${t.brain_type})_`).join("\n");
        const content = `🚀 **Pipeline de construção iniciado!**\n\n${prd.summary || ""}\n\n**${prd.tasks.length} tarefas distribuídas:**\n${taskList}`;

        return new Response(JSON.stringify({
          ok: true, content, command_type: "build", provider,
          files_updated: 0, updated_paths: [],
          orchestrator: orchestratorResult || null,
          pipeline: { status: orchestratorResult ? "executing" : "pending", task_count: orchestratorResult?.taskCount || 0 },
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } else {
        return new Response(JSON.stringify({
          ok: true, content: "❌ Não consegui gerar o plano. Reformule com mais detalhes.",
          command_type: "build", provider, files_updated: 0, updated_paths: [],
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // STREAMING PATH — chat, fix, improve, refine
    // ═══════════════════════════════════════════════════════════
    if (wantStream) {
      let prompt: string;
      let systemPrompt = CODE_SYSTEM_PROMPT;
      const filesContext = Object.keys(projectFiles).length > 0
        ? `\nPROJECT FILES:\n${Object.keys(projectFiles).filter(f => !f.startsWith(".cirius/")).slice(0, 30).join(", ")}`
        : "";

      if (command.type === "fix") {
        prompt = buildFixPrompt(command.prompt, projectFiles);
        systemPrompt += filesContext;
      } else if (command.type === "improve") {
        prompt = buildImprovePrompt(command.prompt, projectFiles);
        systemPrompt += filesContext;
      } else if (command.type === "refine") {
        prompt = buildRefinePrompt(projectFiles, projectPrd);
      } else {
        // chat
        systemPrompt += filesContext;
        prompt = messages.slice(-20)
          .map((m: any) => `${m.role.toUpperCase()}:\n${String(m.content || "").slice(0, 6000)}`)
          .join("\n\n");
      }

      // Try Brain streaming first (if use_brain_stream is set or as primary)
      const brainStream = await streamViaBrainchain(
        supabaseUrl, serviceRoleKey, userId!,
        `[SYSTEM]\n${systemPrompt}\n\n[USER]\n${prompt}`,
        command.type === "fix" || command.type === "improve" ? "code" : "general",
      );
      if (brainStream) {
        // Background: tee and collect for file extraction
        const [passThrough, collector] = brainStream.tee();

        (async () => {
          try {
            const reader = collector.getReader();
            const dec = new TextDecoder();
            let fullText = "";
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = dec.decode(value, { stream: true });
              for (const line of chunk.split("\n")) {
                if (!line.startsWith("data: ")) continue;
                const jsonStr = line.slice(6).trim();
                if (jsonStr === "[DONE]") continue;
                try {
                  const parsed = JSON.parse(jsonStr);
                  const c = parsed.choices?.[0]?.delta?.content;
                  if (c) fullText += c;
                } catch { /* partial */ }
              }
            }
            if (project_id && fullText.length > 10) {
              let newFiles = extractFileBlocks(fullText);
              if (Object.keys(newFiles).length === 0) newFiles = extractFilesFromMarkdown(fullText);
              if (Object.keys(newFiles).length > 0) {
                const merged = { ...projectFiles, ...newFiles };
                await supabase.from("cirius_projects").update({ source_files_json: merged, updated_at: new Date().toISOString() }).eq("id", project_id);
              }
              const summary = fullText.split(/<file\s/)[0]?.trim().slice(0, 400) || "Brain stream response";
              await supabase.from("cirius_chat_messages").insert({
                project_id, user_id: userId, role: "assistant", content: summary,
                metadata: { command_type: command.type, provider: "brain_stream", files_updated: Object.keys(newFiles || {}).length },
              });
            }
          } catch (e) { console.error("[cirius-ai-chat] brain stream save error:", e); }
        })();

        return new Response(passThrough, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      }

      // Fallback: Gateway streaming
      const stream = await streamViaGateway(prompt, systemPrompt);
      if (stream) {
        // Collect full response in background for file extraction + DB save
        const [passThrough, collector] = stream.tee();

        // Background: collect full text and save
        (async () => {
          try {
            const reader = collector.getReader();
            const decoder = new TextDecoder();
            let fullText = "";
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value, { stream: true });
              for (const line of chunk.split("\n")) {
                if (!line.startsWith("data: ")) continue;
                const jsonStr = line.slice(6).trim();
                if (jsonStr === "[DONE]") continue;
                try {
                  const parsed = JSON.parse(jsonStr);
                  const c = parsed.choices?.[0]?.delta?.content;
                  if (c) fullText += c;
                } catch { /* partial */ }
              }
            }

            // Extract and merge files
            if (project_id && fullText.length > 10) {
              let newFiles = extractFileBlocks(fullText);
              if (Object.keys(newFiles).length === 0) {
                newFiles = extractFilesFromMarkdown(fullText);
              }
              if (Object.keys(newFiles).length > 0) {
                const merged = { ...projectFiles, ...newFiles };
                await supabase.from("cirius_projects").update({
                  source_files_json: merged,
                  updated_at: new Date().toISOString(),
                }).eq("id", project_id);
              }

              // Save assistant message
              const summary = fullText.split(/<file\s/)[0]?.trim().slice(0, 400) || "Código atualizado";
              await supabase.from("cirius_chat_messages").insert({
                project_id, user_id: userId, role: "assistant", content: summary,
                metadata: { command_type: command.type, provider: "gateway_stream", files_updated: Object.keys(newFiles || {}).length },
              });
            }
          } catch (e) {
            console.error("[cirius-ai-chat] background save error:", e);
          }
        })();

        return new Response(passThrough, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      }
      // If stream fails, fall through to non-streaming
    }

    // ═══════════════════════════════════════════════════════════
    // NON-STREAMING FALLBACK for fix/improve/refine/chat
    // ═══════════════════════════════════════════════════════════
    let assistantContent = "";
    let provider = "brainchain";

    if ((command.type === "fix" || command.type === "improve") && project_id) {
      const prompt = command.type === "fix"
        ? buildFixPrompt(command.prompt, projectFiles)
        : buildImprovePrompt(command.prompt, projectFiles);
      const systemPrompt = CODE_SYSTEM_PROMPT + `\nCURRENT FILES:\n${Object.keys(projectFiles).slice(0, 30).join(", ")}`;

      const bcResult = await sendViaBrainchain(supabaseUrl, serviceRoleKey, anonKey, userId,
        `[SYSTEM]\n${systemPrompt}\n\n[USER]\n${prompt}`, "code");
      if (bcResult.content && bcResult.content.length > 50) {
        assistantContent = bcResult.content; provider = "brainchain";
      } else {
        const orResult = await sendViaOpenRouterPool(supabase, supabaseUrl, serviceRoleKey, prompt, systemPrompt);
        if (orResult.content) { assistantContent = orResult.content; provider = "openrouter"; }
        else {
          const gw = await sendViaGatewaySync(prompt, systemPrompt);
          assistantContent = gw.content || ""; provider = "gateway";
        }
      }
    } else if (command.type === "refine" && project_id) {
      const prompt = buildRefinePrompt(projectFiles, projectPrd);
      const orResult = await sendViaOpenRouterPool(supabase, supabaseUrl, serviceRoleKey, prompt, CODE_SYSTEM_PROMPT);
      if (orResult.content) { assistantContent = orResult.content; provider = "openrouter_claude"; }
      else {
        const gw = await sendViaGatewaySync(prompt, CODE_SYSTEM_PROMPT);
        assistantContent = gw.content || ""; provider = "gateway";
      }
    } else {
      const filesContext = Object.keys(projectFiles).length > 0
        ? `\nPROJECT FILES:\n${Object.keys(projectFiles).filter(f => !f.startsWith(".cirius/")).slice(0, 30).join(", ")}` : "";
      const systemPrompt = CODE_SYSTEM_PROMPT + filesContext;
      const conversationText = messages.slice(-20)
        .map((m: any) => `${m.role.toUpperCase()}:\n${String(m.content || "").slice(0, 6000)}`).join("\n\n");

      const bcResult = await sendViaBrainchain(supabaseUrl, serviceRoleKey, anonKey, userId,
        `[SYSTEM]\n${systemPrompt}\n\n[CONVERSATION]\n${conversationText}`, "code");
      if (bcResult.content && bcResult.content.length > 20) {
        assistantContent = bcResult.content; provider = "brainchain";
      } else {
        const orResult = await sendViaOpenRouterPool(supabase, supabaseUrl, serviceRoleKey,
          conversationText, systemPrompt, "anthropic/claude-sonnet-4");
        if (orResult.content) { assistantContent = orResult.content; provider = "openrouter"; }
        else {
          const gw = await sendViaGatewaySync(conversationText, systemPrompt);
          assistantContent = gw.content || ""; provider = "gateway";
        }
      }
    }

    if (!assistantContent || assistantContent.trim().length < 2) {
      return new Response(JSON.stringify({ error: "Empty AI response" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // File extraction & merge
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
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
