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
  const entries = Object.entries(files);
  // Limit context to avoid token overflow — send first 30 files, truncate large ones
  return entries
    .slice(0, 30)
    .map(([path, content]) => {
      const trimmed = content.length > 2000 ? content.slice(0, 2000) + "\n// ... (truncated)" : content;
      return `--- ${path} ---\n${trimmed}`;
    })
    .join("\n\n");
}

// Extract <file path="...">content</file> blocks from AI response
function extractFileBlocks(text: string): Record<string, string> {
  const files: Record<string, string> = {};
  const re = /<file\s+path="([^"]+)">([\s\S]*?)<\/file>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const path = m[1].trim().replace(/^\.\//, "");
    const content = m[2].replace(/^\n/, "").replace(/\s+$/, "") + "\n";
    if (path && content.trim().length > 1) files[path] = content;
  }
  // Fallback: ```lang path\ncontent```
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, project_id } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
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

    // Load project files for context
    let projectFiles: Record<string, string> = {};
    if (project_id) {
      const { data: proj } = await supabase
        .from("cirius_projects")
        .select("source_files_json")
        .eq("id", project_id)
        .maybeSingle();
      if (proj?.source_files_json) {
        projectFiles = proj.source_files_json as Record<string, string>;
      }
    }

    const systemPrompt = SYSTEM_PROMPT.replace("{PROJECT_FILES}", formatFilesForPrompt(projectFiles));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Call Lovable AI Gateway with streaming
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
          ...messages.map((m: any) => ({ role: m.role, content: m.content })),
        ],
        stream: true,
        max_tokens: 16000,
      }),
    });

    if (!aiResp.ok) {
      const status = aiResp.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in workspace settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResp.text();
      console.error("AI gateway error:", status, errText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // We need to collect the full response to extract files AND stream to client
    // Strategy: use a TransformStream to tee the response
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    let fullContent = "";

    // Process in background
    (async () => {
      try {
        const reader = aiResp.body!.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          // Pass through to client
          await writer.write(value);
          // Also collect for file extraction
          const chunk = decoder.decode(value, { stream: true });
          // Parse SSE lines to extract content
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (json === "[DONE]") continue;
            try {
              const parsed = JSON.parse(json);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) fullContent += delta;
            } catch { /* partial json */ }
          }
        }
      } catch (e) {
        console.error("Stream processing error:", e);
      } finally {
        // After stream completes, extract files and merge into project
        try {
          if (project_id && fullContent.length > 10) {
            const newFiles = extractFileBlocks(fullContent);
            if (Object.keys(newFiles).length > 0) {
              const merged = { ...projectFiles, ...newFiles };
              await supabase
                .from("cirius_projects")
                .update({ source_files_json: merged, updated_at: new Date().toISOString() })
                .eq("id", project_id);
              console.log(`Merged ${Object.keys(newFiles).length} files into project ${project_id}`);
            }

            // Persist assistant message
            await supabase.from("cirius_chat_messages").insert({
              project_id,
              user_id: userId,
              role: "assistant",
              content: fullContent,
            });
          }
        } catch (e) {
          console.error("Post-stream merge error:", e);
        }
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("cirius-ai-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
