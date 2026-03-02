
-- Venus™ Tables

CREATE TABLE IF NOT EXISTS public.venus_licenses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key  text UNIQUE NOT NULL,
  user_id      text,
  tenant_id    text,
  plan_name    text DEFAULT 'FREE',
  plan_type    text DEFAULT 'mensagens',
  quota        integer DEFAULT 100,
  used         integer DEFAULT 0,
  expires_at   timestamptz,
  active       boolean DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.venus_licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on venus_licenses"
  ON public.venus_licenses FOR ALL
  USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.venus_tenants (
  id           text PRIMARY KEY,
  name         text NOT NULL,
  color        text DEFAULT '#7c3aed',
  logo_url     text,
  url          text,
  plans_url    text,
  affiliate_url text,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.venus_tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read on venus_tenants"
  ON public.venus_tenants FOR SELECT
  USING (true);

CREATE POLICY "Admin manage venus_tenants"
  ON public.venus_tenants FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.venus_notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key  text NOT NULL,
  project_id   text NOT NULL,
  text         text NOT NULL,
  color        text DEFAULT '#7c3aed',
  x            integer DEFAULT 80,
  y            integer DEFAULT 300,
  ts           bigint,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venus_notes_key_project ON public.venus_notes(license_key, project_id);

ALTER TABLE public.venus_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on venus_notes"
  ON public.venus_notes FOR ALL
  USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.venus_brain_projects (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lovable_project_id  text UNIQUE NOT NULL,
  brain_project_id    text,
  connected           boolean DEFAULT false,
  last_sync           timestamptz,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE public.venus_brain_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on venus_brain_projects"
  ON public.venus_brain_projects FOR ALL
  USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.venus_orch_projects (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lovable_project_id  text NOT NULL,
  license_key         text,
  status              text DEFAULT 'pending',
  client_prompt       text,
  prd                 text,
  tasks               jsonb DEFAULT '[]'::jsonb,
  current_task_index  integer DEFAULT 0,
  total_tasks         integer DEFAULT 0,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venus_orch_project ON public.venus_orch_projects(lovable_project_id);

ALTER TABLE public.venus_orch_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on venus_orch_projects"
  ON public.venus_orch_projects FOR ALL
  USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.venus_github_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key  text NOT NULL,
  gh_token     text NOT NULL,
  gh_user      text,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_venus_gh_tokens_key ON public.venus_github_tokens(license_key);

ALTER TABLE public.venus_github_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on venus_github_tokens"
  ON public.venus_github_tokens FOR ALL
  USING (true) WITH CHECK (true);

-- Insert default tenant
INSERT INTO public.venus_tenants (id, name, color, url)
VALUES ('starble', 'Venus™ Platform', '#7c3aed', 'https://starble.lovable.app')
ON CONFLICT (id) DO NOTHING;
