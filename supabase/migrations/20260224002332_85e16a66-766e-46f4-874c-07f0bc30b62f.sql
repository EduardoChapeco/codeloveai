
-- ============================================================
-- STARBLE v2.0 — Schema Evolution Migration
-- ============================================================

-- ── 1. tenant_branding (separate from tenants) ────────────────
CREATE TABLE IF NOT EXISTS public.tenant_branding (
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE PRIMARY KEY,
  app_name TEXT NOT NULL DEFAULT 'Booster',
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '7c3aed',
  secondary_color TEXT NOT NULL DEFAULT 'a855f7',
  accent_color TEXT,
  extension_mode TEXT NOT NULL DEFAULT 'security_fix_v2',
  custom_mode_prompt TEXT,
  modules JSONB NOT NULL DEFAULT '{"chat":false,"deploy":true,"preview":true,"notes":true,"split":true,"auto":true,"wl":true,"affiliate":true,"community":true}',
  prompt_suggestions JSONB NOT NULL DEFAULT '[]',
  community_group_name TEXT,
  community_group_enabled BOOLEAN NOT NULL DEFAULT true,
  community_max_channels INTEGER NOT NULL DEFAULT 5,
  trial_minutes INTEGER NOT NULL DEFAULT 30,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all branding" ON public.tenant_branding
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Tenant admins manage own branding" ON public.tenant_branding
  FOR ALL USING (public.is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant members view branding" ON public.tenant_branding
  FOR SELECT USING (public.is_tenant_member(auth.uid(), tenant_id));

-- Trigger for updated_at
CREATE TRIGGER update_tenant_branding_updated_at
  BEFORE UPDATE ON public.tenant_branding
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Validation trigger for extension_mode
CREATE OR REPLACE FUNCTION public.validate_extension_mode()
  RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.extension_mode NOT IN ('security_fix_v2', 'seo_fix', 'error_fix', 'custom') THEN
    RAISE EXCEPTION 'Invalid extension_mode: %', NEW.extension_mode;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_extension_mode
  BEFORE INSERT OR UPDATE ON public.tenant_branding
  FOR EACH ROW EXECUTE FUNCTION public.validate_extension_mode();

-- ── 2. plans table (fully configurable) ──────────────────────
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'daily_token',
  price INTEGER NOT NULL DEFAULT 500,
  billing_cycle TEXT NOT NULL DEFAULT 'daily',
  daily_message_limit INTEGER,
  hourly_limit INTEGER,
  monthly_limit INTEGER,
  trial_minutes INTEGER NOT NULL DEFAULT 30,
  trial_enabled BOOLEAN NOT NULL DEFAULT true,
  extension_mode TEXT NOT NULL DEFAULT 'security_fix_v2',
  modules JSONB,
  is_public BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  highlight_label TEXT,
  description TEXT,
  features JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view public active plans" ON public.plans
  FOR SELECT USING (is_public = true AND is_active = true);

CREATE POLICY "Admins manage all plans" ON public.plans
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Tenant admins manage own plans" ON public.plans
  FOR ALL USING (public.is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

-- Validation triggers for plans
CREATE OR REPLACE FUNCTION public.validate_plan_type_v2()
  RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.type NOT IN ('messages', 'hourly', 'daily_token') THEN
    RAISE EXCEPTION 'Invalid plan type: %', NEW.type;
  END IF;
  IF NEW.billing_cycle NOT IN ('daily', 'weekly', 'monthly') THEN
    RAISE EXCEPTION 'Invalid billing_cycle: %', NEW.billing_cycle;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_plan_type_v2
  BEFORE INSERT OR UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.validate_plan_type_v2();

-- ── 3. commissions table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES public.affiliates(id),
  tenant_id UUID REFERENCES public.tenants(id),
  license_id UUID REFERENCES public.licenses(id),
  type TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  payout_batch_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all commissions" ON public.commissions
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Affiliates view own commissions" ON public.commissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.affiliates
      WHERE affiliates.id = commissions.affiliate_id
        AND affiliates.user_id = auth.uid()
    )
  );

-- Validation trigger for commissions
CREATE OR REPLACE FUNCTION public.validate_commission()
  RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.type NOT IN ('setup', 'monthly', 'daily') THEN
    RAISE EXCEPTION 'Invalid commission type: %', NEW.type;
  END IF;
  IF NEW.status NOT IN ('pending', 'approved', 'paid', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid commission status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_commission
  BEFORE INSERT OR UPDATE ON public.commissions
  FOR EACH ROW EXECUTE FUNCTION public.validate_commission();

-- ── 4. payout_batches table ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payout_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processed_at TIMESTAMPTZ,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processing',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payout_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage payout batches" ON public.payout_batches
  FOR ALL USING (public.is_admin(auth.uid()));

-- Add FK from commissions to payout_batches
ALTER TABLE public.commissions
  ADD CONSTRAINT commissions_payout_batch_id_fkey
  FOREIGN KEY (payout_batch_id) REFERENCES public.payout_batches(id);

-- ── 5. community_channels ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_private BOOLEAN NOT NULL DEFAULT false,
  is_readonly BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.community_channels ENABLE ROW LEVEL SECURITY;

-- Users see global channels OR their own tenant's channels
CREATE POLICY "Users view accessible channels" ON public.community_channels
  FOR SELECT USING (
    tenant_id IS NULL
    OR public.is_tenant_member(auth.uid(), tenant_id)
  );

CREATE POLICY "Admins manage all channels" ON public.community_channels
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Tenant admins manage own channels" ON public.community_channels
  FOR ALL USING (public.is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

-- ── 6. community_messages (NO tenant_id — by design) ─────────
CREATE TABLE IF NOT EXISTS public.community_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES public.community_channels(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

-- Users see messages from channels they have access to
CREATE POLICY "Users view accessible messages" ON public.community_messages
  FOR SELECT USING (
    NOT is_deleted AND
    EXISTS (
      SELECT 1 FROM public.community_channels c
      WHERE c.id = community_messages.channel_id
        AND (c.tenant_id IS NULL OR public.is_tenant_member(auth.uid(), c.tenant_id))
    )
  );

CREATE POLICY "Users create messages in accessible channels" ON public.community_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.community_channels c
      WHERE c.id = community_messages.channel_id
        AND (c.tenant_id IS NULL OR public.is_tenant_member(auth.uid(), c.tenant_id))
        AND c.is_readonly = false
    )
  );

CREATE POLICY "Users update own messages" ON public.community_messages
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins manage all messages" ON public.community_messages
  FOR ALL USING (public.is_admin(auth.uid()));

-- ── 7. community_profiles (NO tenant_id — by design) ─────────
CREATE TABLE IF NOT EXISTS public.community_profiles (
  user_id UUID PRIMARY KEY,
  username TEXT UNIQUE,
  avatar_url TEXT,
  bio TEXT,
  reputation INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.community_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view community profiles" ON public.community_profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users manage own community profile" ON public.community_profiles
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage all community profiles" ON public.community_profiles
  FOR ALL USING (public.is_admin(auth.uid()));

-- ── 8. ALTER licenses — add v2 columns ───────────────────────
ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.plans(id),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'daily_token',
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_used BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS token_valid_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_renewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS messages_used_today INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS messages_used_month INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hours_used_month NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reset_at DATE;

-- Validation trigger for license status/type
CREATE OR REPLACE FUNCTION public.validate_license_status_type()
  RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('active', 'expired', 'suspended', 'trial') THEN
    RAISE EXCEPTION 'Invalid license status: %', NEW.status;
  END IF;
  IF NEW.type NOT IN ('daily_token', 'trial', 'monthly', 'custom') THEN
    RAISE EXCEPTION 'Invalid license type: %', NEW.type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_license_status_type
  BEFORE INSERT OR UPDATE ON public.licenses
  FOR EACH ROW EXECUTE FUNCTION public.validate_license_status_type();

-- ── 9. ALTER affiliates — add v2 columns ─────────────────────
ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'simple',
  ADD COLUMN IF NOT EXISTS pix_key TEXT,
  ADD COLUMN IF NOT EXISTS bank_info JSONB;

-- Validation trigger for affiliate type
CREATE OR REPLACE FUNCTION public.validate_affiliate_type()
  RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.type NOT IN ('simple', 'whitelabel') THEN
    RAISE EXCEPTION 'Invalid affiliate type: %', NEW.type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_affiliate_type
  BEFORE INSERT OR UPDATE ON public.affiliates
  FOR EACH ROW EXECUTE FUNCTION public.validate_affiliate_type();

-- ── 10. ALTER tenants — add v2 columns ───────────────────────
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS owner_user_id UUID,
  ADD COLUMN IF NOT EXISTS affiliate_id UUID REFERENCES public.affiliates(id),
  ADD COLUMN IF NOT EXISTS platform_fee_per_user NUMERIC,
  ADD COLUMN IF NOT EXISTS setup_paid_at TIMESTAMPTZ;

-- ── 11. increment_daily_usage RPC (used by increment-usage edge function) ──
CREATE OR REPLACE FUNCTION public.increment_daily_usage(p_license_id UUID, p_date DATE)
  RETURNS INTEGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = 'public'
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO public.daily_usage (license_id, user_id, tenant_id, date, messages_used)
  SELECT p_license_id, l.user_id, l.tenant_id, p_date, 1
  FROM public.licenses l WHERE l.id = p_license_id
  ON CONFLICT (license_id, date) DO UPDATE SET messages_used = daily_usage.messages_used + 1
  RETURNING messages_used INTO v_count;
  
  RETURN COALESCE(v_count, 0);
END;
$$;

-- ── 12. Insert default branding for existing default tenant ──
INSERT INTO public.tenant_branding (tenant_id, app_name, primary_color, secondary_color)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Starble Booster', '7c3aed', 'a855f7')
ON CONFLICT (tenant_id) DO NOTHING;

-- ── 13. Insert default Starble plans ─────────────────────────
INSERT INTO public.plans (tenant_id, name, type, price, billing_cycle, trial_minutes, trial_enabled, display_order, highlight_label, description, features)
VALUES
  (NULL, 'Trial', 'daily_token', 0, 'daily', 30, true, 0, NULL, '30 minutos grátis para testar', '["30 min de acesso completo", "Sem cartão de crédito", "Deploy + Preview + Automação"]'::jsonb),
  (NULL, 'Diário', 'daily_token', 500, 'daily', 30, false, 1, 'Popular', 'Token de 24h — R$5/dia', '["24h de acesso completo", "Deploy ilimitado", "Preview ao vivo", "Notas por projeto", "Split View automático"]'::jsonb),
  (NULL, 'Mensal', 'messages', 9900, 'monthly', 30, false, 2, NULL, 'Plano mensal — R$99/mês', '["Mensagens ilimitadas", "Todos os módulos", "Suporte prioritário", "Comunidade VIP"]'::jsonb)
ON CONFLICT DO NOTHING;
