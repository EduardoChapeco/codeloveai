-- =============================================
-- TENANT BRANDING + AFFILIATES UPGRADE + COMMISSIONS
-- =============================================

-- 1. Create tenant_branding table
CREATE TABLE IF NOT EXISTS public.tenant_branding (
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE PRIMARY KEY,
  app_name TEXT NOT NULL DEFAULT 'Booster',
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '7c3aed',
  secondary_color TEXT NOT NULL DEFAULT 'a855f7',
  accent_color TEXT,
  modules JSONB NOT NULL DEFAULT '{"chat":true,"deploy":true,"preview":true,"notes":true,"split":true,"auto":true,"wl":true}',
  prompt_suggestions JSONB DEFAULT '[{"label":"Auditar sistema","prompt":"Faça uma auditoria completa do sistema"},{"label":"Corrigir erros","prompt":"Encontre e corrija todos os erros"},{"label":"Segurança","prompt":"Analise a segurança do projeto"},{"label":"Performance","prompt":"Otimize a performance do projeto"}]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_branding ENABLE ROW LEVEL SECURITY;

-- RLS: global admins manage all, tenant admins manage own, tenant members view own
CREATE POLICY "Global admins manage tenant_branding"
  ON public.tenant_branding FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Tenant admins manage own branding"
  ON public.tenant_branding FOR ALL
  USING (is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant members view own branding"
  ON public.tenant_branding FOR SELECT
  USING (is_tenant_member(auth.uid(), tenant_id));

-- Insert default branding for the Starble tenant
INSERT INTO public.tenant_branding (tenant_id, app_name, primary_color, secondary_color)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Starble Booster', '7c3aed', 'a855f7')
ON CONFLICT (tenant_id) DO NOTHING;

-- Trigger for updated_at
CREATE TRIGGER update_tenant_branding_updated_at
BEFORE UPDATE ON public.tenant_branding
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 2. ALTER affiliates — add missing columns
-- =============================================

DO $$
BEGIN
  -- Add type column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'affiliates' AND column_name = 'type'
  ) THEN
    ALTER TABLE public.affiliates ADD COLUMN type TEXT DEFAULT 'simple' CHECK (type IN ('simple', 'whitelabel'));
  END IF;

  -- Add commission_pct if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'affiliates' AND column_name = 'commission_pct'
  ) THEN
    ALTER TABLE public.affiliates ADD COLUMN commission_pct NUMERIC DEFAULT 30;
  END IF;

  -- Add total_earned if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'affiliates' AND column_name = 'total_earned'
  ) THEN
    ALTER TABLE public.affiliates ADD COLUMN total_earned NUMERIC DEFAULT 0;
  END IF;
END $$;

-- =============================================
-- 3. Create commissions table
-- =============================================

CREATE TABLE IF NOT EXISTS public.commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('setup', 'monthly')),
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

-- RLS
CREATE POLICY "Global admins manage commissions"
  ON public.commissions FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Affiliates view own commissions"
  ON public.commissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.affiliates
      WHERE affiliates.id = commissions.affiliate_id
        AND affiliates.user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_commissions_affiliate ON public.commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_commissions_tenant ON public.commissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON public.commissions(status);
CREATE INDEX IF NOT EXISTS idx_tenant_branding_tenant ON public.tenant_branding(tenant_id);
