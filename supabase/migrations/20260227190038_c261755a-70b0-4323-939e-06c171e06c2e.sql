
-- Fix views to use SECURITY INVOKER so they respect RLS on underlying tables
-- This prevents unauthenticated/unauthorized users from bypassing RLS via views

-- 1. tenants_safe
CREATE OR REPLACE VIEW public.tenants_safe
WITH (security_invoker = true)
AS
SELECT id, name, slug, domain, domain_custom, is_domain_approved, status, is_active,
  primary_color, secondary_color, accent_color, logo_url, favicon_url, font_family,
  border_radius, theme_preset, commission_percent, plan_type, token_cost, trial_minutes,
  modules, branding, extension_mode, custom_mode_prompt, meta_title, meta_description,
  terms_template, owner_user_id, affiliate_id, white_label_plan_id, setup_paid, setup_paid_at,
  platform_fee_per_user, global_split_percent, affiliate_global_split_percent, created_at, updated_at
FROM public.tenants;

-- 2. lovable_accounts_safe
CREATE OR REPLACE VIEW public.lovable_accounts_safe
WITH (security_invoker = true)
AS
SELECT id, user_id, tenant_id, status, auto_refresh_enabled, is_admin_account,
  last_verified_at, token_expires_at, refresh_failure_count, created_at, updated_at
FROM public.lovable_accounts;

-- 3. api_key_vault_safe
CREATE OR REPLACE VIEW public.api_key_vault_safe
WITH (security_invoker = true)
AS
SELECT id, provider, label, is_active,
  '****' || right(api_key_encrypted, 4) AS api_key_masked,
  requests_count, last_used_at, created_at, updated_at
FROM public.api_key_vault;

-- 4. migration_jobs_safe
CREATE OR REPLACE VIEW public.migration_jobs_safe
WITH (security_invoker = true)
AS
SELECT id, user_id, tenant_id, project_id, source_supabase_url, dest_supabase_url,
  status, sync_active, tables_migrated, error_log, last_sync_at, created_at, updated_at
FROM public.supabase_migration_jobs;

-- 5. user_activity_summary
CREATE OR REPLACE VIEW public.user_activity_summary
WITH (security_invoker = true)
AS
SELECT user_id,
  count(*) AS total_calls,
  count(*) FILTER (WHERE created_at > now() - interval '24 hours') AS calls_today,
  count(*) FILTER (WHERE created_at > now() - interval '7 days') AS calls_week,
  count(DISTINCT date(created_at)) AS active_days,
  max(created_at) AS last_seen,
  min(created_at) AS first_seen
FROM public.extension_usage_logs
GROUP BY user_id;
