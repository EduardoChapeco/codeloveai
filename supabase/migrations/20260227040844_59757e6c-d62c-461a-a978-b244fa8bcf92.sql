
-- Community Groups (Facebook-style with cover, description, rules)
CREATE TABLE public.community_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT DEFAULT '',
  rules TEXT DEFAULT '',
  cover_url TEXT,
  icon_url TEXT,
  is_private BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  members_count INTEGER NOT NULL DEFAULT 1,
  posts_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, slug)
);

-- Group Members (created BEFORE group RLS policies that reference it)
CREATE TABLE public.community_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.community_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Now enable RLS and create policies
ALTER TABLE public.community_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view public groups"
  ON public.community_groups FOR SELECT
  USING (NOT is_private OR created_by = auth.uid() OR EXISTS (
    SELECT 1 FROM public.community_group_members WHERE group_id = id AND user_id = auth.uid()
  ));

CREATE POLICY "Authenticated users can create groups"
  ON public.community_groups FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creator or admin can update group"
  ON public.community_groups FOR UPDATE
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Creator or admin can delete group"
  ON public.community_groups FOR DELETE
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Anyone can view group members"
  ON public.community_group_members FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can join groups"
  ON public.community_group_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can leave or admin can remove"
  ON public.community_group_members FOR DELETE
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.community_groups WHERE id = group_id AND created_by = auth.uid()) OR
    public.is_admin(auth.uid())
  );

-- Add group_id to community_posts
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.community_groups(id);
CREATE INDEX IF NOT EXISTS idx_community_posts_group_id ON public.community_posts(group_id);

-- Triggers
CREATE TRIGGER update_community_groups_updated_at
  BEFORE UPDATE ON public.community_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.validate_group_member_role()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.role NOT IN ('member', 'moderator', 'admin') THEN
    RAISE EXCEPTION 'Invalid group member role: %', NEW.role;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_group_member_role_trigger
  BEFORE INSERT OR UPDATE ON public.community_group_members
  FOR EACH ROW EXECUTE FUNCTION public.validate_group_member_role();
