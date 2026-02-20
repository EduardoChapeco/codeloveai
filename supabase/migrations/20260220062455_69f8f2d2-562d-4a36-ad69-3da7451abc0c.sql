-- Add rewarded flag to community_posts to track token-rewarded posts
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS rewarded boolean NOT NULL DEFAULT false;

-- Add is_archived flag for archiving instead of deleting
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;