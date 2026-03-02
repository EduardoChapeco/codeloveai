import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Specialized Brain Types ──────────────────────────────────
// Each brain_type maps to a brainchain_accounts pool specialized in that area.
// The orchestrator will acquire the right account type for each task.
const BRAIN_SPECIALIZATIONS = {
  frontend: {
    description: "UI/UX, React components, Tailwind styling, animations, responsive design",
    system_context: "You are a senior frontend specialist. Focus exclusively on React components, Tailwind CSS, responsive design, animations with framer-motion, and user experience. Write clean, reusable components with proper TypeScript types.",
  },
  backend: {
    description: "Edge functions, API routes, database queries, authentication logic, server-side validation",
    system_context: "You are a senior backend specialist. Focus on Supabase Edge Functions, database queries, RLS policies, authentication flows, API integrations, and server-side validation. Write secure, performant backend code.",
  },
  database: {
    description: "Schema design, migrations, RLS policies, triggers, indexes, data modeling",
    system_context: "You are a database architect. Focus on PostgreSQL schema design, Supabase migrations, RLS policies, triggers, indexes, and data modeling. Ensure referential integrity, performance, and security.",
  },
  design: {
    description: "Visual design system, color palette, typography, layout, branding, CSS architecture",
    system_context: "You are a design system architect. Focus on creating cohesive visual systems: color palettes in HSL, typography scales, spacing systems, component variants, dark/light themes via CSS variables and Tailwind config.",
  },
  review: {
    description: "Holistic code review, cross-file consistency, import validation, integration testing",
    system_context: "You are a senior code reviewer and integration specialist. Review ALL files holistically: validate imports match exports, ensure consistent naming, check for missing dependencies, verify component composition, and ensure all pieces work together as a cohesive application.",
  },
  code: {
    description: "General full-stack implementation, features, business logic",
    system_context: "You are a senior full-stack developer. Implement features end-to-end: React components, state management, API calls, Edge Functions, and database operations. Write production-ready, type-safe code.",
  },
};

// ─── PRD Generation ──────────────────────────────────────────
interface PrdTask {
  title: string;
  intent: string;
  prompt: string;
  brain_type: string;
  phase?: number;
  required_audit_before?: boolean;
  stop_condition?: string;
  depends_on?: number[];
}

interface PrdResult {
  project_name: string;
  summary: string;
  tasks: PrdTask[];
  specializations_used: string[];
}

async function generateSpecializedPRD(
  apiKey: string,
  clientPrompt: string,
  projectType: string
): Promise<PrdResult> {
  const specializationList = Object.entries(BRAIN_SPECIALIZATIONS)
    .map(([key, val]) => `- "${key}": ${val.description}`)
    .join("\n");

  const systemPrompt = `You are a senior software architect that decomposes projects into specialized tasks.

Each task MUST be assigned to a specialized brain_type. Available specializations:
${specializationList}

Rules:
1. Max 10 tasks, ordered by dependency (foundation first)
2. ALWAYS start with "database" brain for schema/tables (if project needs data)
3. ALWAYS include a "design" brain task early for design system setup
4. Use "frontend" brain for UI components and pages
5. Use "backend" brain for Edge Functions, API logic, auth
6. ALWAYS end with a "review" brain task for holistic integration check
7. Each task prompt must be self-contained, detailed, and implementation-ready
8. Include the brain's system context in the task: the brain is SPECIALIZED
9. Tasks can run in parallel if they don't depend on each other — set depends_on accordingly
10. The review task should reference ALL other tasks and verify cross-file consistency

Respond ONLY with valid JSON:
{
  "project_name": "string",
  "summary": "string (1 sentence)",
  "specializations_used": ["database", "design", "frontend", "backend", "review"],
  "tasks": [
    {
      "title": "string",
      "brain_type": "database|frontend|backend|design|review|code",
      "intent": "security_fix_v2",
      "phase": 1,
      "depends_on": [],
      "prompt": "string (detailed implementation prompt for the specialized brain)"
    }
  ]
}`;

  const userMessage = `Project type: ${projectType || "web app"}

Client request:
"""
${clientPrompt}
"""

Decompose into specialized brain tasks now. Remember: each brain is an expert in its area.`;

  // Strategy 1: Lovable AI Gateway
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableKey) {
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "Return only valid JSON, no markdown fences." },
            { role: "user", content: systemPrompt + "\n\n" + userMessage },
          ],
          temperature: 0.2, max_tokens: 5000,
        }),
      });
      if (res.ok) {
        const result = await res.json() as Record<string, unknown>;
        const content = ((result?.choices as any)?.[0]?.message?.content || "") as string;
        const parsed = extractJSON(content);
        if (parsed) return parsed;
      }
    } catch (e) { console.error("[PRD] Gateway error:", (e as Error).message); }
  }

  // Strategy 2: OpenRouter
  if (apiKey) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://starble.lovable.app",
          "X-Title": "Starble Orchestrator",
        },
        body: JSON.stringify({
          model: "anthropic/claude-sonnet-4-5",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          max_tokens: 5000, temperature: 0.3,
        }),
      });
      if (res.ok) {
        const result = await res.json() as Record<string, unknown>;
        const content = ((result?.choices as any)?.[0]?.message?.content || "") as string;
        const parsed = extractJSON(content);
        if (parsed) return parsed;
      }
    } catch (e) { console.error("[PRD] OpenRouter error:", (e as Error).message); }
  }

  // Fallback
  return fallbackPRD(clientPrompt);
}

function extractJSON(content: string): PrdResult | null {
  if (!content || content.length < 10) return null;
  let s = content.trim();
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) s = m[1].trim();
  const i = s.indexOf("{");
  if (i >= 0) s = s.slice(i);
  const j = s.lastIndexOf("}");
  if (j >= 0) s = s.slice(0, j + 1);
  try {
    const parsed = JSON.parse(s);
    if (parsed.tasks && Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
      // Normalize brain_type
      parsed.tasks = parsed.tasks.map((t: any) => ({
        ...t,
        brain_type: BRAIN_SPECIALIZATIONS[t.brain_type as keyof typeof BRAIN_SPECIALIZATIONS]
          ? t.brain_type : "code",
      }));
      if (!parsed.specializations_used) {
        parsed.specializations_used = [...new Set(parsed.tasks.map((t: any) => t.brain_type))];
      }
      return parsed as PrdResult;
    }
  } catch { /* invalid */ }
  return null;
}

function fallbackPRD(clientPrompt: string): PrdResult {
  return {
    project_name: "Novo Projeto",
    summary: "Implementação via brains especializados",
    specializations_used: ["database", "design", "code", "review"],
    tasks: [
      {
        title: "Configurar banco de dados e schema",
        intent: "setup",
        brain_type: "database",
        phase: 1,
        prompt: `[DATABASE SPECIALIST] Configure the Supabase database with necessary tables, RLS policies, indexes, and triggers for this project: ${clientPrompt.substring(0, 500)}. Create proper migrations with ENABLE ROW LEVEL SECURITY on all tables.`,
      },
      {
        title: "Criar design system e tema visual",
        intent: "feature",
        brain_type: "design",
        phase: 1,
        depends_on: [],
        prompt: `[DESIGN SPECIALIST] Create a complete design system for this project: ${clientPrompt.substring(0, 300)}. Define CSS variables in index.css (HSL colors), configure tailwind.config.ts with semantic tokens, create component variants. Include dark mode support.`,
      },
      {
        title: "Implementar funcionalidades principais",
        intent: "feature",
        brain_type: "code",
        phase: 2,
        depends_on: [0, 1],
        prompt: `[FULL-STACK SPECIALIST] Implement the core features: ${clientPrompt}. Use the design system tokens already created. Connect to Supabase for data operations. Implement proper error handling and loading states.`,
      },
      {
        title: "Revisão holística e integração",
        intent: "security_fix_v2",
        brain_type: "review",
        phase: 3,
        depends_on: [0, 1, 2],
        prompt: `[REVIEW SPECIALIST] Perform a holistic review of ALL project files:
1. Verify all imports resolve correctly (no missing files)
2. Check that component props match their usage
3. Validate database queries match the schema
4. Ensure RLS policies are properly configured
5. Check for consistent naming conventions
6. Verify the design system tokens are used consistently
7. Fix any broken references or missing exports
8. Ensure the app compiles and runs without errors

Review EVERY file and fix ALL integration issues.`,
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
    if (!client_prompt?.trim()) return json({ error: "client_prompt is required" }, 400);

    const apiKey = Deno.env.get("OPENROUTER_API_KEY") || "";

    let prd: PrdResult;
    let isFallback = false;

    try {
      prd = await generateSpecializedPRD(apiKey, client_prompt, project_type || "web app");
    } catch (e) {
      console.error("[orchestrator-prd] Failed, using fallback:", e);
      prd = fallbackPRD(client_prompt);
      isFallback = true;
    }

    return json({
      success: true,
      fallback: isFallback,
      project_id: project_id || null,
      prd,
      brain_specializations: Object.keys(BRAIN_SPECIALIZATIONS),
    });
  } catch (err) {
    console.error("[orchestrator-prd] Error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
