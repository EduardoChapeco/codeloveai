-- Rate limiting por licença Venus
CREATE TABLE IF NOT EXISTS public.venus_rate_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  license_key TEXT NOT NULL,
  action TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('minute', NOW()),
  request_count INTEGER NOT NULL DEFAULT 1,
  UNIQUE(license_key, action, window_start)
);
CREATE INDEX IF NOT EXISTS idx_venus_rate_limits_license ON public.venus_rate_limits(license_key, window_start);
ALTER TABLE public.venus_rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS: only service role can access
CREATE POLICY "venus_rate_limits_service_only" ON public.venus_rate_limits
  FOR ALL USING (false);

-- Add index on venus_notes.project_id if not exists
CREATE INDEX IF NOT EXISTS idx_venus_notes_project ON public.venus_notes(project_id);

-- Add updated_at column to venus_notes if not exists
DO $$ BEGIN
  ALTER TABLE public.venus_notes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Cleanup old rate limit entries (auto via cron or manual)
-- Entries older than 5 minutes can be safely deleted