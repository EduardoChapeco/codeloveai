import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const API = "https://api.lovable.dev";
const GIT_SHA = "3d7a3673c6f02b606137a12ddc0ab88f6b775113";

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
}

async function readStream(body: ReadableStream<Uint8Array>, maxBytes = 500_000, timeoutMs = 5000): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let result = "";
  const deadline = Date.now() + timeoutMs;
  try {
    while (true) {
      if (Date.now() > deadline || result.length > maxBytes) break;
      const { done, value } = await Promise.race([
        reader.read(),
        new Promise<{ done: true; value: undefined }>((resolve) =>
          setTimeout(() => resolve({ done: true, value: undefined }), Math.max(100, deadline - Date.now()))
        ),
      ]);
      if (done || !value) break;
      result += decoder.decode(value, { stream: true });
    }
  } catch { /* stream error */ }
  try { reader.cancel(); } catch {}
  return result;
}

async function fetchText(url: string, token: string, connectMs = 5000, bodyMs = 5000): Promise<{ status: number; body: string } | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), connectMs);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        Origin: "https://lovable.dev",
        Referer: "https://lovable.dev/",
        "X-Client-Git-SHA": GIT_SHA,
      },
    });
    clearTimeout(timer);
    if (!r.body) return { status: r.status, body: "" };
    const body = await readStream(r.body, 800_000, bodyMs);
    return { status: r.status, body };
  } catch (e) {
    clearTimeout(timer);
    console.log(`[bc] fetch-err ${url.replace(API, "").slice(0, 50)}: ${String(e).slice(0, 80)}`);
    return null;
  }
}

function extractMdBody(c: string): string | null {
  if (!c) return null;
  const p = c.split("---");
  if (p.length >= 3) {
    let b = p.slice(2).join("---").trim();
    b = b.replace(/^```(?:markdown|md)?\s*/i, "").replace(/```\s*$/, "").trim();
    return b.length > 5 ? b : null;
  }
  const a = c.replace(/^---[\s\S]*?---\s*/m, "").trim();
  return a.length > 5 ? a : null;
}

/** Deep-search for brain-output.md in any structure */
function findBrainMd(obj: any, target = "src/brain-output.md"): string | null {
  if (!obj || typeof obj !== "object") return null;

  // Direct key match: { "src/brain-output.md": "content" | { content: "..." } }
  if (obj[target]) {
    const v = obj[target];
    if (typeof v === "string") return v;
    if (typeof v === "object") return v.content || v.source || v.code || null;
  }

  // Array of { path, content } or { name, content }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (!item || typeof item !== "object") continue;
      const p = item.path || item.name || item.file_path || "";
      if (p === target || p.endsWith("brain-output.md")) {
        const c = item.content || item.source || item.code;
        if (typeof c === "string") return c;
      }
    }
    return null;
  }

  // Check common wrappers: files, data, source, source_code, project
  for (const key of ["files", "data", "source", "source_code", "project", "code"]) {
    if (obj[key]) {
      const result = findBrainMd(obj[key], target);
      if (result) return result;
    }
  }

  // Last resort: scan all keys ending with brain-output.md
  for (const key of Object.keys(obj)) {
    if (key.endsWith("brain-output.md")) {
      const v = obj[key];
      if (typeof v === "string") return v;
      if (typeof v === "object") return v?.content || v?.source || null;
    }
  }

  return null;
}

/** Describe structure for diagnostics */
function describeStructure(obj: any, depth = 0): string {
  if (depth > 2) return typeof obj;
  if (obj === null || obj === undefined) return "null";
  if (typeof obj === "string") return `str(${obj.length})`;
  if (typeof obj === "number" || typeof obj === "boolean") return String(obj);
  if (Array.isArray(obj)) {
    const sample = obj.length > 0 ? describeStructure(obj[0], depth + 1) : "empty";
    return `arr[${obj.length}](${sample})`;
  }
  if (typeof obj === "object") {
    const keys = Object.keys(obj);
    const sample = keys.slice(0, 6).map(k => `${k}:${describeStructure(obj[k], depth + 1)}`).join(", ");
    return `{${keys.length}keys: ${sample}}`;
  }
  return typeof obj;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const sc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { data: pending } = await sc.from("loveai_conversations")
      .select("id, user_id, target_project_id, created_at")
      .eq("status", "processing").order("created_at", { ascending: true }).limit(5);
    if (!pending?.length) return json({ processed: 0 });
    console.log(`[bc] ${pending.length} pending`);

    let captured = 0, timedOut = 0;
    const byUser = new Map<string, typeof pending>();
    for (const c of pending) { const l = byUser.get(c.user_id) || []; l.push(c); byUser.set(c.user_id, l); }

    for (const [userId, convos] of byUser) {
      const { data: acct } = await sc.from("lovable_accounts")
        .select("token_encrypted").eq("user_id", userId).eq("status", "active").maybeSingle();
      if (!acct?.token_encrypted) { console.log(`[bc] no-token`); continue; }
      const tk = acct.token_encrypted;

      for (const convo of convos) {
        if (!convo.target_project_id) continue;
        const age = Date.now() - new Date(convo.created_at).getTime();
        if (age > 300_000) {
          await sc.from("loveai_conversations").update({ status: "timeout" }).eq("id", convo.id);
          timedOut++; continue;
        }
        const pid = convo.target_project_id, cid = convo.id.slice(0, 8);
        console.log(`[bc] ${cid} pid=${pid.slice(0,8)} age=${Math.round(age/1000)}s`);

        // S1: latest-message (4s connect, 3s body)
        const r1 = await fetchText(`${API}/projects/${pid}/latest-message`, tk, 4000, 3000);
        if (r1) {
          if (r1.status === 200 && r1.body.length > 5) {
            try {
              const msg = JSON.parse(r1.body);
              const txt = msg?.content || msg?.message || msg?.text || "";
              if (msg?.role !== "user" && !msg?.is_streaming && txt.length > 30) {
                await sc.from("loveai_conversations").update({ ai_response: txt.trim(), status: "completed" }).eq("id", convo.id);
                captured++; console.log(`[bc] ✅ ${cid} S1 ${txt.length}c`); continue;
              }
            } catch { /* S1 is SSE stream, expected */ }
          }
        }

        // S2: source-code (6s connect, 10s body — increased for large projects)
        const r2 = await fetchText(`${API}/projects/${pid}/source-code`, tk, 6000, 10000);
        if (r2) {
          console.log(`[bc] ${cid} S2 ${r2.status} ${r2.body.length}b`);
          if (r2.status === 200 && r2.body.length > 10) {
            try {
              const parsed = JSON.parse(r2.body);
              // Log top-level structure for diagnostics
              console.log(`[bc] ${cid} S2-struct: ${describeStructure(parsed)}`);

              const md = findBrainMd(parsed);
              if (md) {
                console.log(`[bc] ${cid} brain-md ${md.length}c preview=${md.slice(0,120)}`);
                const hasDone = /status:\s*done/i.test(md);
                const hasReady = /status:\s*ready/i.test(md);
                if (hasDone || (md.length > 200 && !hasReady)) {
                  const body = extractMdBody(md);
                  if (body && body.length > 20) {
                    await sc.from("loveai_conversations").update({ ai_response: body, status: "completed" }).eq("id", convo.id);
                    captured++; console.log(`[bc] ✅ ${cid} S2 ${body.length}c`); continue;
                  }
                }
              } else {
                console.log(`[bc] ${cid} S2 no-brain-md`);
              }
            } catch (e) { console.log(`[bc] ${cid} S2 parse-err: ${String(e).slice(0,100)}`); }
          }
        }
        console.log(`[bc] ${cid} no-capture`);
      }
    }
    return json({ processed: pending.length, captured, timedOut });
  } catch (err) {
    console.error("[bc] fatal:", err);
    return json({ error: String(err) }, 500);
  }
});
