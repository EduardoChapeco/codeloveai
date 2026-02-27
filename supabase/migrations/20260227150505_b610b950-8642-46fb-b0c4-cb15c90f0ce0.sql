
-- Marketplace Onboarding & Delivery System
-- Tracks guided onboarding steps, buyer confirmation, and payout release

-- Onboarding sessions for each purchase
CREATE TABLE public.marketplace_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES public.marketplace_purchases(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL,
  buyer_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  current_step INT NOT NULL DEFAULT 1,
  total_steps INT NOT NULL DEFAULT 5,
  seller_started_at TIMESTAMPTZ,
  buyer_confirmed_project_at TIMESTAMPTZ,
  buyer_confirmed_delivery_at TIMESTAMPTZ,
  payout_released_at TIMESTAMPTZ,
  buyer_location JSONB,
  seller_location JSONB,
  location_consent_buyer BOOLEAN DEFAULT false,
  location_consent_seller BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation trigger for onboarding status
CREATE OR REPLACE FUNCTION public.validate_onboarding_status()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'in_progress', 'buyer_review', 'confirmed', 'payout_released', 'disputed') THEN
    RAISE EXCEPTION 'Invalid onboarding status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_onboarding_status BEFORE INSERT OR UPDATE ON public.marketplace_onboarding
  FOR EACH ROW EXECUTE FUNCTION public.validate_onboarding_status();

-- Onboarding step log
CREATE TABLE public.marketplace_onboarding_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_id UUID NOT NULL REFERENCES public.marketplace_onboarding(id) ON DELETE CASCADE,
  step_number INT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seller invoices/payouts (7-day hold)
CREATE TABLE public.marketplace_seller_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL,
  purchase_id UUID NOT NULL REFERENCES public.marketplace_purchases(id),
  listing_id UUID NOT NULL,
  buyer_id UUID NOT NULL,
  gross_amount NUMERIC NOT NULL DEFAULT 0,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  net_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'held',
  hold_until TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  buyer_confirmed BOOLEAN DEFAULT false,
  payout_method TEXT DEFAULT 'pix',
  payout_reference TEXT,
  paid_at TIMESTAMPTZ,
  paid_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation for invoice status
CREATE OR REPLACE FUNCTION public.validate_seller_invoice_status()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('held', 'pending_confirmation', 'ready', 'processing', 'paid', 'cancelled', 'refunded') THEN
    RAISE EXCEPTION 'Invalid seller invoice status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_seller_invoice_status BEFORE INSERT OR UPDATE ON public.marketplace_seller_invoices
  FOR EACH ROW EXECUTE FUNCTION public.validate_seller_invoice_status();

-- Location consent log
CREATE TABLE public.marketplace_location_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  purchase_id UUID,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  consent_given BOOLEAN DEFAULT true,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.marketplace_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_onboarding_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_seller_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_location_log ENABLE ROW LEVEL SECURITY;

-- Onboarding: buyer and seller can see their own
CREATE POLICY "Buyer or seller can view onboarding"
  ON public.marketplace_onboarding FOR SELECT TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id OR public.is_admin());

CREATE POLICY "Seller can update onboarding"
  ON public.marketplace_onboarding FOR UPDATE TO authenticated
  USING (auth.uid() = seller_id OR auth.uid() = buyer_id OR public.is_admin());

-- Onboarding steps: same access
CREATE POLICY "View onboarding steps"
  ON public.marketplace_onboarding_steps FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.marketplace_onboarding o
    WHERE o.id = onboarding_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid() OR public.is_admin())
  ));

CREATE POLICY "Complete onboarding steps"
  ON public.marketplace_onboarding_steps FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.marketplace_onboarding o
    WHERE o.id = onboarding_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid() OR public.is_admin())
  ));

-- Seller invoices: seller sees own, admin sees all
CREATE POLICY "Seller views own invoices"
  ON public.marketplace_seller_invoices FOR SELECT TO authenticated
  USING (auth.uid() = seller_id OR public.is_admin());

CREATE POLICY "Admin manages invoices"
  ON public.marketplace_seller_invoices FOR UPDATE TO authenticated
  USING (public.is_admin());

-- Location log: user sees own, admin sees all
CREATE POLICY "User views own location"
  ON public.marketplace_location_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "User inserts own location"
  ON public.marketplace_location_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Updated_at triggers
CREATE TRIGGER update_marketplace_onboarding_updated_at
  BEFORE UPDATE ON public.marketplace_onboarding
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_marketplace_seller_invoices_updated_at
  BEFORE UPDATE ON public.marketplace_seller_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
