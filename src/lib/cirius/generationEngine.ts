// ─── Generation Engine for Cirius ───────────────────────────────────────────
import { supabase } from "@/integrations/supabase/client";
import type { ProjectBlueprint } from "./intentClassifier";
import { generateSupabaseSchema } from "./intentClassifier";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GenerationParams {
  userPrompt: string;
  blueprint: ProjectBlueprint;
  projectName: string;
  userId: string;
  supabaseUrl: string;
  brainToken?: string;
}

export interface GenerationResult {
  status: "success" | "error" | "timeout";
  generatedCode?: string;
  files?: Array<{ path: string; content: string }>;
  lovableProjectId?: string;
  error?: string;
  duration: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function invokeEdge<T = any>(
  fnName: string,
  body: Record<string, unknown>,
): Promise<{ data: T | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke(fnName, {
    body,
  });
  if (error) return { data: null, error: error.message ?? String(error) };
  return { data: data as T, error: null };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Prompt Builder ─────────────────────────────────────────────────────────

export function buildGenerationPrompt(
  userPrompt: string,
  blueprint: ProjectBlueprint,
): string {
  const lines: string[] = [];

  lines.push("## Projeto solicitado pelo usuário");
  lines.push(`"${userPrompt}"`);
  lines.push("");

  // Project type instruction
  const intentLabel: Record<string, string> = {
    landing_page: "Landing Page (página única, sem backend)",
    marketing_site: "Site institucional multi-página",
    crud_system: "Sistema CRUD com banco de dados",
    dashboard: "Dashboard / Painel de métricas",
    ecommerce: "E-commerce / Loja virtual",
    saas_app: "Aplicação SaaS completa",
    api_only: "API / Edge Functions (sem frontend)",
    component: "Componente de UI isolado",
    custom: "Projeto personalizado",
  };
  lines.push(`## Tipo de projeto: ${intentLabel[blueprint.intent] ?? blueprint.intent}`);
  lines.push("");

  // Tech stack
  lines.push("## Stack técnica obrigatória");
  lines.push("- React 18 + Vite 5 + TypeScript");
  lines.push("- Tailwind CSS 3 + shadcn/ui components");
  lines.push("- React Router DOM para rotas");
  if (blueprint.needsDatabase || blueprint.needsAuth) {
    lines.push("- Supabase (banco de dados PostgreSQL + Auth + Storage)");
  }
  lines.push("");

  // Database schema
  if (blueprint.needsDatabase) {
    const schema = generateSupabaseSchema(blueprint);
    if (schema) {
      lines.push("## Schema do banco de dados (Supabase)");
      lines.push("```sql");
      lines.push(schema);
      lines.push("```");
      lines.push("");
    }
  }

  // Auth instructions
  if (blueprint.needsAuth) {
    lines.push("## Autenticação");
    lines.push("- Use Supabase Auth com email/senha");
    lines.push("- Crie páginas de Login e Registro");
    lines.push("- Proteja rotas autenticadas com redirect para /login");
    lines.push("- Use auth.uid() nas políticas RLS");
    lines.push("");
  }

  // Payments
  if (blueprint.needsPayments) {
    lines.push("## Pagamentos");
    lines.push("- Implemente fluxo de checkout");
    lines.push("- Crie página de planos/pricing se SaaS");
    lines.push("- Inclua status de pagamento e histórico");
    lines.push("");
  }

  // Rules
  lines.push("## Regras de geração");
  lines.push("- Retorne código COMPLETO e funcional, pronto para executar");
  lines.push("- NÃO use dados mock ou placeholder — conecte ao Supabase real");
  lines.push("- Cada arquivo deve ser delimitado com <file path=\"caminho/do/arquivo.tsx\">conteúdo</file>");
  lines.push("- Inclua todos os arquivos necessários: pages, components, hooks, lib, styles");
  lines.push("- Use design moderno, limpo e responsivo");
  lines.push("- Inclua loading states, empty states e tratamento de erros");
  lines.push("");

  // Features
  if (blueprint.features.length > 0) {
    lines.push("## Features detectadas");
    for (const f of blueprint.features) {
      lines.push(`- ${f}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ─── Engine: Brainchain (pool compartilhado, rápido) ────────────────────────

async function generateViaBrainchain(
  prompt: string,
  blueprint: ProjectBlueprint,
  userId: string,
): Promise<GenerationResult> {
  const start = Date.now();

  const { data, error } = await invokeEdge<{ queue_id?: string; id?: string }>(
    "brainchain-send",
    {
      message: prompt,
      brain_type: blueprint.suggestedSkill === "design" ? "design" : "code",
      user_id: userId,
    },
  );

  if (error || !data) {
    return { status: "error", error: error ?? "Brainchain returned empty", duration: Date.now() - start };
  }

  const queueId = data.queue_id ?? data.id;
  if (!queueId) {
    return { status: "error", error: "No queue_id returned from brainchain-send", duration: Date.now() - start };
  }

  // Poll for result — every 3s, up to 60s
  const maxAttempts = 20;
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(3000);

    const { data: statusData, error: statusErr } = await invokeEdge<{
      status?: string;
      response?: string;
    }>("brainchain-status", { queue_id: queueId });

    if (statusErr) continue;

    if (statusData?.status === "done" && statusData.response) {
      return {
        status: "success",
        generatedCode: statusData.response,
        files: parseFilesFromResponse(statusData.response),
        duration: Date.now() - start,
      };
    }

    if (statusData?.status === "error") {
      return {
        status: "error",
        error: statusData.response ?? "Brainchain task failed",
        duration: Date.now() - start,
      };
    }
  }

  return { status: "timeout", error: "Brainchain timeout after 60s", duration: Date.now() - start };
}

// ─── Engine: Brain (IA pessoal, especializada) ──────────────────────────────

async function generateViaBrain(
  prompt: string,
  blueprint: ProjectBlueprint,
  userId: string,
): Promise<GenerationResult> {
  const start = Date.now();

  const skillMap: Record<string, string> = {
    design: "design",
    code: "code",
    general: "general",
  };

  const { data, error } = await invokeEdge<{
    conversation_id?: string;
    output_id?: string;
  }>("brain", {
    action: "send",
    message: prompt,
    brain_type: skillMap[blueprint.suggestedSkill] ?? "code",
    user_id: userId,
  });

  if (error || !data) {
    return { status: "error", error: error ?? "Brain returned empty", duration: Date.now() - start };
  }

  const conversationId = data.conversation_id ?? data.output_id;
  if (!conversationId) {
    return { status: "error", error: "No conversation_id from brain", duration: Date.now() - start };
  }

  // Poll for result — every 5s, up to 120s
  const maxAttempts = 24;
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(5000);

    const { data: captureData, error: captureErr } = await invokeEdge<{
      status?: string;
      response?: string;
      content?: string;
    }>("brain", {
      action: "capture",
      conversation_id: conversationId,
      user_id: userId,
    });

    if (captureErr) continue;

    const content = captureData?.response ?? captureData?.content;
    if (captureData?.status === "done" && content) {
      return {
        status: "success",
        generatedCode: content,
        files: parseFilesFromResponse(content),
        duration: Date.now() - start,
      };
    }

    if (captureData?.status === "error") {
      return {
        status: "error",
        error: content ?? "Brain task failed",
        duration: Date.now() - start,
      };
    }
  }

  return { status: "timeout", error: "Brain timeout after 120s", duration: Date.now() - start };
}

// ─── Engine: Orchestrator (multi-task sequencial) ───────────────────────────

async function generateViaOrchestrator(
  prompt: string,
  blueprint: ProjectBlueprint,
  userId: string,
  projectName: string,
): Promise<GenerationResult> {
  const start = Date.now();

  const { data, error } = await invokeEdge<{
    project_id?: string;
    id?: string;
  }>("agentic-orchestrator", {
    action: "start",
    client_prompt: prompt,
    user_id: userId,
    project_name: projectName,
    intent: blueprint.intent,
    estimated_tasks: blueprint.estimatedTasks,
  });

  if (error || !data) {
    return { status: "error", error: error ?? "Orchestrator returned empty", duration: Date.now() - start };
  }

  const projectId = data.project_id ?? data.id;
  if (!projectId) {
    return { status: "error", error: "No project_id from orchestrator", duration: Date.now() - start };
  }

  // Poll for result — every 10s, up to 300s (5 min for complex projects)
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(10000);

    const { data: statusData, error: statusErr } = await invokeEdge<{
      status?: string;
      total_tasks?: number;
      completed_tasks?: number;
      failed_tasks?: number;
      result?: string;
      files?: Array<{ path: string; content: string }>;
    }>("agentic-orchestrator", {
      action: "status",
      project_id: projectId,
    });

    if (statusErr) continue;

    if (statusData?.status === "completed" || statusData?.status === "done") {
      return {
        status: "success",
        generatedCode: statusData.result ?? "",
        files: statusData.files ?? parseFilesFromResponse(statusData.result ?? ""),
        lovableProjectId: projectId,
        duration: Date.now() - start,
      };
    }

    if (statusData?.status === "failed") {
      return {
        status: "error",
        error: "Orchestrator project failed",
        lovableProjectId: projectId,
        duration: Date.now() - start,
      };
    }
  }

  return {
    status: "timeout",
    error: "Orchestrator timeout after 300s",
    lovableProjectId: projectId,
    duration: Date.now() - start,
  };
}

// ─── File parser ────────────────────────────────────────────────────────────

function parseFilesFromResponse(raw: string): Array<{ path: string; content: string }> {
  const files: Array<{ path: string; content: string }> = [];
  const regex = /<file\s+path="([^"]+)">([\s\S]*?)<\/file>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    files.push({ path: match[1], content: match[2].trim() });
  }
  return files;
}

// ─── Main entry ─────────────────────────────────────────────────────────────

export async function generateProject(params: GenerationParams): Promise<GenerationResult> {
  const { userPrompt, blueprint, projectName, userId } = params;
  const prompt = buildGenerationPrompt(userPrompt, blueprint);

  switch (blueprint.suggestedEngine) {
    case "brainchain":
      return generateViaBrainchain(prompt, blueprint, userId);

    case "brain":
      return generateViaBrain(prompt, blueprint, userId);

    case "orchestrator":
      return generateViaOrchestrator(prompt, blueprint, userId, projectName);

    default:
      // Fallback to brainchain
      return generateViaBrainchain(prompt, blueprint, userId);
  }
}
