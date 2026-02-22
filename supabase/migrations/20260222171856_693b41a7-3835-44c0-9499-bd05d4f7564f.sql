
-- Fix: Replace public SELECT policy on affiliates with authenticated-only
DROP POLICY IF EXISTS "Public can view affiliate codes" ON public.affiliates;
CREATE POLICY "Authenticated can view affiliate codes" ON public.affiliates FOR SELECT USING (auth.uid() IS NOT NULL);
