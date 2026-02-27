
-- =============================================
-- PROJECT MARKETPLACE SCHEMA
-- =============================================

-- Seller profiles (extends existing profiles)
CREATE TABLE public.seller_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  bio text DEFAULT '',
  avatar_url text,
  website_url text,
  github_url text,
  skills text[] DEFAULT '{}',
  total_sales integer NOT NULL DEFAULT 0,
  total_revenue numeric NOT NULL DEFAULT 0,
  rating numeric NOT NULL DEFAULT 0,
  rating_count integer NOT NULL DEFAULT 0,
  is_verified boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;

-- Everyone can view active seller profiles
CREATE POLICY "Public can view active sellers" ON public.seller_profiles
  FOR SELECT USING (is_active = true);

-- Users can manage their own seller profile
CREATE POLICY "Users manage own seller profile" ON public.seller_profiles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Admins can manage all
CREATE POLICY "Admins manage all sellers" ON public.seller_profiles
  FOR ALL USING (public.is_admin(auth.uid()));

-- Marketplace listings
CREATE TABLE public.marketplace_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.seller_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  long_description text DEFAULT '',
  category text NOT NULL DEFAULT 'webapp',
  tags text[] DEFAULT '{}',
  price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  preview_url text,
  preview_image_url text,
  screenshots text[] DEFAULT '{}',
  lovable_project_id text,
  tech_stack text[] DEFAULT '{}',
  features jsonb DEFAULT '[]',
  demo_url text,
  documentation_url text,
  status text NOT NULL DEFAULT 'draft',
  is_featured boolean NOT NULL DEFAULT false,
  views_count integer NOT NULL DEFAULT 0,
  sales_count integer NOT NULL DEFAULT 0,
  rating numeric NOT NULL DEFAULT 0,
  rating_count integer NOT NULL DEFAULT 0,
  commission_rate numeric NOT NULL DEFAULT 0.40,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;

-- Published listings are public
CREATE POLICY "Public view published listings" ON public.marketplace_listings
  FOR SELECT USING (status = 'published' OR auth.uid() = user_id OR public.is_admin(auth.uid()));

-- Sellers manage own listings
CREATE POLICY "Sellers manage own listings" ON public.marketplace_listings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Sellers update own listings" ON public.marketplace_listings
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Sellers delete own listings" ON public.marketplace_listings
  FOR DELETE USING (auth.uid() = user_id);

-- Admins manage all
CREATE POLICY "Admins manage all listings" ON public.marketplace_listings
  FOR ALL USING (public.is_admin(auth.uid()));

-- Marketplace purchases
CREATE TABLE public.marketplace_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.marketplace_listings(id),
  buyer_id uuid NOT NULL REFERENCES auth.users(id),
  seller_id uuid NOT NULL REFERENCES public.seller_profiles(id),
  price numeric NOT NULL,
  commission_amount numeric NOT NULL,
  seller_amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  payment_method text DEFAULT 'pix',
  payment_id text,
  remixed_project_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_purchases ENABLE ROW LEVEL SECURITY;

-- Buyers see their purchases, sellers see their sales
CREATE POLICY "Users see own purchases" ON public.marketplace_purchases
  FOR SELECT USING (
    auth.uid() = buyer_id 
    OR auth.uid() IN (SELECT user_id FROM public.seller_profiles WHERE id = seller_id)
    OR public.is_admin(auth.uid())
  );

-- Only service role inserts purchases (via edge function)
CREATE POLICY "Admins manage purchases" ON public.marketplace_purchases
  FOR ALL USING (public.is_admin(auth.uid()));

-- Marketplace reviews
CREATE TABLE public.marketplace_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  purchase_id uuid REFERENCES public.marketplace_purchases(id),
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text DEFAULT '',
  is_verified_purchase boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(listing_id, user_id)
);

ALTER TABLE public.marketplace_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view reviews" ON public.marketplace_reviews
  FOR SELECT USING (true);
CREATE POLICY "Users manage own reviews" ON public.marketplace_reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own reviews" ON public.marketplace_reviews
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own reviews" ON public.marketplace_reviews
  FOR DELETE USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_seller_profiles_updated_at BEFORE UPDATE ON public.seller_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_marketplace_listings_updated_at BEFORE UPDATE ON public.marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_marketplace_purchases_updated_at BEFORE UPDATE ON public.marketplace_purchases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Validate listing status
CREATE OR REPLACE FUNCTION public.validate_listing_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'pending_review', 'published', 'suspended', 'archived') THEN
    RAISE EXCEPTION 'Invalid listing status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_marketplace_listing_status BEFORE INSERT OR UPDATE ON public.marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION public.validate_listing_status();

-- Validate purchase status
CREATE OR REPLACE FUNCTION public.validate_purchase_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'paid', 'delivered', 'refunded', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid purchase status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_marketplace_purchase_status BEFORE INSERT OR UPDATE ON public.marketplace_purchases
  FOR EACH ROW EXECUTE FUNCTION public.validate_purchase_status();
