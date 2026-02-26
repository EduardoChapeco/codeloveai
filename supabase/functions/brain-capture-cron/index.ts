import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * brain-capture-cron v3 — Response Miner
 * 
 * Polls Lovable projects for Brain responses using src/brain-output.md (primary)
 * with fallbacks to .json and latest-message.
 * Runs every 30s via pg_cron.
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
  return fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      Origin: "https://lovable.dev",
      Referer: "https://lovable.dev/",
      "X-Client-Git-SHA": GIT_SHA,
      ...(opts.headers as Record<string, string> || {}),
    },
  });
}

// ── Mining strategies ──────────────────────────────────────────

function extractFromMd(content: string): string | null {
  if (!content || !/status:\s*done/i.test(content)) return null;
  const parts = content.split("---");
  if (parts.length >= 3) {
    const body = parts.slice(2).join("---").trim();
    if (body.length > 10) return body;
  }
  // Fallback: strip frontmatter
  const afterFm = content.replace(/^---[\s\S]*?---\s*/m, "").trim();
  return afterFm.length > 10 ? afterFm : null;
}

function extractFromJson(content: string): string | null {
  if (!content) return null;
  let clean = content.trim();
  if (clean.startsWith("```")) {
    clean = clean.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  }
  try {
    const out = JSON.parse(clean);
    if (out?.status === "done" && typeof out?.response === "string" && out.response.length > 0) {
      return out.response;
    }
  } catch { /* not valid */ }
  return null;
}

async function mineProjectResponse(projectId: string, token: string): Promise<string | null> {
  // Strategy 1: Mine source-code files
  try {
    const res = await lovFetch(`${API}/projects/${projectId}/source-code`, token, { method: "GET" });
    if (res.ok) {
      const raw = await res.text();
      let parsed: any = {};
      try { parsed = JSON.parse(raw); } catch { return null; }

      const files = parsed?.files || parsed?.data?.files || parsed?.source?.files || parsed;

      const getContent = (path: string): string | null => {
        if (Array.isArray(files)) {
          const f = files.find((f: any) => f.path === path);
          return f?.content || f?.source || null;
        }
        if (files && typeof files === "object") return files[path] || null;
        return null;
      };

      // Primary: src/brain-output.md
      const mdResult = extractFromMd(getContent("src/brain-output.md") || "");
      if (mdResult) return mdResult;

      // Fallback: src/brain-output.json (legacy)
      const jsonResult = extractFromJson(getContent("src/brain-output.json") || "");
      if (jsonResult) return jsonResult;

      // Fallback: .lovable/tasks/brain-response.md
      const taskResult = extractFromMd(getContent(".lovable/tasks/brain-response.md") || "");
      if (taskResult) return taskResult;

      // Fallback: any task .md with status: done
      if (Array.isArray(files)) {
        const taskFiles = files
          .filter((f: any) => f.path?.startsWith(".lovable/tasks/") && f.path?.endsWith(".md"))
          .sort((a: any, b: any) => (b.path || "").localeCompare(a.path || ""));

        for (const tf of taskFiles) {
          const content = tf.content || tf.source || "";
          const result = extractFromMd(content);
          if (result) return result;
        }
      }
    }
  } catch { /* continue */ }

  // Strategy 2: latest-message (last resort)
  try {
    const res = await lovFetch(`${API}/projects/${projectId}/latest-message`, token, { method: "GET" });
    if (res.ok) {
      const msg = await res.json();
      if (msg && !msg.is_streaming && msg.role !== "user") {
        const content = msg.content || msg.message || msg.text || "";
        if (typeof content === "string" && content.trim().length > 30) {
          return content.trim();
        }
      }
    }
  } catch { /* continue */ }

  return null;
}

// ── Main handler ───────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sc = createClient(supabaseUrl, serviceKey);

  try {
    // Find all "processing" conversations (max 10)
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

      // Timeout after 5 min
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

      const response = await mineProjectResponse(
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
