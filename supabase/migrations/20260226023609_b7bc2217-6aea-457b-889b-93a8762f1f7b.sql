-- Add extension_id to extension_files to link files to specific catalog extensions
ALTER TABLE public.extension_files 
ADD COLUMN extension_id uuid REFERENCES public.extension_catalog(id) ON DELETE SET NULL;

-- Create index for fast lookups
CREATE INDEX idx_extension_files_extension_id ON public.extension_files(extension_id);

-- Create unique constraint: only one "latest" per extension
-- (We'll enforce this in code, but the index helps queries)
CREATE INDEX idx_extension_files_latest ON public.extension_files(extension_id, is_latest) WHERE is_latest = true;