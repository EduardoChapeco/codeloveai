import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const API = "https://api.lovable.dev";
const GIT_SHA = "3d7a3673c6f02b606137a12ddc0ab88f6b775113";

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
}

async function readStream(body: ReadableStream<Uint8Array>, maxBytes = 800_000, timeoutMs = 5000): Promise<string> {
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

function lovHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Origin: "https://lovable.dev",
    Referer: "https://lovable.dev/",
    "X-Client-Git-SHA": GIT_SHA,
  };
}

async function fetchText(url: string, token: string, connectMs = 5000, bodyMs = 5000): Promise<{ status: number; body: string } | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), connectMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: lovHeaders(token) });
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

// ── Timestamp extraction ──────────────────────────────────────
function extractMdTimestamp(mdContent: string): number | null {
  const match = mdContent.match(/timestamp:\s*(\d{10,15})/);
  if (!match) return null;
  const ts = parseInt(match[1], 10);
  return ts < 1e12 ? ts * 1000 : ts;
}

// ── Bootstrap detection + cleaning ──────────────────────────────

const BOOTSTRAP_MARKERS = [
  /^#\s*Star AI\s*—.*Sistema Operacional\s*✅/im,
  /^Brain ativado\.\s*Credenciais:/im,
  /^Brain ativado\.\s*Aguardando instruções/im,
  /Aguardando instruções do usuário\.?\s*$/im,
  /^Sistema operacional\.\s*Aguardando instruções/im,
  /readiness:\s*complete/im,
];

const BOILERPLATE_LINES = [
  /^#\s*Resposta do Star AI\s*—/i,
  /^#+\s*Star AI\s*—.*—\s*Sistema Operacional/i,
  /^##?\s*Auto-Teste Conclu[ií]do/i,
  /^##?\s*Verificações\s*$/i,
  /^-\s*✅\s*(Estrutura de arquivos|Templates de resposta|Manifesto de capacidades|Auto-teste|Protocolo de resposta)/i,
  /^##?\s*Status:\s*Totalmente operacional/i,
  /^\|\s*Item\s*\|\s*Resultado\s*\|/i,
  /^\|\s*-+\s*\|\s*-+\s*\|/,
  /^\|\s*Varredura de segurança\s*\|/i,
  /^\|\s*Vulnerabilidades\s*\|/i,
  /^\|\s*Ação necessária\s*\|/i,
  /^##?\s*Próximos?\s*Passos?\s*$/i,
  /^[-*]\s*(Ativar|Executar|Configurar|Criar)\s*(Lovable|Cloud|migrations|RLS|Edge Functions)/i,
  /^[-*]\s*.*\(coisas relacionadas a\s*l[oa][vb]a[bl][el]\)/i,
  /^\s*O projeto opera em modo headless/i,
  /^\s*não há superfície de ataque exposta/i,
  /^Análise executada com sucesso\.\s*0 vulnerabilidades/i,
];

function isBootstrapResponse(text: string): boolean {
  return BOOTSTRAP_MARKERS.some(r => r.test(text));
}

function cleanBrainResponse(raw: string): string {
  if (!raw || raw.length < 5) return raw;
  let text = raw.replace(/^---[\s\S]*?---\s*/m, "").trim();
  text = text.replace(/^```(?:markdown|md)?\s*/i, "").replace(/```\s*$/, "").trim();
  const lines = text.split("\n");
  const cleaned = lines.filter(line => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    return !BOILERPLATE_LINES.some(r => r.test(trimmed));
  });
  let result = cleaned.join("\n").trim();
  result = result.replace(/\n##?\s*Próximos?\s*Passos?[\s\S]*$/im, "").trim();
  result = result.replace(/Sistema operacional\.\s*Aguardando instruções\.?\s*$/im, "").trim();
  result = result.replace(/Aguardando instruções do usuário\.?\s*$/im, "").trim();
  result = result.replace(/Aguardando instruções\.?\s*$/im, "").trim();
  result = result.replace(/^#\s*Resposta do Star AI\s*—[^\n]*\n\s*/i, "").trim();
  result = result.replace(/\n{3,}/g, "\n\n");
  return result.length > 5 ? result : raw;
}

function extractMdBody(c: string): string | null {
  if (!c) return null;
  const p = c.split("---");
  let raw = "";
  if (p.length >= 3) {
    raw = p.slice(2).join("---").trim();
    raw = raw.replace(/^```(?:markdown|md)?\s*/i, "").replace(/```\s*$/, "").trim();
  } else {
    raw = c.replace(/^---[\s\S]*?---\s*/m, "").trim();
  }
  if (raw.length < 5) return null;
  if (isBootstrapResponse(raw)) return null;
  return cleanBrainResponse(raw);
}

function findBrainMd(obj: any, target = "src/brain-output.md"): string | null {
  if (!obj || typeof obj !== "object") return null;

  if (obj[target]) {
    const v = obj[target];
    if (typeof v === "string") return v;
    if (typeof v === "object") return v.contents || v.content || v.source || null;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (!item || typeof item !== "object") continue;
      const p = item.path || item.name || item.file_path || "";
      if (p === target || p.endsWith("brain-output.md")) {
        const c = item.contents || item.content || item.source || item.code;
        if (typeof c === "string") return c;
      }
    }
    return null;
  }

  for (const key of ["files", "data", "source", "source_code", "project", "code"]) {
    if (obj[key]) {
      const result = findBrainMd(obj[key], target);
      if (result) return result;
    }
  }

  for (const key of Object.keys(obj)) {
    if (key.endsWith("brain-output.md")) {
      const v = obj[key];
      if (typeof v === "string") return v;
      if (typeof v === "object") return v?.contents || v?.content || v?.source || null;
    }
  }

  return null;
}

// ── Bootstrap phase prompts ──────────────────────────────────────

type SkillProfile = { title: string; credentials: string; focus: string };

const SKILL_PROFILES: Record<string, SkillProfile> = {
  general: { title: "Star AI — Assistente Geral Sênior", credentials: "PhD em Ciência da Computação (MIT), MBA (Harvard), 50 anos de experiência.", focus: "análise geral, planejamento, arquitetura de software, resolução de problemas complexos" },
  design: { title: "Star AI — Arquiteto de Design & UX", credentials: "PhD em HCI (MIT Media Lab), Mestre em Design Visual (RISD).", focus: "design systems, UX research, acessibilidade WCAG, Tailwind CSS, shadcn/ui" },
  code: { title: "Star AI — Engenheiro de Software Principal", credentials: "PhD em Engenharia de Software (Stanford), 50 anos como Staff Engineer.", focus: "TypeScript, React, Node.js, Deno, PostgreSQL, Edge Functions" },
  scraper: { title: "Star AI — Especialista em Extração de Dados", credentials: "PhD em Data Engineering (CMU), 30 anos em web scraping.", focus: "crawlers, parsing, Firecrawl, APIs de dados, ETL" },
  migration: { title: "Star AI — Arquiteto de Dados & Migrações", credentials: "PhD em Database Systems (UC Berkeley), 40 anos em PostgreSQL.", focus: "migrações SQL, modelagem relacional, performance tuning, índices, RLS policies" },
  data: { title: "Star AI — Cientista de Dados Sênior", credentials: "PhD em Machine Learning (Stanford), PhD em Estatística (MIT).", focus: "análise de dados, visualização, modelagem preditiva, ETL, dashboards" },
  devops: { title: "Star AI — Engenheiro DevOps/SRE Principal", credentials: "PhD em Sistemas Distribuídos (MIT), 40 anos em infraestrutura cloud.", focus: "CI/CD, Edge Functions, Supabase, monitoramento, cron jobs" },
  security: { title: "Star AI — Engenheiro de Segurança Principal", credentials: "PhD em Cybersecurity (MIT), CISSP, OSCP.", focus: "RLS policies, OAuth, criptografia, hardening, auditoria" },
  code_review: { title: "Star AI — Code Reviewer & Auditor Principal", credentials: "PhD em Software Engineering (MIT), 40 anos em code review.", focus: "code review, auditoria, refactoring, clean architecture, performance" },
};

function getProfile(skill: string): SkillProfile {
  return SKILL_PROFILES[skill] || SKILL_PROFILES.general;
}

function buildPhasePrompt(phase: number, skill: string, ctx: { supabaseUrl: string; userId: string }): string {
  const p = getProfile(skill);
  const now = Date.now();

  switch (phase) {
    case 1:
      return `IMPORTANTE: Não faça perguntas, não peça confirmação. Execute diretamente.

Criar Projeto (Brain Specialist — ${p.title}):

Este projeto é um sistema headless de IA especializada.

## PRD
### Objetivo
Sistema de resposta especializada com persona PhD/Sênior.

### Requisitos
1. Respostas em \`src/brain-output.md\` com frontmatter \`status: done\` e \`timestamp: {epoch_ms}\`
2. NÃO criar React/UI — backend headless

### Estrutura Inicial
1. \`.lovable/plan.md\`:
\`\`\`markdown
---
title: ${p.title}
skill: ${skill}
status: ready
---
# ${p.title}
Protocolo: respostas em src/brain-output.md com status: done e timestamp.
\`\`\`

2. \`src/brain-output.md\`:
\`\`\`markdown
---
status: ready
skill: ${skill}
timestamp: ${now}
---
# ${p.title}
Brain ativado. Aguardando instruções.
\`\`\`

3. \`src/INSTRUCTIONS.md\`:
\`\`\`markdown
# ${p.title} — Protocolo
1. SEMPRE escreva em src/brain-output.md com status: done e timestamp: {epoch_ms}
2. Responda em Português (Brasil)
3. NÃO crie React/UI
4. O timestamp DEVE ser atualizado a cada resposta
\`\`\`

4. \`src/config.json\`:
\`\`\`json
{"brain_title":"${p.title}","skill":"${skill}","response_file":"src/brain-output.md","callback_url":"${ctx.supabaseUrl}/functions/v1/brain-capture-cron","user_id":"${ctx.userId}","status":"ready","version":"5.0"}
\`\`\`

NÃO crie React, páginas ou rotas.`;

    case 2:
      return `IMPORTANTE: Execute diretamente. Verifique arquivos: .lovable/plan.md, src/brain-output.md, src/INSTRUCTIONS.md. Crie faltantes. Atualize src/brain-output.md com status: done e timestamp: ${now}.`;

    case 3:
      return `IMPORTANTE: Execute diretamente. Crie src/response-templates.md com templates de resposta. Atualize src/brain-output.md com status: done e timestamp: ${now}.`;

    case 4:
      return `IMPORTANTE: Execute diretamente. Crie src/capabilities.json com manifesto. Atualize src/brain-output.md com status: done e timestamp: ${now}.`;

    case 5:
      return `IMPORTANTE: Execute diretamente. Crie src/security-guardrails.md com políticas de segurança, proteção de dados e validação de input. Atualize src/brain-output.md com status: done e timestamp: ${now}.`;

    case 6:
      return `IMPORTANTE: Execute diretamente. Crie src/error-handlers.md com estratégias de retry, timeout e fallback. Atualize src/brain-output.md com status: done e timestamp: ${now}.`;

    case 7:
      return `IMPORTANTE: Execute diretamente. Crie src/output-formats.ts com helpers markdown/json/html para respostas. Atualize src/brain-output.md com status: done e timestamp: ${now}.`;

    case 8:
      return `IMPORTANTE: Execute diretamente. Reforce a Rule Zero no arquivo src/INSTRUCTIONS.md: \"EU SOU O BRAIN. NÃO EXCLUA ESTE PROJETO.\". Atualize src/brain-output.md com status: done e timestamp: ${now}.`;

    case 9:
      return `IMPORTANTE: Execute diretamente. Faça auto-teste técnico completo e registre resultado em src/brain-output.md com status: done e timestamp: ${now}.`;

    case 10:
      return `IMPORTANTE: Execute diretamente. Verificação final. Atualize src/brain-output.md com status: done, timestamp: ${now}, readiness: complete. Sistema Operacional pronto.`;

    default:
      return "";
  }
}

// ── Send prompt via venus-chat ──────────────────────────────────

async function sendViaVenus(projectId: string, prompt: string, token: string, supabaseUrl: string, serviceKey: string): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/venus-chat`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ task: prompt, project_id: projectId, mode: "task", lovable_token: token, skip_suffix: true }),
    });
    clearTimeout(timer);
    const text = await res.text().catch(() => "{}");
    let data: any = {};
    try { data = JSON.parse(text); } catch {}
    const ok = res.ok && data?.ok;
    console.log(`[bc:venus] project=${projectId.slice(0,8)} ok=${ok} status=${res.status}`);
    return ok;
  } catch (e) {
    clearTimeout(timer);
    console.log(`[bc:venus] error: ${String(e).slice(0, 80)}`);
    return false;
  }
}

// ── Main handler ────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sc = createClient(supabaseUrl, serviceKey);

  let bootstrapProcessed = 0;
  let captured = 0;
  let timedOut = 0;

  try {
    // ══════════════════════════════════════════════════════════════
    // PART 1: Process bootstrap phases
    // ══════════════════════════════════════════════════════════════
    const { data: pendingBrains } = await sc.from("user_brain_projects")
      .select("id, user_id, lovable_project_id, skill_phase, brain_skill, created_at, status")
      .in("status", ["active", "bootstrapping", "injecting"])
      .gt("skill_phase", 0)
      .lte("skill_phase", 10)
      .order("created_at", { ascending: true })
      .limit(5);

    if (pendingBrains?.length) {
      console.log(`[bc] ${pendingBrains.length} brains need bootstrap`);

      for (const brain of pendingBrains) {
        const phase = brain.skill_phase || 1;
        const age = Date.now() - new Date(brain.created_at).getTime();

        if (!brain.lovable_project_id || String(brain.lovable_project_id).startsWith("creating")) {
          console.log(`[bc] brain=${brain.id.slice(0,8)} has placeholder project id, skipping`);
          continue;
        }

        // Each phase needs ~90s to complete; skip if not enough time has passed
        const minAgeForPhase = phase === 1 ? 5_000 : (phase - 1) * 90_000;
        if (age < minAgeForPhase) {
          console.log(`[bc] brain=${brain.id.slice(0,8)} phase=${phase} too early (${Math.round(age/1000)}s < ${Math.round(minAgeForPhase/1000)}s), skipping`);
          continue;
        }

        const { data: acct } = await sc.from("lovable_accounts")
          .select("token_encrypted")
          .eq("user_id", brain.user_id)
          .eq("status", "active")
          .maybeSingle();
        if (!acct?.token_encrypted) {
          console.log(`[bc] brain=${brain.id.slice(0,8)} no-token, skipping`);
          continue;
        }

        const prompt = buildPhasePrompt(phase, brain.brain_skill, { supabaseUrl, userId: brain.user_id });
        if (!prompt) {
          await sc.from("user_brain_projects").update({ skill_phase: 0 }).eq("id", brain.id);
          continue;
        }

        console.log(`[bc] brain=${brain.id.slice(0,8)} phase=${phase} skill=${brain.brain_skill} sending...`);
        const ok = await sendViaVenus(brain.lovable_project_id, prompt, acct.token_encrypted, supabaseUrl, serviceKey);

        if (ok) {
          const nextPhase = phase >= 10 ? 0 : phase + 1;
          await sc.from("user_brain_projects").update({ skill_phase: nextPhase, status: "active" }).eq("id", brain.id);
          bootstrapProcessed++;
          console.log(`[bc] ✅ brain=${brain.id.slice(0,8)} phase=${phase}→${nextPhase}`);
        } else {
          console.log(`[bc] ❌ brain=${brain.id.slice(0,8)} phase=${phase} failed`);
          if (age > 600_000) {
            console.log(`[bc] brain=${brain.id.slice(0,8)} too old, marking done`);
            await sc.from("user_brain_projects").update({ skill_phase: 0 }).eq("id", brain.id);
          }
        }
      }
    }

    // ══════════════════════════════════════════════════════════════
    // PART 2: Capture pending conversation responses (with TIMESTAMP VALIDATION)
    // ══════════════════════════════════════════════════════════════
    const { data: pending } = await sc.from("loveai_conversations")
      .select("id, user_id, target_project_id, created_at")
      .eq("status", "processing")
      .order("created_at", { ascending: true })
      .limit(5);

    if (!pending?.length && !bootstrapProcessed) {
      return json({ processed: 0, bootstrap: bootstrapProcessed });
    }

    if (pending?.length) {
      console.log(`[bc] ${pending.length} pending conversations`);

      const byUser = new Map<string, typeof pending>();
      for (const c of pending) {
        const l = byUser.get(c.user_id) || [];
        l.push(c);
        byUser.set(c.user_id, l);
      }

      for (const [userId, convos] of byUser) {
        const { data: acct } = await sc.from("lovable_accounts")
          .select("token_encrypted")
          .eq("user_id", userId)
          .eq("status", "active")
          .maybeSingle();
        if (!acct?.token_encrypted) { console.log(`[bc] no-token`); continue; }
        const tk = acct.token_encrypted;

        for (const convo of convos) {
          if (!convo.target_project_id) continue;
          const age = Date.now() - new Date(convo.created_at).getTime();
          if (age > 300_000) {
            await sc.from("loveai_conversations").update({ status: "timeout" }).eq("id", convo.id);
            timedOut++;
            continue;
          }
          const pid = convo.target_project_id;
          const cid = convo.id.slice(0, 8);
          // Conversation timestamp — used to reject stale .md responses
          const convoTs = new Date(convo.created_at).getTime();
          console.log(`[bc] ${cid} pid=${pid.slice(0,8)} age=${Math.round(age / 1000)}s convoTs=${convoTs}`);

          // S1: latest-message (no timestamp needed — always latest)
          const r1 = await fetchText(`${API}/projects/${pid}/latest-message`, tk, 4000, 3000);
          if (r1 && r1.status === 200 && r1.body.length > 5) {
            try {
              const msg = JSON.parse(r1.body);
              const txt = msg?.content || msg?.message || msg?.text || "";
              if (msg?.role !== "user" && !msg?.is_streaming && txt.length > 30) {
                if (isBootstrapResponse(txt)) {
                  console.log(`[bc] ${cid} S1 skipping bootstrap`);
                } else {
                  const cleanedTxt = cleanBrainResponse(txt.trim());
                  await sc.from("loveai_conversations").update({ ai_response: cleanedTxt, status: "completed" }).eq("id", convo.id);
                  await sc.from("brain_outputs").insert({
                    user_id: userId, conversation_id: convo.id, skill: "general",
                    request: "", response: cleanedTxt, status: "done", brain_project_id: pid,
                  }).catch(() => {});
                  captured++;
                  console.log(`[bc] ✅ ${cid} S1 ${cleanedTxt.length}c`);
                  continue;
                }
              }
            } catch { /* S1 is SSE stream, expected */ }
          }

          // S2: source-code (WITH CONTENT-CHANGE + TIMESTAMP VALIDATION)
          const r2 = await fetchText(`${API}/projects/${pid}/source-code`, tk, 6000, 10000);
          if (r2 && r2.status === 200 && r2.body.length > 10) {
            try {
              const parsed = JSON.parse(r2.body);
              const md = findBrainMd(parsed);
              if (md) {
                const hasDone = /status:\s*done/i.test(md);
                const hasReady = /status:\s*ready/i.test(md);

                // ── TIMESTAMP CHECK — but also accept content-change ──
                const mdTs = extractMdTimestamp(md);
                const isStaleTs = mdTs && mdTs < convoTs;

                if (isStaleTs && age < 60_000) {
                  // Only skip stale .md if conversation is young (< 60s)
                  // After 60s, accept any valid content since AI may not update timestamp
                  console.log(`[bc] ${cid} S2 stale .md (md_ts=${mdTs} < convo_ts=${convoTs}), waiting...`);
                } else if (hasDone || (md.length > 200 && !hasReady)) {
                  const body = extractMdBody(md);
                  if (body && body.length > 20) {
                    await sc.from("loveai_conversations").update({ ai_response: body, status: "completed" }).eq("id", convo.id);
                    await sc.from("brain_outputs").insert({
                      user_id: userId, conversation_id: convo.id, skill: "general",
                      request: "", response: body, status: "done", brain_project_id: pid,
                    }).catch(() => {});
                    captured++;
                    console.log(`[bc] ✅ ${cid} S2 ${body.length}c (staleTs=${!!isStaleTs})`);
                    continue;
                  }
                }
              } else {
                console.log(`[bc] ${cid} S2 no-brain-md`);
              }
            } catch (e) {
              console.log(`[bc] ${cid} S2 parse-err: ${String(e).slice(0, 100)}`);
            }
          }

          // S3: Try latest-message with SSE-aware parsing
          if (age > 15_000) {
            const r3 = await fetchText(`${API}/projects/${pid}/latest-message`, tk, 4000, 5000);
            if (r3 && r3.status === 200 && r3.body.length > 5) {
              try {
                // Handle SSE format: extract last "data:" line
                let msgText = r3.body;
                if (msgText.includes("data:")) {
                  const lines = msgText.split("\n").filter((l: string) => l.startsWith("data:"));
                  if (lines.length > 0) {
                    const lastLine = lines[lines.length - 1].replace(/^data:\s*/, "");
                    try { msgText = lastLine; } catch { /* keep original */ }
                  }
                }
                const msg = JSON.parse(msgText);
                const txt = msg?.content || msg?.message || msg?.text || "";
                if (msg?.role !== "user" && !msg?.is_streaming && typeof txt === "string" && txt.length > 30) {
                  if (!isBootstrapResponse(txt)) {
                    const cleanedTxt = cleanBrainResponse(txt.trim());
                    await sc.from("loveai_conversations").update({ ai_response: cleanedTxt, status: "completed" }).eq("id", convo.id);
                    await sc.from("brain_outputs").insert({
                      user_id: userId, conversation_id: convo.id, skill: "general",
                      request: "", response: cleanedTxt, status: "done", brain_project_id: pid,
                    }).catch(() => {});
                    captured++;
                    console.log(`[bc] ✅ ${cid} S3-msg ${cleanedTxt.length}c`);
                    continue;
                  }
                }
              } catch { /* S3 parse failed */ }
            }
          }

          console.log(`[bc] ${cid} no-capture (age=${Math.round(age/1000)}s)`);
        }
      }
    }

    return json({ processed: pending?.length || 0, captured, timedOut, bootstrap: bootstrapProcessed });
  } catch (err) {
    console.error("[bc] fatal:", err);
    return json({ error: String(err) }, 500);
  }
});
