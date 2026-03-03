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

// ═══════════════════════════════════════════════════════════════
// BRAIN-FIRST ENGINE: Send via Brain → Mine .md → Extract files
// Same pipeline as Star AI (proven, reliable)
// ═══════════════════════════════════════════════════════════════

const LOVABLE_API = "https://api.lovable.dev";
const GIT_SHA = "3d7a3673c6f02b606137a12ddc0ab88f6b775113";

function lovFetch(url: string, token: string, opts: RequestInit = {}) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Origin: "https://lovable.dev",
    Referer: "https://lovable.dev/",
    "X-Client-Git-SHA": GIT_SHA,
    ...(opts.headers as Record<string, string> || {}),
  };
  if ((opts.method === "POST" || opts.method === "PUT" || opts.method === "PATCH") && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  return fetch(url, { ...opts, headers });
}

/** Get user's Lovable token from lovable_accounts */
async function getUserLovableToken(sc: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await sc.from("lovable_accounts")
    .select("token_encrypted")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return data?.token_encrypted?.trim() || null;
}

/** Refresh Lovable token if expired */
async function refreshLovableToken(sc: SupabaseClient, userId: string): Promise<string | null> {
  try {
    const { data: acct } = await sc.from("lovable_accounts")
      .select("refresh_token_encrypted")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (!acct?.refresh_token_encrypted) return null;

    const fbKey = Deno.env.get("FIREBASE_API_KEY");
    if (!fbKey) return null;

    const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${fbKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(acct.refresh_token_encrypted)}`,
    });
    if (!res.ok) return null;

    const payload = await res.json();
    const newToken = payload.id_token || payload.access_token;
    if (!newToken) return null;

    await sc.from("lovable_accounts").update({
      token_encrypted: newToken,
      ...(payload.refresh_token ? { refresh_token_encrypted: payload.refresh_token } : {}),
    }).eq("user_id", userId).eq("status", "active");

    return newToken;
  } catch { return null; }
}

async function getValidLovableToken(sc: SupabaseClient, userId: string): Promise<string | null> {
  const token = await getUserLovableToken(sc, userId);
  if (!token) return null;
  try {
    const probe = await lovFetch(`${LOVABLE_API}/user/workspaces`, token, { method: "GET" });
    if (probe.ok) return token;
    if (probe.status === 401 || probe.status === 403) return await refreshLovableToken(sc, userId);
  } catch { /* keep current */ }
  return token;
}

/** Get user's active Brain project ID */
async function getUserBrainProject(sc: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await sc.from("user_brain_projects")
    .select("lovable_project_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .not("lovable_project_id", "like", "creating_%")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  return data?.lovable_project_id || null;
}

/** Send message to Brain via venus-chat (same as Brain.send) */
async function sendToBrain(
  supabaseUrl: string, serviceKey: string,
  projectId: string, token: string, message: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/venus-chat`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({
        task: message,
        project_id: projectId,
        mode: "task",
        lovable_token: token,
        skip_suffix: false,
      }),
    });
    clearTimeout(timer);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      return { ok: false, error: data?.error || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, error: String(e).slice(0, 80) };
  }
}

/** Parse latest-message SSE/JSON response */
function parseLatestMessage(rawText: string): { id: string; role: string; content: string; is_streaming: boolean } | null {
  try {
    let msgText = rawText;
    if (rawText.includes("data:")) {
      const lines = rawText.split("\n").filter(l => l.startsWith("data:"));
      if (lines.length > 0) msgText = lines[lines.length - 1].replace(/^data:\s*/, "");
    }
    const msg = JSON.parse(msgText);
    return {
      id: msg?.id || msg?.message_id || "",
      role: msg?.role || "",
      content: msg?.content || msg?.message || msg?.text || "",
      is_streaming: !!msg?.is_streaming,
    };
  } catch { return null; }
}

/** Extract file content from source-code response */
function extractFileContent(srcData: any, filePath: string): string | null {
  const files = srcData?.files || srcData?.data?.files || srcData?.source?.files || srcData;
  if (!files) return null;
  if (typeof files === "object" && !Array.isArray(files)) {
    if (typeof files[filePath] === "string") return files[filePath];
    if (files[filePath]?.content) return files[filePath].content;
  }
  if (Array.isArray(files)) {
    const f = files.find((f: any) => f.path === filePath);
    return f?.content || f?.source || null;
  }
  return null;
}

function extractMdBody(mdContent: string): string | null {
  const parts = mdContent.split("---");
  if (parts.length >= 3) {
    let body = parts.slice(2).join("---").trim();
    body = body.replace(/^```(?:markdown|md)?\s*/i, "").replace(/```\s*$/, "").trim();
    return body.length > 5 ? body : null;
  }
  const afterFm = mdContent.replace(/^---[\s\S]*?---\s*/m, "").trim();
  return afterFm.length > 5 ? afterFm : null;
}

function extractUpdateMdTimestamp(mdContent: string): number | null {
  const match = mdContent.match(/updated_at:\s*(\S+)/);
  if (!match) return null;
  const d = new Date(match[1]);
  return isNaN(d.getTime()) ? null : d.getTime();
}

/**
 * CORE: Mine response from Brain project (same captureResponse as Brain helpers)
 * Polls /chat/latest-message + source-code for src/update.md
 */
async function mineBrainResponse(
  projectId: string,
  token: string,
  maxWaitMs = 60_000,
  intervalMs = 4_000,
  initialDelayMs = 5_000,
  questionTs?: number,
): Promise<{ response: string | null; status: "completed" | "processing" | "timeout" }> {
  // Capture initial latest-message ID
  let initialMsgId: string | null = null;
  try {
    const initRes = await lovFetch(`${LOVABLE_API}/projects/${projectId}/chat/latest-message`, token, { method: "GET" });
    if (initRes.ok) {
      const msg = parseLatestMessage(await initRes.text());
      initialMsgId = msg?.id || null;
    }
  } catch { /* ignore */ }

  await new Promise(r => setTimeout(r, initialDelayMs));
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    // PRIMARY: /chat/latest-message
    try {
      const ctrl = new AbortController();
      const lmTimer = setTimeout(() => ctrl.abort(), 10_000);
      const latestRes = await fetch(`${LOVABLE_API}/projects/${projectId}/chat/latest-message`, {
        signal: ctrl.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          Origin: "https://lovable.dev",
          Referer: "https://lovable.dev/",
          "X-Client-Git-SHA": GIT_SHA,
        },
      });
      clearTimeout(lmTimer);

      if (latestRes.ok) {
        const msg = parseLatestMessage(await latestRes.text());
        if (msg && msg.role !== "user" && !msg.is_streaming && msg.id !== initialMsgId) {
          const content = (msg.content || "").trim();
          if (content.length > 30) {
            let cleaned = content.replace(/^---[\s\S]*?---\s*/m, "").trim();
            cleaned = cleaned.replace(/^```(?:markdown|md)?\s*/i, "").replace(/```\s*$/, "").trim();
            cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
            if (cleaned.length > 20) {
              console.log(`[cirius-brain] Got response via latest-message (${cleaned.length} chars)`);
              return { response: cleaned, status: "completed" };
            }
          }
        }
      }
    } catch { /* continue */ }

    // SECONDARY: source-code for src/update.md
    try {
      const srcRes = await lovFetch(`${LOVABLE_API}/projects/${projectId}/source-code`, token, { method: "GET" });
      if (srcRes.ok) {
        let srcData: any = {};
        try { srcData = JSON.parse(await srcRes.text()); } catch { /* ignore */ }

        const mdContent = extractFileContent(srcData, "src/update.md");
        if (mdContent && /status:\s*done/i.test(mdContent)) {
          const mdTs = extractUpdateMdTimestamp(mdContent);
          if (questionTs && mdTs && mdTs < questionTs) {
            // Stale — skip
          } else {
            const body = extractMdBody(mdContent);
            if (body && body.length > 20) {
              console.log(`[cirius-brain] Got response from update.md (${body.length} chars)`);
              return { response: body, status: "completed" };
            }
          }
        }
      }
    } catch { /* continue */ }

    await new Promise(r => setTimeout(r, intervalMs));
  }

  return { response: null, status: "timeout" };
}

// ─── Fallback: Gateway (sync, no streaming) ─────────────────

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
    if (!res.ok) return { content: null, durationMs, error: `Gateway HTTP ${res.status}` };
    const json = await res.json();
    return { content: json?.choices?.[0]?.message?.content || null, durationMs };
  } catch (e) {
    return { content: null, durationMs: Date.now() - t0, error: (e as Error).message.slice(0, 80) };
  }
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
    console.log(`[cirius-ai-chat] Command: ${command.type}, Project: ${project_id?.slice(0, 8)}, Brain-First mode`);

    // ═══════════════════════════════════════════════════════════
    // BUILD COMMAND → Generate PRD → Dispatch to Orchestrator
    // ═══════════════════════════════════════════════════════════
    if (command.type === "build" && project_id) {
      const prdPrompt = buildPrdPrompt(command.prompt, projectName, projectFiles);
      let prd: any = null;
      let provider = "gateway";

      // Use Gateway for PRD generation (fast, structured JSON)
      const gwResult = await sendViaGatewaySync(prdPrompt, "Return only valid JSON, no markdown fences.");
      if (gwResult.content) { prd = extractPrdJSON(gwResult.content); provider = "gateway"; }

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
    // BRAIN-FIRST: Route through user's Brain project
    // Same pipeline as Star AI — send → mine .md → extract files
    // ═══════════════════════════════════════════════════════════

    const lovableToken = await getValidLovableToken(supabase, userId);
    const brainProjectId = lovableToken ? await getUserBrainProject(supabase, userId) : null;

    let assistantContent = "";
    let provider = "gateway_fallback";
    const questionTs = Date.now();

    if (brainProjectId && lovableToken) {
      // ─── Build the prompt for the Brain ───
      let brainPrompt: string;
      const filesContext = Object.keys(projectFiles).length > 0
        ? `\n\nARQUIVOS DO PROJETO CIRIUS (${Object.keys(projectFiles).length} arquivos):\n${Object.entries(projectFiles).filter(([p]) => !p.startsWith(".cirius/")).slice(0, 15).map(([p, c]) => `--- ${p} ---\n${c.slice(0, 2000)}`).join("\n\n")}`
        : "";

      if (command.type === "fix") {
        brainPrompt = `${CODE_SYSTEM_PROMPT}\n\n${buildFixPrompt(command.prompt, projectFiles)}`;
      } else if (command.type === "improve") {
        brainPrompt = `${CODE_SYSTEM_PROMPT}\n\n${buildImprovePrompt(command.prompt, projectFiles)}`;
      } else if (command.type === "refine") {
        brainPrompt = `${CODE_SYSTEM_PROMPT}\n\n${buildRefinePrompt(projectFiles, projectPrd)}`;
      } else {
        // chat — include conversation history
        const conversationText = messages.slice(-10)
          .map((m: any) => `${m.role.toUpperCase()}:\n${String(m.content || "").slice(0, 4000)}`)
          .join("\n\n");
        brainPrompt = `${CODE_SYSTEM_PROMPT}${filesContext}\n\n[CONVERSA]\n${conversationText}`;
      }

      console.log(`[cirius-brain] Sending to Brain project=${brainProjectId.slice(0, 8)} (${brainPrompt.length} chars)`);

      // Send to Brain via venus-chat
      const sendResult = await sendToBrain(supabaseUrl, serviceRoleKey, brainProjectId, lovableToken, brainPrompt);

      if (sendResult.ok) {
        // Mine the response (same as Brain.capture)
        const mineResult = await mineBrainResponse(brainProjectId, lovableToken, 60_000, 4_000, 5_000, questionTs);

        if (mineResult.status === "completed" && mineResult.response) {
          assistantContent = mineResult.response;
          provider = "brain_md";
          console.log(`[cirius-brain] Brain response mined (${assistantContent.length} chars)`);
        } else {
          console.warn(`[cirius-brain] Brain mining ${mineResult.status}, falling back to Gateway`);
        }
      } else {
        console.warn(`[cirius-brain] Brain send failed: ${sendResult.error}, falling back to Gateway`);
      }
    }

    // ─── FALLBACK: Gateway sync (if Brain failed or unavailable) ───
    if (!assistantContent || assistantContent.trim().length < 10) {
      console.log(`[cirius-ai-chat] Fallback to Gateway sync`);
      let prompt: string;
      if (command.type === "fix") {
        prompt = buildFixPrompt(command.prompt, projectFiles);
      } else if (command.type === "improve") {
        prompt = buildImprovePrompt(command.prompt, projectFiles);
      } else if (command.type === "refine") {
        prompt = buildRefinePrompt(projectFiles, projectPrd);
      } else {
        const filesContext = Object.keys(projectFiles).length > 0
          ? `\nPROJECT FILES:\n${Object.keys(projectFiles).filter(f => !f.startsWith(".cirius/")).slice(0, 30).join(", ")}` : "";
        prompt = messages.slice(-20)
          .map((m: any) => `${m.role.toUpperCase()}:\n${String(m.content || "").slice(0, 6000)}`)
          .join("\n\n") + filesContext;
      }

      const gw = await sendViaGatewaySync(prompt, CODE_SYSTEM_PROMPT);
      if (gw.content) {
        assistantContent = gw.content;
        provider = "gateway";
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

    // ─── Extract files from response (supports <file> tags AND markdown fences) ───
    let filesUpdated = 0;
    let updatedPaths: string[] = [];
    if (project_id) {
      // Try <file> tags first, then md-assembly markdown parsing
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
