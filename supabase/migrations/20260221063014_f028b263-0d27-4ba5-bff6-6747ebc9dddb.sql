
-- =============================================
-- PHASE 1: MULTI-TENANT WHITE LABEL FOUNDATION
-- =============================================

-- 1. Create tenant_role enum
CREATE TYPE public.tenant_role AS ENUM ('tenant_owner', 'tenant_admin', 'tenant_member', 'tenant_support');

-- 2. Create tenants table
CREATE TABLE public.tenants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  domain_custom TEXT UNIQUE,
  logo_url TEXT,
  favicon_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#0A84FF',
  secondary_color TEXT NOT NULL DEFAULT '#5E5CE6',
  meta_title TEXT,
  meta_description TEXT,
  terms_template TEXT,
  commission_percent NUMERIC NOT NULL DEFAULT 30,
  token_cost NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- 3. Create tenant_users table
CREATE TABLE public.tenant_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role tenant_role NOT NULL DEFAULT 'tenant_member',
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;

-- 4. Create tenant_wallets table
CREATE TABLE public.tenant_wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  balance NUMERIC NOT NULL DEFAULT 0,
  total_credited NUMERIC NOT NULL DEFAULT 0,
  total_debited NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_wallets ENABLE ROW LEVEL SECURITY;

-- 5. Create tenant_wallet_transactions table
CREATE TABLE public.tenant_wallet_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL, -- 'credit', 'debit', 'token_cost', 'commission'
  description TEXT NOT NULL DEFAULT '',
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_wallet_transactions ENABLE ROW LEVEL SECURITY;

-- 6. Create tenant_extensions table
CREATE TABLE public.tenant_extensions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  version TEXT NOT NULL,
  instructions TEXT NOT NULL DEFAULT '',
  is_latest BOOLEAN NOT NULL DEFAULT true,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  activation_cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_extensions ENABLE ROW LEVEL SECURITY;

-- 7. Create tenant_invoices table (admin global → tenant)
CREATE TABLE public.tenant_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_revenue NUMERIC NOT NULL DEFAULT 0,
  admin_commission NUMERIC NOT NULL DEFAULT 0,
  tenant_revenue NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open', -- open, paid, overdue
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_invoices ENABLE ROW LEVEL SECURITY;

-- 8. Create tenant_invoice_items table
CREATE TABLE public.tenant_invoice_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.tenant_invoices(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id),
  payment_id TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  admin_commission NUMERIC NOT NULL DEFAULT 0,
  tenant_revenue NUMERIC NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_invoice_items ENABLE ROW LEVEL SECURITY;

-- 9. Create admin_commissions table
CREATE TABLE public.admin_commissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id),
  payment_id TEXT,
  sale_amount NUMERIC NOT NULL DEFAULT 0,
  commission_percent NUMERIC NOT NULL DEFAULT 30,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_commissions ENABLE ROW LEVEL SECURITY;

-- 10. Create tenant_payouts table
CREATE TABLE public.tenant_payouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT 'pix',
  status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, cancelled
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_payouts ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 11. ADD tenant_id TO ALL EXISTING TABLES
-- =============================================

ALTER TABLE public.profiles ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.subscriptions ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.tokens ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.admin_notifications ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.affiliates ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.affiliate_referrals ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.affiliate_invoices ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.affiliate_invoice_items ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.affiliate_bank_info ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.community_posts ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.post_comments ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.post_likes ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.post_views ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.post_copies ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.post_hashtags ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.hashtags ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.chat_conversations ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.chat_messages ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.codecoins ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.codecoin_transactions ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.messages ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.extension_files ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.user_profiles ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.user_followers ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.lovable_accounts ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.lovable_projects ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.lovable_api_calls_log ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.deployments_log ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.ai_endpoint_config ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);

-- =============================================
-- 12. HELPER FUNCTIONS
-- =============================================

-- Check if user has a specific tenant role
CREATE OR REPLACE FUNCTION public.has_tenant_role(_user_id UUID, _tenant_id UUID, _role tenant_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
      AND role = _role
  )
$$;

-- Check if user is tenant_owner or tenant_admin for a given tenant
CREATE OR REPLACE FUNCTION public.is_tenant_admin(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
      AND role IN ('tenant_owner', 'tenant_admin')
  )
$$;

-- Check if user belongs to a tenant (any role)
CREATE OR REPLACE FUNCTION public.is_tenant_member(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
  )
$$;

-- Get primary tenant ID for a user
CREATE OR REPLACE FUNCTION public.get_user_primary_tenant(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.tenant_users
  WHERE user_id = _user_id AND is_primary = true
  LIMIT 1
$$;

-- Check if user is global admin (reuses existing is_admin)
-- Already exists: public.is_admin(_user_id)

-- =============================================
-- 13. MIGRATE EXISTING DATA — CREATE DEFAULT TENANT
-- =============================================

-- Create the default "Starble" tenant
INSERT INTO public.tenants (id, name, slug, domain_custom, primary_color, secondary_color, commission_percent, token_cost, is_active, meta_title, meta_description)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Starble',
  'Starble',
  'Starbleai.lovable.app',
  '#0A84FF',
  '#5E5CE6',
  0,
  0,
  true,
  'Starble — Mensagens Ilimitadas no Lovable',
  'Acesse o Lovable sem limites com a extensão Starble'
);

-- Create wallet for default tenant
INSERT INTO public.tenant_wallets (tenant_id, balance, total_credited, total_debited)
VALUES ('a0000000-0000-0000-0000-000000000001', 999999, 999999, 0);

-- Assign ALL existing users to the Starble tenant
INSERT INTO public.tenant_users (tenant_id, user_id, role, is_primary)
SELECT 
  'a0000000-0000-0000-0000-000000000001',
  ur.user_id,
  CASE 
    WHEN ur.role = 'admin' THEN 'tenant_owner'::tenant_role
    ELSE 'tenant_member'::tenant_role
  END,
  true
FROM public.user_roles ur
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- Update ALL existing tables with the default tenant_id
UPDATE public.profiles SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.subscriptions SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.tokens SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.admin_notifications SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.affiliates SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.affiliate_referrals SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.affiliate_invoices SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.affiliate_invoice_items SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.affiliate_bank_info SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.community_posts SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.post_comments SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.post_likes SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.post_views SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.post_copies SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.post_hashtags SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.hashtags SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.chat_conversations SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.chat_messages SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.codecoins SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.codecoin_transactions SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.messages SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.extension_files SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.user_profiles SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.user_followers SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.lovable_accounts SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.lovable_projects SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.lovable_api_calls_log SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.deployments_log SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.ai_endpoint_config SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;

-- =============================================
-- 14. INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX idx_tenant_users_user ON public.tenant_users(user_id);
CREATE INDEX idx_tenant_users_tenant ON public.tenant_users(tenant_id);
CREATE INDEX idx_profiles_tenant ON public.profiles(tenant_id);
CREATE INDEX idx_subscriptions_tenant ON public.subscriptions(tenant_id);
CREATE INDEX idx_tokens_tenant ON public.tokens(tenant_id);
CREATE INDEX idx_community_posts_tenant ON public.community_posts(tenant_id);
CREATE INDEX idx_chat_conversations_tenant ON public.chat_conversations(tenant_id);
CREATE INDEX idx_affiliates_tenant ON public.affiliates(tenant_id);
CREATE INDEX idx_admin_commissions_tenant ON public.admin_commissions(tenant_id);
CREATE INDEX idx_tenant_invoices_tenant ON public.tenant_invoices(tenant_id);
CREATE INDEX idx_tenant_wallet_transactions_tenant ON public.tenant_wallet_transactions(tenant_id);

-- =============================================
-- 15. RLS POLICIES FOR NEW TABLES
-- =============================================

-- TENANTS: Global admins see all, tenant admins see own
CREATE POLICY "Global admins manage tenants" ON public.tenants FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Tenant members view own tenant" ON public.tenants FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = tenants.id)
);

-- TENANT_USERS: Global admin sees all, tenant_admin sees own tenant, users see own
CREATE POLICY "Global admins manage tenant_users" ON public.tenant_users FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Tenant admins manage own tenant users" ON public.tenant_users FOR ALL USING (
  is_tenant_admin(auth.uid(), tenant_id)
) WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));
CREATE POLICY "Users view own memberships" ON public.tenant_users FOR SELECT USING (auth.uid() = user_id);

-- TENANT_WALLETS
CREATE POLICY "Global admins manage wallets" ON public.tenant_wallets FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Tenant admins view own wallet" ON public.tenant_wallets FOR SELECT USING (
  is_tenant_admin(auth.uid(), tenant_id)
);

-- TENANT_WALLET_TRANSACTIONS
CREATE POLICY "Global admins manage wallet txns" ON public.tenant_wallet_transactions FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Tenant admins view own txns" ON public.tenant_wallet_transactions FOR SELECT USING (
  is_tenant_admin(auth.uid(), tenant_id)
);

-- TENANT_EXTENSIONS
CREATE POLICY "Global admins manage tenant extensions" ON public.tenant_extensions FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Tenant admins manage own extensions" ON public.tenant_extensions FOR ALL USING (
  is_tenant_admin(auth.uid(), tenant_id)
) WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));
CREATE POLICY "Tenant members view extensions" ON public.tenant_extensions FOR SELECT USING (
  is_tenant_member(auth.uid(), tenant_id)
);

-- TENANT_INVOICES
CREATE POLICY "Global admins manage tenant invoices" ON public.tenant_invoices FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Tenant admins view own invoices" ON public.tenant_invoices FOR SELECT USING (
  is_tenant_admin(auth.uid(), tenant_id)
);

-- TENANT_INVOICE_ITEMS
CREATE POLICY "Global admins manage invoice items" ON public.tenant_invoice_items FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Tenant admins view own invoice items" ON public.tenant_invoice_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.tenant_invoices ti WHERE ti.id = tenant_invoice_items.invoice_id AND is_tenant_admin(auth.uid(), ti.tenant_id))
);

-- ADMIN_COMMISSIONS
CREATE POLICY "Global admins manage commissions" ON public.admin_commissions FOR ALL USING (is_admin(auth.uid()));

-- TENANT_PAYOUTS
CREATE POLICY "Global admins manage payouts" ON public.tenant_payouts FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Tenant admins view own payouts" ON public.tenant_payouts FOR SELECT USING (
  is_tenant_admin(auth.uid(), tenant_id)
);

-- =============================================
-- 16. UPDATE handle_new_user TO ASSIGN DEFAULT TENANT
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _role app_role;
  _default_tenant_id UUID;
BEGIN
  -- First user ever becomes admin, all others become member
  IF NOT EXISTS (SELECT 1 FROM public.user_roles LIMIT 1) THEN
    _role := 'admin';
  ELSE
    _role := 'member';
  END IF;

  INSERT INTO public.profiles (user_id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''), NEW.email);
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role);

  -- Assign user to default tenant (Starble)
  _default_tenant_id := 'a0000000-0000-0000-0000-000000000001';
  INSERT INTO public.tenant_users (tenant_id, user_id, role, is_primary)
  VALUES (_default_tenant_id, NEW.id, 'tenant_member', true)
  ON CONFLICT (tenant_id, user_id) DO NOTHING;

  -- Set tenant_id on profile
  UPDATE public.profiles SET tenant_id = _default_tenant_id WHERE user_id = NEW.id AND tenant_id IS NULL;

  RETURN NEW;
END;
$$;

-- Trigger for updated_at on tenants
CREATE TRIGGER update_tenants_updated_at
BEFORE UPDATE ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updated_at on tenant_invoices
CREATE TRIGGER update_tenant_invoices_updated_at
BEFORE UPDATE ON public.tenant_invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
