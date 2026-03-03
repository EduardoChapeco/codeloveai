
-- Create dedicated venus_client_accounts table
CREATE TABLE IF NOT EXISTS public.venus_client_accounts (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  license_key     text NOT NULL,
  email           text,
  uid             text,
  label           text,
  access_token    text,
  refresh_token   text NOT NULL,
  brain_project_id text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Deduplication indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_venus_client_accounts_email
  ON public.venus_client_accounts(license_key, email)
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_venus_client_accounts_uid
  ON public.venus_client_accounts(license_key, uid)
  WHERE uid IS NOT NULL;

-- RLS: only service_role access (no public policies)
ALTER TABLE public.venus_client_accounts ENABLE ROW LEVEL SECURITY;
