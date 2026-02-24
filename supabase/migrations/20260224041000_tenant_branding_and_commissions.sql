-- ═══════════════════════════════════════════════════════════
-- tenant_branding table + commissions + ALTER affiliates
-- ═══════════════════════════════════════════════════════════

-- 1. tenant_branding — per-tenant white-label configuration
CREATE TABLE IF NOT EXISTS tenant_branding (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         UUID NOT NULL UNIQUE,
  app_name          TEXT DEFAULT 'Starble Booster',
  logo_url          TEXT,
  favicon_url       TEXT,
  primary_color     TEXT DEFAULT '7c3aed',
  secondary_color   TEXT DEFAULT 'a855f7',
  accent_color      TEXT,
  modules           JSONB DEFAULT '{
    "chat": false,
    "deploy": true,
    "preview": true,
    "notes": true,
    "split": true,
    "auto": true,
    "wl": true,
    "affiliate": true,
    "community": true
  }'::jsonb,
  prompt_suggestions JSONB DEFAULT '[]'::jsonb,
  extension_mode    TEXT DEFAULT 'security_fix_v2',
  custom_mode_prompt TEXT,
  terms_template    TEXT,
  theme             TEXT DEFAULT 'crystal',  -- 'titanium', 'crystal', 'nebula'
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Default row for the main Starble tenant
INSERT INTO tenant_branding (tenant_id, app_name, primary_color, secondary_color, theme)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Starble Booster',
  '0071e3',
  '5e5ce6',
  'crystal'
)
ON CONFLICT (tenant_id) DO NOTHING;

-- 2. commissions — track affiliate/white-label earnings
CREATE TABLE IF NOT EXISTS commissions (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID REFERENCES affiliates(id) ON DELETE CASCADE,
  tenant_id    UUID,
  type         TEXT CHECK (type IN ('setup', 'monthly', 'daily')) DEFAULT 'monthly',
  amount_brl   INTEGER NOT NULL DEFAULT 0,  -- centavos
  status       TEXT CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')) DEFAULT 'pending',
  reference_id TEXT,   -- payment_id from MercadoPago or similar
  period       DATE,   -- billing period (first day of month)
  paid_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ALTER affiliates — add missing columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'affiliates' AND column_name = 'type'
  ) THEN
    ALTER TABLE affiliates ADD COLUMN type TEXT DEFAULT 'simple'
      CHECK (type IN ('simple', 'whitelabel'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'affiliates' AND column_name = 'commission_pct'
  ) THEN
    ALTER TABLE affiliates ADD COLUMN commission_pct NUMERIC DEFAULT 30;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'affiliates' AND column_name = 'total_earned'
  ) THEN
    ALTER TABLE affiliates ADD COLUMN total_earned NUMERIC DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'affiliates' AND column_name = 'pix_key'
  ) THEN
    ALTER TABLE affiliates ADD COLUMN pix_key TEXT;
  END IF;
END$$;

-- 4. updated_at trigger for tenant_branding
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tenant_branding_updated_at ON tenant_branding;
CREATE TRIGGER trg_tenant_branding_updated_at
  BEFORE UPDATE ON tenant_branding
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. RLS
ALTER TABLE tenant_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;

-- tenant_branding: public read, admin write
DROP POLICY IF EXISTS "Branding is public" ON tenant_branding;
CREATE POLICY "Branding is public"
  ON tenant_branding FOR SELECT USING (true);

DROP POLICY IF EXISTS "Tenant admins can update branding" ON tenant_branding;
CREATE POLICY "Tenant admins can update branding"
  ON tenant_branding FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tenant_users tu
      WHERE tu.tenant_id = tenant_branding.tenant_id
        AND tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  );

-- commissions: affiliates see their own
DROP POLICY IF EXISTS "Affiliates see own commissions" ON commissions;
CREATE POLICY "Affiliates see own commissions"
  ON commissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM affiliates a
      WHERE a.id = commissions.affiliate_id
        AND a.user_id = auth.uid()
    )
  );
