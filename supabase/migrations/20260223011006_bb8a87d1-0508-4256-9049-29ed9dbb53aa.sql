
-- Tabela de licenças CLF1
CREATE TABLE IF NOT EXISTS public.licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  user_id uuid NOT NULL,
  plan text NOT NULL DEFAULT 'trial',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  device_id text,
  last_validated_at timestamptz,
  tenant_id uuid REFERENCES public.tenants(id)
);

-- Rate limiting table
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key text PRIMARY KEY,
  count int NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_licenses_token ON public.licenses(token);
CREATE INDEX IF NOT EXISTS idx_licenses_user_id ON public.licenses(user_id);

-- RLS for licenses
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own licenses" ON public.licenses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own licenses" ON public.licenses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own licenses" ON public.licenses
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins manage all licenses" ON public.licenses
  FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- RLS for rate_limits (service role only, no user access needed)
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage rate limits" ON public.rate_limits
  FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
