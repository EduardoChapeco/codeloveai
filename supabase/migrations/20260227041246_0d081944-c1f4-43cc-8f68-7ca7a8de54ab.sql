
-- Restrict feature flags to authenticated users only
DROP POLICY IF EXISTS "feature_flags_select_all" ON public.feature_flags;
CREATE POLICY "feature_flags_select_authenticated" ON public.feature_flags FOR SELECT TO authenticated USING (true);
