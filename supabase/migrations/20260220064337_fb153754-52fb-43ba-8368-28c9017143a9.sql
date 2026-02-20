-- Add blur support to community posts
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS is_blurred boolean NOT NULL DEFAULT false;