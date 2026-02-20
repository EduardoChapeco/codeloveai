import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppNav from "@/components/AppNav";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Users, Heart, MessageCircle, Share2, Edit, Camera,
  Globe, Github, Twitter, Linkedin, LogOut, Loader2,
  Folder, Eye, Hash
} from "lucide-react";

interface UserProfile {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  cover_url: string;
  website: string;
  social_github: string;
  social_twitter: string;
  social_linkedin: string;
  followers_count: number;
  following_count: number;
  posts_count: number;
}

interface Post {
  id: string;
  post_type: string;
  title: string;
  content: string;
  media_urls: string[];
  project_url: string;
  project_name: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
}

export default function Profile() {
  const { userId } = useParams<{ userId: string }>();
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [editing, setEditing] = useState(false);

  // Edit form
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [editGithub, setEditGithub] = useState("");
  const [editTwitter, setEditTwitter] = useState("");
  const [editLinkedin, setEditLinkedin] = useState("");

  useEffect(() => {
    if (!userId) return;

    const fetchProfile = async () => {
      setLoading(true);

      let { data } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      // Auto-create profile if owner and none exists
      if (!data && user && user.id === userId) {
        const { data: created } = await supabase.from("user_profiles").insert({
          user_id: user.id,
          display_name: user.user_metadata?.name || user.email?.split("@")[0] || "Usuário",
          username: user.email?.split("@")[0]?.replace(/[^a-z0-9_]/g, "") || `user_${Date.now()}`,
        }).select("*").single();
        data = created;
      }

      setProfile(data as UserProfile | null);
      setIsOwner(user?.id === userId);

      if (data) {
        setEditName(data.display_name || "");
        setEditBio(data.bio || "");
        setEditUsername(data.username || "");
        setEditWebsite(data.website || "");
        setEditGithub(data.social_github || "");
        setEditTwitter(data.social_twitter || "");
        setEditLinkedin(data.social_linkedin || "");
      }

      // Fetch posts
      const { data: postsData } = await supabase
        .from("community_posts")
        .select("*")
        .eq("user_id", userId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(30);
      setPosts((postsData || []) as Post[]);

      // Check following
      if (user && user.id !== userId) {
        const { data: follow } = await supabase
          .from("user_followers")
          .select("id")
          .eq("follower_id", user.id)
          .eq("following_id", userId)
          .maybeSingle();
        setIsFollowing(!!follow);
      }

      setLoading(false);
    };

    fetchProfile();
  }, [userId, user]);

  const handleFollow = async () => {
    if (!user || !userId) return toast.error("Faça login para seguir.");
    if (isFollowing) {
      await supabase.from("user_followers").delete().eq("follower_id", user.id).eq("following_id", userId);
      setIsFollowing(false);
      if (profile) setProfile({ ...profile, followers_count: Math.max(0, profile.followers_count - 1) });
    } else {
      await supabase.from("user_followers").insert({ follower_id: user.id, following_id: userId });
      setIsFollowing(true);
      if (profile) setProfile({ ...profile, followers_count: profile.followers_count + 1 });
    }
  };

  const handleSaveProfile = async () => {
    if (!user || !profile) return;
    const { error } = await supabase.from("user_profiles").update({
      display_name: editName.trim(),
      bio: editBio.trim(),
      username: editUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, ""),
      website: editWebsite.trim(),
      social_github: editGithub.trim(),
      social_twitter: editTwitter.trim(),
      social_linkedin: editLinkedin.trim(),
    }).eq("user_id", user.id);

    if (error) return toast.error(error.message);
    toast.success("Perfil atualizado!");
    setEditing(false);
    setProfile({
      ...profile,
      display_name: editName.trim(),
      bio: editBio.trim(),
      username: editUsername.trim(),
      website: editWebsite.trim(),
      social_github: editGithub.trim(),
      social_twitter: editTwitter.trim(),
      social_linkedin: editLinkedin.trim(),
    });
  };

  const handleUpload = async (type: "avatar" | "cover", file: File) => {
    if (!user) return;
    const path = `${user.id}/${type}_${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("community").upload(path, file);
    if (error) return toast.error("Erro no upload.");
    const { data: urlData } = supabase.storage.from("community").getPublicUrl(path);
    const field = type === "avatar" ? "avatar_url" : "cover_url";
    await supabase.from("user_profiles").update({ [field]: urlData.publicUrl }).eq("user_id", user.id);
    if (profile) setProfile({ ...profile, [field]: urlData.publicUrl });
    toast.success(`${type === "avatar" ? "Foto" : "Capa"} atualizada!`);
  };

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>;
  }

  if (!profile) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <p className="ep-section-title mb-4">PERFIL NÃO ENCONTRADO</p>
        <Link to="/community" className="ep-btn-primary">VOLTAR</Link>
      </div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {user ? (
        <AppNav />
      ) : (
        <nav className="sticky top-0 z-20 bg-background border-b border-border px-8 py-4 flex items-center justify-between">
          <Link to="/" className="ep-label text-sm tracking-[0.3em]">CODELOVE AI</Link>
          <Link to="/login" className="ep-btn-primary h-10 px-6 text-[9px]">ENTRAR</Link>
        </nav>
      )}

      {/* Cover */}
      <div className="relative h-48 md:h-64 bg-muted overflow-hidden">
        {profile.cover_url ? (
          <img src={profile.cover_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-muted to-muted-foreground/10" />
        )}
        {isOwner && (
          <label className="absolute bottom-4 right-4 ep-btn-secondary h-8 px-3 text-[8px] flex items-center gap-1 cursor-pointer bg-background/80 backdrop-blur">
            <Camera className="h-3 w-3" /> CAPA
            <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleUpload("cover", e.target.files[0])} />
          </label>
        )}
      </div>

      {/* Profile header */}
      <div className="max-w-4xl mx-auto px-8 -mt-16 relative z-10">
        <div className="flex items-end gap-6 mb-6">
          <div className="relative">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-28 w-28 rounded-full object-cover border-4 border-background" />
            ) : (
              <div className="h-28 w-28 rounded-full bg-muted border-4 border-background flex items-center justify-center text-3xl font-bold text-muted-foreground">
                {(profile.display_name || "U")[0].toUpperCase()}
              </div>
            )}
            {isOwner && (
              <label className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-foreground text-background flex items-center justify-center cursor-pointer">
                <Camera className="h-3.5 w-3.5" />
                <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleUpload("avatar", e.target.files[0])} />
              </label>
            )}
          </div>
          <div className="flex-1 pb-2">
            <h1 className="ep-section-title text-2xl">{profile.display_name}</h1>
            {profile.username && <p className="text-sm text-muted-foreground font-medium">@{profile.username}</p>}
          </div>
          <div className="pb-2 flex gap-2">
            {isOwner ? (
              <button onClick={() => setEditing(!editing)} className="ep-btn-secondary h-10 px-4 text-[9px] flex items-center gap-1">
                <Edit className="h-3 w-3" /> EDITAR
              </button>
            ) : (
              <button onClick={handleFollow}
                className={`h-10 px-6 text-[9px] ${isFollowing ? "ep-btn-secondary" : "ep-btn-primary"}`}>
                {isFollowing ? "SEGUINDO" : "SEGUIR"}
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-6 mb-6">
          <div className="text-center">
            <p className="ep-value text-lg">{profile.posts_count}</p>
            <p className="text-[10px] text-muted-foreground font-bold">POSTS</p>
          </div>
          <div className="text-center">
            <p className="ep-value text-lg">{profile.followers_count}</p>
            <p className="text-[10px] text-muted-foreground font-bold">SEGUIDORES</p>
          </div>
          <div className="text-center">
            <p className="ep-value text-lg">{profile.following_count}</p>
            <p className="text-[10px] text-muted-foreground font-bold">SEGUINDO</p>
          </div>
        </div>

        {/* Bio & socials */}
        {profile.bio && <p className="text-sm text-muted-foreground font-medium mb-4">{profile.bio}</p>}
        <div className="flex gap-4 mb-8 flex-wrap">
          {profile.website && (
            <a href={profile.website} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <Globe className="h-3 w-3" /> {profile.website.replace(/^https?:\/\//, "")}
            </a>
          )}
          {profile.social_github && (
            <a href={`https://github.com/${profile.social_github}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <Github className="h-3 w-3" /> {profile.social_github}
            </a>
          )}
          {profile.social_twitter && (
            <a href={`https://twitter.com/${profile.social_twitter}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <Twitter className="h-3 w-3" /> {profile.social_twitter}
            </a>
          )}
          {profile.social_linkedin && (
            <a href={`https://linkedin.com/in/${profile.social_linkedin}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <Linkedin className="h-3 w-3" /> {profile.social_linkedin}
            </a>
          )}
        </div>

        {/* Edit form */}
        {editing && isOwner && (
          <div className="ep-card mb-8 space-y-4">
            <p className="ep-subtitle mb-2">EDITAR PERFIL</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">NOME</label>
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  className="w-full bg-muted border border-border rounded-[10px] px-3 py-2 text-sm text-foreground" />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">USERNAME</label>
                <input value={editUsername} onChange={e => setEditUsername(e.target.value)}
                  className="w-full bg-muted border border-border rounded-[10px] px-3 py-2 text-sm text-foreground" />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">BIO</label>
              <textarea value={editBio} onChange={e => setEditBio(e.target.value)} rows={3}
                className="w-full bg-muted border border-border rounded-[10px] px-3 py-2 text-sm text-foreground resize-none" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">WEBSITE</label>
                <input value={editWebsite} onChange={e => setEditWebsite(e.target.value)}
                  className="w-full bg-muted border border-border rounded-[10px] px-3 py-2 text-sm text-foreground" />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">GITHUB</label>
                <input value={editGithub} onChange={e => setEditGithub(e.target.value)}
                  className="w-full bg-muted border border-border rounded-[10px] px-3 py-2 text-sm text-foreground" />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">TWITTER</label>
                <input value={editTwitter} onChange={e => setEditTwitter(e.target.value)}
                  className="w-full bg-muted border border-border rounded-[10px] px-3 py-2 text-sm text-foreground" />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">LINKEDIN</label>
                <input value={editLinkedin} onChange={e => setEditLinkedin(e.target.value)}
                  className="w-full bg-muted border border-border rounded-[10px] px-3 py-2 text-sm text-foreground" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSaveProfile} className="ep-btn-primary h-10 px-6 text-[9px]">SALVAR</button>
              <button onClick={() => setEditing(false)} className="ep-btn-secondary h-10 px-6 text-[9px]">CANCELAR</button>
            </div>
          </div>
        )}

        {/* User's posts */}
        <div className="space-y-4 pb-16">
          <p className="ep-subtitle">PUBLICAÇÕES ({posts.length})</p>
          {posts.length === 0 ? (
            <p className="text-sm text-muted-foreground font-medium">Nenhuma publicação ainda.</p>
          ) : posts.map(post => (
            <div key={post.id} className="ep-card">
              <div className="flex items-center gap-2 mb-2">
                <span className="ep-badge text-[7px]">{post.post_type.toUpperCase()}</span>
                <span className="text-[10px] text-muted-foreground">
                  {format(new Date(post.created_at), "dd MMM yyyy", { locale: ptBR })}
                </span>
              </div>
              {post.title && <h3 className="text-sm font-bold text-foreground mb-1">{post.title}</h3>}
              <p className="text-sm text-muted-foreground font-medium whitespace-pre-wrap mb-3">{post.content}</p>

              {post.media_urls && post.media_urls.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {post.media_urls.map((url, i) => (
                    <img key={i} src={url} alt="" className="rounded-[8px] w-full max-h-48 object-cover" />
                  ))}
                </div>
              )}

              <div className="flex items-center gap-4 text-xs text-muted-foreground font-bold">
                <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> {post.likes_count}</span>
                <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> {post.comments_count}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
