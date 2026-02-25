
-- Extension catalog: each extension is a product in the store
CREATE TABLE public.extension_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'Puzzle',
  hero_color TEXT NOT NULL DEFAULT '#6366f1',
  screenshots TEXT[] NOT NULL DEFAULT '{}',
  features JSONB NOT NULL DEFAULT '[]',
  requirements TEXT[] NOT NULL DEFAULT '{}',
  tier TEXT NOT NULL DEFAULT 'free',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  download_slug TEXT, -- maps to extension_files for download
  version TEXT NOT NULL DEFAULT '1.0.0',
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Junction: which plans unlock which extensions
CREATE TABLE public.plan_extensions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  extension_id UUID NOT NULL REFERENCES public.extension_catalog(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plan_id, extension_id)
);

-- RLS
ALTER TABLE public.extension_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_extensions ENABLE ROW LEVEL SECURITY;

-- Everyone can view active extensions
CREATE POLICY "Anyone can view active extensions" ON public.extension_catalog
  FOR SELECT USING (is_active = true);

-- Admins manage extensions
CREATE POLICY "Admins manage extensions" ON public.extension_catalog
  FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Everyone can view plan_extensions
CREATE POLICY "Anyone can view plan extensions" ON public.plan_extensions
  FOR SELECT USING (true);

-- Admins manage plan_extensions
CREATE POLICY "Admins manage plan extensions" ON public.plan_extensions
  FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_extension_catalog_updated_at
  BEFORE UPDATE ON public.extension_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
