/**
 * Cirius AI Chat v3 — Deep Intent Understanding + Full Vibecoding Pipeline
 * Flow: Prompt → Deep Classify → Specialized Prompt → OpenRouter/Claude → Smart Merge → Update
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractFilesFromMarkdown } from "../_shared/md-assembly.ts";
import { smartMergeFiles } from "../_shared/smart-merge.ts";
import { getCodeSystemPrompt, buildSpecializedPrdPrompt, type ProjectTemplateType } from "../_shared/cirius-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Deep Command Detection ─────────────────────────────────
// Understands natural language intents beyond first-word matching

type CommandType =
  | "build"        // Create from scratch
  | "add_feature"  // Add new functionality
  | "fix"          // Debug & fix errors
  | "improve"      // Optimize, performance, UX
  | "refine"       // Holistic review + polish
  | "audit"        // Security, accessibility, best-practices audit
  | "test"         // Generate tests, verify behavior
  | "style"        // Visual redesign, CSS, theme changes
  | "remove"       // Delete features, cleanup
  | "refactor"     // Code structure improvements without changing behavior
  | "deploy"       // Deployment prep, env config
  | "explain"      // Explain code, architecture
  | "chat";        // General conversation

interface CommandMatch {
  type: CommandType;
  prompt: string;
  confidence: number;
  subIntent?: string; // e.g. "responsive", "dark_mode", "performance"
}

const COMMAND_PATTERNS: Array<{
  type: CommandType;
  patterns: RegExp[];
  keywords: string[];
  weight: number;
}> = [
  {
    type: "build",
    patterns: [
      /^(crie|criar|cria|build|gere|gerar|construa|monte|implemente|faça|faz|desenvolva|desenvolver|make|create)\b/i,
      /\b(criar|construir|montar|fazer|gerar|desenvolver)\s+(um|uma|o|a)\s+/i,
      /\b(novo|nova)\s+(projeto|app|aplicação|sistema|site|página|pagina|tela)\b/i,
      /\bdo zero\b/i,
      /\bfrom scratch\b/i,
    ],
    keywords: ["crie", "criar", "build", "gere", "gerar", "construa", "monte", "implemente", "faça", "desenvolva", "make", "create", "novo projeto"],
    weight: 3,
  },
  {
    type: "add_feature",
    patterns: [
      /^(adicione|adicionar|add|insira|inserir|inclua|incluir|coloque|colocar|integre|integrar)\b/i,
      /\b(adicionar|inserir|incluir|colocar|integrar)\s+(um|uma|o|a|novo|nova)\s+/i,
      /\bpreciso\s+de\s+(um|uma)\b/i,
      /\bquero\s+(um|uma|que\s+tenha)\b/i,
      /\badd\s+(a|the|new)\b/i,
    ],
    keywords: ["adicione", "adicionar", "add", "insira", "inserir", "inclua", "incluir", "coloque", "integre", "integrar", "preciso de", "quero que tenha"],
    weight: 2.5,
  },
  {
    type: "fix",
    patterns: [
      /^(corrija|corrigir|fix|fixe|arrume|arrumar|conserte|consertar|debug|resolve|resolver)\b/i,
      /\b(não\s+funciona|nao\s+funciona|quebrado|quebrou|broken|error|erro|bug|crash|falha)\b/i,
      /\btá\s+(dando|com)\s+(erro|problema|bug)\b/i,
      /\bnot\s+working\b/i,
      /\btype\s*error\b/i,
      /\bsintax\s*error\b/i,
      /\bimport\s+error\b/i,
      /\bcannot\s+find\b/i,
      /\bundefined\b/i,
    ],
    keywords: ["corrija", "corrigir", "fix", "arrume", "arrumar", "conserte", "debug", "resolver", "erro", "bug", "quebrado", "não funciona", "broken", "error", "crash"],
    weight: 3,
  },
  {
    type: "improve",
    patterns: [
      /^(melhore|melhorar|improve|otimize|otimizar|upgrade|aprimore|aprimorar|evolua|evoluir)\b/i,
      /\b(melhorar|otimizar|aprimorar|evoluir)\s+(a|o|as|os)?\s*/i,
      /\b(mais\s+(rápido|rapido|bonito|moderno|limpo|profissional|elegante|clean))\b/i,
      /\bperformance\b/i,
      /\boptimiz(e|ation)\b/i,
    ],
    keywords: ["melhore", "melhorar", "improve", "otimize", "otimizar", "upgrade", "aprimore", "aprimorar", "evolua", "performance", "mais rápido", "mais bonito", "mais moderno"],
    weight: 2,
  },
  {
    type: "refine",
    patterns: [
      /^(refine|refinar|revise|revisar|review|polish|polir|finalize|finalizar)\b/i,
      /\b(revisão|revisao|review)\s+(completa|geral|holística|holistica|total|final)\b/i,
      /\b(finalizar|polir|dar\s+acabamento)\b/i,
      /\bfine[- ]?tun(e|ing)\b/i,
      /\bajust(e|ar)\s+(fino|final)\b/i,
    ],
    keywords: ["refine", "refinar", "revise", "revisar", "review", "polish", "polir", "finalize", "finalizar", "revisão completa", "fine-tune", "ajuste fino"],
    weight: 2,
  },
  {
    type: "audit",
    patterns: [
      /^(audite|auditar|audit|analise|analisar|analyze|inspecione|inspecionar|inspect|verifique|verificar|verify|check|cheque|checar)\b/i,
      /\b(auditoria|audit)\s+(de\s+)?(segurança|seguranca|security|código|codigo|code|acessibilidade|accessibility|qualidade|quality)\b/i,
      /\b(segurança|seguranca|security)\s+(review|check|scan)\b/i,
      /\bvulnerabilidade\b/i,
      /\bbest\s+practices?\b/i,
      /\bcode\s+quality\b/i,
      /\blint\b/i,
    ],
    keywords: ["audite", "auditar", "audit", "analise", "analisar", "inspecione", "verifique", "verificar", "segurança", "security", "vulnerabilidade", "best practices", "qualidade", "lint"],
    weight: 2.5,
  },
  {
    type: "test",
    patterns: [
      /^(teste|testar|test|valide|validar|validate)\b/i,
      /\b(escreva|gere|criar|crie)\s+(testes|tests)\b/i,
      /\bunit\s+test\b/i,
      /\btest\s+coverage\b/i,
      /\btesting\b/i,
      /\be2e\b/i,
      /\bintegration\s+test\b/i,
    ],
    keywords: ["teste", "testar", "test", "valide", "validar", "testes", "unit test", "test coverage", "e2e"],
    weight: 2,
  },
  {
    type: "style",
    patterns: [
      /^(estilize|estilizar|style|redesign|redesenhe|tema|theme)\b/i,
      /\b(mudar|trocar|alterar)\s+(o\s+)?(visual|design|tema|theme|cores?|layout|estilo|aparência|aparencia)\b/i,
      /\b(dark\s+mode|modo\s+escuro|light\s+mode|modo\s+claro)\b/i,
      /\b(responsivo|responsive|mobile[- ]first)\b/i,
      /\b(animação|animacao|animation|transition|transição|transicao)\b/i,
      /\bcss\b/i,
      /\btailwind\b/i,
    ],
    keywords: ["estilize", "estilizar", "style", "redesign", "tema", "theme", "visual", "cores", "layout", "dark mode", "responsivo", "responsive", "animação", "css", "tailwind"],
    weight: 2,
  },
  {
    type: "remove",
    patterns: [
      /^(remova|remover|remove|delete|deletar|exclua|excluir|apague|apagar|tire|tirar|elimine|eliminar)\b/i,
      /\b(remover|deletar|excluir|apagar|tirar|eliminar)\s+(a|o|as|os)?\s*/i,
      /\b(não\s+preciso|nao\s+preciso|não\s+quero|nao\s+quero)\s+(mais\s+)?(de|do|da|d[eo]s?)?\s*/i,
    ],
    keywords: ["remova", "remover", "remove", "delete", "deletar", "exclua", "excluir", "apague", "tire", "tirar", "elimine"],
    weight: 2.5,
  },
  {
    type: "refactor",
    patterns: [
      /^(refatore|refatorar|refactor|reorganize|reorganizar|reestruture|reestruturar|restructure)\b/i,
      /\b(separar|split|extrair|extract)\s+(em|into)\s+(componentes?|arquivos?|módulos?|files?)\b/i,
      /\b(clean\s*up|limpar|organizar)\s+(o\s+)?(código|codigo|code)\b/i,
      /\bDRY\b/,
      /\bSOLID\b/,
    ],
    keywords: ["refatore", "refatorar", "refactor", "reorganize", "reorganizar", "reestruture", "separar em", "extrair", "clean up", "limpar código", "DRY", "SOLID"],
    weight: 2,
  },
  {
    type: "deploy",
    patterns: [
      /^(deploy|publicar|publish|hospedar|host)\b/i,
      /\b(preparar?\s+para\s+produção|preparar?\s+para\s+producao|production\s+ready)\b/i,
      /\b(deploy|publicar|publish)\b/i,
      /\benv\s+var(iable)?s?\b/i,
    ],
    keywords: ["deploy", "publicar", "publish", "hospedar", "produção", "production ready"],
    weight: 2,
  },
  {
    type: "explain",
    patterns: [
      /^(explique|explicar|explain|como\s+funciona|what\s+does|o\s+que\s+é|o\s+que\s+faz)\b/i,
      /\b(me\s+explica|me\s+conta|me\s+diz)\b/i,
      /\bcomo\s+(funciona|isso\s+funciona|esse|essa)\b/i,
      /\bwhat\s+is\b/i,
      /\bhow\s+does\b/i,
    ],
    keywords: ["explique", "explicar", "explain", "como funciona", "o que é", "o que faz", "me explica"],
    weight: 1.5,
  },
];

function detectCommand(text: string): CommandMatch {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  const normalized = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  let bestType: CommandType = "chat";
  let bestScore = 0;
  let bestSubIntent: string | undefined;

  for (const cmd of COMMAND_PATTERNS) {
    let score = 0;

    // Pattern matching (high priority)
    for (const pattern of cmd.patterns) {
      if (pattern.test(normalized) || pattern.test(lower)) {
        score += 10 * cmd.weight;
      }
    }

    // Keyword matching (additive)
    for (const kw of cmd.keywords) {
      if (normalized.includes(kw.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))) {
        score += kw.length * cmd.weight * 0.5;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestType = cmd.type;
    }
  }

  // Detect sub-intents for richer context
  if (/\b(responsiv[oe]|responsive|mobile)\b/i.test(lower)) bestSubIntent = "responsive";
  else if (/\b(dark\s*mode|modo\s*escuro)\b/i.test(lower)) bestSubIntent = "dark_mode";
  else if (/\b(performance|lento|slow|otimiz)\b/i.test(lower)) bestSubIntent = "performance";
  else if (/\b(segurança|seguranca|security|xss|sql\s*injection|rls)\b/i.test(lower)) bestSubIntent = "security";
  else if (/\b(acessibilidade|accessibility|a11y|aria)\b/i.test(lower)) bestSubIntent = "accessibility";
  else if (/\b(seo|meta\s*tags?|og:)\b/i.test(lower)) bestSubIntent = "seo";
  else if (/\b(i18n|internacionaliz|traduz|translat)\b/i.test(lower)) bestSubIntent = "i18n";
  else if (/\b(typescript|tipos?|types?|tipagem)\b/i.test(lower)) bestSubIntent = "typescript";

  const confidence = Math.min(1, bestScore / 30);

  return { type: bestType, prompt: trimmed, confidence, subIntent: bestSubIntent };
}

// ─── Intent Classification (lightweight inline) ──────────────
type ProjectIntent = "landing_page" | "marketing_site" | "crud_system" | "dashboard" | "ecommerce" | "saas_app" | "api_only" | "component" | "custom";

interface LightBlueprint {
  intent: ProjectIntent;
  needsDatabase: boolean;
  needsAuth: boolean;
  supabaseTables: string[];
  features: string[];
}

const INTENT_KW: Record<ProjectIntent, string[]> = {
  landing_page: ["landing", "landing page", "lp", "squeeze", "hero", "captura"],
  marketing_site: ["site", "website", "institucional", "portfolio", "blog"],
  crud_system: ["sistema", "crud", "gerenciar", "cadastro", "tabela", "listagem", "formulario", "controle", "admin", "gestao"],
  dashboard: ["dashboard", "painel", "metricas", "relatorio", "analytics", "grafico", "kpi"],
  ecommerce: ["loja", "ecommerce", "produto", "carrinho", "cart", "checkout", "catalogo", "shop", "store"],
  saas_app: ["saas", "assinatura", "subscription", "billing", "multi-tenant", "pricing", "freemium"],
  api_only: ["api", "endpoint", "backend", "edge function", "webhook"],
  component: ["componente", "component", "widget", "botao", "modal"],
  custom: [],
};

function classifyLightIntent(prompt: string): LightBlueprint {
  const n = prompt.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, " ");
  let best: ProjectIntent = "custom";
  let bestScore = 0;
  for (const [intent, kws] of Object.entries(INTENT_KW) as [ProjectIntent, string[]][]) {
    let s = 0;
    for (const kw of kws) { if (n.includes(kw)) s += kw.length; }
    if (s > bestScore) { bestScore = s; best = intent; }
  }
  const needsDb = ["crud_system", "dashboard", "ecommerce", "saas_app"].includes(best);
  const needsAuth = needsDb;
  const tables: string[] = [];
  if (best === "crud_system") {
    const m = n.match(/(?:cadastro|tabela|gerenciar|crud)\s+(?:de\s+)?(\w+)/);
    tables.push(m ? m[1].replace(/s$/, "") : "items");
  } else if (best === "ecommerce") tables.push("products", "orders", "order_items", "customers");
  else if (best === "saas_app") tables.push("profiles", "plans", "subscriptions");
  const features: string[] = [];
  if (needsAuth) features.push("auth", "database");
  return { intent: best, needsDatabase: needsDb, needsAuth, supabaseTables: tables, features };
}

// ─── Specialized Prompt Builders ─────────────────────────────

function buildFilesContext(files: Record<string, string>, maxFiles = 25, maxChars = 4000): string {
  return Object.entries(files)
    .filter(([p]) => !p.startsWith(".cirius/"))
    .slice(0, maxFiles)
    .map(([p, c]) => `<file path="${p}">\n${c.slice(0, maxChars)}\n</file>`)
    .join("\n\n");
}

function buildAddFeaturePrompt(prompt: string, files: Record<string, string>, templateType: ProjectTemplateType): string {
  const systemPrompt = getCodeSystemPrompt(templateType);
  return `${systemPrompt}

## IMPORTANT: You are ADDING a feature to an EXISTING project.
## NEVER remove or break existing functionality.
## If you need to update src/App.tsx, include ALL existing routes PLUS the new ones.
## If you need to update package.json, include ALL existing dependencies PLUS new ones.

## REQUEST:
${prompt}

## EXISTING PROJECT FILES (${Object.keys(files).length} files):
${buildFilesContext(files).slice(0, 100000)}

Return ALL new/modified files using <file path="...">COMPLETE content</file> tags.
Include the FULL content of any file you modify — never use "..." or placeholders.`;
}

function buildFixPrompt(prompt: string, files: Record<string, string>, subIntent?: string): string {
  const securityFocus = subIntent === "security"
    ? "\n- Pay special attention to XSS, SQL injection, RLS policies, auth token handling"
    : "";

  return `You are a senior debugger. Analyze the project files and FIX the described problem.

## Problem Description:
${prompt}

## Debugging Checklist:
1. Find the root cause (not just symptoms)
2. Check ALL related imports and exports
3. Verify TypeScript types match actual data
4. Ensure React hooks follow rules (deps, order, conditional)
5. Validate Supabase queries match table schema
6. Check for null/undefined edge cases${securityFocus}
7. Fix ALL affected files — trace the full dependency chain

## Current Project Files (${Object.keys(files).length} files):
${buildFilesContext(files, 20, 3000).slice(0, 80000)}

Return ALL fixed files using <file path="...">COMPLETE content</file>.
Before the code blocks, explain briefly what was broken and why.`;
}

function buildImprovePrompt(prompt: string, files: Record<string, string>, subIntent?: string): string {
  let focusArea = "";
  switch (subIntent) {
    case "performance":
      focusArea = `\n## Performance Focus:
- React.memo, useMemo, useCallback where beneficial
- Lazy loading with React.lazy + Suspense
- Optimize re-renders (split large components)
- Image optimization, code splitting
- Debounce/throttle expensive operations`;
      break;
    case "responsive":
      focusArea = `\n## Responsive Focus:
- Mobile-first approach with Tailwind breakpoints
- Flexible layouts (grid, flexbox)
- Touch targets min 44px
- Responsive typography (clamp)
- Hide/show elements appropriately per breakpoint`;
      break;
    case "accessibility":
      focusArea = `\n## Accessibility Focus:
- Semantic HTML (nav, main, article, section, aside)
- ARIA labels and roles where needed
- Keyboard navigation support
- Color contrast ratios (WCAG AA)
- Focus management and visible focus indicators
- Screen reader friendly content order`;
      break;
    case "seo":
      focusArea = `\n## SEO Focus:
- Meta tags (title, description, og:image, og:title)
- Semantic heading hierarchy (h1 > h2 > h3)
- Structured data where applicable
- Image alt texts
- Clean URL structure`;
      break;
    default:
      focusArea = `\n## General Improvement Areas:
- Code quality and readability
- Error handling and edge cases
- User experience and feedback
- Loading states and empty states
- Consistent design system usage`;
  }

  return `You are a senior developer improving an existing project.
${focusArea}

## Request:
${prompt}

## Current Project Files (${Object.keys(files).length} files):
${buildFilesContext(files, 20, 3000).slice(0, 80000)}

Return ALL improved files using <file path="...">COMPLETE content</file>.
Explain what was improved and why before the code blocks.`;
}

function buildRefinePrompt(files: Record<string, string>, prdJson?: any): string {
  let prdContext = "";
  if (prdJson?.tasks) {
    prdContext = `\nPRD Tasks:\n${prdJson.tasks.map((t: any, i: number) => `${i + 1}. ${t.title}: ${(t.prompt || "").slice(0, 100)}`).join("\n")}\n`;
  }

  return `You are performing a HOLISTIC REVIEW of the entire project.
${prdContext}
## Complete Review Checklist:
1. **Functional completeness** — Does every PRD task have working code?
2. **Import integrity** — All imports resolve, no circular deps, no missing files
3. **TypeScript correctness** — No type errors, proper interfaces, no 'any' abuse
4. **Route completeness** — App.tsx has all pages, navigation links match routes
5. **Responsive design** — Mobile-friendly, proper breakpoints
6. **Error handling** — Try/catch, loading states, empty states, error boundaries
7. **Design consistency** — Consistent use of design tokens, spacing, typography
8. **Auth flow** — If auth exists: protected routes, redirect logic, session handling
9. **Data flow** — Supabase queries match schema, proper RLS awareness
10. **UX polish** — Transitions, hover states, disabled states, feedback messages

## Project Files (${Object.keys(files).length} files):
${Object.entries(files)
  .filter(([p]) => !p.startsWith(".cirius/"))
  .map(([p, c]) => `<file path="${p}">\n${c.slice(0, 5000)}\n</file>`)
  .join("\n\n")
  .slice(0, 100000)}

Return ALL corrected files using <file path="...">COMPLETE content</file>.
List every issue found and fixed.`;
}

function buildAuditPrompt(prompt: string, files: Record<string, string>, subIntent?: string): string {
  let auditType = "general code quality";
  let checklist = "";

  switch (subIntent) {
    case "security":
      auditType = "security";
      checklist = `## Security Audit Checklist:
1. XSS vulnerabilities (dangerouslySetInnerHTML, unescaped user input)
2. SQL injection (raw queries, unsanitized parameters)
3. Authentication bypass (missing auth checks, exposed routes)
4. RLS policies (every table with user data MUST have RLS)
5. API key exposure (secrets in client code, env vars)
6. CORS misconfiguration
7. Input validation (both client and server side)
8. Token handling (storage, expiration, refresh)
9. File upload security (type validation, size limits)
10. Rate limiting considerations`;
      break;
    case "accessibility":
      auditType = "accessibility (WCAG 2.1 AA)";
      checklist = `## Accessibility Audit:
1. Semantic HTML structure
2. ARIA attributes usage
3. Keyboard navigability
4. Color contrast ratios
5. Focus management
6. Alt texts for images
7. Form labels and error messages
8. Skip navigation links
9. Motion/animation preferences (prefers-reduced-motion)
10. Screen reader compatibility`;
      break;
    default:
      checklist = `## General Audit:
1. Code quality, DRY principles, SOLID
2. Error handling completeness
3. TypeScript strictness (no implicit any)
4. Performance anti-patterns
5. Security basics
6. Accessibility basics
7. SEO fundamentals
8. Bundle size concerns
9. Dependency health
10. Code organization and modularity`;
  }

  return `You are performing a thorough ${auditType} AUDIT of this project.

${prompt ? `## Specific Focus:\n${prompt}\n` : ""}
${checklist}

## Project Files (${Object.keys(files).length} files):
${buildFilesContext(files, 30, 3500).slice(0, 90000)}

For each issue found:
- **Severity**: 🔴 Critical / 🟡 Warning / 🔵 Info
- **File**: path
- **Issue**: description
- **Fix**: concrete solution

Then return ALL files that need fixing using <file path="...">COMPLETE content</file>.`;
}

function buildTestPrompt(prompt: string, files: Record<string, string>): string {
  return `You are a QA engineer writing comprehensive tests for this project.

## Request:
${prompt || "Generate tests for all key components and functions."}

## Guidelines:
- Use Vitest + React Testing Library
- Test user interactions, not implementation details
- Cover happy path + edge cases + error states
- Mock Supabase calls appropriately
- Test custom hooks with renderHook
- Ensure proper cleanup in afterEach

## Project Files (${Object.keys(files).length} files):
${buildFilesContext(files, 20, 3000).slice(0, 80000)}

Return test files using <file path="src/__tests__/ComponentName.test.tsx">COMPLETE content</file>.
Include a brief test plan before the code.`;
}

function buildStylePrompt(prompt: string, files: Record<string, string>, subIntent?: string): string {
  let styleGuide = "";
  if (subIntent === "dark_mode") {
    styleGuide = `\n## Dark Mode Implementation:
- Use CSS variables with :root and .dark selectors
- Map all hardcoded colors to design tokens
- Ensure proper contrast in both modes
- Use Tailwind dark: variants consistently`;
  }

  return `You are a UI/UX designer and CSS expert restyling this project.

## Request:
${prompt}
${styleGuide}

## Design Rules:
- Use ONLY Tailwind CSS semantic classes and design tokens
- Never hardcode colors — use HSL CSS variables
- Consistent spacing scale (4, 8, 12, 16, 24, 32, 48, 64)
- Typography hierarchy with proper font sizing
- Smooth transitions (150-300ms) on interactive elements
- Proper hover, active, focus, disabled states
- Mobile-first responsive approach

## Project Files (${Object.keys(files).length} files):
${buildFilesContext(files, 25, 3500).slice(0, 90000)}

Return ALL restyled files using <file path="...">COMPLETE content</file>.
Include updated index.css and tailwind.config if needed.`;
}

function buildRemovePrompt(prompt: string, files: Record<string, string>): string {
  return `You are cleaning up and removing features/code from this project.

## What to Remove:
${prompt}

## CRITICAL RULES:
1. Remove ALL related files (components, hooks, utils, styles, tests)
2. Remove ALL imports/references to deleted code
3. Update App.tsx routes — remove deleted page routes
4. Update navigation — remove links to deleted pages
5. Update package.json ONLY if removing a dependency entirely
6. NEVER leave broken imports or dead references
7. Verify the app still compiles after removal

## Project Files (${Object.keys(files).length} files):
${buildFilesContext(files, 25, 3000).slice(0, 80000)}

Return ALL modified files using <file path="...">COMPLETE content</file>.
List what was removed. For deleted files, return them with content "// DELETED".`;
}

function buildRefactorPrompt(prompt: string, files: Record<string, string>): string {
  return `You are refactoring code WITHOUT changing behavior.

## Request:
${prompt}

## Refactoring Principles:
1. Same behavior, better structure
2. Extract reusable components/hooks/utils
3. Eliminate code duplication (DRY)
4. Improve naming for clarity
5. Split large files (>200 lines)
6. Proper separation of concerns
7. Consistent patterns across codebase
8. ALL imports must resolve after refactoring
9. ALL tests must still pass

## Project Files (${Object.keys(files).length} files):
${buildFilesContext(files, 25, 3500).slice(0, 90000)}

Return ALL affected files using <file path="...">COMPLETE content</file>.
Explain each refactoring decision.`;
}

function buildExplainPrompt(prompt: string, files: Record<string, string>): string {
  return `You are a senior developer explaining this codebase.

## Question:
${prompt}

## Project Files (${Object.keys(files).length} files):
${buildFilesContext(files, 15, 2500).slice(0, 60000)}

Provide a clear, structured explanation:
1. Architecture overview
2. Data flow
3. Key components and their responsibilities
4. How the specific thing asked about works
5. Potential improvements

Do NOT return <file> blocks unless the user asked for changes.
Use markdown formatting for clarity.`;
}

function buildDeployPrompt(prompt: string, files: Record<string, string>): string {
  return `You are preparing this project for production deployment.

## Request:
${prompt}

## Deployment Checklist:
1. Environment variables properly configured
2. Build optimization (tree shaking, code splitting)
3. Error boundaries in place
4. Console.log cleanup (remove debug logs)
5. SEO meta tags configured
6. Favicon and manifest.json
7. 404/error pages
8. Loading performance (lazy loading, Suspense)
9. Security headers consideration
10. API endpoints use env vars, not hardcoded URLs

## Project Files (${Object.keys(files).length} files):
${buildFilesContext(files, 25, 3000).slice(0, 80000)}

Return ALL files that need changes using <file path="...">COMPLETE content</file>.
List everything that needs manual attention (env vars, DNS, etc).`;
}

// ─── File Extraction ────────────────────────────────────────

function extractFileBlocks(text: string): Record<string, string> {
  const files: Record<string, string> = {};
  const re = /<file\s+path="([^"]+)">([\s\S]*?)<\/file>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const path = m[1].trim().replace(/^\.\//, "");
    const content = m[2].replace(/^\n/, "").replace(/\s+$/, "") + "\n";
    if (path && content.trim().length > 1 && content.trim() !== "// DELETED") files[path] = content;
  }
  if (Object.keys(files).length === 0) {
    const cbRe = /```(?:\w+)?\s+((?:src|public|index|vite|tailwind|tsconfig|package|supabase)[^\n]*)\n([\s\S]*?)```/g;
    while ((m = cbRe.exec(text)) !== null) {
      const path = m[1].trim();
      const content = m[2].replace(/^\n/, "").replace(/\s+$/, "") + "\n";
      if (path.includes(".") && content.trim().length > 1) files[path] = content;
    }
  }
  return files;
}

// Handle file deletions separately
function extractDeletedFiles(text: string): string[] {
  const deleted: string[] = [];
  const re = /<file\s+path="([^"]+)">\s*\/\/\s*DELETED\s*<\/file>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    deleted.push(m[1].trim().replace(/^\.\//, ""));
  }
  return deleted;
}

// ─── PRD JSON Extraction ────────────────────────────────────

function extractPrdJSON(content: string): { tasks: Array<{ title: string; brain_type: string; prompt: string }>; summary?: string } | null {
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
    if (parsed.tasks && Array.isArray(parsed.tasks) && parsed.tasks.length > 0) return parsed;
  } catch { /* invalid */ }
  return null;
}

// ─── AI Engine: OpenRouter (Claude) — EXCLUSIVE ─────────────

async function sendViaOpenRouter(
  messages: Array<{ role: string; content: string }>,
  opts: { stream?: boolean; maxTokens?: number } = {},
): Promise<Response | { content: string | null; durationMs: number; error?: string }> {
  const key = Deno.env.get("OPENROUTER_API_KEY");
  const t0 = Date.now();
  if (!key) return { content: null, durationMs: 0, error: "OPENROUTER_API_KEY not set" };

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://starble.lovable.app",
      "X-Title": "Cirius AI Editor",
    },
    body: JSON.stringify({
      model: "anthropic/claude-sonnet-4",
      messages,
      temperature: 0.3,
      max_tokens: opts.maxTokens || 16000,
      stream: opts.stream || false,
    }),
  });

  if (opts.stream) return res;

  const d = Date.now() - t0;
  if (res.ok) {
    const r = await res.json();
    return { content: r?.choices?.[0]?.message?.content || null, durationMs: d };
  }
  const e = await res.text().catch(() => "");
  return { content: null, durationMs: d, error: `HTTP ${res.status}: ${e.slice(0, 100)}` };
}

// ─── Sequential Task Execution (Build Command) ──────────────

async function executeSequentialBuild(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  projectName: string,
  prd: { tasks: Array<{ title: string; brain_type: string; prompt: string }>; summary?: string },
  existingFiles: Record<string, string>,
  templateType: ProjectTemplateType,
): Promise<{ ok: boolean; files: Record<string, string>; tasksDone: number; error?: string }> {
  let currentFiles = { ...existingFiles };
  let tasksDone = 0;
  const totalTasks = prd.tasks.length;
  const codeSystemPrompt = getCodeSystemPrompt(templateType);

  for (let i = 0; i < totalTasks; i++) {
    const task = prd.tasks[i];
    const progressPct = Math.round(20 + (60 * (i / totalTasks)));

    await supabase.from("cirius_projects").update({
      status: "generating_code", progress_pct: progressPct,
      current_step: `task_${i + 1}_of_${totalTasks}`,
    }).eq("id", projectId);

    await supabase.from("cirius_generation_log").insert({
      project_id: projectId, step: `task_${i + 1}`, status: "started",
      message: `Executando tarefa ${i + 1}/${totalTasks}: ${task.title}`, level: "info",
    });

    const fileContext = Object.keys(currentFiles).length > 0
      ? `\n\nARQUIVOS JÁ GERADOS (${Object.keys(currentFiles).length} arquivos):\n${Object.entries(currentFiles).filter(([p]) => !p.startsWith(".cirius/")).slice(0, 25).map(([p, c]) => `<file path="${p}">\n${c.slice(0, 4000)}\n</file>`).join("\n\n")}`
      : "";

    const isFirstTask = i === 0;
    const foundationNote = isFirstTask
      ? `\n\nCRITICAL: This is the FIRST task. You MUST generate ALL foundation files:\n- index.html, src/main.tsx, src/App.tsx (with ALL routes), src/index.css\n- package.json, vite.config.ts, tailwind.config.js, tsconfig.json\n- Layout components (Header/Navbar, Footer)\n${["crud_system", "ecommerce", "saas_app"].includes(templateType) ? "- supabase/schema.sql with CREATE TABLE + RLS\n- src/lib/supabase.ts\n- src/contexts/AuthContext.tsx + Login/Register pages" : ""}`
      : `\n\nIMPORTANT: Previous files already exist. Maintain compatibility.\nIf adding routes, include the COMPLETE updated App.tsx with ALL existing + new routes.\nNEVER remove existing routes or imports.`;

    const taskPrompt = `You are building project "${projectName}".
Stack: React 18 + Vite 5 + TypeScript + Tailwind CSS 3 + shadcn/ui + React Router DOM + Supabase

## Current Task (${i + 1}/${totalTasks}): ${task.title}

${task.prompt}
${foundationNote}
${fileContext}

Return ALL files using <file path="path/to/file.tsx">COMPLETE file content</file> tags.
Output COMPLETE file content — never use "..." or placeholders.`;

    const messages = [
      { role: "system", content: codeSystemPrompt },
      { role: "user", content: taskPrompt },
    ];

    const result = await sendViaOpenRouter(messages);
    let content: string | null = null;

    if ("content" in result && result.content && result.content.length > 100) {
      content = result.content;
    }

    if (!content) {
      await supabase.from("cirius_generation_log").insert({
        project_id: projectId, step: `task_${i + 1}`, status: "failed",
        message: `Tarefa ${i + 1} falhou: sem resposta da IA`, level: "error",
      });
      continue;
    }

    let newFiles = extractFileBlocks(content);
    if (Object.keys(newFiles).length === 0) newFiles = extractFilesFromMarkdown(content);

    if (Object.keys(newFiles).length > 0) {
      currentFiles = smartMergeFiles(currentFiles, newFiles);
      tasksDone++;

      await supabase.from("cirius_projects").update({
        source_files_json: currentFiles, updated_at: new Date().toISOString(),
      }).eq("id", projectId);

      await supabase.from("cirius_generation_log").insert({
        project_id: projectId, step: `task_${i + 1}`, status: "completed",
        message: `Tarefa ${i + 1} concluída: ${Object.keys(newFiles).length} arquivos (smart merge)`,
        level: "info", metadata: { file_count: Object.keys(newFiles).length },
      });
    } else {
      await supabase.from("cirius_generation_log").insert({
        project_id: projectId, step: `task_${i + 1}`, status: "completed",
        message: `Tarefa ${i + 1}: resposta sem arquivos (texto/explicação)`, level: "warning",
      });
    }
  }

  return { ok: tasksDone > 0, files: currentFiles, tasksDone };
}

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, project_id, stream: wantStream } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let userId: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
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

    // Load project
    let projectFiles: Record<string, string> = {};
    let projectName = "Cirius Project";
    let projectPrd: any = null;
    let templateType: ProjectTemplateType = "custom";

    if (project_id) {
      const { data: proj } = await supabase
        .from("cirius_projects")
        .select("source_files_json, name, prd_json, template_type")
        .eq("id", project_id)
        .maybeSingle();

      if (proj) {
        if (proj.source_files_json && typeof proj.source_files_json === "object") {
          projectFiles = proj.source_files_json as Record<string, string>;
        }
        projectName = proj.name || projectName;
        projectPrd = proj.prd_json;
        templateType = (proj.template_type as ProjectTemplateType) || "custom";
      }
    }

    const latestMsg = messages[messages.length - 1]?.content || "";
    const command = detectCommand(latestMsg);
    console.log(`[cirius-ai-chat] Command: ${command.type} (confidence: ${command.confidence}, sub: ${command.subIntent || "none"}), Template: ${templateType}, Project: ${project_id?.slice(0, 8)}`);

    // ═══════════════════════════════════════════════════════════
    // BUILD COMMAND → PRD → Sequential Tasks via Claude
    // ═══════════════════════════════════════════════════════════
    if (command.type === "build" && project_id) {
      const blueprint = classifyLightIntent(command.prompt);
      if (templateType === "custom") templateType = blueprint.intent;

      const prdPrompt = buildSpecializedPrdPrompt(command.prompt, projectName, templateType, projectFiles, blueprint);
      const prdMessages = [
        { role: "system", content: "Return only valid JSON, no markdown fences." },
        { role: "user", content: prdPrompt },
      ];

      let prd: any = null;
      const orResult = await sendViaOpenRouter(prdMessages);
      if ("content" in orResult && orResult.content) prd = extractPrdJSON(orResult.content);

      if (!prd || !prd.tasks?.length) {
        return new Response(JSON.stringify({
          ok: true, content: "❌ Não consegui gerar o plano. Reformule com mais detalhes.",
          command_type: "build", provider: "claude_direct", files_updated: 0, updated_paths: [],
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await supabase.from("cirius_projects").update({
        prd_json: prd, status: "generating_code", progress_pct: 20,
        generation_started_at: new Date().toISOString(),
        generation_engine: "claude_direct", template_type: templateType,
      }).eq("id", project_id);

      const result = await executeSequentialBuild(
        supabase, userId, project_id, projectName, prd, projectFiles, templateType,
      );

      if (result.ok) {
        await supabase.from("cirius_projects").update({
          status: "refining", progress_pct: 85, current_step: "refining",
        }).eq("id", project_id);

        const codeSystemPrompt = getCodeSystemPrompt(templateType);
        const refineMessages = [
          { role: "system", content: codeSystemPrompt },
          { role: "user", content: buildRefinePrompt(result.files, prd) },
        ];

        let refinedFiles = result.files;
        const refResult = await sendViaOpenRouter(refineMessages);
        if ("content" in refResult && refResult.content) {
          const refFiles = extractFileBlocks(refResult.content);
          if (Object.keys(refFiles).length > 0) {
            refinedFiles = smartMergeFiles(refinedFiles, refFiles);
          }
        }

        await supabase.from("cirius_projects").update({
          source_files_json: refinedFiles, status: "live", progress_pct: 100,
          generation_ended_at: new Date().toISOString(), current_step: "completed",
        }).eq("id", project_id);

        const taskList = prd.tasks.map((t: any, i: number) => `${i + 1}. **${t.title}**`).join("\n");
        return new Response(JSON.stringify({
          ok: true,
          content: `🚀 **Projeto construído com sucesso!**\n\n${prd.summary || ""}\n\n**${result.tasksDone}/${prd.tasks.length} tarefas completadas:**\n${taskList}\n\n✅ ${Object.keys(refinedFiles).length} arquivos gerados.`,
          command_type: "build", provider: "claude_direct",
          files_updated: Object.keys(refinedFiles).length,
          updated_paths: Object.keys(refinedFiles),
          pipeline: { status: "completed", task_count: result.tasksDone, template: templateType },
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } else {
        await supabase.from("cirius_projects").update({
          status: "failed", error_message: "Nenhuma tarefa completou com sucesso",
        }).eq("id", project_id);

        return new Response(JSON.stringify({
          ok: false, content: "❌ O build falhou. Tente com um prompt mais detalhado.",
          command_type: "build", provider: "claude_direct", files_updated: 0, updated_paths: [],
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // ADD FEATURE → Smart merge into existing project
    // ═══════════════════════════════════════════════════════════
    if (command.type === "add_feature" && project_id) {
      const featurePrompt = buildAddFeaturePrompt(command.prompt, projectFiles, templateType);
      const aiMessages = [
        { role: "system", content: getCodeSystemPrompt(templateType) },
        { role: "user", content: featurePrompt },
      ];

      let assistantContent = "";
      const orResult = await sendViaOpenRouter(aiMessages);
      if ("content" in orResult && orResult.content && orResult.content.length > 10) {
        assistantContent = orResult.content;
      }

      if (!assistantContent) {
        return new Response(JSON.stringify({
          ok: false, content: "⚠️ Não consegui gerar a feature. Tente novamente.",
          command_type: "add_feature", files_updated: 0, updated_paths: [],
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let newFiles = extractFileBlocks(assistantContent);
      if (Object.keys(newFiles).length === 0) newFiles = extractFilesFromMarkdown(assistantContent);

      const filesUpdated = Object.keys(newFiles).length;
      const updatedPaths = Object.keys(newFiles);

      if (filesUpdated > 0) {
        const merged = smartMergeFiles(projectFiles, newFiles);
        await supabase.from("cirius_projects").update({
          source_files_json: merged, updated_at: new Date().toISOString(),
        }).eq("id", project_id);
      }

      const summary = filesUpdated > 0
        ? `✅ Feature adicionada! ${filesUpdated} arquivo(s) atualizado(s):\n${updatedPaths.slice(0, 10).map(f => `• \`${f}\``).join("\n")}`
        : assistantContent.split(/<file\s/)[0]?.trim().slice(0, 400) || assistantContent.slice(0, 400);

      if (project_id) {
        await supabase.from("cirius_chat_messages").insert({
          project_id, user_id: userId, role: "assistant", content: summary,
          metadata: { command_type: "add_feature", provider: "openrouter_claude", files_updated: filesUpdated },
        });
      }

      return new Response(JSON.stringify({
        ok: true, content: summary, raw_content: assistantContent,
        command_type: "add_feature", provider: "openrouter_claude",
        files_updated: filesUpdated, updated_paths: updatedPaths,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ═══════════════════════════════════════════════════════════
    // ALL OTHER COMMANDS (fix, improve, refine, audit, test, style, remove, refactor, deploy, explain, chat)
    // ═══════════════════════════════════════════════════════════

    const codeSystemPrompt = getCodeSystemPrompt(templateType);
    let userPrompt: string;
    let commandLabel = command.type;

    switch (command.type) {
      case "fix":
        userPrompt = buildFixPrompt(command.prompt, projectFiles, command.subIntent);
        break;
      case "improve":
        userPrompt = buildImprovePrompt(command.prompt, projectFiles, command.subIntent);
        break;
      case "refine":
        userPrompt = buildRefinePrompt(projectFiles, projectPrd);
        break;
      case "audit":
        userPrompt = buildAuditPrompt(command.prompt, projectFiles, command.subIntent);
        break;
      case "test":
        userPrompt = buildTestPrompt(command.prompt, projectFiles);
        break;
      case "style":
        userPrompt = buildStylePrompt(command.prompt, projectFiles, command.subIntent);
        break;
      case "remove":
        userPrompt = buildRemovePrompt(command.prompt, projectFiles);
        break;
      case "refactor":
        userPrompt = buildRefactorPrompt(command.prompt, projectFiles);
        break;
      case "deploy":
        userPrompt = buildDeployPrompt(command.prompt, projectFiles);
        break;
      case "explain":
        userPrompt = buildExplainPrompt(command.prompt, projectFiles);
        break;
      default: {
        // Chat — include conversation history + project context
        const filesContext = Object.keys(projectFiles).length > 0
          ? `\nPROJECT FILES (${Object.keys(projectFiles).length}):\n${Object.keys(projectFiles).filter(f => !f.startsWith(".cirius/")).slice(0, 30).join(", ")}` : "";
        userPrompt = messages.slice(-20)
          .map((m: any) => `${m.role.toUpperCase()}:\n${String(m.content || "").slice(0, 6000)}`)
          .join("\n\n") + filesContext;
        commandLabel = "chat";
      }
    }

    const aiMessages = [
      { role: "system", content: codeSystemPrompt },
      { role: "user", content: userPrompt },
    ];

    // Streaming SSE mode
    if (wantStream) {
      try {
        const streamRes = await sendViaOpenRouter(aiMessages, { stream: true });
        if (streamRes instanceof Response && streamRes.ok && streamRes.body) {
          return new Response(streamRes.body, {
            headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
          });
        }
      } catch (e) {
        console.warn("[cirius-ai-chat] Streaming failed, falling back:", e);
      }
    }

    // Non-streaming
    let assistantContent = "";
    const orResult = await sendViaOpenRouter(aiMessages);
    if ("content" in orResult && orResult.content && orResult.content.length > 10) {
      assistantContent = orResult.content;
    }

    if (!assistantContent || assistantContent.trim().length < 2) {
      return new Response(JSON.stringify({
        ok: false, error: "Empty AI response",
        content: "⚠️ Não consegui gerar resposta. Tente novamente.",
        command_type: commandLabel, provider: "openrouter_claude", files_updated: 0, updated_paths: [],
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Extract and apply file changes
    let filesUpdated = 0;
    let updatedPaths: string[] = [];
    let deletedPaths: string[] = [];

    if (project_id) {
      let newFiles = extractFileBlocks(assistantContent);
      if (Object.keys(newFiles).length === 0) newFiles = extractFilesFromMarkdown(assistantContent);
      deletedPaths = extractDeletedFiles(assistantContent);
      filesUpdated = Object.keys(newFiles).length;
      updatedPaths = Object.keys(newFiles);

      if (filesUpdated > 0 || deletedPaths.length > 0) {
        let merged = smartMergeFiles(projectFiles, newFiles);
        // Remove deleted files
        for (const dp of deletedPaths) {
          delete merged[dp];
        }
        await supabase.from("cirius_projects").update({
          source_files_json: merged, updated_at: new Date().toISOString(),
        }).eq("id", project_id);
      }
    }

    // Build summary
    let summary: string;
    if (command.type === "explain") {
      // For explain, show the full response (no file extraction summary)
      summary = assistantContent.slice(0, 2000);
    } else if (filesUpdated > 0 || deletedPaths.length > 0) {
      const parts: string[] = [];
      if (filesUpdated > 0) parts.push(`${filesUpdated} arquivo(s) atualizado(s):\n${updatedPaths.slice(0, 10).map(f => `• \`${f}\``).join("\n")}`);
      if (deletedPaths.length > 0) parts.push(`${deletedPaths.length} arquivo(s) removido(s):\n${deletedPaths.map(f => `• ~~\`${f}\`~~`).join("\n")}`);
      summary = `✅ ${command.type.toUpperCase()} concluído!\n\n${parts.join("\n\n")}`;
    } else {
      summary = assistantContent.split(/<file\s/)[0]?.trim().slice(0, 800) || assistantContent.slice(0, 800);
    }

    if (project_id) {
      await supabase.from("cirius_chat_messages").insert({
        project_id, user_id: userId, role: "assistant", content: summary,
        metadata: { command_type: commandLabel, provider: "openrouter_claude", files_updated: filesUpdated, sub_intent: command.subIntent },
      });
    }

    return new Response(JSON.stringify({
      ok: true, content: summary, raw_content: assistantContent,
      command_type: commandLabel, provider: "openrouter_claude",
      files_updated: filesUpdated, updated_paths: updatedPaths,
      deleted_paths: deletedPaths,
      sub_intent: command.subIntent,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("cirius-ai-chat error:", e);
    return new Response(JSON.stringify({
      ok: false, error: e instanceof Error ? e.message : "Unknown error",
      content: "⚠️ O Cirius teve uma falha temporária. Tente novamente.",
      files_updated: 0, updated_paths: [],
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
