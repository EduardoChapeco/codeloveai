
-- Add views_count to community_posts
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS views_count integer NOT NULL DEFAULT 0;

-- Create post_views table for tracking unique views
CREATE TABLE public.post_views (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique constraint: one view per user per post
ALTER TABLE public.post_views ADD CONSTRAINT post_views_unique UNIQUE (post_id, user_id);

-- Enable RLS
ALTER TABLE public.post_views ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own views
CREATE POLICY "Users can record views" ON public.post_views
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Authenticated users can view post_views
CREATE POLICY "Authenticated can view post views" ON public.post_views
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Admins manage all
CREATE POLICY "Admins manage post views" ON public.post_views
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for performance
CREATE INDEX idx_post_views_post_id ON public.post_views(post_id);
CREATE INDEX idx_post_views_user_id ON public.post_views(user_id);
