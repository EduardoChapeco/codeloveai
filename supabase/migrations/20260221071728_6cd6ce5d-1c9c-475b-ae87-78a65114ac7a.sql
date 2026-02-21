
-- Fix: Allow unauthenticated users to view active WL plans (needed for public ref page)
DROP POLICY IF EXISTS "Authenticated can view active WL plans" ON public.white_label_plans;
CREATE POLICY "Anyone can view active WL plans"
ON public.white_label_plans FOR SELECT
USING (is_active = true);
