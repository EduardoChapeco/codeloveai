
-- Module catalog table: defines all available modules with pricing
CREATE TABLE IF NOT EXISTS public.module_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text DEFAULT '',
  icon text DEFAULT 'Boxes',
  price_per_user_cents integer NOT NULL DEFAULT 0,
  billing_model text NOT NULL DEFAULT 'per_user' CHECK (billing_model IN ('per_user', 'per_message', 'flat', 'free')),
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.module_catalog ENABLE ROW LEVEL SECURITY;

-- Anyone can view active modules
CREATE POLICY "Anyone can view active modules"
  ON public.module_catalog FOR SELECT
  USING (is_active = true);

-- Only admins manage modules
CREATE POLICY "Admins manage module catalog"
  ON public.module_catalog FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Seed the module catalog with all known modules
INSERT INTO public.module_catalog (slug, name, description, icon, price_per_user_cents, billing_model, is_default, display_order) VALUES
  ('dashboard',   'Dashboard',        'Painel principal com métricas',              'LayoutDashboard', 0,    'free',        true,  0),
  ('notes',       'Notas',            'Bloco de notas pessoal',                     'StickyNote',      0,    'free',        true,  1),
  ('community',   'Comunidade',       'Feed social unificado para todos tenants',   'MessageCircle',   0,    'free',        true,  2),
  ('affiliates',  'Afiliados',        'Sistema de indicação e comissões',           'Users',           0,    'free',        true,  3),
  ('preview',     'Preview',          'Visualização de projetos Lovable',           'Eye',             0,    'free',        true,  4),
  ('deploy',      'Deploy/Publicar',  'Deploy e publicação de projetos',            'Upload',          500,  'per_user',    false, 5),
  ('chat_ai',     'Chat AI / Star AI','Assistente de IA para projetos',             'Brain',           1000, 'per_message', false, 6),
  ('automation',  'Automação',        'Regras e triggers automáticos',              'Workflow',        800,  'per_user',    false, 7),
  ('orchestrator','Orquestrador',     'Gerenciamento avançado de múltiplos projetos','Layers',         1500, 'per_user',    false, 8),
  ('split_view',  'Split View',       'Visualização lado a lado',                   'PanelLeft',       300,  'per_user',    false, 9),
  ('whitelabel',  'White Label',      'Marca própria e personalização total',       'Building2',       5000, 'flat',        false, 10),
  ('starcrawl',   'StarCrawl',        'Crawler e análise de sites',                 'Search',          1200, 'per_user',    false, 11),
  ('voice',       'Voice Lab',        'Assistente de voz',                          'Headphones',      2000, 'per_user',    false, 12)
ON CONFLICT (slug) DO NOTHING;

-- Tenant module subscriptions: which modules each tenant has enabled + pricing override
CREATE TABLE IF NOT EXISTS public.tenant_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  module_slug text NOT NULL REFERENCES public.module_catalog(slug) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  price_override_cents integer DEFAULT NULL,
  billing_model_override text DEFAULT NULL CHECK (billing_model_override IS NULL OR billing_model_override IN ('per_user', 'per_message', 'flat', 'free')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, module_slug)
);

ALTER TABLE public.tenant_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all tenant modules"
  ON public.tenant_modules FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Tenant admins view own modules"
  ON public.tenant_modules FOR SELECT
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins update own modules"
  ON public.tenant_modules FOR UPDATE
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- Trigger for updated_at
CREATE TRIGGER update_tenant_modules_updated_at
  BEFORE UPDATE ON public.tenant_modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
