
-- Fix: Drop SECURITY DEFINER view and recreate as SECURITY INVOKER
DROP VIEW IF EXISTS public.user_activity_summary;

CREATE OR REPLACE VIEW public.user_activity_summary
WITH (security_invoker = true) AS
SELECT
  user_id,
  COUNT(*) AS total_calls,
  COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours') AS calls_today,
  COUNT(*) FILTER (WHERE created_at > now() - interval '7 days') AS calls_week,
  COUNT(DISTINCT DATE(created_at)) AS active_days,
  MAX(created_at) AS last_seen,
  MIN(created_at) AS first_seen
FROM public.extension_usage_logs
GROUP BY user_id;

-- Fix: Tighten INSERT policy - only service role should insert
DROP POLICY IF EXISTS "Service can insert usage logs" ON public.extension_usage_logs;
