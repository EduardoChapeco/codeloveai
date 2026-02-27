-- Add source_fingerprint column for change detection
ALTER TABLE public.user_brain_projects 
ADD COLUMN IF NOT EXISTS source_fingerprint text;

-- Comment for documentation
COMMENT ON COLUMN public.user_brain_projects.source_fingerprint IS 'Hash of last seen source code, used to skip unchanged polls';