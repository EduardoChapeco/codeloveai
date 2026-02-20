
-- Add prompt_text and copy_count to community_posts
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS prompt_text text DEFAULT '';
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS copy_count integer NOT NULL DEFAULT 0;

-- Create post_copies table for tracking copy events
CREATE TABLE public.post_copies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.post_copies ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins manage copies" ON public.post_copies FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can view copies" ON public.post_copies FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can record copies" ON public.post_copies FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Index for performance
CREATE INDEX idx_post_copies_post_id ON public.post_copies(post_id);
CREATE INDEX idx_post_copies_user_id ON public.post_copies(user_id);
