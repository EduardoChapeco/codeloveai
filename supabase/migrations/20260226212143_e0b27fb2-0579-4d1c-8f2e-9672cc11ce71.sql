-- Allow tenant owners and tenant admins to UPDATE their own tenant
CREATE POLICY "Tenant admins update own tenant"
ON public.tenants FOR UPDATE
TO authenticated
USING (is_tenant_admin(auth.uid(), id))
WITH CHECK (is_tenant_admin(auth.uid(), id));

-- Allow tenant admins to update licenses within their tenant (revoke etc)
CREATE POLICY "Tenant admins update own tenant licenses"
ON public.licenses FOR UPDATE
TO authenticated
USING (
  is_tenant_admin(auth.uid(), tenant_id)
)
WITH CHECK (
  is_tenant_admin(auth.uid(), tenant_id)
);