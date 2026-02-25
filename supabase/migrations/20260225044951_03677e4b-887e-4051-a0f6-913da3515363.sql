
-- Table to store platform-level API keys for external services
CREATE TABLE public.api_key_vault (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL, -- e.g. 'firecrawl', 'elevenlabs', 'gemini', 'openrouter'
  label TEXT NOT NULL DEFAULT '',
  api_key_encrypted TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  requests_count BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.api_key_vault ENABLE ROW LEVEL SECURITY;

-- Only admins can access
CREATE POLICY "Admin full access to api_key_vault"
  ON public.api_key_vault
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_api_key_vault_updated_at
  BEFORE UPDATE ON public.api_key_vault
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
