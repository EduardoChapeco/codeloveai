
-- Add commission tracking to referrals
ALTER TABLE public.affiliate_referrals 
ADD COLUMN IF NOT EXISTS commission_amount numeric(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS subscription_plan text,
ADD COLUMN IF NOT EXISTS sale_amount numeric(10,2) DEFAULT 0;

-- Affiliate bank info (PIX)
CREATE TABLE public.affiliate_bank_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  pix_key_type text NOT NULL DEFAULT 'cpf',
  pix_key text NOT NULL DEFAULT '',
  holder_name text NOT NULL DEFAULT '',
  bank_name text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(affiliate_id)
);

ALTER TABLE public.affiliate_bank_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates can view own bank info"
ON public.affiliate_bank_info FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Affiliates can upsert own bank info"
ON public.affiliate_bank_info FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Affiliates can update own bank info"
ON public.affiliate_bank_info FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all bank info"
ON public.affiliate_bank_info FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Affiliate invoices (weekly billing)
CREATE TABLE public.affiliate_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  week_start date NOT NULL,
  week_end date NOT NULL,
  total_sales integer NOT NULL DEFAULT 0,
  total_commission numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  paid_at timestamptz,
  paid_by uuid,
  payment_notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(affiliate_id, week_start)
);

ALTER TABLE public.affiliate_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates can view own invoices"
ON public.affiliate_invoices FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all invoices"
ON public.affiliate_invoices FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at on bank_info
CREATE TRIGGER update_affiliate_bank_info_updated_at
BEFORE UPDATE ON public.affiliate_bank_info
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updated_at on invoices
CREATE TRIGGER update_affiliate_invoices_updated_at
BEFORE UPDATE ON public.affiliate_invoices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
