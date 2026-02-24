-- ═══════════════════════════════════════════════════════════════════════════
-- Advanced RLS + Feature Flags + Audit Log + Admin Bypass
-- Security hardening: no plain-text tokens, no public endpoint leakage
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Helper: is_admin() ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

-- ── Helper: is_tenant_admin() ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_tenant_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = auth.uid() AND role IN ('tenant_owner', 'tenant_admin')
  );
$$;

-- ── Feature Flags Table ──────────────────────────────────────────────────
-- Controls access to lab features per user/plan/global
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  feature       TEXT        NOT NULL,               -- 'brain', 'starcrawl', 'voice', 'orchestrator'
  enabled_for   TEXT        NOT NULL DEFAULT 'admin' -- 'all', 'admin', 'plan:pro', 'user:<uuid>'
    CHECK (enabled_for LIKE 'all%' OR enabled_for LIKE 'admin%' OR enabled_for LIKE 'plan:%' OR enabled_for LIKE 'user:%'),
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Everyone can read feature flags (to know what page to show)
CREATE POLICY "feature_flags_select_all"
  ON public.feature_flags FOR SELECT
  USING (true);

-- Only admins can manage feature flags
CREATE POLICY "feature_flags_admin_manage"
  ON public.feature_flags FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Seed default lab feature flags (admin-only by default)
INSERT INTO public.feature_flags (feature, enabled_for, description) VALUES
  ('brain',         'admin', 'Starble Brain — Assistente IA + Gemini'),
  ('starcrawl',     'admin', 'StarCrawl — Inteligência Web por Firecrawl'),
  ('voice',         'admin', 'Voice AI — Síntese de Voz por ElevenLabs'),
  ('orchestrator',  'admin', 'Orchestrator Engine — Criação Autônoma de Projetos')
ON CONFLICT DO NOTHING;

-- ── check_feature_access helper ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_feature_access(p_feature TEXT)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flag TEXT;
  v_uid  UUID := auth.uid();
BEGIN
  -- Admins always have access
  IF public.is_admin() THEN RETURN TRUE; END IF;

  SELECT enabled_for INTO v_flag FROM public.feature_flags
  WHERE feature = p_feature LIMIT 1;

  IF v_flag IS NULL THEN RETURN FALSE; END IF;
  IF v_flag = 'all' THEN RETURN TRUE; END IF;
  IF v_flag = 'admin' THEN RETURN public.is_admin(); END IF;
  IF v_flag LIKE 'user:%' THEN
    RETURN (v_uid::TEXT = SUBSTRING(v_flag FROM 6));
  END IF;
  -- plan-based: check licenses
  IF v_flag LIKE 'plan:%' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.licenses l
      JOIN public.plans p ON p.id = l.plan_id
      WHERE l.user_id = v_uid AND p.type = SUBSTRING(v_flag FROM 6)
      AND l.expires_at > NOW()
    );
  END IF;
  RETURN FALSE;
END;
$$;

-- ── Audit Log Table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  action      TEXT        NOT NULL,    -- 'api_key.view', 'token.refresh', 'admin.access', etc.
  ip_hash     TEXT,                    -- SHA-256 of IP (never store plain IP)
  user_agent  TEXT,
  metadata    JSONB       DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can see their own audit logs
CREATE POLICY "audit_logs_select_own"
  ON public.audit_logs FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

-- Only service role can insert audit logs
-- (no public insert policy — Edge Functions use service role)

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_time
  ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON public.audit_logs(action, created_at DESC);

-- ── Harden lovable_accounts RLS ─────────────────────────────────────────
-- Ensure no one can read other users' Lovable tokens
DROP POLICY IF EXISTS "Users manage own lovable accounts" ON public.lovable_accounts;
ALTER TABLE public.lovable_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lovable_accounts_owner_only"
  ON public.lovable_accounts FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── Harden orchestrator_projects RLS ────────────────────────────────────
-- Ensure users can only see their own orchestrator projects
DROP POLICY IF EXISTS "Users manage own orchestrator projects" ON public.orchestrator_projects;
ALTER TABLE public.orchestrator_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orchestrator_projects_owner"
  ON public.orchestrator_projects FOR ALL
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- ── Harden orchestrator_tasks RLS ───────────────────────────────────────
DROP POLICY IF EXISTS "Users see own tasks" ON public.orchestrator_tasks;
ALTER TABLE public.orchestrator_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orchestrator_tasks_owner"
  ON public.orchestrator_tasks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.orchestrator_projects p
      WHERE p.id = project_id AND (p.user_id = auth.uid() OR public.is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orchestrator_projects p
      WHERE p.id = project_id AND (p.user_id = auth.uid() OR public.is_admin())
    )
  );

-- ── Harden agent_skills ──────────────────────────────────────────────────
ALTER TABLE public.agent_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_skills_read_all"
  ON public.agent_skills FOR SELECT
  USING (true);

CREATE POLICY "agent_skills_admin_write"
  ON public.agent_skills FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "agent_skills_admin_update"
  ON public.agent_skills FOR UPDATE
  USING (public.is_admin());

-- ── Revoke public access to sensitive views ──────────────────────────────
REVOKE SELECT ON public.lovable_accounts FROM anon;
REVOKE SELECT ON public.api_keys FROM anon;
REVOKE SELECT ON public.audit_logs FROM anon;
