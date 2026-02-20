
-- Fix ALL policies to be explicitly PERMISSIVE

-- PROFILES
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Admins can view all profiles" ON public.profiles
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own profile" ON public.profiles
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- SUBSCRIPTIONS
DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;

CREATE POLICY "Admins can manage all subscriptions" ON public.subscriptions
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- TOKENS
DROP POLICY IF EXISTS "Admins can manage all tokens" ON public.tokens;
DROP POLICY IF EXISTS "Users can view own tokens" ON public.tokens;

CREATE POLICY "Admins can manage all tokens" ON public.tokens
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own tokens" ON public.tokens
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- USER_ROLES
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "Admins can manage all roles" ON public.user_roles
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own roles" ON public.user_roles
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
