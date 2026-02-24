import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENROUTER_API = "https://openrouter.ai/api/v1";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── PRD Generation via OpenRouter ─────────────────────────────
// Uses Claude Sonnet (via OpenRouter) to generate a structured execution plan.
// Falls back to a minimal 3-task plan if the API fails.

interface PrdTask {
  title: string;
  intent: string;
  prompt: string;
  phase?: number;
  required_audit_before?: boolean;
  stop_condition?: string;
}

interface PrdResult {
  project_name: string;
  summary: string;
  tasks: PrdTask[];
}

async function generatePRDViaOpenRouter(
  apiKey: string,
  clientPrompt: string,
  projectType: string
): Promise<PrdResult> {
  const systemPrompt = `You are a senior software architect specialized in Lovable (AI-powered web app builder).
Generate a structured JSON execution plan to build the described project using Lovable AI.
Each task must be a focused, actionable prompt for Lovable to implement one specific feature.

Rules:
- Max 8 tasks, ordered from foundation to advanced features
- First task: always database/schema setup (if needed)
- Second task: auth setup (if needed)
- Last task: always security/RLS audit fix
- Each task prompt must be self-contained and specific
- intent must be one of: "chat", "security_fix_v2", "seo_fix", "error_fix", "setup", "feature", "db_migration", "ux_improvement"
- set required_audit_before: true for critical tasks (DB, auth)
- add stop_condition when verifiable (e.g., "file_exists:supabase/migrations/001_init.sql")

Respond ONLY with valid JSON matching this schema:
{
  "project_name": "string",
  "summary": "string (1 sentence)",
  "tasks": [
    {
      "title": "string",
      "intent": "string",
      "phase": 1,
      "required_audit_before": false,
      "stop_condition": "string or null",
      "prompt": "string (detailed Lovable prompt)"
    }
  ]
}`;

  const userMessage = `Project type: ${projectType || "web app"}

Client request:
"""
${clientPrompt}
"""

Generate the execution plan now.`;

  const res = await fetch(`${OPENROUTER_API}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://starble.com.br",
      "X-Title": "Starble Orchestrator",
    },
    body: JSON.stringify({
      model: "anthropic/claude-sonnet-4-5",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: 4000,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter API error: ${res.status} — ${errText}`);
  }

  const completion = await res.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = completion.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter returned empty content");

  const parsed = JSON.parse(content) as PrdResult;
  if (!parsed.tasks?.length) throw new Error("PRD had no tasks");

  return parsed;
}

function fallbackPRD(clientPrompt: string): PrdResult {
  return {
    project_name: "Novo Projeto",
    summary: "Implementação gerada automaticamente via fallback",
    tasks: [
      {
        title: "Configurar banco de dados e autenticação",
        intent: "setup",
        phase: 1,
        prompt: `Configure the Supabase database with necessary tables, RLS policies, and authentication for this project: ${clientPrompt.substring(0, 200)}`,
        required_audit_before: false,
      },
      {
        title: "Implementar funcionalidades principais",
        intent: "feature",
        phase: 2,
        prompt: `Implement the core features as described: ${clientPrompt}`,
        required_audit_before: false,
      },
      {
        title: "Auditoria de segurança e RLS",
        intent: "security_fix_v2",
        phase: 3,
        prompt: "Run a complete security audit. Verify all tables have RLS enabled with proper policies. Fix any security vulnerabilities found.",
        required_audit_before: false,
        stop_condition: "source_contains:ENABLE ROW LEVEL SECURITY",
      },
    ],
  };
}

// ═══════════════════════════════════════════════════════════
// Main Handler
// ═══════════════════════════════════════════════════════════
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json() as {
      client_prompt: string;
      project_type?: string;
      project_id?: string;
    };

    const { client_prompt, project_type, project_id } = body;

    if (!client_prompt?.trim()) {
      return json({ error: "client_prompt is required" }, 400);
    }

    const apiKey = Deno.env.get("OPENROUTER_API_KEY");

    // If OpenRouter key is not set, return fallback immediately
    if (!apiKey) {
      console.warn("[orchestrator-prd] OPENROUTER_API_KEY not set — returning fallback PRD");
      return json({
        success: true,
        fallback: true,
        project_id: project_id || null,
        prd: fallbackPRD(client_prompt),
      });
    }

    let prd: PrdResult;
    let isFallback = false;

    try {
      prd = await generatePRDViaOpenRouter(apiKey, client_prompt, project_type || "web app");
    } catch (e) {
      console.error("[orchestrator-prd] OpenRouter failed, using fallback:", e);
      prd = fallbackPRD(client_prompt);
      isFallback = true;
    }

    return json({
      success: true,
      fallback: isFallback,
      project_id: project_id || null,
      prd,
    });
  } catch (err) {
    console.error("[orchestrator-prd] Error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
