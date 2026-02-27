
-- Tighten INSERT policy to only allow service-role or matching user_id
DROP POLICY "Service can insert brain outputs" ON public.brain_outputs;
CREATE POLICY "Insert own brain outputs"
  ON public.brain_outputs FOR INSERT
  WITH CHECK (auth.uid() = user_id);
