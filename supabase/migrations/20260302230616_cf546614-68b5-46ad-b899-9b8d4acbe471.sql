
-- Add missing columns if they don't exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cirius_projects' AND column_name='blueprint_json') THEN
    ALTER TABLE public.cirius_projects ADD COLUMN blueprint_json JSONB;
  END IF;
END $$;

-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_cirius_projects_user_id ON public.cirius_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_cirius_projects_status ON public.cirius_projects(status);
CREATE INDEX IF NOT EXISTS idx_cirius_generation_log_project ON public.cirius_generation_log(project_id);
CREATE INDEX IF NOT EXISTS idx_cirius_generation_log_created ON public.cirius_generation_log(created_at DESC);

-- Seed templates (skip if already populated)
INSERT INTO public.cirius_templates (name, description, category, prompt_template, default_features, is_premium) 
SELECT * FROM (VALUES
  ('Landing Page SaaS', 'Landing page moderna com hero, features, pricing e CTA', 'landing',
   'Crie uma landing page moderna para SaaS com: seção hero com headline impactante e CTA, seção de features (3-6 cards), seção de pricing (3 planos), seção de testimonials, footer completo. Use design dark/light elegante, animações suaves, totalmente responsivo.',
   '["hero","features","pricing","testimonials","footer","responsive"]'::jsonb, false),
  ('Sistema CRUD Completo', 'Sistema com listagem, criação, edição e exclusão de registros', 'crud_system',
   'Crie um sistema CRUD completo com: tabela principal no Supabase com RLS, listagem com busca e filtros, modal de criação/edição, confirmação de exclusão, autenticação de usuários, dashboard com stats básicas.',
   '["auth","crud","search","filters","realtime","rls"]'::jsonb, false),
  ('Dashboard Analytics', 'Painel com gráficos, métricas e relatórios em tempo real', 'dashboard',
   'Crie um dashboard de analytics com: sidebar de navegação, cards de métricas (KPIs), gráfico de linha, gráfico de pizza, tabela de dados recentes, filtro por período. Use Recharts para os gráficos.',
   '["charts","metrics","filters","realtime","export"]'::jsonb, false),
  ('E-commerce Simples', 'Loja online com produtos, carrinho e checkout', 'ecommerce',
   'Crie um e-commerce com: catálogo de produtos com grid, página de produto individual, carrinho de compras persistente, checkout simples, painel admin de produtos.',
   '["catalog","cart","checkout","admin","auth","supabase"]'::jsonb, true),
  ('App SaaS Completo', 'Aplicação SaaS com auth, billing, dashboard e configurações', 'saas_app',
   'Crie um SaaS completo com: autenticação, onboarding, dashboard principal, gerenciamento de planos, configurações de conta, sistema de convites para equipe.',
   '["auth","billing","dashboard","teams","settings","onboarding"]'::jsonb, true),
  ('Componente UI', 'Componente React isolado e reutilizável', 'component',
   'Crie um componente React reutilizável, tipado com TypeScript, estilizado com Tailwind, com todas as variantes necessárias e props documentadas.',
   '["typescript","tailwind","props","variants"]'::jsonb, false)
) AS t(name, description, category, prompt_template, default_features, is_premium)
WHERE NOT EXISTS (SELECT 1 FROM public.cirius_templates LIMIT 1);
