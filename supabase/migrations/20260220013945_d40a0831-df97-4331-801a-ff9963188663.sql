
-- Drop all RESTRICTIVE policies and recreate as PERMISSIVE

-- PROFILES
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- SUBSCRIPTIONS
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON public.subscriptions;

CREATE POLICY "Users can view own subscriptions" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all subscriptions" ON public.subscriptions FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- TOKENS
DROP POLICY IF EXISTS "Users can view own tokens" ON public.tokens;
DROP POLICY IF EXISTS "Admins can manage all tokens" ON public.tokens;

CREATE POLICY "Users can view own tokens" ON public.tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all tokens" ON public.tokens FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- USER_ROLES
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
