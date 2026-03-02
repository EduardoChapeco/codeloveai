import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Cirius, an expert AI coding assistant specialised in React 18 + TypeScript + Tailwind CSS + shadcn/ui.

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

CURRENT PROJECT FILES:
{PROJECT_FILES}`;

function formatFilesForPrompt(files: Record<string, string>): string {
  if (!files || Object.keys(files).length === 0) return "(empty project)";
  return Object.entries(files)
    .slice(0, 30)
    .map(([path, content]) => {
      const trimmed = content.length > 2000 ? content.slice(0, 2000) + "\n// ... (truncated)" : content;
      return `--- ${path} ---\n${trimmed}`;
    })
    .join("\n\n");
}

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

function buildConversationPayload(messages: Array<{ role: string; content: string }>, systemPrompt: string): string {
  const history = messages
    .slice(-20)
    .map((m) => `${m.role.toUpperCase()}:\n${String(m.content || "").slice(0, 8000)}`)
    .join("\n\n");

  return [
    "[SYSTEM INSTRUCTIONS]",
    systemPrompt,
    "",
    "[CONVERSATION CONTEXT]",
    history,
    "",
    "Generate the response now strictly in the required file-block format.",
  ].join("\n");
}

async function gatewayFallback(systemPrompt: string, messages: Array<{ role: string; content: string }>): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      stream: false,
      max_tokens: 16000,
    }),
  });

  if (!aiResp.ok) {
    const status = aiResp.status;
    if (status === 429) throw new Error("Rate limit exceeded. Try again shortly.");
    if (status === 402) throw new Error("AI credits exhausted. Add funds in workspace settings.");
    throw new Error("AI gateway error");
  }

  const json = await aiResp.json();
  return json?.choices?.[0]?.message?.content || "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, project_id } = await req.json();
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

    let projectFiles: Record<string, string> = {};
    let projectMemory = "";

    if (project_id) {
      const { data: proj } = await supabase
        .from("cirius_projects")
        .select("source_files_json")
        .eq("id", project_id)
        .maybeSingle();

      if (proj?.source_files_json && typeof proj.source_files_json === "object") {
        projectFiles = proj.source_files_json as Record<string, string>;
        projectMemory = (projectFiles[".cirius/knowledge/base.md"] || "").trim();
      }
    }

    const memorySection = projectMemory
      ? `\n\n[PROJECT MEMORY — Previous decisions, PRD, and context]\n${projectMemory.slice(0, 8000)}\n\nUse this memory to maintain consistency with previous architectural decisions.\n`
      : "";

    const systemPrompt = SYSTEM_PROMPT.replace("{PROJECT_FILES}", formatFilesForPrompt(projectFiles)) + memorySection;
    const composedMessage = buildConversationPayload(messages, systemPrompt);

    let assistantContent = "";
    let provider: "brainchain" | "gateway_fallback" = "brainchain";

    const brainchainResp = await fetch(`${supabaseUrl}/functions/v1/brainchain-send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({
        user_id: userId,
        brain_type: "code",
        message: composedMessage,
      }),
    });

    const brainchainData = await brainchainResp.json().catch(() => ({}));

    if (brainchainResp.ok && brainchainData?.ok && typeof brainchainData?.response === "string" && brainchainData.response.length > 0) {
      assistantContent = brainchainData.response;
    } else {
      provider = "gateway_fallback";
      assistantContent = await gatewayFallback(systemPrompt, messages);
    }

    if (!assistantContent || assistantContent.trim().length < 2) {
      return new Response(JSON.stringify({ error: "Empty AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let filesUpdated = 0;
    if (project_id) {
      const newFiles = extractFileBlocks(assistantContent);
      filesUpdated = Object.keys(newFiles).length;

      if (filesUpdated > 0) {
        const merged = { ...projectFiles, ...newFiles };
        await supabase
          .from("cirius_projects")
          .update({ source_files_json: merged, updated_at: new Date().toISOString() })
          .eq("id", project_id);
      }

      await supabase.from("cirius_chat_messages").insert({
        project_id,
        user_id: userId,
        role: "assistant",
        content: assistantContent,
      });

      const summary = `**User:** ${messages[messages.length - 1]?.content?.slice(0, 200) || "..."}\n**Assistant:** ${assistantContent.slice(0, 300)}...`;
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
          content: `## Chat Interaction\n\n${summary}`,
        }),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({
      ok: true,
      content: assistantContent,
      provider,
      files_updated: filesUpdated,
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
