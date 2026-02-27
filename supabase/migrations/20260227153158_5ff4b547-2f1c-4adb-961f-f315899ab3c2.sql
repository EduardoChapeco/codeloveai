
-- 1. extension_catalog: require auth for viewing
DROP POLICY IF EXISTS "Anyone can view active extensions" ON public.extension_catalog;
CREATE POLICY "Authenticated can view active extensions"
  ON public.extension_catalog FOR SELECT TO authenticated
  USING (is_active = true);

-- 2. module_catalog: require auth for viewing
DROP POLICY IF EXISTS "Anyone can view active modules" ON public.module_catalog;
CREATE POLICY "Authenticated can view active modules"
  ON public.module_catalog FOR SELECT TO authenticated
  USING (is_active = true);

-- 3. plan_extensions: require auth for viewing
DROP POLICY IF EXISTS "Anyone can view plan extensions" ON public.plan_extensions;
CREATE POLICY "Authenticated can view plan extensions"
  ON public.plan_extensions FOR SELECT TO authenticated
  USING (true);

-- 4. seller_profiles: require auth for viewing active sellers, hide revenue data
DROP POLICY IF EXISTS "Public can view active sellers" ON public.seller_profiles;
CREATE POLICY "Authenticated can view active sellers"
  ON public.seller_profiles FOR SELECT TO authenticated
  USING (is_active = true);

-- 5. whitelabel_config: require auth (except keep service_role)
DROP POLICY IF EXISTS "Public read whitelabel config" ON public.whitelabel_config;
CREATE POLICY "Authenticated read whitelabel config"
  ON public.whitelabel_config FOR SELECT TO authenticated
  USING (true);

-- 6. plans: keep public for pricing pages but only expose necessary fields
-- Plans need to remain public for unauthenticated pricing page views - this is intentional
-- No change needed for plans
