import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * brain-capture-cron v4 — High-Frequency Response Miner
 * 
 * Polls Lovable Brain projects for responses using multiple strategies:
 * 1. src/brain-output.md (primary — frontmatter status:done)
 * 2. src/brain-output.json (legacy JSON format)
 * 3. .lovable/tasks/*.md (task files with status:done)
 * 4. latest-message API (direct AI message fallback)
 * 5. Source fingerprint change detection
 * 
 * Runs every 10-30s via pg_cron for near-realtime capture.
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
  if (!content) return null;
  // Must have status: done in frontmatter
  if (!/status:\s*done/i.test(content)) return null;
  
  const parts = content.split("---");
  if (parts.length >= 3) {
    const body = parts.slice(2).join("---").trim();
    // Strip code fences that wrap the entire body
    const cleaned = body
      .replace(/^```(?:markdown|md)?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
    if (cleaned.length > 10) return cleaned;
  }
  // Fallback: strip frontmatter block
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
    // Also accept { answer, content } shapes
    const text = out?.response || out?.answer || out?.content || out?.result;
    if (typeof text === "string" && text.length > 10 && out?.status === "done") {
      return text;
    }
  } catch { /* not valid JSON */ }
  return null;
}

function extractFromHtml(content: string): string | null {
  if (!content) return null;
  // Look for content inside <body> or <main> tags
  const bodyMatch = content.match(/<(?:body|main)[^>]*>([\s\S]*?)<\/(?:body|main)>/i);
  if (bodyMatch) {
    // Strip HTML tags for plain text, keep basic structure
    const text = bodyMatch[1]
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length > 30) return text;
  }
  return null;
}

/** Compute simple hash for fingerprint comparison */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString(36);
}

interface MineResult {
  response: string | null;
  fingerprint: string | null;
  source: string;
}

async function mineProjectResponse(projectId: string, token: string, prevFingerprint?: string | null): Promise<MineResult> {
  const noResult: MineResult = { response: null, fingerprint: prevFingerprint || null, source: "none" };

  // Strategy 1 (PRIMARY): latest-message API — most reliable
  try {
    const res = await lovFetch(`${API}/projects/${projectId}/latest-message`, token, { method: "GET" });
    if (res.ok) {
      const msg = await res.json();
      if (msg && !msg.is_streaming && msg.role !== "user") {
        const content = msg.content || msg.message || msg.text || "";
        if (typeof content === "string" && content.trim().length > 30) {
          return { response: content.trim(), fingerprint: null, source: "latest-message" };
        }
      }
    }
  } catch { /* continue to fallback */ }

  // Strategy 2: Mine source-code files (secondary — brain-output.md + tasks)
  try {
    const res = await lovFetch(`${API}/projects/${projectId}/source-code`, token, { method: "GET" });
    if (res.ok) {
      const raw = await res.text();
      
      const currentFp = simpleHash(raw);
      if (prevFingerprint && currentFp === prevFingerprint) {
        return { ...noResult, fingerprint: currentFp, source: "unchanged" };
      }

      let parsed: any = {};
      try { parsed = JSON.parse(raw); } catch { return { ...noResult, fingerprint: currentFp }; }

      const files = parsed?.files || parsed?.data?.files || parsed?.source?.files || parsed;

      const getContent = (path: string): string | null => {
        if (Array.isArray(files)) {
          const f = files.find((f: any) => f.path === path);
          return f?.content || f?.source || null;
        }
        if (files && typeof files === "object") return files[path] || null;
        return null;
      };

      // Check brain-output.md
      const mdResult = extractFromMd(getContent("src/brain-output.md") || "");
      if (mdResult) return { response: mdResult, fingerprint: currentFp, source: "brain-output.md" };

      // Check task files with status: done (newest first)
      if (Array.isArray(files)) {
        const taskFiles = files
          .filter((f: any) => f.path?.startsWith(".lovable/tasks/") && f.path?.endsWith(".md"))
          .sort((a: any, b: any) => (b.path || "").localeCompare(a.path || ""));

        for (const tf of taskFiles) {
          const content = tf.content || tf.source || "";
          const result = extractFromMd(content);
          if (result) return { response: result, fingerprint: currentFp, source: `tasks/${tf.path}` };
        }
      }

      return { ...noResult, fingerprint: currentFp, source: "no-match" };
    }
  } catch { /* continue */ }

  return noResult;
}

// ── Main handler ───────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sc = createClient(supabaseUrl, serviceKey);

  try {
    // Find all "processing" conversations (max 20 for higher throughput)
    const { data: pending } = await sc
      .from("loveai_conversations")
      .select("id, user_id, target_project_id, created_at")
      .eq("status", "processing")
      .order("created_at", { ascending: true })
      .limit(20);

    if (!pending || pending.length === 0) {
      return json({ message: "No pending conversations", processed: 0 });
    }

    let captured = 0;
    let timedOut = 0;
    let unchanged = 0;

    // Group conversations by user to avoid redundant token lookups
    const byUser = new Map<string, typeof pending>();
    for (const c of pending) {
      const list = byUser.get(c.user_id) || [];
      list.push(c);
      byUser.set(c.user_id, list);
    }

    for (const [userId, convos] of byUser) {
      // Get user's Lovable token once per user
      const { data: account } = await sc
        .from("lovable_accounts")
        .select("token_encrypted")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (!account?.token_encrypted) continue;

      // Get last known fingerprint for this user's brain project
      const { data: brain } = await sc
        .from("user_brain_projects")
        .select("lovable_project_id, source_fingerprint")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      for (const convo of convos) {
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

        const prevFp = brain?.source_fingerprint || null;
        const result = await mineProjectResponse(
          convo.target_project_id,
          account.token_encrypted,
          prevFp,
        );

        // Update fingerprint if changed
        if (result.fingerprint && result.fingerprint !== prevFp) {
          await sc.from("user_brain_projects")
            .update({ source_fingerprint: result.fingerprint })
            .eq("user_id", userId)
            .eq("status", "active");
        }

        if (result.source === "unchanged") {
          unchanged++;
          continue;
        }

        if (result.response) {
          await sc.from("loveai_conversations").update({
            ai_response: result.response,
            status: "completed",
          }).eq("id", convo.id);
          captured++;
          console.log(`[brain-capture] ✅ Captured from ${result.source} for convo ${convo.id.slice(0, 8)}`);
        }
      }
    }

    return json({ processed: pending.length, captured, timedOut, unchanged });
  } catch (err) {
    console.error("[brain-capture-cron] Error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
