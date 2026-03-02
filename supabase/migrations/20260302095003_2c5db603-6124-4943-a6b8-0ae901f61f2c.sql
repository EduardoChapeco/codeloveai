
-- Drop overly permissive policies and replace with auth-required ones
DROP POLICY "Authenticated users manage venus brain projects" ON public.venus_brain_projects;
DROP POLICY "Authenticated users manage venus github tokens" ON public.venus_github_tokens;
DROP POLICY "Authenticated users manage venus notes" ON public.venus_notes;
DROP POLICY "Authenticated users manage venus orch projects" ON public.venus_orch_projects;

-- Require authentication (auth.uid() IS NOT NULL) for all operations
CREATE POLICY "Auth users manage venus brain projects"
ON public.venus_brain_projects FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users manage venus github tokens"
ON public.venus_github_tokens FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users manage venus notes"
ON public.venus_notes FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users manage venus orch projects"
ON public.venus_orch_projects FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);
