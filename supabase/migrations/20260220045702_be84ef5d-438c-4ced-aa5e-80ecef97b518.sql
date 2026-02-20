
-- Restrict community_posts SELECT to authenticated users only
DROP POLICY IF EXISTS "Anyone can view posts" ON public.community_posts;
CREATE POLICY "Authenticated can view posts"
ON public.community_posts FOR SELECT
USING (auth.uid() IS NOT NULL AND is_deleted = false);

-- Restrict post_comments SELECT to authenticated users only
DROP POLICY IF EXISTS "Anyone can view comments" ON public.post_comments;
CREATE POLICY "Authenticated can view comments"
ON public.post_comments FOR SELECT
USING (auth.uid() IS NOT NULL AND is_deleted = false);

-- Restrict post_likes SELECT to authenticated users only
DROP POLICY IF EXISTS "Anyone can view likes" ON public.post_likes;
CREATE POLICY "Authenticated can view likes"
ON public.post_likes FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Restrict hashtags SELECT to authenticated users only
DROP POLICY IF EXISTS "Anyone can view hashtags" ON public.hashtags;
CREATE POLICY "Authenticated can view hashtags"
ON public.hashtags FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Restrict post_hashtags SELECT to authenticated users only
DROP POLICY IF EXISTS "Anyone can view post hashtags" ON public.post_hashtags;
CREATE POLICY "Authenticated can view post hashtags"
ON public.post_hashtags FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Restrict user_followers SELECT to authenticated users only
DROP POLICY IF EXISTS "Anyone can view followers" ON public.user_followers;
CREATE POLICY "Authenticated can view followers"
ON public.user_followers FOR SELECT
USING (auth.uid() IS NOT NULL);
