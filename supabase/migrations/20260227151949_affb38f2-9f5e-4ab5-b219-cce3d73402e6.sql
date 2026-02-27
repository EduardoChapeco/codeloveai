
-- Add demo credentials (email/password pairs) and media uploads support
ALTER TABLE public.marketplace_listings 
ADD COLUMN IF NOT EXISTS demo_credentials JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS media_urls TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS video_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS highlights TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS setup_instructions TEXT DEFAULT NULL;

-- Create storage bucket for marketplace media (images/videos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('marketplace-media', 'marketplace-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for marketplace-media
CREATE POLICY "Anyone can view marketplace media"
ON storage.objects FOR SELECT
USING (bucket_id = 'marketplace-media');

CREATE POLICY "Authenticated users can upload marketplace media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'marketplace-media' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own marketplace media"
ON storage.objects FOR UPDATE
USING (bucket_id = 'marketplace-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own marketplace media"
ON storage.objects FOR DELETE
USING (bucket_id = 'marketplace-media' AND auth.uid()::text = (storage.foldername(name))[1]);
