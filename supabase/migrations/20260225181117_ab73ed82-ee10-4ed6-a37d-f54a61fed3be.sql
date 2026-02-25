-- CRITICAL: Remove dangerous RLS policies that let users create/modify their own licenses
DROP POLICY IF EXISTS "Users insert own licenses" ON public.licenses;
DROP POLICY IF EXISTS "Users update own licenses" ON public.licenses;

-- Users should only READ their own licenses, never create or modify them
-- (Only admins and service_role can create/update licenses)
