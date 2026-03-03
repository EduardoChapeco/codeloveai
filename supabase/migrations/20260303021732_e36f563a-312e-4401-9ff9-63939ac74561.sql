
-- Table: client_accounts (venus token harvester, separate from brainchain)
CREATE TABLE IF NOT EXISTS public.client_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key text NOT NULL,
  email text,
  uid text,
  label text,
  access_token text,
  refresh_token text NOT NULL,
  brain_project_id text,
  last_synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT uq_license_email UNIQUE (license_key, email)
);

CREATE INDEX IF NOT EXISTS idx_client_accounts_license ON public.client_accounts(license_key);

-- RLS
ALTER TABLE public.client_accounts ENABLE ROW LEVEL SECURITY;

-- Only service_role can access (edge function uses service role)
-- No public/anon access
CREATE POLICY "Service role full access on client_accounts"
  ON public.client_accounts
  FOR ALL
  USING (false)
  WITH CHECK (false);
