
-- ═══════════════════════════════════════════════════════════
-- WHITE LABEL MONETIZATION SYSTEM - PHASE 1: DATABASE
-- ═══════════════════════════════════════════════════════════

-- 1. White Label Plans (products you sell)
CREATE TABLE public.white_label_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  setup_price_cents bigint NOT NULL DEFAULT 0,
  setup_is_free boolean NOT NULL DEFAULT false,
  monthly_price_cents bigint NOT NULL DEFAULT 0,
  yearly_price_cents bigint DEFAULT NULL,
  global_split_percent numeric(5,2) NOT NULL DEFAULT 30.00,
  affiliate_global_split_percent numeric(5,2) NOT NULL DEFAULT 30.00,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.white_label_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Global admins manage WL plans"
  ON public.white_label_plans FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Authenticated can view active WL plans"
  ON public.white_label_plans FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = true);

-- 2. Alter tenants to add WL columns
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS white_label_plan_id uuid REFERENCES public.white_label_plans(id),
  ADD COLUMN IF NOT EXISTS setup_paid boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS global_split_percent numeric(5,2) DEFAULT 30.00,
  ADD COLUMN IF NOT EXISTS affiliate_global_split_percent numeric(5,2) DEFAULT 30.00;

-- 3. White Label Affiliates (separate from member affiliates)
CREATE TABLE public.white_label_affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text UNIQUE NOT NULL,
  display_name text NOT NULL DEFAULT '',
  commission_percent numeric(5,2) NOT NULL DEFAULT 30.00,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.white_label_affiliates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Global admins manage WL affiliates"
  ON public.white_label_affiliates FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "WL affiliates view own"
  ON public.white_label_affiliates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Public can view active WL affiliate codes"
  ON public.white_label_affiliates FOR SELECT
  USING (is_active = true);

-- 4. White Label Referrals (which tenants were referred)
CREATE TABLE public.white_label_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.white_label_affiliates(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  setup_commission_cents bigint DEFAULT 0,
  subscription_commission_cents bigint DEFAULT 0,
  total_recurring_earned_cents bigint DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.white_label_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Global admins manage WL referrals"
  ON public.white_label_referrals FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "WL affiliates view own referrals"
  ON public.white_label_referrals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.white_label_affiliates a
      WHERE a.id = white_label_referrals.affiliate_id
        AND a.user_id = auth.uid()
    )
  );

-- 5. White Label Subscriptions (WL owner paying for their WL)
CREATE TABLE public.white_label_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  plan_id uuid NOT NULL REFERENCES public.white_label_plans(id),
  owner_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active',
  period text NOT NULL DEFAULT 'monthly',
  amount_cents bigint NOT NULL DEFAULT 0,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  payment_id text,
  affiliate_wl_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.white_label_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Global admins manage WL subscriptions"
  ON public.white_label_subscriptions FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Tenant owners view own WL subscription"
  ON public.white_label_subscriptions FOR SELECT
  USING (auth.uid() = owner_user_id);

-- 6. White Label Affiliate Bank Info (for PIX payouts)
CREATE TABLE public.white_label_affiliate_bank_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.white_label_affiliates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  holder_name text NOT NULL DEFAULT '',
  pix_key_type text NOT NULL DEFAULT 'cpf',
  pix_key text NOT NULL DEFAULT '',
  bank_name text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(affiliate_id)
);

ALTER TABLE public.white_label_affiliate_bank_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Global admins manage WL bank info"
  ON public.white_label_affiliate_bank_info FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "WL affiliates manage own bank info"
  ON public.white_label_affiliate_bank_info FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7. White Label Affiliate Invoices (weekly payouts)
CREATE TABLE public.white_label_affiliate_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.white_label_affiliates(id),
  user_id uuid NOT NULL,
  week_start date NOT NULL,
  week_end date NOT NULL,
  total_sales integer NOT NULL DEFAULT 0,
  total_commission_cents bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  paid_at timestamptz,
  paid_by uuid,
  payment_notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.white_label_affiliate_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Global admins manage WL invoices"
  ON public.white_label_affiliate_invoices FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "WL affiliates view own invoices"
  ON public.white_label_affiliate_invoices FOR SELECT
  USING (auth.uid() = user_id);

-- 8. Triggers for updated_at
CREATE TRIGGER update_white_label_plans_updated_at
  BEFORE UPDATE ON public.white_label_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_white_label_affiliates_updated_at
  BEFORE UPDATE ON public.white_label_affiliates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_white_label_subscriptions_updated_at
  BEFORE UPDATE ON public.white_label_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_wl_affiliate_bank_info_updated_at
  BEFORE UPDATE ON public.white_label_affiliate_bank_info
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_wl_affiliate_invoices_updated_at
  BEFORE UPDATE ON public.white_label_affiliate_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Indexes for performance
CREATE INDEX idx_wl_referrals_affiliate ON public.white_label_referrals(affiliate_id);
CREATE INDEX idx_wl_referrals_tenant ON public.white_label_referrals(tenant_id);
CREATE INDEX idx_wl_subscriptions_tenant ON public.white_label_subscriptions(tenant_id);
CREATE INDEX idx_wl_subscriptions_owner ON public.white_label_subscriptions(owner_user_id);
CREATE INDEX idx_wl_affiliates_user ON public.white_label_affiliates(user_id);
CREATE INDEX idx_wl_affiliates_code ON public.white_label_affiliates(code);

-- 10. Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.white_label_subscriptions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.white_label_referrals;
