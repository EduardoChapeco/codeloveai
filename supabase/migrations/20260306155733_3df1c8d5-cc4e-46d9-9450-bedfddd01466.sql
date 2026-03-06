
CREATE TABLE public.access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_email TEXT,
  ip_address TEXT,
  country TEXT,
  country_code TEXT,
  region TEXT,
  city TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  timezone TEXT,
  isp TEXT,
  org TEXT,
  as_number TEXT,
  device_type TEXT,
  browser TEXT,
  browser_version TEXT,
  os TEXT,
  os_version TEXT,
  screen_width INTEGER,
  screen_height INTEGER,
  language TEXT,
  referrer TEXT,
  page_url TEXT,
  user_agent TEXT,
  is_mobile BOOLEAN DEFAULT false,
  is_vpn BOOLEAN DEFAULT false,
  tenant_id UUID,
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.access_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Admins can read all" ON public.access_logs
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE INDEX idx_access_logs_created_at ON public.access_logs (created_at DESC);
CREATE INDEX idx_access_logs_user_id ON public.access_logs (user_id);
CREATE INDEX idx_access_logs_ip ON public.access_logs (ip_address);
CREATE INDEX idx_access_logs_country ON public.access_logs (country_code);
