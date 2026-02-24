-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: ensure provision-trial-license edge function has DB support
-- Adds `messages_used_today` column if missing and `increment_daily_usage` RPC
-- Also applies migration to existing users without a license
-- ═══════════════════════════════════════════════════════════════════════════

-- Ensure messages_used_today exists on licenses (may already exist)
ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS messages_used_today INTEGER NOT NULL DEFAULT 0;

-- Index for daily usage queries
CREATE INDEX IF NOT EXISTS idx_licenses_user_active
  ON public.licenses(user_id, active, type);

-- ── Auto-provision free trial for existing users without any license ─────────
-- This is a one-time backfill: create trial licenses for users who registered
-- before the provision-trial-license edge function existed.
-- Only runs during migration; new users are handled by the edge function.

DO $$
DECLARE
  r RECORD;
  new_key TEXT;
BEGIN
  FOR r IN
    SELECT id, email FROM auth.users u
    WHERE NOT EXISTS (
      SELECT 1 FROM public.licenses l WHERE l.user_id = u.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.tokens t WHERE t.user_id = u.id
    )
  LOOP
    new_key := 'CLF1.FREE-' || UPPER(LEFT(r.id::TEXT, 8)) || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 5));
    INSERT INTO public.licenses (
      user_id, key, active, plan, plan_type, type, status, daily_messages, messages_used_today
    ) VALUES (
      r.id, new_key, true, 'Grátis', 'messages', 'trial', 'active', 10, 0
    ) ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

-- ── RLS for licenses — ensure service role can insert ───────────────────────
-- provision-trial-license uses service role key, which bypasses RLS.
-- No additional policies needed, but document this here for clarity.

-- Ensure the increment_daily_usage function exists
CREATE OR REPLACE FUNCTION public.increment_daily_usage(
  p_license_id UUID,
  p_date       DATE
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used INTEGER;
BEGIN
  -- Upsert daily usage record
  INSERT INTO public.license_usage (license_id, usage_date, messages_used)
  VALUES (p_license_id, p_date, 1)
  ON CONFLICT (license_id, usage_date)
  DO UPDATE SET messages_used = license_usage.messages_used + 1
  RETURNING messages_used INTO v_used;

  -- Sync to licenses.messages_used_today for quick reads
  UPDATE public.licenses
  SET messages_used_today = v_used
  WHERE id = p_license_id;

  RETURN v_used;
END;
$$;
