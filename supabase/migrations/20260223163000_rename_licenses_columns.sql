-- Migration: Fix licenses table column names
-- Renames token → key, is_active → active, adds FK to profiles, and updates index

-- 1. Rename columns to match application code
ALTER TABLE public.licenses RENAME COLUMN token TO key;
ALTER TABLE public.licenses RENAME COLUMN is_active TO active;

-- 2. Add FK from licenses.user_id → profiles.user_id (enables PostgREST join)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'licenses_user_id_profiles_fk'
    AND table_name = 'licenses'
  ) THEN
    ALTER TABLE public.licenses
      ADD CONSTRAINT licenses_user_id_profiles_fk
      FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Recreate index on the renamed column
DROP INDEX IF EXISTS idx_licenses_token;
CREATE INDEX IF NOT EXISTS idx_licenses_key ON public.licenses(key);
