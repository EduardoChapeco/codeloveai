
-- =============================================
-- MODULE 2: Database Schema Evolution
-- =============================================

-- TENANTS: add missing columns
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS domain text UNIQUE;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS mp_access_token text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS plan_type text NOT NULL DEFAULT 'messages';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS branding jsonb NOT NULL DEFAULT '{}';

-- Validation trigger for tenants.status
CREATE OR REPLACE FUNCTION public.validate_tenant_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'active', 'suspended') THEN
    RAISE EXCEPTION 'Invalid tenant status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_tenant_status
BEFORE INSERT OR UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_status();

-- Validation trigger for tenants.plan_type
CREATE OR REPLACE FUNCTION public.validate_tenant_plan_type()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.plan_type NOT IN ('messages', 'hourly') THEN
    RAISE EXCEPTION 'Invalid tenant plan_type: %', NEW.plan_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_tenant_plan_type
BEFORE INSERT OR UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_plan_type();

-- LICENSES: add missing columns
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS plan_type text NOT NULL DEFAULT 'messages';
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS daily_messages int NOT NULL DEFAULT 10;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS hourly_limit int;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS affiliate_id uuid REFERENCES public.affiliates(id);

-- Validation trigger for licenses.plan_type
CREATE OR REPLACE FUNCTION public.validate_license_plan_type()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.plan_type NOT IN ('messages', 'hourly') THEN
    RAISE EXCEPTION 'Invalid license plan_type: %', NEW.plan_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_license_plan_type
BEFORE INSERT OR UPDATE ON public.licenses
FOR EACH ROW EXECUTE FUNCTION public.validate_license_plan_type();

-- AFFILIATES: add missing columns
ALTER TABLE public.affiliates ADD COLUMN IF NOT EXISTS commission_rate numeric NOT NULL DEFAULT 0.30;
ALTER TABLE public.affiliates ADD COLUMN IF NOT EXISTS total_earned numeric NOT NULL DEFAULT 0;
ALTER TABLE public.affiliates ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;

-- TRANSACTIONS TABLE (new)
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id),
  affiliate_id uuid REFERENCES public.affiliates(id),
  user_id uuid,
  amount numeric NOT NULL DEFAULT 0,
  mp_payment_id text,
  commission_percent numeric,
  status text NOT NULL DEFAULT 'pending',
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for transactions.type
CREATE OR REPLACE FUNCTION public.validate_transaction_type()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.type NOT IN ('setup', 'subscription', 'commission_affiliate', 'commission_platform') THEN
    RAISE EXCEPTION 'Invalid transaction type: %', NEW.type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_transaction_type
BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.validate_transaction_type();

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all transactions"
ON public.transactions FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Users view own transactions"
ON public.transactions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Tenant admins view tenant transactions"
ON public.transactions FOR SELECT
USING (is_tenant_admin(auth.uid(), tenant_id));

-- DAILY_USAGE TABLE (new)
CREATE TABLE public.daily_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id uuid NOT NULL REFERENCES public.licenses(id),
  user_id uuid NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id),
  date date NOT NULL DEFAULT CURRENT_DATE,
  messages_used int NOT NULL DEFAULT 0,
  UNIQUE(license_id, date)
);

ALTER TABLE public.daily_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own usage"
ON public.daily_usage FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own usage"
ON public.daily_usage FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own usage"
ON public.daily_usage FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins manage all usage"
ON public.daily_usage FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Tenant admins view tenant usage"
ON public.daily_usage FOR SELECT
USING (is_tenant_admin(auth.uid(), tenant_id));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_daily_usage_license_date ON public.daily_usage(license_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_usage_tenant_date ON public.daily_usage(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_transactions_tenant ON public.transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_affiliate ON public.transactions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_licenses_affiliate ON public.licenses(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_tenants_domain ON public.tenants(domain);

-- Storage bucket for tenant assets
INSERT INTO storage.buckets (id, name, public) VALUES ('tenant-assets', 'tenant-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view tenant assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'tenant-assets');

CREATE POLICY "Authenticated users upload tenant assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'tenant-assets' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users update own tenant assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'tenant-assets' AND auth.uid() IS NOT NULL);
