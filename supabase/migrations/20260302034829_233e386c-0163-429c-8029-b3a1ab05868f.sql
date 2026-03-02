
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _role app_role;
  _default_tenant_id UUID;
  _admin_id UUID;
BEGIN
  -- First user ever becomes admin, all others become member
  IF NOT EXISTS (SELECT 1 FROM public.user_roles LIMIT 1) THEN
    _role := 'admin';
  ELSE
    _role := 'member';
  END IF;

  INSERT INTO public.profiles (user_id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''), NEW.email);
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role);

  -- Assign user to default tenant (codelove)
  _default_tenant_id := 'a0000000-0000-0000-0000-000000000001';
  INSERT INTO public.tenant_users (tenant_id, user_id, role, is_primary)
  VALUES (_default_tenant_id, NEW.id, 'tenant_member', true)
  ON CONFLICT (tenant_id, user_id) DO NOTHING;

  -- Set tenant_id on profile
  UPDATE public.profiles SET tenant_id = _default_tenant_id WHERE user_id = NEW.id AND tenant_id IS NULL;

  -- Notify all admins about the new user signup
  FOR _admin_id IN
    SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin'
  LOOP
    INSERT INTO public.admin_notifications (user_id, tenant_id, type, title, description, reference_id)
    VALUES (
      _admin_id,
      _default_tenant_id,
      'new_user',
      'Novo usuário cadastrado',
      'O usuário ' || COALESCE(NEW.raw_user_meta_data->>'name', NEW.email) || ' (' || COALESCE(NEW.email, '') || ') acabou de se cadastrar.',
      NEW.id
    );
  END LOOP;

  RETURN NEW;
END;
$function$;
