ALTER TABLE public.lovable_accounts 
ADD COLUMN IF NOT EXISTS refresh_token text,
ADD COLUMN IF NOT EXISTS token_expires_at timestamptz;
