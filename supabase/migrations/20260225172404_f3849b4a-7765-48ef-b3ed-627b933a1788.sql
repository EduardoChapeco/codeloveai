
-- Whitelabel config for extensions
CREATE TABLE IF NOT EXISTS public.whitelabel_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extension_key text NOT NULL DEFAULT 'speed',
  app_name text DEFAULT 'Speed',
  logo_url text,
  theme text DEFAULT 'dark',
  colors jsonb DEFAULT '{"acc":"#3b5bff","acc2":"#7b4fff","bg":"#1a1a1f","surf":"#222228","brd":"rgba(255,255,255,0.08)","txt":"#f0f0f2","txt2":"#8c8c99","sendBg":"#f0f0f2","sendIc":"#1a1a1f"}'::jsonb,
  links jsonb DEFAULT '{"sso":"https://starble.lovable.app/lovable/connect","upgrade":"https://starble.lovable.app/planos","dashboard":"https://starble.lovable.app/dashboard"}'::jsonb,
  modules jsonb DEFAULT '[{"key":"deploy","label":"Deploy","sub":"Publicar projeto","icon":"upload","color":"#7c3aed","badge":null,"enabled":true},{"key":"preview","label":"Preview","sub":"Abrir preview","icon":"eye","color":"#0ea5e9","badge":"LIVE","enabled":true},{"key":"source","label":"Código-Fonte","sub":"Ver arquivos","icon":"code","color":"#10b981","badge":null,"enabled":true},{"key":"zip","label":"Download ZIP","sub":"Baixar projeto","icon":"download","color":"#f59e0b","badge":null,"enabled":true},{"key":"sandbox","label":"Sandbox","sub":"Modo teste","icon":"box","color":"#8b5cf6","badge":"PRO","enabled":false},{"key":"capture","label":"Capturar Token","sub":"Forçar captura","icon":"zap","color":"#22c55e","badge":null,"enabled":true}]'::jsonb,
  tenant_id uuid REFERENCES public.tenants(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(extension_key, tenant_id)
);

ALTER TABLE public.whitelabel_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage whitelabel config"
  ON public.whitelabel_config FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Service role access whitelabel"
  ON public.whitelabel_config FOR SELECT
  USING (auth.role() = 'service_role');

CREATE POLICY "Public read whitelabel config"
  ON public.whitelabel_config FOR SELECT
  USING (true);

-- Insert default speed config
INSERT INTO public.whitelabel_config (extension_key, app_name, theme)
VALUES ('speed', 'Speed', 'dark')
ON CONFLICT (extension_key, tenant_id) DO NOTHING;

-- Extension audit log
CREATE TABLE IF NOT EXISTS public.extension_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key_hash text,
  extension_key text DEFAULT 'speed',
  action text NOT NULL,
  project_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.extension_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only audit log"
  ON public.extension_audit_log FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Admins read audit log"
  ON public.extension_audit_log FOR SELECT
  USING (is_admin(auth.uid()));
