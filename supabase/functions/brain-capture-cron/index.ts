import { createClient } from "npm:@supabase/supabase-js@2";
import { generateTypeId } from "../_shared/crypto.ts";

/**
 * brain-capture-cron — Polls Lovable projects for Brain responses
 * 
 * Runs every 30s via pg_cron. Finds all "processing" conversations,
 * polls their Lovable project source-code for brain-output.json / latest-message,
 * and updates the conversation with the captured response.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API = "https://api.lovable.dev";
const GIT_SHA = "3d7a3673c6f02b606137a12ddc0ab88f6b775113";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function lovFetch(url: string, token: string, opts: RequestInit = {}) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Origin: "https://lovable.dev",
    Referer: "https://lovable.dev/",
    "X-Client-Git-SHA": GIT_SHA,
    ...(opts.headers as Record<string, string> || {}),
  };
  if (opts.method === "POST" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  return fetch(url, { ...opts, headers });
}

async function extractResponseFromProject(
  projectId: string,
  token: string,
): Promise<string | null> {
  // Strategy 1: latest-message
  try {
    const res = await lovFetch(`${API}/projects/${projectId}/latest-message`, token, { method: "GET" });
    if (res.ok) {
      const msg = await res.json();
      if (msg && !msg.is_streaming && msg.role !== "user") {
        const content = msg.content || msg.message || msg.text || "";
        if (typeof content === "string" && content.trim().length > 20) {
          return content.trim();
        }
      }
    }
  } catch { /* continue */ }

  // Strategy 2: source-code files
  try {
    const res = await lovFetch(`${API}/projects/${projectId}/source-code`, token, { method: "GET" });
    if (!res.ok) return null;

    const rawText = await res.text();
    let parsed: any = {};
    try { parsed = JSON.parse(rawText); } catch { return null; }

    const files = parsed?.files || parsed?.data?.files || parsed?.source?.files || parsed;

    const getContent = (path: string): string | null => {
      if (Array.isArray(files)) {
        const f = files.find((f: any) => f.path === path);
        return f?.content || f?.source || null;
      }
      if (files && typeof files === "object") return files[path] || null;
      return null;
    };

    // Check brain-output.json
    const jsonContent = getContent("src/brain-output.json");
    if (jsonContent) {
      let clean = jsonContent.trim();
      if (clean.startsWith("```")) {
        clean = clean.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
      }
      try {
        const out = JSON.parse(clean);
        if (out?.status === "done" && typeof out?.response === "string" && out.response.length > 0) {
          return out.response;
        }
      } catch { /* not ready */ }
    }

    // Check .lovable/tasks/brain-response.md
    const mdContent = getContent(".lovable/tasks/brain-response.md");
    if (mdContent && /status:\s*done/i.test(mdContent)) {
      const parts = mdContent.split("---");
      if (parts.length >= 3) {
        const body = parts.slice(2).join("---").trim();
        if (body.length > 5) return body;
      }
    }

    // Strategy 3: Check any .md file in .lovable/tasks/ that has content
    if (Array.isArray(files)) {
      const taskFiles = files
        .filter((f: any) => f.path?.startsWith(".lovable/tasks/") && f.path?.endsWith(".md"))
        .sort((a: any, b: any) => (b.path || "").localeCompare(a.path || ""));
      
      for (const tf of taskFiles) {
        const content = tf.content || tf.source || "";
        if (content.length > 50 && /status:\s*(done|completed)/i.test(content)) {
          const parts = content.split("---");
          if (parts.length >= 3) {
            const body = parts.slice(2).join("---").trim();
            if (body.length > 10) return body;
          }
        }
      }
    }

    // Strategy 4: Check if any new edge function or SQL file was created (skill output)
    if (Array.isArray(files)) {
      const newFiles = files.filter((f: any) => {
        const p = f.path || "";
        return (
          (p.startsWith("supabase/functions/") && p.endsWith("/index.ts") && !p.includes("_shared")) ||
          (p.startsWith("supabase/migrations/") && p.endsWith(".sql")) ||
          (p === "src/brain-output.json")
        );
      });
      
      // If we find new edge functions or migrations, compile them as the response
      if (newFiles.length > 0) {
        const summary = newFiles.map((f: any) => {
          const content = (f.content || f.source || "").slice(0, 2000);
          return `### ${f.path}\n\`\`\`\n${content}\n\`\`\``;
        }).join("\n\n");
        
        if (summary.length > 50) return summary;
      }
    }
  } catch { /* continue */ }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sc = createClient(supabaseUrl, serviceKey);

  try {
    // Find all conversations in "processing" status (max 10 at a time)
    const { data: pending } = await sc
      .from("loveai_conversations")
      .select("id, user_id, target_project_id, created_at")
      .eq("status", "processing")
      .order("created_at", { ascending: true })
      .limit(10);

    if (!pending || pending.length === 0) {
      return json({ message: "No pending conversations", processed: 0 });
    }

    let captured = 0;
    let timedOut = 0;

    for (const convo of pending) {
      if (!convo.target_project_id) continue;

      // Check if conversation is too old (> 5 min = timeout)
      const age = Date.now() - new Date(convo.created_at).getTime();
      if (age > 300_000) {
        await sc.from("loveai_conversations")
          .update({ status: "timeout" })
          .eq("id", convo.id);
        timedOut++;
        continue;
      }

      // Get user's Lovable token
      const { data: account } = await sc
        .from("lovable_accounts")
        .select("token_encrypted")
        .eq("user_id", convo.user_id)
        .eq("status", "active")
        .maybeSingle();

      if (!account?.token_encrypted) continue;

      const response = await extractResponseFromProject(
        convo.target_project_id,
        account.token_encrypted,
      );

      if (response) {
        await sc.from("loveai_conversations").update({
          ai_response: response,
          status: "completed",
        }).eq("id", convo.id);
        captured++;
      }
    }

    return json({ processed: pending.length, captured, timedOut });
  } catch (err) {
    console.error("[brain-capture-cron] Error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
