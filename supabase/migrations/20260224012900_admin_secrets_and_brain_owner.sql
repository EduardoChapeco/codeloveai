-- =============================================
-- Admin Secrets Table (internal schema)
-- Stores sensitive admin tokens securely.
-- NO RLS — only accessible via service_role_key.
-- =============================================

-- Create the internal schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS internal;

-- Admin secrets table
CREATE TABLE IF NOT EXISTS internal.admin_secrets (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grant access only to service_role
GRANT USAGE ON SCHEMA internal TO service_role;
GRANT ALL ON internal.admin_secrets TO service_role;

-- Revoke from anon and authenticated (extra safety)
REVOKE ALL ON SCHEMA internal FROM anon;
REVOKE ALL ON SCHEMA internal FROM authenticated;

-- Add brain_owner column to user_brain_projects if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_brain_projects' AND column_name = 'brain_owner'
  ) THEN
    ALTER TABLE public.user_brain_projects ADD COLUMN brain_owner TEXT NOT NULL DEFAULT 'user'
      CHECK (brain_owner IN ('admin', 'user'));
  END IF;
END $$;

-- Add is_admin_account flag to lovable_accounts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lovable_accounts' AND column_name = 'is_admin_account'
  ) THEN
    ALTER TABLE public.lovable_accounts ADD COLUMN is_admin_account BOOLEAN DEFAULT false;
  END IF;
END $$;

-- RLS for user_brain_projects: users see only their own rows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_brain_projects' AND policyname = 'Users see own brain projects'
  ) THEN
    CREATE POLICY "Users see own brain projects"
      ON public.user_brain_projects FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END $$;
