
-- Helper function: check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  )
$$;

-- ─── lovable_accounts ───
CREATE TABLE IF NOT EXISTS public.lovable_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token_encrypted text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','invalid','expired')),
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE public.lovable_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own lovable account"
  ON public.lovable_accounts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage all lovable accounts"
  ON public.lovable_accounts FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER update_lovable_accounts_updated_at
  BEFORE UPDATE ON public.lovable_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── lovable_projects ───
CREATE TABLE IF NOT EXISTS public.lovable_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lovable_project_id text NOT NULL,
  workspace_id text,
  name text,
  display_name text,
  latest_screenshot_url text,
  preview_build_commit_sha text,
  published_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, lovable_project_id)
);
ALTER TABLE public.lovable_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own lovable projects"
  ON public.lovable_projects FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage all lovable projects"
  ON public.lovable_projects FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER update_lovable_projects_updated_at
  BEFORE UPDATE ON public.lovable_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── deployments_log ───
CREATE TABLE IF NOT EXISTS public.deployments_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lovable_project_id text NOT NULL,
  deployment_id text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','success','failed')),
  target_name text,
  target_url text,
  progress jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.deployments_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own deployments"
  ON public.deployments_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own deployments"
  ON public.deployments_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own deployments"
  ON public.deployments_log FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage all deployments"
  ON public.deployments_log FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER update_deployments_log_updated_at
  BEFORE UPDATE ON public.deployments_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── lovable_api_calls_log ───
CREATE TABLE IF NOT EXISTS public.lovable_api_calls_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  endpoint text NOT NULL,
  method text NOT NULL,
  request_meta jsonb,
  response_status int,
  response_meta jsonb,
  duration_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lovable_api_calls_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own api logs"
  ON public.lovable_api_calls_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own api logs"
  ON public.lovable_api_calls_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage all api logs"
  ON public.lovable_api_calls_log FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ─── ai_endpoint_config ───
CREATE TABLE IF NOT EXISTS public.ai_endpoint_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_url text NOT NULL,
  api_key_encrypted text,
  model text NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  system_prompt text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_endpoint_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins manage ai config"
  ON public.ai_endpoint_config FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
