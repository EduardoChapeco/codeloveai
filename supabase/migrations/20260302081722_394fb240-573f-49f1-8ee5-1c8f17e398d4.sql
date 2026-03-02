
-- =============================================
-- CIRIUS: AI App Builder — Database Schema
-- =============================================

-- 1. cirius_projects — Central project table
CREATE TABLE public.cirius_projects (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL,
  org_id                UUID,

  name                  TEXT NOT NULL,
  description           TEXT,
  template_type         TEXT,
  source_url            TEXT,

  status                TEXT DEFAULT 'draft',
  current_step          TEXT,
  progress_pct          INTEGER DEFAULT 0,
  generation_engine     TEXT,
  error_message         TEXT,

  brain_project_id      TEXT,
  orchestrator_project_id UUID REFERENCES public.orchestrator_projects(id),
  brainchain_queue_id   UUID REFERENCES public.brainchain_queue(id),
  lovable_project_id    TEXT,

  prd_json              JSONB,
  source_files_json     JSONB,
  files_fingerprint     TEXT,

  github_repo           TEXT,
  github_url            TEXT,
  github_branch         TEXT DEFAULT 'main',
  vercel_project_id     TEXT,
  vercel_url            TEXT,
  netlify_site_id       TEXT,
  netlify_url           TEXT,
  supabase_project_id   TEXT,
  supabase_url          TEXT,
  custom_domain         TEXT,
  preview_url           TEXT,

  tech_stack            JSONB DEFAULT '{"framework":"react","css":"tailwind","ui":"shadcn"}',
  features              JSONB DEFAULT '[]',
  deploy_config         JSONB DEFAULT '{}',

  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  generation_started_at TIMESTAMPTZ,
  generation_ended_at   TIMESTAMPTZ,
  deployed_at           TIMESTAMPTZ
);

CREATE INDEX idx_cirius_projects_user ON public.cirius_projects(user_id);
CREATE INDEX idx_cirius_projects_status ON public.cirius_projects(status);

ALTER TABLE public.cirius_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_cirius_projects" ON public.cirius_projects
  FOR ALL USING (auth.uid() = user_id);

-- Validation trigger for status
CREATE OR REPLACE FUNCTION public.validate_cirius_project_status()
  RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'generating_prd', 'generating_code', 'deploying', 'live', 'failed', 'paused') THEN
    RAISE EXCEPTION 'Invalid cirius project status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_cirius_project_status
  BEFORE INSERT OR UPDATE ON public.cirius_projects
  FOR EACH ROW EXECUTE FUNCTION public.validate_cirius_project_status();

-- updated_at trigger
CREATE TRIGGER trg_cirius_projects_updated_at
  BEFORE UPDATE ON public.cirius_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. cirius_generation_log — Granular pipeline logs
CREATE TABLE public.cirius_generation_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES public.cirius_projects(id) ON DELETE CASCADE,
  step          TEXT NOT NULL,
  status        TEXT NOT NULL,
  level         TEXT DEFAULT 'info',
  message       TEXT,
  input_json    JSONB,
  output_json   JSONB,
  duration_ms   INTEGER,
  error_msg     TEXT,
  retry_count   INTEGER DEFAULT 0,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cirius_log_project ON public.cirius_generation_log(project_id, created_at DESC);

ALTER TABLE public.cirius_generation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_cirius_logs" ON public.cirius_generation_log
  FOR SELECT USING (
    auth.uid() = (SELECT user_id FROM public.cirius_projects WHERE id = project_id)
  );

CREATE POLICY "service_insert_cirius_logs" ON public.cirius_generation_log
  FOR INSERT WITH CHECK (
    auth.uid() = (SELECT user_id FROM public.cirius_projects WHERE id = project_id)
  );

-- 3. cirius_integrations — Client deploy tokens (encrypted)
CREATE TABLE public.cirius_integrations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL,
  provider          TEXT NOT NULL,

  access_token_enc  TEXT,
  refresh_token_enc TEXT,
  token_expires_at  TIMESTAMPTZ,

  service_key_enc   TEXT,
  project_ref       TEXT,

  account_login     TEXT,
  account_id        TEXT,
  scopes            TEXT[] DEFAULT '{}',
  provider_metadata JSONB DEFAULT '{}',

  is_active         BOOLEAN DEFAULT true,
  last_used_at      TIMESTAMPTZ,
  last_error        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),

  UNIQUE(user_id, provider)
);

ALTER TABLE public.cirius_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_cirius_integrations" ON public.cirius_integrations
  FOR ALL USING (auth.uid() = user_id);

CREATE TRIGGER trg_cirius_integrations_updated_at
  BEFORE UPDATE ON public.cirius_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. cirius_templates — Public template catalog
CREATE TABLE public.cirius_templates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  description      TEXT,
  category         TEXT,
  thumbnail_url    TEXT,
  preview_url      TEXT,
  prompt_template  TEXT NOT NULL,
  default_features JSONB DEFAULT '[]',
  tech_stack       JSONB DEFAULT '{"framework":"react","css":"tailwind"}',
  suggested_engine TEXT DEFAULT 'brainchain',
  tags             TEXT[] DEFAULT '{}',
  is_premium       BOOLEAN DEFAULT false,
  usage_count      INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.cirius_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates_public_read" ON public.cirius_templates
  FOR SELECT USING (true);

-- Admin-only write for templates
CREATE POLICY "admin_manage_cirius_templates" ON public.cirius_templates
  FOR ALL USING (public.is_admin());

-- 5. Enable Realtime for live progress
ALTER PUBLICATION supabase_realtime ADD TABLE public.cirius_projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cirius_generation_log;
