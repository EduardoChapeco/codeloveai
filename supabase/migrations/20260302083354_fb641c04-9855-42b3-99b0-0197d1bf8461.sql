
-- Fix dangerous permissive RLS policies on venus tables
-- These tables should only be accessed via service role (edge functions)
-- Drop the overly permissive policies and replace with user-scoped or service-role-only access

-- venus_brain_projects: no user_id column, accessed by edge functions only
DROP POLICY IF EXISTS "Service role full access on venus_brain_projects" ON public.venus_brain_projects;

-- venus_github_tokens: contains sensitive gh_token, edge function only
DROP POLICY IF EXISTS "Service role full access on venus_github_tokens" ON public.venus_github_tokens;

-- venus_licenses: has user_id (text), can scope SELECT to owner
DROP POLICY IF EXISTS "Service role full access on venus_licenses" ON public.venus_licenses;
CREATE POLICY "Users can view own venus licenses" ON public.venus_licenses
  FOR SELECT USING (auth.uid()::text = user_id);

-- venus_notes: uses license_key, edge function only
DROP POLICY IF EXISTS "Service role full access on venus_notes" ON public.venus_notes;

-- venus_orch_projects: uses license_key, edge function only
DROP POLICY IF EXISTS "Service role full access on venus_orch_projects" ON public.venus_orch_projects;
