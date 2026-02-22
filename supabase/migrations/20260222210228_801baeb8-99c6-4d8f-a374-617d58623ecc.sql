ALTER TABLE public.lovable_accounts 
ADD COLUMN IF NOT EXISTS refresh_token_encrypted text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS token_expires_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS auto_refresh_enabled boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS refresh_failure_count integer NOT NULL DEFAULT 0;