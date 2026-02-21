
-- 1) Add is_domain_approved to tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS is_domain_approved boolean NOT NULL DEFAULT false;

-- 2) Create ledger_entries table for split tracking (tenant vs global admin vs affiliate)
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  payment_id text,
  subscription_id uuid REFERENCES public.subscriptions(id),
  entry_type text NOT NULL, -- 'tenant_revenue', 'admin_commission', 'affiliate_commission'
  amount numeric NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  reference_user_id uuid, -- the user who made the purchase
  affiliate_id uuid REFERENCES public.affiliates(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

-- Global admins manage all
CREATE POLICY "Global admins manage ledger"
ON public.ledger_entries FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Tenant admins view own tenant ledger
CREATE POLICY "Tenant admins view own ledger"
ON public.ledger_entries FOR SELECT
TO authenticated
USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_ledger_entries_tenant_id ON public.ledger_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_payment_id ON public.ledger_entries(payment_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_created_at ON public.ledger_entries(created_at DESC);
