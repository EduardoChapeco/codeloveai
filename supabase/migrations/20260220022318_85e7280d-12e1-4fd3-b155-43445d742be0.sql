
-- Add 'affiliate' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'affiliate';

-- Create affiliates table
CREATE TABLE public.affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  affiliate_code text NOT NULL UNIQUE,
  display_name text NOT NULL DEFAULT '',
  discount_percent int NOT NULL DEFAULT 20,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates can view own record"
  ON public.affiliates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all affiliates"
  ON public.affiliates FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create codecoins table
CREATE TABLE public.codecoins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  balance int NOT NULL DEFAULT 0,
  total_earned int NOT NULL DEFAULT 0,
  total_spent int NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.codecoins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own codecoins"
  ON public.codecoins FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all codecoins"
  ON public.codecoins FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create codecoin_transactions table
CREATE TABLE public.codecoin_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount int NOT NULL,
  type text NOT NULL CHECK (type IN ('earned', 'redeemed')),
  description text NOT NULL DEFAULT '',
  week_start date,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.codecoin_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON public.codecoin_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all transactions"
  ON public.codecoin_transactions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create affiliate_referrals table
CREATE TABLE public.affiliate_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id),
  referred_user_id uuid NOT NULL,
  subscription_id uuid REFERENCES public.subscriptions(id),
  confirmed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates can view own referrals"
  ON public.affiliate_referrals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.affiliates
      WHERE affiliates.id = affiliate_referrals.affiliate_id
      AND affiliates.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all referrals"
  ON public.affiliate_referrals FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create extension_files table
CREATE TABLE public.extension_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_url text NOT NULL,
  version text NOT NULL,
  uploaded_by uuid NOT NULL,
  is_latest boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.extension_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view extension files"
  ON public.extension_files FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage extension files"
  ON public.extension_files FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add affiliate_code column to subscriptions
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS affiliate_code text;

-- Create storage bucket for extensions
INSERT INTO storage.buckets (id, name, public) VALUES ('extensions', 'extensions', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can download extensions"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'extensions' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admins can upload extensions"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'extensions' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete extensions"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'extensions' AND has_role(auth.uid(), 'admin'::app_role));
