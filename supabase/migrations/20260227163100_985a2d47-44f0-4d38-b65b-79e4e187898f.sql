
-- Add missing UPDATE policy on crm_contact_lists for tenant admins
CREATE POLICY "Tenant admins can update lists"
  ON public.crm_contact_lists
  FOR UPDATE
  TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));
