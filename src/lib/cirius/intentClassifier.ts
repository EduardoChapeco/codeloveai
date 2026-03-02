// ─── Intent Classifier for Cirius AI Coding Assistant ───────────────────────

export type ProjectIntent =
  | "landing_page"
  | "marketing_site"
  | "crud_system"
  | "dashboard"
  | "ecommerce"
  | "saas_app"
  | "api_only"
  | "component"
  | "custom";

export interface ProjectBlueprint {
  intent: ProjectIntent;
  needsDatabase: boolean;
  needsAuth: boolean;
  needsPayments: boolean;
  needsStorage: boolean;
  suggestedEngine: "brain" | "brainchain" | "orchestrator";
  suggestedSkill: "design" | "code" | "general";
  estimatedTasks: number;
  generationStrategy: "single_shot" | "multi_task" | "iterative";
  supabaseTables: string[];
  features: string[];
}

export interface PRDTask {
  title: string;
  prompt: string;
  intent: ProjectIntent;
  stop_condition: string;
  brain_skill: "design" | "frontend" | "backend" | "database" | "review" | "general";
}

// ─── Keyword maps ───────────────────────────────────────────────────────────

const INTENT_KEYWORDS: Record<ProjectIntent, string[]> = {
  landing_page: [
    "landing", "landing page", "página", "pagina", "one page", "onepage",
    "single page", "lp", "captura", "squeeze", "hero",
  ],
  marketing_site: [
    "site", "website", "institucional", "portfolio", "portfólio",
    "multi page", "blog", "sobre nós", "contato",
  ],
  crud_system: [
    "sistema", "crud", "gerenciar", "gerenciamento", "cadastro", "cadastrar",
    "tabela", "listagem", "formulário", "registro", "controle", "admin",
    "backoffice", "back office", "gestão", "gestao",
  ],
  dashboard: [
    "dashboard", "painel", "métricas", "metricas", "relatório", "relatorio",
    "analytics", "gráfico", "grafico", "chart", "kpi", "indicador",
    "monitoramento", "overview",
  ],
  ecommerce: [
    "loja", "ecommerce", "e-commerce", "produto", "carrinho", "cart",
    "checkout", "vender", "venda", "pedido", "order", "catálogo",
    "catalogo", "shop", "store", "marketplace",
  ],
  saas_app: [
    "saas", "assinatura", "plano", "billing", "subscription", "multi-tenant",
    "multitenant", "tenant", "recurring", "pricing", "freemium",
    "onboarding", "trial",
  ],
  api_only: [
    "api", "endpoint", "backend", "edge function", "webhook", "rest",
    "graphql", "microservice", "serviço", "servico",
  ],
  component: [
    "componente", "component", "widget", "botão", "botao", "modal",
    "card", "ui element", "ui kit", "design system",
  ],
  custom: [],
};

const FEATURE_KEYWORDS: Record<string, string[]> = {
  auth: ["login", "autenticação", "autenticacao", "signup", "cadastro", "senha", "password", "oauth", "sso"],
  payments: ["pagamento", "payment", "stripe", "pix", "checkout", "cobrança", "cobranca", "fatura", "invoice"],
  storage: ["upload", "arquivo", "file", "imagem", "image", "foto", "photo", "mídia", "media", "storage"],
  notifications: ["notificação", "notificacao", "notification", "email", "push", "alerta", "alert"],
  search: ["busca", "search", "filtro", "filter", "pesquisa"],
  realtime: ["realtime", "tempo real", "chat", "live", "websocket", "ao vivo"],
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreIntent(prompt: string): { intent: ProjectIntent; score: number }[] {
  const norm = normalise(prompt);
  const scores: { intent: ProjectIntent; score: number }[] = [];

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS) as [ProjectIntent, string[]][]) {
    let score = 0;
    for (const kw of keywords) {
      if (norm.includes(kw)) {
        // longer keyword = higher confidence
        score += kw.length;
      }
    }
    scores.push({ intent, score });
  }

  return scores.sort((a, b) => b.score - a.score);
}

function detectFeatures(prompt: string): string[] {
  const norm = normalise(prompt);
  const found: string[] = [];

  for (const [feature, keywords] of Object.entries(FEATURE_KEYWORDS)) {
    if (keywords.some((kw) => norm.includes(kw))) {
      found.push(feature);
    }
  }
  return found;
}

function detectTableNames(prompt: string, intent: ProjectIntent): string[] {
  const norm = normalise(prompt);

  // Common entity extraction via simple patterns
  const entityHints: string[] = [];
  const patterns = [
    /(?:cadastro|tabela|lista|gerenciar|crud)\s+(?:de\s+)?(\w+)/gi,
    /(\w+)\s+(?:management|manager|listing)/gi,
  ];
  for (const p of patterns) {
    let m: RegExpExecArray | null;
    while ((m = p.exec(norm)) !== null) {
      const w = m[1].replace(/s$/, ""); // naive singular
      if (w.length > 2) entityHints.push(w);
    }
  }

  // Defaults per intent
  const defaults: Record<string, string[]> = {
    crud_system: entityHints.length ? entityHints : ["items"],
    ecommerce: ["products", "orders", "order_items", "customers"],
    saas_app: ["profiles", "subscriptions", "plans", "usage_logs"],
    dashboard: ["metrics", "reports"],
  };

  return defaults[intent] ?? [];
}

// ─── Main classifier ────────────────────────────────────────────────────────

export function classifyIntent(userPrompt: string): ProjectBlueprint {
  const ranked = scoreIntent(userPrompt);
  const top = ranked[0];
  const intent: ProjectIntent = top.score > 0 ? top.intent : "custom";

  const features = detectFeatures(userPrompt);
  const tables = detectTableNames(userPrompt, intent);

  const needsDatabase = ["crud_system", "dashboard", "ecommerce", "saas_app"].includes(intent)
    || features.includes("auth")
    || tables.length > 0;

  const needsAuth = ["crud_system", "dashboard", "ecommerce", "saas_app"].includes(intent)
    || features.includes("auth");

  const needsPayments = ["ecommerce", "saas_app"].includes(intent)
    || features.includes("payments");

  const needsStorage = features.includes("storage");

  // Engine selection
  let suggestedEngine: ProjectBlueprint["suggestedEngine"] = "brainchain";
  if (["ecommerce", "saas_app"].includes(intent)) {
    suggestedEngine = "orchestrator";
  } else if (["crud_system", "dashboard", "api_only"].includes(intent)) {
    suggestedEngine = "brain";
  }

  // Skill selection
  let suggestedSkill: ProjectBlueprint["suggestedSkill"] = "general";
  if (["landing_page", "marketing_site", "component"].includes(intent)) {
    suggestedSkill = "design";
  } else if (["crud_system", "api_only", "saas_app"].includes(intent)) {
    suggestedSkill = "code";
  }

  // Task estimation
  const taskMap: Record<ProjectIntent, number> = {
    landing_page: 2,
    marketing_site: 3,
    component: 1,
    api_only: 2,
    crud_system: 5,
    dashboard: 4,
    ecommerce: 7,
    saas_app: 8,
    custom: 3,
  };
  let estimatedTasks = taskMap[intent];
  if (needsPayments) estimatedTasks = Math.min(10, estimatedTasks + 1);
  if (needsStorage) estimatedTasks = Math.min(10, estimatedTasks + 1);

  // Generation strategy
  let generationStrategy: ProjectBlueprint["generationStrategy"] = "single_shot";
  if (estimatedTasks >= 5) generationStrategy = "multi_task";
  else if (estimatedTasks >= 3) generationStrategy = "iterative";

  // Collect feature labels
  const featureLabels = [...features];
  if (needsAuth && !featureLabels.includes("auth")) featureLabels.push("auth");
  if (needsDatabase) featureLabels.push("database");
  if (needsPayments && !featureLabels.includes("payments")) featureLabels.push("payments");

  return {
    intent,
    needsDatabase,
    needsAuth,
    needsPayments,
    needsStorage,
    suggestedEngine,
    suggestedSkill,
    estimatedTasks,
    generationStrategy,
    supabaseTables: tables,
    features: featureLabels,
  };
}

// ─── Supabase Schema Generator ──────────────────────────────────────────────

export function generateSupabaseSchema(blueprint: ProjectBlueprint): string {
  if (!blueprint.needsDatabase || blueprint.supabaseTables.length === 0) return "";

  const lines: string[] = [
    "-- Auto-generated by Cirius Intent Classifier",
    "-- Intent: " + blueprint.intent,
    "",
  ];

  // Reusable updated_at trigger
  lines.push(`CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
`);

  if (blueprint.intent === "ecommerce") {
    lines.push(ecommerceSchema());
  } else if (blueprint.intent === "saas_app") {
    lines.push(saasSchema());
  } else if (blueprint.intent === "dashboard") {
    lines.push(dashboardSchema(blueprint.supabaseTables));
  } else {
    // Generic CRUD tables
    for (const table of blueprint.supabaseTables) {
      lines.push(genericTableSchema(table, blueprint.needsAuth));
    }
  }

  return lines.join("\n");
}

function rlsBlock(table: string): string {
  return `
ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;

CREATE POLICY "${table}_select_own" ON public.${table}
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "${table}_insert_own" ON public.${table}
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "${table}_update_own" ON public.${table}
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "${table}_delete_own" ON public.${table}
  FOR DELETE USING (auth.uid() = user_id);
`;
}

function updatedAtTrigger(table: string): string {
  return `
CREATE TRIGGER trg_${table}_updated_at
  BEFORE UPDATE ON public.${table}
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
`;
}

function genericTableSchema(table: string, withAuth: boolean): string {
  const userCol = withAuth ? "\n  user_id UUID NOT NULL," : "";
  return `
CREATE TABLE public.${table} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),${userCol}
  name TEXT NOT NULL DEFAULT '',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
${withAuth ? rlsBlock(table) : ""}${updatedAtTrigger(table)}`;
}

function ecommerceSchema(): string {
  return `
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  stock INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
${rlsBlock("products")}${updatedAtTrigger("products")}

CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
${rlsBlock("customers")}${updatedAtTrigger("customers")}

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  customer_id UUID REFERENCES public.customers(id),
  status TEXT NOT NULL DEFAULT 'pending',
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
${rlsBlock("orders")}${updatedAtTrigger("orders")}

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
${rlsBlock("order_items")}`;
}

function saasSchema(): string {
  return `
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  interval TEXT NOT NULL DEFAULT 'monthly',
  features JSONB DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans_public_read" ON public.plans FOR SELECT USING (true);

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  plan_id UUID NOT NULL REFERENCES public.plans(id),
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
${rlsBlock("subscriptions")}${updatedAtTrigger("subscriptions")}

CREATE TABLE public.usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  event TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
${rlsBlock("usage_logs")}`;
}

function dashboardSchema(tables: string[]): string {
  const out: string[] = [];
  for (const t of tables) {
    out.push(genericTableSchema(t, true));
  }
  return out.join("\n");
}

// ─── PRD Task Generator ─────────────────────────────────────────────────────

export function generatePRDTasks(userPrompt: string, blueprint: ProjectBlueprint): PRDTask[] {
  const tasks: PRDTask[] = [];

  // 1 — Setup base (always)
  tasks.push({
    title: "Setup Base do Projeto",
    prompt: `Crie a estrutura base do projeto React + Vite + Tailwind CSS. Configure o index.html, App.tsx, main.tsx e os estilos globais. O projeto é: ${userPrompt}`,
    intent: blueprint.intent,
    stop_condition: "App.tsx renderiza sem erros e exibe layout básico",
    brain_skill: "frontend",
  });

  // 2 — Database schema
  if (blueprint.needsDatabase) {
    const schema = generateSupabaseSchema(blueprint);
    tasks.push({
      title: "Schema do Banco de Dados",
      prompt: `Crie o schema Supabase para o projeto. Tabelas: ${blueprint.supabaseTables.join(", ")}. SQL sugerido:\n\n${schema}`,
      intent: blueprint.intent,
      stop_condition: "Todas as tabelas criadas com RLS ativo e políticas configuradas",
      brain_skill: "database",
    });
  }

  // 3 — Auth
  if (blueprint.needsAuth) {
    tasks.push({
      title: "Autenticação de Usuários",
      prompt: "Implemente autenticação com email/senha usando Supabase Auth. Crie páginas de Login e Registro com validação, loading states e redirecionamento após login. Proteja as rotas autenticadas.",
      intent: blueprint.intent,
      stop_condition: "Usuário consegue registrar, fazer login e acessar rotas protegidas",
      brain_skill: "backend",
    });
  }

  // 4 — Core features
  const corePrompt = buildCorePrompt(userPrompt, blueprint);
  tasks.push({
    title: "Features Principais",
    prompt: corePrompt,
    intent: blueprint.intent,
    stop_condition: "Todas as features principais funcionais com CRUD completo",
    brain_skill: blueprint.suggestedSkill === "design" ? "frontend" : "backend",
  });

  // 5 — UI / Dashboard
  if (["dashboard", "saas_app", "ecommerce", "crud_system"].includes(blueprint.intent)) {
    tasks.push({
      title: "Interface e Dashboard",
      prompt: `Crie o dashboard principal com: navegação lateral, cards de resumo, tabelas de dados e filtros. Use os dados das tabelas: ${blueprint.supabaseTables.join(", ")}. Design moderno e responsivo.`,
      intent: blueprint.intent,
      stop_condition: "Dashboard renderiza dados reais do banco com filtros funcionais",
      brain_skill: "frontend",
    });
  }

  // 6 — Payments integration
  if (blueprint.needsPayments) {
    tasks.push({
      title: "Integração de Pagamentos",
      prompt: "Implemente o fluxo de pagamento/checkout. Crie a página de checkout, integração com gateway de pagamento e confirmação de pedido. Inclua status de pagamento e histórico.",
      intent: blueprint.intent,
      stop_condition: "Fluxo completo de checkout funcional com confirmação",
      brain_skill: "backend",
    });
  }

  // 7 — Storage
  if (blueprint.needsStorage) {
    tasks.push({
      title: "Upload e Storage",
      prompt: "Implemente upload de arquivos com Supabase Storage. Crie componente de upload com drag-and-drop, preview de imagens e gerenciamento de arquivos. Configure bucket com políticas de acesso.",
      intent: blueprint.intent,
      stop_condition: "Upload funcional com preview e listagem de arquivos",
      brain_skill: "backend",
    });
  }

  // 8 — Polish & deploy (always last)
  tasks.push({
    title: "Revisão e Deploy",
    prompt: "Revise todo o código gerado. Corrija erros de TypeScript, melhore responsividade, adicione loading states, tratamento de erros e estados vazios. Prepare para deploy.",
    intent: blueprint.intent,
    stop_condition: "Build sem erros, todas as páginas responsivas e funcionais",
    brain_skill: "review",
  });

  return tasks;
}

function buildCorePrompt(userPrompt: string, bp: ProjectBlueprint): string {
  switch (bp.intent) {
    case "landing_page":
      return `Crie uma landing page completa baseada em: "${userPrompt}". Inclua: hero section, features, depoimentos, CTA e footer. Design moderno com animações sutis.`;
    case "marketing_site":
      return `Crie um site multi-página baseado em: "${userPrompt}". Inclua: Home, Sobre, Serviços/Produtos, Contato. Navegação entre páginas com React Router.`;
    case "crud_system":
      return `Crie o sistema CRUD completo para: "${userPrompt}". Implemente listagem com busca/filtro, criação com formulário validado, edição inline e exclusão com confirmação. Tabelas: ${bp.supabaseTables.join(", ")}.`;
    case "dashboard":
      return `Crie o painel de métricas para: "${userPrompt}". Inclua: cards de KPI, gráficos de linha/barra com Recharts, tabela de dados recentes e filtros por período.`;
    case "ecommerce":
      return `Crie a loja virtual para: "${userPrompt}". Implemente: catálogo de produtos com grid, página de produto, carrinho de compras, checkout e histórico de pedidos.`;
    case "saas_app":
      return `Crie a aplicação SaaS para: "${userPrompt}". Implemente: dashboard do usuário, página de planos/pricing, gerenciamento de assinatura e painel de uso.`;
    case "api_only":
      return `Crie as Edge Functions para: "${userPrompt}". Implemente endpoints RESTful com validação de input, autenticação via JWT e respostas padronizadas.`;
    case "component":
      return `Crie o componente de UI para: "${userPrompt}". Implemente com props tipadas, variantes, estados (hover, focus, disabled) e acessibilidade. Use Tailwind CSS.`;
    default:
      return `Implemente o projeto descrito pelo usuário: "${userPrompt}". Siga as melhores práticas de React + TypeScript + Tailwind CSS.`;
  }
}
