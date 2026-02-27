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

/** Find brain-output.md in source-code response (supports {name, contents} format) */
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
// Phase 1: Bootstrap (PRD + structure)
// Phase 2-6: Audit prompts (verify, templates, capabilities, self-test, readiness)
// Must match brain/index.ts buildBootstrapPrompt + buildAuditPrompts

type SkillProfile = { title: string; credentials: string; focus: string };

const SKILL_PROFILES: Record<string, SkillProfile> = {
  general: {
    title: "Star AI — Assistente Geral Sênior",
    credentials: "PhD em Ciência da Computação (MIT), MBA (Harvard), 50 anos de experiência.",
    focus: "análise geral, planejamento, arquitetura de software, resolução de problemas complexos",
  },
  design: {
    title: "Star AI — Arquiteto de Design & UX",
    credentials: "PhD em HCI (MIT Media Lab), Mestre em Design Visual (RISD).",
    focus: "design systems, UX research, acessibilidade WCAG, Tailwind CSS, shadcn/ui",
  },
  code: {
    title: "Star AI — Engenheiro de Software Principal",
    credentials: "PhD em Engenharia de Software (Stanford), 50 anos como Staff Engineer.",
    focus: "TypeScript, React, Node.js, Deno, PostgreSQL, Edge Functions",
  },
  scraper: {
    title: "Star AI — Especialista em Extração de Dados",
    credentials: "PhD em Data Engineering (CMU), 30 anos em web scraping.",
    focus: "crawlers, parsing, Firecrawl, APIs de dados, ETL",
  },
  migration: {
    title: "Star AI — Arquiteto de Dados & Migrações",
    credentials: "PhD em Database Systems (UC Berkeley), 40 anos em PostgreSQL.",
    focus: "migrações SQL, modelagem relacional, performance tuning, índices, RLS policies",
  },
  data: {
    title: "Star AI — Cientista de Dados Sênior",
    credentials: "PhD em Machine Learning (Stanford), PhD em Estatística (MIT).",
    focus: "análise de dados, visualização, modelagem preditiva, ETL, dashboards",
  },
  devops: {
    title: "Star AI — Engenheiro DevOps/SRE Principal",
    credentials: "PhD em Sistemas Distribuídos (MIT), 40 anos em infraestrutura cloud.",
    focus: "CI/CD, Edge Functions, Supabase, monitoramento, cron jobs",
  },
  security: {
    title: "Star AI — Engenheiro de Segurança Principal",
    credentials: "PhD em Cybersecurity (MIT), CISSP, OSCP.",
    focus: "RLS policies, OAuth, criptografia, hardening, auditoria",
  },
};

function getProfile(skill: string): SkillProfile {
  return SKILL_PROFILES[skill] || SKILL_PROFILES.general;
}

function buildPhasePrompt(phase: number, skill: string, ctx: { supabaseUrl: string; userId: string }): string {
  const p = getProfile(skill);

  switch (phase) {
    case 1:
      // Phase 1: Bootstrap PRD (matches brain/index.ts buildBootstrapPrompt)
      return `IMPORTANTE: Não faça perguntas, não peça confirmação. Execute diretamente.

Criar Projeto (Brain Specialist — ${p.title}):

Este projeto é um sistema headless de IA especializada onde todas as perguntas serão respondidas de forma coerente e profissional como um especialista ${p.credentials}.

## PRD — Product Requirements Document

### Objetivo
Sistema de resposta especializada com persona PhD/Sênior. O corpo da resposta deve ser anexado sempre em .md.

### Requisitos Funcionais
1. Todas as respostas devem ser escritas em \`src/brain-output.md\` com frontmatter \`status: done\`
2. NÃO criar componentes React, páginas ou rotas visuais — este é um backend de IA headless

### Estrutura Inicial

1. Crie o arquivo \`.lovable/plan.md\` com:
\`\`\`markdown
---
title: ${p.title}
skill: ${skill}
status: ready
credentials: ${p.credentials}
---
# ${p.title}
Sistema especializado em ${p.focus}.
Protocolo: todas as respostas em \`src/brain-output.md\` com status: done.
\`\`\`

2. Crie o arquivo \`src/brain-output.md\` com:
\`\`\`markdown
---
status: ready
skill: ${skill}
timestamp: ${Date.now()}
---
# ${p.title}
Brain ativado. Credenciais: ${p.credentials}
Foco: ${p.focus}
Aguardando instruções.
\`\`\`

3. Crie o arquivo \`src/INSTRUCTIONS.md\` com:
\`\`\`markdown
# ${p.title} — Protocolo de Resposta

## Identidade
${p.credentials}

## Regras
1. SEMPRE escreva respostas em \`src/brain-output.md\` com frontmatter \`status: done\`
2. Responda em Português (Brasil)
3. Seja técnico, detalhado e acionável
4. NÃO crie componentes React ou páginas visuais
5. Pode criar Edge Functions, SQL, scripts backend
6. Use formato Markdown com código quando necessário
\`\`\`

4. Crie o arquivo \`src/config.json\` com:
\`\`\`json
{
  "brain_title": "${p.title}",
  "skill": "${skill}",
  "response_file": "src/brain-output.md",
  "callback_url": "${ctx.supabaseUrl}/functions/v1/brain-capture-cron",
  "user_id": "${ctx.userId}",
  "status": "ready",
  "version": "5.0"
}
\`\`\`

NÃO crie componentes React, páginas ou rotas. Este projeto serve APENAS como backend de IA especializada.`;

    case 2:
      // Audit 1: Verify structure
      return `IMPORTANTE: Não faça perguntas, execute diretamente.

Verifique se todos os arquivos do sistema foram criados corretamente:
- .lovable/plan.md (deve existir com skill: ${skill})
- src/brain-output.md (deve existir com status: ready)
- src/INSTRUCTIONS.md (deve existir com protocolo de resposta)
Se algum arquivo estiver faltando, crie-o agora. Atualize src/brain-output.md com status: done e uma confirmação de que a estrutura está completa.`;

    case 3:
      // Audit 2: Response templates
      return `IMPORTANTE: Não faça perguntas, execute diretamente.

Crie o arquivo src/response-templates.md com templates de resposta para diferentes tipos de consulta:

\`\`\`markdown
---
status: done
timestamp: ${Date.now()}
---
# Templates de Resposta — ${p.title}

## Template: Análise Técnica
- Diagnóstico
- Causa raiz
- Solução recomendada
- Código (se aplicável)

## Template: Arquitetura
- Visão geral
- Componentes
- Fluxo de dados
- Considerações de segurança

## Template: Code Review
- Problemas encontrados
- Severidade
- Correções sugeridas
- Boas práticas
\`\`\`

Atualize src/brain-output.md com status: done confirmando a criação dos templates.`;

    case 4:
      // Audit 3: Capabilities manifest
      return `IMPORTANTE: Não faça perguntas, execute diretamente.

Crie o arquivo src/capabilities.json com o manifesto de capacidades deste Brain:

\`\`\`json
{
  "brain": "${p.title}",
  "skill": "${skill}",
  "capabilities": [
    "análise técnica avançada",
    "geração de código",
    "revisão de arquitetura",
    "criação de documentação",
    "resolução de problemas complexos"
  ],
  "response_formats": ["markdown", "json", "html"],
  "output_file": "src/brain-output.md",
  "version": "5.0",
  "status": "operational"
}
\`\`\`

Atualize src/brain-output.md com status: done.`;

    case 5:
      // Audit 4: Self-test
      return `IMPORTANTE: Não faça perguntas, execute diretamente.

Realize um auto-teste do sistema. Escreva em src/brain-output.md uma resposta de teste demonstrando suas capacidades como ${p.title}:

1. Apresente-se com suas credenciais
2. Liste suas áreas de especialização
3. Demonstre conhecimento técnico em ${p.focus}
4. Confirme que o protocolo de resposta está funcionando

Use o formato correto com frontmatter status: done.`;

    case 6:
      // Audit 5: Final readiness
      return `IMPORTANTE: Não faça perguntas, execute diretamente.

Verificação final de prontidão. Atualize src/brain-output.md com:

\`\`\`markdown
---
status: done
skill: ${skill}
timestamp: ${Date.now()}
readiness: complete
---

# ${p.title} — Sistema Operacional ✅

## Status: Totalmente operacional
- Estrutura de arquivos: ✅
- Templates de resposta: ✅
- Manifesto de capacidades: ✅
- Auto-teste: ✅
- Protocolo de resposta: ✅

Aguardando instruções do usuário.
\`\`\``;

    default:
      return "";
  }
}

// ── Send prompt via venus-chat ──────────────────────────────────

async function sendViaVenus(
  projectId: string,
  prompt: string,
  token: string,
  supabaseUrl: string,
  serviceKey: string,
): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/venus-chat`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        task: prompt,
        project_id: projectId,
        mode: "task",
        lovable_token: token,
      }),
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
    // PART 1: Process bootstrap phases (skill_phase 1-3)
    // ══════════════════════════════════════════════════════════════
    const { data: pendingBrains } = await sc.from("user_brain_projects")
      .select("id, user_id, lovable_project_id, skill_phase, brain_skill, created_at")
      .eq("status", "active")
      .gt("skill_phase", 0)
      .lte("skill_phase", 6)
      .order("created_at", { ascending: true })
      .limit(2); // Process max 2 per cycle

    if (pendingBrains?.length) {
      console.log(`[bc] ${pendingBrains.length} brains need bootstrap`);

      for (const brain of pendingBrains) {
        const phase = brain.skill_phase || 1;
        const age = Date.now() - new Date(brain.created_at).getTime();

        // Don't process if brain was just created (wait 30s for project stabilization)
        if (age < 30_000) {
          console.log(`[bc] brain=${brain.id.slice(0,8)} too young (${Math.round(age/1000)}s), skipping`);
          continue;
        }

        // Get user token
        const { data: acct } = await sc.from("lovable_accounts")
          .select("token_encrypted")
          .eq("user_id", brain.user_id)
          .eq("status", "active")
          .maybeSingle();
        if (!acct?.token_encrypted) {
          console.log(`[bc] brain=${brain.id.slice(0,8)} no-token, skipping`);
          continue;
        }

        const prompt = buildPhasePrompt(phase, brain.brain_skill, {
          supabaseUrl,
          userId: brain.user_id,
        });

        if (!prompt) {
          // Phase > 3 or invalid, mark as done
          await sc.from("user_brain_projects").update({ skill_phase: 0 }).eq("id", brain.id);
          continue;
        }

        console.log(`[bc] brain=${brain.id.slice(0,8)} phase=${phase} skill=${brain.brain_skill} sending...`);
        const ok = await sendViaVenus(brain.lovable_project_id, prompt, acct.token_encrypted, supabaseUrl, serviceKey);

        if (ok) {
          // Advance to next phase (or 0 if done with all 6 phases)
          const nextPhase = phase >= 6 ? 0 : phase + 1;
          await sc.from("user_brain_projects").update({ skill_phase: nextPhase }).eq("id", brain.id);
          bootstrapProcessed++;
          console.log(`[bc] ✅ brain=${brain.id.slice(0,8)} phase=${phase}→${nextPhase}`);
        } else {
          console.log(`[bc] ❌ brain=${brain.id.slice(0,8)} phase=${phase} failed`);
          // If failed 3+ times (brain older than 10 min and still on same phase), skip
          if (age > 600_000) {
            console.log(`[bc] brain=${brain.id.slice(0,8)} too old, marking done`);
            await sc.from("user_brain_projects").update({ skill_phase: 0 }).eq("id", brain.id);
          }
        }
      }
    }

    // ══════════════════════════════════════════════════════════════
    // PART 2: Capture pending conversation responses
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
          console.log(`[bc] ${cid} pid=${pid.slice(0,8)} age=${Math.round(age / 1000)}s`);

          // S1: latest-message
          const r1 = await fetchText(`${API}/projects/${pid}/latest-message`, tk, 4000, 3000);
          if (r1 && r1.status === 200 && r1.body.length > 5) {
            try {
              const msg = JSON.parse(r1.body);
              const txt = msg?.content || msg?.message || msg?.text || "";
              if (msg?.role !== "user" && !msg?.is_streaming && txt.length > 30) {
                await sc.from("loveai_conversations").update({ ai_response: txt.trim(), status: "completed" }).eq("id", convo.id);
                await sc.from("brain_outputs").insert({
                  user_id: userId, conversation_id: convo.id, skill: "general",
                  request: "", response: txt.trim(), status: "done", brain_project_id: pid,
                }).catch(() => {});
                captured++;
                console.log(`[bc] ✅ ${cid} S1 ${txt.length}c`);
                continue;
              }
            } catch { /* S1 is SSE stream, expected */ }
          }

          // S2: source-code
          const r2 = await fetchText(`${API}/projects/${pid}/source-code`, tk, 6000, 10000);
          if (r2 && r2.status === 200 && r2.body.length > 10) {
            try {
              const parsed = JSON.parse(r2.body);
              const md = findBrainMd(parsed);
              if (md) {
                console.log(`[bc] ${cid} brain-md ${md.length}c hasDone=${/status:\s*done/i.test(md)}`);
                const hasDone = /status:\s*done/i.test(md);
                const hasReady = /status:\s*ready/i.test(md);
                if (hasDone || (md.length > 200 && !hasReady)) {
                  const body = extractMdBody(md);
                  if (body && body.length > 20) {
                    await sc.from("loveai_conversations").update({ ai_response: body, status: "completed" }).eq("id", convo.id);
                    await sc.from("brain_outputs").insert({
                      user_id: userId, conversation_id: convo.id, skill: "general",
                      request: "", response: body, status: "done", brain_project_id: pid,
                    }).catch(() => {});
                    captured++;
                    console.log(`[bc] ✅ ${cid} S2 ${body.length}c`);
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
          console.log(`[bc] ${cid} no-capture`);
        }
      }
    }

    return json({ processed: pending?.length || 0, captured, timedOut, bootstrap: bootstrapProcessed });
  } catch (err) {
    console.error("[bc] fatal:", err);
    return json({ error: String(err) }, 500);
  }
});
