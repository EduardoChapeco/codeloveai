
-- Create is_admin() no-arg helper
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

-- Create feature_flags table
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  feature       TEXT        NOT NULL,
  enabled_for   TEXT        NOT NULL DEFAULT 'all',
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feature_flags_select_all"
  ON public.feature_flags FOR SELECT
  USING (true);

CREATE POLICY "feature_flags_admin_manage"
  ON public.feature_flags FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Seed with brain enabled for ALL users
INSERT INTO public.feature_flags (feature, enabled_for, description) VALUES
  ('brain',         'all',   'Starble Brain — Assistente IA + Gemini'),
  ('starcrawl',     'admin', 'StarCrawl — Inteligência Web por Firecrawl'),
  ('voice',         'admin', 'Voice AI — Síntese de Voz por ElevenLabs'),
  ('orchestrator',  'admin', 'Orchestrator Engine — Criação Autônoma de Projetos')
ON CONFLICT DO NOTHING;

-- check_feature_access helper
CREATE OR REPLACE FUNCTION public.check_feature_access(p_feature TEXT)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flag TEXT;
  v_uid  UUID := auth.uid();
BEGIN
  IF public.is_admin() THEN RETURN TRUE; END IF;

  SELECT enabled_for INTO v_flag FROM public.feature_flags
  WHERE feature = p_feature LIMIT 1;

  IF v_flag IS NULL THEN RETURN FALSE; END IF;
  IF v_flag = 'all' THEN RETURN TRUE; END IF;
  IF v_flag = 'admin' THEN RETURN public.is_admin(); END IF;
  IF v_flag LIKE 'user:%' THEN
    RETURN (v_uid::TEXT = SUBSTRING(v_flag FROM 6));
  END IF;
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
