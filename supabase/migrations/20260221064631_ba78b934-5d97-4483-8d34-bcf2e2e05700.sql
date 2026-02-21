-- Fix user_profiles public SELECT policy to require authentication
DROP POLICY IF EXISTS "Anyone can view public profiles" ON public.user_profiles;

CREATE POLICY "Authenticated can view public profiles"
  ON public.user_profiles
  FOR SELECT
  USING ((auth.uid() IS NOT NULL) AND (is_public = true));