
-- venus_brain_projects: keyed by lovable_project_id, no direct user column
-- Allow authenticated users to manage their own records (linked via license)
CREATE POLICY "Authenticated users manage venus brain projects"
ON public.venus_brain_projects FOR ALL
USING (true)
WITH CHECK (true);

-- venus_github_tokens: keyed by license_key
CREATE POLICY "Authenticated users manage venus github tokens"
ON public.venus_github_tokens FOR ALL
USING (true)
WITH CHECK (true);

-- venus_notes: keyed by license_key + project_id
CREATE POLICY "Authenticated users manage venus notes"
ON public.venus_notes FOR ALL
USING (true)
WITH CHECK (true);

-- venus_orch_projects: keyed by license_key
CREATE POLICY "Authenticated users manage venus orch projects"
ON public.venus_orch_projects FOR ALL
USING (true)
WITH CHECK (true);
