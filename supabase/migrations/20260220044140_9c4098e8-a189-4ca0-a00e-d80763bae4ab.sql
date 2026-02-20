
-- ============================================
-- COMMUNITY SYSTEM: Perfis, Projetos, Posts, Feed
-- ============================================

-- 1. USER PROFILES (extended)
CREATE TABLE public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  username text UNIQUE,
  display_name text NOT NULL DEFAULT '',
  bio text DEFAULT '',
  avatar_url text DEFAULT '',
  cover_url text DEFAULT '',
  website text DEFAULT '',
  social_github text DEFAULT '',
  social_twitter text DEFAULT '',
  social_linkedin text DEFAULT '',
  is_public boolean NOT NULL DEFAULT true,
  followers_count integer NOT NULL DEFAULT 0,
  following_count integer NOT NULL DEFAULT 0,
  posts_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view public profiles" ON public.user_profiles
  FOR SELECT USING (is_public = true);

CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all profiles" ON public.user_profiles
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. FOLLOWERS
CREATE TABLE public.user_followers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

ALTER TABLE public.user_followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view followers" ON public.user_followers
  FOR SELECT USING (true);

CREATE POLICY "Users can follow" ON public.user_followers
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow" ON public.user_followers
  FOR DELETE USING (auth.uid() = follower_id);

CREATE POLICY "Admins manage followers" ON public.user_followers
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. HASHTAGS
CREATE TABLE public.hashtags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  posts_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hashtags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view hashtags" ON public.hashtags
  FOR SELECT USING (true);

CREATE POLICY "Authenticated can create hashtags" ON public.hashtags
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins manage hashtags" ON public.hashtags
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. POSTS (projects, questions, tips, showcase)
CREATE TABLE public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  post_type text NOT NULL DEFAULT 'post' CHECK (post_type IN ('post', 'project', 'question', 'tip', 'showcase')),
  title text DEFAULT '',
  content text NOT NULL DEFAULT '',
  media_urls text[] DEFAULT '{}',
  link_url text DEFAULT '',
  link_preview_title text DEFAULT '',
  link_preview_description text DEFAULT '',
  link_preview_image text DEFAULT '',
  project_name text DEFAULT '',
  project_url text DEFAULT '',
  project_preview_image text DEFAULT '',
  likes_count integer NOT NULL DEFAULT 0,
  comments_count integer NOT NULL DEFAULT 0,
  is_pinned boolean NOT NULL DEFAULT false,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view posts" ON public.community_posts
  FOR SELECT USING (is_deleted = false);

CREATE POLICY "Users can create posts" ON public.community_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts" ON public.community_posts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts" ON public.community_posts
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins manage posts" ON public.community_posts
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. POST HASHTAGS (junction)
CREATE TABLE public.post_hashtags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  hashtag_id uuid NOT NULL REFERENCES public.hashtags(id) ON DELETE CASCADE,
  UNIQUE(post_id, hashtag_id)
);

ALTER TABLE public.post_hashtags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view post hashtags" ON public.post_hashtags
  FOR SELECT USING (true);

CREATE POLICY "Post owners can manage hashtags" ON public.post_hashtags
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.community_posts WHERE id = post_id AND user_id = auth.uid())
  );

CREATE POLICY "Post owners can delete hashtags" ON public.post_hashtags
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.community_posts WHERE id = post_id AND user_id = auth.uid())
  );

CREATE POLICY "Admins manage post hashtags" ON public.post_hashtags
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 6. LIKES
CREATE TABLE public.post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view likes" ON public.post_likes
  FOR SELECT USING (true);

CREATE POLICY "Users can like" ON public.post_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike" ON public.post_likes
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins manage likes" ON public.post_likes
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 7. COMMENTS
CREATE TABLE public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.post_comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  likes_count integer NOT NULL DEFAULT 0,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view comments" ON public.post_comments
  FOR SELECT USING (is_deleted = false);

CREATE POLICY "Users can create comments" ON public.post_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments" ON public.post_comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON public.post_comments
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins manage comments" ON public.post_comments
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- INDEXES for performance
CREATE INDEX idx_community_posts_user ON public.community_posts(user_id);
CREATE INDEX idx_community_posts_type ON public.community_posts(post_type);
CREATE INDEX idx_community_posts_created ON public.community_posts(created_at DESC);
CREATE INDEX idx_post_likes_post ON public.post_likes(post_id);
CREATE INDEX idx_post_likes_user ON public.post_likes(user_id);
CREATE INDEX idx_post_comments_post ON public.post_comments(post_id);
CREATE INDEX idx_user_followers_following ON public.user_followers(following_id);
CREATE INDEX idx_user_followers_follower ON public.user_followers(follower_id);
CREATE INDEX idx_post_hashtags_hashtag ON public.post_hashtags(hashtag_id);
CREATE INDEX idx_hashtags_slug ON public.hashtags(slug);

-- TRIGGERS for updated_at
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_community_posts_updated_at
  BEFORE UPDATE ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_post_comments_updated_at
  BEFORE UPDATE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- STORAGE: community media uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('community', 'community', true);

CREATE POLICY "Anyone can view community files" ON storage.objects
  FOR SELECT USING (bucket_id = 'community');

CREATE POLICY "Authenticated can upload community files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'community' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own community files" ON storage.objects
  FOR UPDATE USING (bucket_id = 'community' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own community files" ON storage.objects
  FOR DELETE USING (bucket_id = 'community' AND auth.uid()::text = (storage.foldername(name))[1]);
