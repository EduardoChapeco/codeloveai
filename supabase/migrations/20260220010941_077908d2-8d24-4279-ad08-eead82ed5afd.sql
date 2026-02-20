
-- Fix: Change all RESTRICTIVE policies to PERMISSIVE (OR logic)
-- Without this, admins can't view other users' data

-- PROFILES
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- SUBSCRIPTIONS
DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;

CREATE POLICY "Admins can manage all subscriptions" ON public.subscriptions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- TOKENS
DROP POLICY IF EXISTS "Admins can manage all tokens" ON public.tokens;
DROP POLICY IF EXISTS "Users can view own tokens" ON public.tokens;

CREATE POLICY "Admins can manage all tokens" ON public.tokens
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own tokens" ON public.tokens
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- USER_ROLES
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
