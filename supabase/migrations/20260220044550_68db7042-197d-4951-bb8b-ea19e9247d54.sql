
-- Add referred user info to referrals for affiliate client portfolio
ALTER TABLE public.affiliate_referrals 
  ADD COLUMN IF NOT EXISTS referred_email text DEFAULT '',
  ADD COLUMN IF NOT EXISTS referred_name text DEFAULT '';

-- Add line items to invoices for detailed digital invoice
CREATE TABLE IF NOT EXISTS public.affiliate_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.affiliate_invoices(id) ON DELETE CASCADE,
  referral_id uuid REFERENCES public.affiliate_referrals(id) ON DELETE SET NULL,
  client_email text NOT NULL DEFAULT '',
  client_name text NOT NULL DEFAULT '',
  plan text NOT NULL DEFAULT '',
  sale_amount numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliate_invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates view own invoice items" ON public.affiliate_invoice_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.affiliate_invoices ai 
      WHERE ai.id = invoice_id AND ai.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins manage invoice items" ON public.affiliate_invoice_items
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_invoice_items_invoice ON public.affiliate_invoice_items(invoice_id);
