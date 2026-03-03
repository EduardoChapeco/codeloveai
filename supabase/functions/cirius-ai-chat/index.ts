/**
 * Cirius AI Chat v2 — With specialized templates + smart merge
 * Flow: Prompt → Classify → Template Selection → OpenRouter/Claude (streaming SSE) → Smart Merge → Update source_files_json
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractFilesFromMarkdown } from "../_shared/md-assembly.ts";
import { smartMergeFiles } from "../_shared/smart-merge.ts";
import { getCodeSystemPrompt, buildSpecializedPrdPrompt, type ProjectTemplateType } from "../_shared/cirius-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Command Detection ───────────────────────────────────────
type CommandType = "build" | "fix" | "improve" | "refine" | "add_feature" | "chat";

function detectCommand(text: string): { type: CommandType; prompt: string } {
  const lower = text.trim().toLowerCase();
  if (/^(crie|criar|cria|build|gere|gerar|construa|monte|implemente|faça|faz)\s/i.test(lower)) {
    return { type: "build", prompt: text.trim() };
  }
  if (/^(adicione|adicionar|add|insira|inserir|inclua|incluir|coloque|colocar)\s/i.test(lower)) {
    return { type: "add_feature", prompt: text.trim() };
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

// ─── Intent Classification (lightweight inline) ──────────────
type ProjectIntent = "landing_page" | "marketing_site" | "crud_system" | "dashboard" | "ecommerce" | "saas_app" | "api_only" | "component" | "custom";

interface LightBlueprint {
  intent: ProjectIntent;
  needsDatabase: boolean;
  needsAuth: boolean;
  supabaseTables: string[];
  features: string[];
}

const INTENT_KW: Record<ProjectIntent, string[]> = {
  landing_page: ["landing", "landing page", "lp", "squeeze", "hero", "captura"],
  marketing_site: ["site", "website", "institucional", "portfolio", "blog"],
  crud_system: ["sistema", "crud", "gerenciar", "cadastro", "tabela", "listagem", "formulario", "controle", "admin", "gestao"],
  dashboard: ["dashboard", "painel", "metricas", "relatorio", "analytics", "grafico", "kpi"],
  ecommerce: ["loja", "ecommerce", "produto", "carrinho", "cart", "checkout", "catalogo", "shop", "store"],
  saas_app: ["saas", "assinatura", "subscription", "billing", "multi-tenant", "pricing", "freemium"],
  api_only: ["api", "endpoint", "backend", "edge function", "webhook"],
  component: ["componente", "component", "widget", "botao", "modal"],
  custom: [],
};

function classifyLightIntent(prompt: string): LightBlueprint {
  const n = prompt.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, " ");
  let best: ProjectIntent = "custom";
  let bestScore = 0;
  for (const [intent, kws] of Object.entries(INTENT_KW) as [ProjectIntent, string[]][]) {
    let s = 0;
    for (const kw of kws) { if (n.includes(kw)) s += kw.length; }
    if (s > bestScore) { bestScore = s; best = intent; }
  }
  const needsDb = ["crud_system", "dashboard", "ecommerce", "saas_app"].includes(best);
  const needsAuth = needsDb;
  const tables: string[] = [];
  if (best === "crud_system") {
    const m = n.match(/(?:cadastro|tabela|gerenciar|crud)\s+(?:de\s+)?(\w+)/);
    tables.push(m ? m[1].replace(/s$/, "") : "items");
  } else if (best === "ecommerce") tables.push("products", "orders", "order_items", "customers");
  else if (best === "saas_app") tables.push("profiles", "plans", "subscriptions");
  const features: string[] = [];
  if (needsAuth) features.push("auth", "database");
  return { intent: best, needsDatabase: needsDb, needsAuth, supabaseTables: tables, features };
}

// ─── Prompt Builders ─────────────────────────────────────────

function buildAddFeaturePrompt(prompt: string, files: Record<string, string>, templateType: ProjectTemplateType): string {
  const systemPrompt = getCodeSystemPrompt(templateType);
  const fileList = Object.entries(files)
    .filter(([p]) => !p.startsWith(".cirius/"))
    .slice(0, 25)
    .map(([p, c]) => `<file path="${p}">\n${c.slice(0, 4000)}\n</file>`)
    .join("\n\n");

  return `${systemPrompt}

## IMPORTANT: You are ADDING a feature to an EXISTING project.
## NEVER remove or break existing functionality.
## If you need to update src/App.tsx, include ALL existing routes PLUS the new ones.
## If you need to update package.json, include ALL existing dependencies PLUS new ones.

## REQUEST:
${prompt}

## EXISTING PROJECT FILES (${Object.keys(files).length} files):
${fileList.slice(0, 100000)}

Return ALL new/modified files using <file path="...">COMPLETE content</file> tags.
Include the FULL content of any file you modify — never use "..." or placeholders.`;
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

Retorne os arquivos melhorados usando <file path="...">...</file>.`;
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
5. Garanta design responsivo

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
    const cbRe = /```(?:\w+)?\s+((?:src|public|index|vite|tailwind|tsconfig|package|supabase)[^\n]*)\n([\s\S]*?)```/g;
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

  if (opts.stream) return res;

  const d = Date.now() - t0;
  if (res.ok) {
    const r = await res.json();
    return { content: r?.choices?.[0]?.message?.content || null, durationMs: d };
  }
  const e = await res.text().catch(() => "");
  return { content: null, durationMs: d, error: `HTTP ${res.status}: ${e.slice(0, 100)}` };
}

// ─── AI Engine: Lovable AI Gateway — REMOVIDO (proibido para Cirius) ─────

// ─── Sequential Task Execution (Build Command) ──────────────

async function executeSequentialBuild(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  projectName: string,
  prd: { tasks: Array<{ title: string; brain_type: string; prompt: string }>; summary?: string },
  existingFiles: Record<string, string>,
  templateType: ProjectTemplateType,
): Promise<{ ok: boolean; files: Record<string, string>; tasksDone: number; error?: string }> {
  let currentFiles = { ...existingFiles };
  let tasksDone = 0;
  const totalTasks = prd.tasks.length;
  const codeSystemPrompt = getCodeSystemPrompt(templateType);

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
      ? `\n\nARQUIVOS JÁ GERADOS (${Object.keys(currentFiles).length} arquivos):\n${Object.entries(currentFiles).filter(([p]) => !p.startsWith(".cirius/")).slice(0, 25).map(([p, c]) => `<file path="${p}">\n${c.slice(0, 4000)}\n</file>`).join("\n\n")}`
      : "";

    const isFirstTask = i === 0;
    const foundationNote = isFirstTask
      ? `\n\nCRITICAL: This is the FIRST task. You MUST generate ALL foundation files:\n- index.html, src/main.tsx, src/App.tsx (with ALL routes), src/index.css\n- package.json, vite.config.ts, tailwind.config.js, tsconfig.json\n- Layout components (Header/Navbar, Footer)\n${templateType === "crud_system" || templateType === "ecommerce" || templateType === "saas_app" ? "- supabase/schema.sql with CREATE TABLE + RLS\n- src/lib/supabase.ts\n- src/contexts/AuthContext.tsx + Login/Register pages" : ""}`
      : `\n\nIMPORTANT: Previous files already exist. Maintain compatibility.\nIf adding routes, include the COMPLETE updated App.tsx with ALL existing + new routes.\nNEVER remove existing routes or imports.`;

    const taskPrompt = `You are building project "${projectName}".
Stack: React 18 + Vite 5 + TypeScript + Tailwind CSS 3 + shadcn/ui + React Router DOM + Supabase

## Current Task (${i + 1}/${totalTasks}): ${task.title}

${task.prompt}
${foundationNote}
${fileContext}

Return ALL files using <file path="path/to/file.tsx">COMPLETE file content</file> tags.
Output COMPLETE file content — never use "..." or placeholders.`;

    const messages = [
      { role: "system", content: codeSystemPrompt },
      { role: "user", content: taskPrompt },
    ];

    let result = await sendViaOpenRouter(messages);
    let content: string | null = null;
    let engine = "openrouter";

    if ("content" in result && result.content && result.content.length > 100) {
      content = result.content;
    }

    if (!content) {
      await supabase.from("cirius_generation_log").insert({
        project_id: projectId, step: `task_${i + 1}`, status: "failed",
        message: `Tarefa ${i + 1} falhou: sem resposta da IA`, level: "error",
      });
      continue;
    }

    let newFiles = extractFileBlocks(content);
    if (Object.keys(newFiles).length === 0) {
      newFiles = extractFilesFromMarkdown(content);
    }

    if (Object.keys(newFiles).length > 0) {
      // ── SMART MERGE instead of simple overwrite ──
      currentFiles = smartMergeFiles(currentFiles, newFiles);
      tasksDone++;

      await supabase.from("cirius_projects").update({
        source_files_json: currentFiles,
        updated_at: new Date().toISOString(),
      }).eq("id", projectId);

      await supabase.from("cirius_generation_log").insert({
        project_id: projectId, step: `task_${i + 1}`, status: "completed",
        message: `Tarefa ${i + 1} concluída: ${Object.keys(newFiles).length} arquivos via ${engine} (smart merge)`,
        level: "info", metadata: { file_count: Object.keys(newFiles).length, engine },
      });
    } else {
      await supabase.from("cirius_generation_log").insert({
        project_id: projectId, step: `task_${i + 1}`, status: "completed",
        message: `Tarefa ${i + 1}: resposta sem arquivos (texto/explicação)`, level: "warning",
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

    // Load project
    let projectFiles: Record<string, string> = {};
    let projectName = "Cirius Project";
    let projectPrd: any = null;
    let templateType: ProjectTemplateType = "custom";

    if (project_id) {
      const { data: proj } = await supabase
        .from("cirius_projects")
        .select("source_files_json, name, prd_json, template_type")
        .eq("id", project_id)
        .maybeSingle();

      if (proj) {
        if (proj.source_files_json && typeof proj.source_files_json === "object") {
          projectFiles = proj.source_files_json as Record<string, string>;
        }
        projectName = proj.name || projectName;
        projectPrd = proj.prd_json;
        templateType = (proj.template_type as ProjectTemplateType) || "custom";
      }
    }

    const latestMsg = messages[messages.length - 1]?.content || "";
    const command = detectCommand(latestMsg);
    console.log(`[cirius-ai-chat] Command: ${command.type}, Template: ${templateType}, Project: ${project_id?.slice(0, 8)}`);

    // ═══════════════════════════════════════════════════════════
    // BUILD COMMAND → PRD via Gemini Flash → Sequential Tasks via Claude
    // ═══════════════════════════════════════════════════════════
    if (command.type === "build" && project_id) {
      const blueprint = classifyLightIntent(command.prompt);
      if (templateType === "custom") templateType = blueprint.intent;

      const prdPrompt = buildSpecializedPrdPrompt(command.prompt, projectName, templateType, projectFiles, blueprint);
      const prdMessages = [
        { role: "system", content: "Return only valid JSON, no markdown fences." },
        { role: "user", content: prdPrompt },
      ];

      let prd: any = null;
      const orResult = await sendViaOpenRouter(prdMessages);
      if ("content" in orResult && orResult.content) prd = extractPrdJSON(orResult.content);

      if (!prd || !prd.tasks?.length) {
        return new Response(JSON.stringify({
          ok: true, content: "❌ Não consegui gerar o plano. Reformule com mais detalhes.",
          command_type: "build", provider: "claude_direct", files_updated: 0, updated_paths: [],
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await supabase.from("cirius_projects").update({
        prd_json: prd, status: "generating_code", progress_pct: 20,
        generation_started_at: new Date().toISOString(),
        generation_engine: "claude_direct", template_type: templateType,
      }).eq("id", project_id);

      const result = await executeSequentialBuild(
        supabase, userId, project_id, projectName, prd, projectFiles, templateType,
      );

      if (result.ok) {
        // Refine
        await supabase.from("cirius_projects").update({
          status: "refining", progress_pct: 85, current_step: "refining",
        }).eq("id", project_id);

        const codeSystemPrompt = getCodeSystemPrompt(templateType);
        const refineMessages = [
          { role: "system", content: codeSystemPrompt },
          { role: "user", content: buildRefinePrompt(result.files, prd) },
        ];

        let refinedFiles = result.files;
        const refResult = await sendViaOpenRouter(refineMessages);
        if ("content" in refResult && refResult.content) {
          const refFiles = extractFileBlocks(refResult.content);
          if (Object.keys(refFiles).length > 0) {
            refinedFiles = smartMergeFiles(refinedFiles, refFiles);
          }
        }

        await supabase.from("cirius_projects").update({
          source_files_json: refinedFiles, status: "live", progress_pct: 100,
          generation_ended_at: new Date().toISOString(), current_step: "completed",
        }).eq("id", project_id);

        await supabase.from("cirius_generation_log").insert({
          project_id: project_id, step: "complete", status: "completed",
          message: `Pipeline completo: ${Object.keys(refinedFiles).length} arquivos, ${result.tasksDone}/${prd.tasks.length} tarefas (template: ${templateType})`,
          level: "info",
        });

        const taskList = prd.tasks.map((t: any, i: number) => `${i + 1}. **${t.title}**`).join("\n");
        return new Response(JSON.stringify({
          ok: true,
          content: `🚀 **Projeto construído com sucesso!**\n\n${prd.summary || ""}\n\n**${result.tasksDone}/${prd.tasks.length} tarefas completadas:**\n${taskList}\n\n✅ ${Object.keys(refinedFiles).length} arquivos gerados.`,
          command_type: "build", provider: "claude_direct",
          files_updated: Object.keys(refinedFiles).length,
          updated_paths: Object.keys(refinedFiles),
          pipeline: { status: "completed", task_count: result.tasksDone, template: templateType },
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } else {
        await supabase.from("cirius_projects").update({
          status: "failed", error_message: "Nenhuma tarefa completou com sucesso",
        }).eq("id", project_id);

        return new Response(JSON.stringify({
          ok: false, content: "❌ O build falhou. Tente com um prompt mais detalhado.",
          command_type: "build", provider: "claude_direct", files_updated: 0, updated_paths: [],
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // ADD FEATURE COMMAND → Smart merge into existing project
    // ═══════════════════════════════════════════════════════════
    if (command.type === "add_feature" && project_id) {
      const featurePrompt = buildAddFeaturePrompt(command.prompt, projectFiles, templateType);
      const aiMessages = [
        { role: "system", content: getCodeSystemPrompt(templateType) },
        { role: "user", content: featurePrompt },
      ];

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

      if (!assistantContent) {
        return new Response(JSON.stringify({
          ok: false, content: "⚠️ Não consegui gerar a feature. Tente novamente.",
          command_type: "add_feature", files_updated: 0, updated_paths: [],
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let newFiles = extractFileBlocks(assistantContent);
      if (Object.keys(newFiles).length === 0) newFiles = extractFilesFromMarkdown(assistantContent);

      const filesUpdated = Object.keys(newFiles).length;
      const updatedPaths = Object.keys(newFiles);

      if (filesUpdated > 0) {
        // ── SMART MERGE ──
        const merged = smartMergeFiles(projectFiles, newFiles);
        await supabase.from("cirius_projects").update({
          source_files_json: merged, updated_at: new Date().toISOString(),
        }).eq("id", project_id);
      }

      const summary = filesUpdated > 0
        ? `✅ Feature adicionada! ${filesUpdated} arquivo(s) atualizado(s):\n${updatedPaths.slice(0, 10).map(f => `• \`${f}\``).join("\n")}`
        : assistantContent.split(/<file\s/)[0]?.trim().slice(0, 400) || assistantContent.slice(0, 400);

      if (project_id) {
        await supabase.from("cirius_chat_messages").insert({
          project_id, user_id: userId, role: "assistant", content: summary,
          metadata: { command_type: "add_feature", provider, files_updated: filesUpdated },
        });
      }

      return new Response(JSON.stringify({
        ok: true, content: summary, raw_content: assistantContent,
        command_type: "add_feature", provider,
        files_updated: filesUpdated, updated_paths: updatedPaths,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ═══════════════════════════════════════════════════════════
    // STREAMING SSE MODE (for chat/fix/improve/refine)
    // ═══════════════════════════════════════════════════════════

    const codeSystemPrompt = getCodeSystemPrompt(templateType);
    let userPrompt: string;
    if (command.type === "fix") {
      userPrompt = buildFixPrompt(command.prompt, projectFiles);
    } else if (command.type === "improve") {
      userPrompt = buildImprovePrompt(command.prompt, projectFiles);
    } else if (command.type === "refine") {
      userPrompt = buildRefinePrompt(projectFiles, projectPrd);
    } else {
      const filesContext = Object.keys(projectFiles).length > 0
        ? `\nPROJECT FILES (${Object.keys(projectFiles).length}):\n${Object.keys(projectFiles).filter(f => !f.startsWith(".cirius/")).slice(0, 30).join(", ")}` : "";
      userPrompt = messages.slice(-20)
        .map((m: any) => `${m.role.toUpperCase()}:\n${String(m.content || "").slice(0, 6000)}`)
        .join("\n\n") + filesContext;
    }

    const aiMessages = [
      { role: "system", content: codeSystemPrompt },
      { role: "user", content: userPrompt },
    ];

    if (wantStream) {
      try {
        const streamRes = await sendViaOpenRouter(aiMessages, { stream: true });
        if (streamRes instanceof Response && streamRes.ok && streamRes.body) {
          return new Response(streamRes.body, {
            headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
          });
        }
      } catch (e) {
        console.warn("[cirius-ai-chat] Streaming failed, falling back:", e);
      }
    }

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
        ok: false, error: "Empty AI response",
        content: "⚠️ Não consegui gerar resposta. Tente novamente.",
        command_type: command.type, provider, files_updated: 0, updated_paths: [],
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Extract and SMART MERGE files
    let filesUpdated = 0;
    let updatedPaths: string[] = [];
    if (project_id) {
      let newFiles = extractFileBlocks(assistantContent);
      if (Object.keys(newFiles).length === 0) newFiles = extractFilesFromMarkdown(assistantContent);
      filesUpdated = Object.keys(newFiles).length;
      updatedPaths = Object.keys(newFiles);
      if (filesUpdated > 0) {
        const merged = smartMergeFiles(projectFiles, newFiles);
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
      ok: false, error: e instanceof Error ? e.message : "Unknown error",
      content: "⚠️ O Cirius teve uma falha temporária. Tente novamente.",
      files_updated: 0, updated_paths: [],
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
