
-- Extension usage tracking
CREATE TABLE public.extension_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  function_name TEXT NOT NULL,
  project_id TEXT,
  license_key_hash TEXT,
  ip_address TEXT,
  user_agent TEXT,
  response_status INT,
  duration_ms INT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ext_usage_user ON public.extension_usage_logs(user_id, created_at DESC);
CREATE INDEX idx_ext_usage_fn ON public.extension_usage_logs(function_name, created_at DESC);

ALTER TABLE public.extension_usage_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read
CREATE POLICY "Admins can read extension usage"
ON public.extension_usage_logs FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Service role inserts (from edge functions)
CREATE POLICY "Service can insert usage logs"
ON public.extension_usage_logs FOR INSERT
WITH CHECK (true);

-- Aggregated view for quick stats
CREATE OR REPLACE VIEW public.user_activity_summary AS
SELECT
  user_id,
  COUNT(*) AS total_calls,
  COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours') AS calls_today,
  COUNT(*) FILTER (WHERE created_at > now() - interval '7 days') AS calls_week,
  COUNT(DISTINCT DATE(created_at)) AS active_days,
  MAX(created_at) AS last_seen,
  MIN(created_at) AS first_seen,
  jsonb_object_agg(
    COALESCE(function_name, 'unknown'),
    fn_count
  ) FILTER (WHERE function_name IS NOT NULL) AS calls_by_function
FROM (
  SELECT user_id, function_name, created_at,
    COUNT(*) OVER (PARTITION BY user_id, function_name) AS fn_count
  FROM public.extension_usage_logs
) sub
GROUP BY user_id;
