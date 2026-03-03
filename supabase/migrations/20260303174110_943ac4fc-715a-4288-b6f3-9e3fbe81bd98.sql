
-- Fix: venus_client_accounts has RLS enabled but no policies (fully locked)
-- This table contains sensitive tokens - only service_role should access it
CREATE POLICY "Service role full access venus_client_accounts"
ON public.venus_client_accounts
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Also add admin access
CREATE POLICY "Admins manage venus_client_accounts"
ON public.venus_client_accounts
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));
