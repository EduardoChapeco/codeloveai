-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: enhance plans table with per-plan limits and feature controls
-- ═══════════════════════════════════════════════════════════════════════════

-- Add granular limit columns to plans
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS daily_messages    INTEGER DEFAULT NULL,   -- null = unlimited
  ADD COLUMN IF NOT EXISTS hourly_limit      INTEGER DEFAULT NULL,   -- null = no hourly cap
  ADD COLUMN IF NOT EXISTS max_projects      INTEGER DEFAULT NULL,   -- null = unlimited
  ADD COLUMN IF NOT EXISTS allow_build_mode  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sort_order        INTEGER NOT NULL DEFAULT 0;

-- Sync existing plans with correct limits based on type
UPDATE public.plans SET
  daily_messages    = 10,
  hourly_limit      = NULL,
  max_projects      = 1,
  allow_build_mode  = FALSE
WHERE type = 'trial';

UPDATE public.plans SET
  daily_messages    = NULL,   -- unlimited
  allow_build_mode  = TRUE,
  max_projects      = NULL
WHERE type != 'trial';

-- daily plan: unlimited messages, builds allowed
UPDATE public.plans SET allow_build_mode = TRUE
WHERE billing_cycle = 'daily' AND type != 'trial';

-- ── tenant_plan_overrides: per-tenant price/visibility overrides ────────────
CREATE TABLE IF NOT EXISTS public.tenant_plan_overrides (
  id              UUID     DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       UUID     REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  plan_id         UUID     REFERENCES public.plans(id)   ON DELETE CASCADE NOT NULL,
  custom_price    NUMERIC  DEFAULT NULL,       -- NULL = use plan's default price
  is_visible      BOOLEAN  NOT NULL DEFAULT TRUE,
  is_trial_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, plan_id)
);

-- RLS for tenant_plan_overrides
ALTER TABLE public.tenant_plan_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Global admins can manage plan overrides"
  ON public.tenant_plan_overrides
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Tenant admins can read their plan overrides"
  ON public.tenant_plan_overrides
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = tenant_plan_overrides.tenant_id
        AND tu.user_id = auth.uid()
        AND tu.role IN ('tenant_admin', 'tenant_owner')
    )
  );

-- Public read for plans (already exists, but document here)
-- Plans are public-read but only admin can write
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'plans' AND policyname = 'Admins can manage plans'
  ) THEN
    CREATE POLICY "Admins can manage plans"
      ON public.plans
      FOR ALL
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END $$;
