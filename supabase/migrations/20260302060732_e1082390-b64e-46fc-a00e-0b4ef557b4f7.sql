
-- Contas mestres do pool Brainchain
CREATE TABLE IF NOT EXISTS public.brainchain_accounts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email           TEXT,
  label           TEXT,
  brain_type      TEXT NOT NULL DEFAULT 'general',
  refresh_token   TEXT NOT NULL,
  access_token    TEXT,
  access_expires_at TIMESTAMPTZ,
  brain_project_id TEXT,
  is_active       BOOLEAN DEFAULT true,
  is_busy         BOOLEAN DEFAULT false,
  busy_since      TIMESTAMPTZ,
  busy_user_id    TEXT,
  request_count   INTEGER DEFAULT 0,
  error_count     INTEGER DEFAULT 0,
  last_used_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bc_accounts_type_active
  ON public.brainchain_accounts(brain_type, is_active, is_busy);

-- Fila de requisições ao Brainchain
CREATE TABLE IF NOT EXISTS public.brainchain_queue (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       TEXT NOT NULL,
  brain_type    TEXT NOT NULL DEFAULT 'general',
  message       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  account_id    UUID REFERENCES public.brainchain_accounts(id),
  response      TEXT,
  error_msg     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '3 minutes')
);

CREATE INDEX IF NOT EXISTS idx_bc_queue_status
  ON public.brainchain_queue(status, brain_type, created_at);
CREATE INDEX IF NOT EXISTS idx_bc_queue_user
  ON public.brainchain_queue(user_id, status);

-- Log de uso
CREATE TABLE IF NOT EXISTS public.brainchain_usage (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     TEXT NOT NULL,
  brain_type  TEXT NOT NULL,
  account_id  UUID,
  queue_id    UUID,
  duration_ms INTEGER,
  success     BOOLEAN,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bc_usage_user ON public.brainchain_usage(user_id, created_at);

-- RLS: acesso apenas via service_role
ALTER TABLE public.brainchain_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brainchain_queue    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brainchain_usage    ENABLE ROW LEVEL SECURITY;

-- Admin-only policies for brainchain_accounts
CREATE POLICY "Admins can manage brainchain_accounts"
  ON public.brainchain_accounts FOR ALL
  USING (public.is_admin());

-- Admin-only policies for brainchain_queue
CREATE POLICY "Admins can view brainchain_queue"
  ON public.brainchain_queue FOR SELECT
  USING (public.is_admin());

-- Admin-only policies for brainchain_usage
CREATE POLICY "Admins can view brainchain_usage"
  ON public.brainchain_usage FOR SELECT
  USING (public.is_admin());

-- Helper functions for incrementing counters
CREATE OR REPLACE FUNCTION public.increment_requests(acc_id UUID)
RETURNS INTEGER
LANGUAGE SQL
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE brainchain_accounts
  SET request_count = request_count + 1
  WHERE id = acc_id
  RETURNING request_count;
$$;

CREATE OR REPLACE FUNCTION public.increment_errors(acc_id UUID)
RETURNS INTEGER
LANGUAGE SQL
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE brainchain_accounts
  SET error_count = error_count + 1
  WHERE id = acc_id
  RETURNING error_count;
$$;

-- Validation triggers
CREATE OR REPLACE FUNCTION public.validate_bc_queue_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'processing', 'done', 'error', 'timeout') THEN
    RAISE EXCEPTION 'Invalid brainchain_queue status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_bc_queue_status
  BEFORE INSERT OR UPDATE ON public.brainchain_queue
  FOR EACH ROW EXECUTE FUNCTION public.validate_bc_queue_status();
