
-- Allow public read of affiliate display_name and affiliate_code for magic links
CREATE POLICY "Public can view affiliate codes"
  ON public.affiliates FOR SELECT
  USING (true);

-- Drop the old restrictive owner-only policy since public read is needed
DROP POLICY IF EXISTS "Affiliates can view own record" ON public.affiliates;

-- Add instructions column to extension_files for step-by-step text
ALTER TABLE public.extension_files ADD COLUMN IF NOT EXISTS instructions text NOT NULL DEFAULT '';

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
