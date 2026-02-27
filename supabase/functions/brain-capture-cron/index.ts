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

/** Read response body manually from stream with hard cutoff */
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
    const body = await readStream(r.body, 500_000, bodyMs);
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

function getFile(files: any, path: string): string | null {
  if (!files) return null;
  if (Array.isArray(files)) { const f = files.find((x: any) => x.path === path); return f?.content || f?.source || null; }
  if (typeof files === "object") { const v = files[path]; return typeof v === "string" ? v : v?.content || null; }
  return null;
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
        console.log(`[bc] ${cid} age=${Math.round(age/1000)}s`);

        // S1: latest-message (4s connect, 3s body)
        const r1 = await fetchText(`${API}/projects/${pid}/latest-message`, tk, 4000, 3000);
        if (r1) {
          console.log(`[bc] ${cid} S1 ${r1.status} ${r1.body.length}b preview=${r1.body.slice(0,150)}`);
          if (r1.status === 200 && r1.body.length > 5) {
            try {
              const msg = JSON.parse(r1.body);
              const txt = msg?.content || msg?.message || msg?.text || "";
              if (msg?.role !== "user" && !msg?.is_streaming && txt.length > 30) {
                await sc.from("loveai_conversations").update({ ai_response: txt.trim(), status: "completed" }).eq("id", convo.id);
                captured++; console.log(`[bc] ✅ ${cid} S1 ${txt.length}c`); continue;
              }
              console.log(`[bc] ${cid} S1 role=${msg?.role} stream=${msg?.is_streaming}`);
            } catch { console.log(`[bc] ${cid} S1 not-json`); }
          }
        }

        // S2: source-code (6s connect, 8s body)
        const r2 = await fetchText(`${API}/projects/${pid}/source-code`, tk, 6000, 8000);
        if (r2) {
          console.log(`[bc] ${cid} S2 ${r2.status} ${r2.body.length}b`);
          if (r2.status === 200 && r2.body.length > 10) {
            try {
              const parsed = JSON.parse(r2.body);
              const files = parsed?.files || parsed?.data?.files || parsed;
              const md = getFile(files, "src/brain-output.md");
              if (md) {
                console.log(`[bc] ${cid} brain-md ${md.length}c`);
                const body = extractMdBody(md);
                if (body && body.length > 20) {
                  await sc.from("loveai_conversations").update({ ai_response: body, status: "completed" }).eq("id", convo.id);
                  captured++; console.log(`[bc] ✅ ${cid} S2 ${body.length}c`); continue;
                }
              } else {
                const keys = typeof files === "object" ? Object.keys(files || {}).length : 0;
                console.log(`[bc] ${cid} S2 no-md files=${keys}`);
              }
            } catch { console.log(`[bc] ${cid} S2 parse-err`); }
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
