
-- Master Access for Education/Owner (Edu)
DO $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID := 'a0000000-0000-0000-0000-000000000001'; -- Default Tenant
  v_plan_id UUID;
BEGIN
  -- 1. Get User ID
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'eusoueduoficial@gmail.com';
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User eusoueduoficial@gmail.com not found. Please register first.';
    RETURN;
  END IF;

  -- 2. Ensure User exists in Profiles
  INSERT INTO public.profiles (user_id, name, email)
  VALUES (v_user_id, 'Edu Master', 'eusoueduoficial@gmail.com')
  ON CONFLICT (user_id) DO UPDATE SET name = 'Edu Master';

  -- 3. Grant Global Admin Role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- 4. Create "Master" Plan (Unlimited/Lifetime) if it doesn't exist
  INSERT INTO public.plans (
    name, type, price, billing_cycle, daily_message_limit, is_public, is_active, display_order, description
  )
  VALUES (
    'Master', 'messages', 0, 'monthly', NULL, false, true, 999, 'Acesso Master Vitalício e Ilimitado'
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_plan_id;

  IF v_plan_id IS NULL THEN
    SELECT id INTO v_plan_id FROM public.plans WHERE name = 'Master' LIMIT 1;
  END IF;

  -- 5. Add user to default tenant as owner
  INSERT INTO public.tenant_users (tenant_id, user_id, role, is_primary)
  VALUES (v_tenant_id, v_user_id, 'tenant_owner', true)
  ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = 'tenant_owner';

  RAISE NOTICE 'Admin role and Master plan setup for Edu. Token must be generated via Admin UI to use Worker cryptographic system.';
END $$;
