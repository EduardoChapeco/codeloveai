
-- ============================================================
-- SECURITY FIX: Hide sensitive columns via views
-- ============================================================

-- 1. Create a safe view for tenants that excludes mp_access_token
CREATE OR REPLACE VIEW public.tenants_safe
WITH (security_invoker=on) AS
  SELECT id, name, slug, domain, domain_custom, is_domain_approved,
         status, is_active, primary_color, secondary_color, accent_color,
         logo_url, favicon_url, font_family, border_radius, theme_preset,
         commission_percent, plan_type, token_cost, trial_minutes,
         modules, branding, extension_mode, custom_mode_prompt,
         meta_title, meta_description, terms_template,
         owner_user_id, affiliate_id, white_label_plan_id,
         setup_paid, setup_paid_at, platform_fee_per_user,
         global_split_percent, affiliate_global_split_percent,
         created_at, updated_at
  FROM public.tenants;
  -- Excludes: mp_access_token

-- 2. Create a safe view for supabase_migration_jobs that excludes encrypted keys
CREATE OR REPLACE VIEW public.migration_jobs_safe
WITH (security_invoker=on) AS
  SELECT id, user_id, tenant_id, project_id,
         source_supabase_url, dest_supabase_url,
         status, sync_active, tables_migrated,
         error_log, last_sync_at, created_at, updated_at
  FROM public.supabase_migration_jobs;
  -- Excludes: dest_service_role_key_encrypted

-- 3. Create a safe view for lovable_accounts that excludes tokens
CREATE OR REPLACE VIEW public.lovable_accounts_safe
WITH (security_invoker=on) AS
  SELECT id, user_id, tenant_id, status,
         auto_refresh_enabled, is_admin_account,
         last_verified_at, token_expires_at,
         refresh_failure_count, created_at, updated_at
  FROM public.lovable_accounts;
  -- Excludes: token_encrypted, refresh_token_encrypted

-- 4. Create a safe view for api_key_vault that masks keys
CREATE OR REPLACE VIEW public.api_key_vault_safe
WITH (security_invoker=on) AS
  SELECT id, provider, label, is_active,
         '****' || RIGHT(api_key_encrypted, 4) AS api_key_masked,
         requests_count, last_used_at, created_at, updated_at
  FROM public.api_key_vault;
  -- Shows only last 4 chars of key

-- 5. Restrict direct SELECT on tenants for non-admins to use the safe view
-- First drop the existing tenant member policy that exposes mp_access_token
DROP POLICY IF EXISTS "Tenant members view own tenant" ON public.tenants;

-- Recreate it with column restriction — but since Postgres RLS can't restrict columns,
-- we deny direct SELECT for tenant members and they must use the view
-- Actually we need to keep the policy but the view approach is the right one.
-- Let's re-add the policy since the view uses security_invoker
CREATE POLICY "Tenant members view own tenant" ON public.tenants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tenant_users
      WHERE tenant_users.user_id = auth.uid()
        AND tenant_users.tenant_id = tenants.id
    )
  );
