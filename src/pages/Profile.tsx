import { useEffect, useState, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";
import AppLayout from "@/components/AppLayout";
import MeshBackground from "@/components/MeshBackground";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Users, Heart, MessageCircle, Share2, Edit, Camera,
  Globe, Github, Twitter, Linkedin, LogOut, Loader2,
  Folder, Eye, Hash, Send, X, MessageSquare
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

interface FollowUser {
  user_id: string;
  display_name: string;
  username: string;
  avatar_url: string;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

export default function Profile() {
  const { userId } = useParams<{ userId: string }>();
  const { user, loading: authLoading, signOut } = useAuth();
  const { tenant } = useTenant();
  const brandName = tenant?.name || "OrbIOS";
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

  // Followers/Following modal
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [followersList, setFollowersList] = useState<FollowUser[]>([]);
  const [followingList, setFollowingList] = useState<FollowUser[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // Chat
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userId) return;

    const fetchProfile = async () => {
      setLoading(true);

      let { data } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

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

      const { data: postsData } = await supabase
        .from("community_posts")
        .select("*")
        .eq("user_id", userId)
        .eq("is_deleted", false)
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(30);
      setPosts((postsData || []) as Post[]);

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
      if (profile) {
        const newCount = Math.max(0, profile.followers_count - 1);
        await supabase.from("user_profiles").update({ followers_count: newCount }).eq("user_id", userId);
        await supabase.from("user_profiles").update({ following_count: Math.max(0, (await supabase.from("user_profiles").select("following_count").eq("user_id", user.id).single()).data?.following_count || 1) - 1 }).eq("user_id", user.id);
        setProfile({ ...profile, followers_count: newCount });
      }
      setIsFollowing(false);
    } else {
      await supabase.from("user_followers").insert({ follower_id: user.id, following_id: userId });
      if (profile) {
        const newCount = profile.followers_count + 1;
        await supabase.from("user_profiles").update({ followers_count: newCount }).eq("user_id", userId);
        const { data: myProfile } = await supabase.from("user_profiles").select("following_count").eq("user_id", user.id).single();
        await supabase.from("user_profiles").update({ following_count: (myProfile?.following_count || 0) + 1 }).eq("user_id", user.id);
        setProfile({ ...profile, followers_count: newCount });
      }
      setIsFollowing(true);
    }
  };

  const loadFollowers = async () => {
    if (!userId) return;
    setShowFollowers(true);
    setShowFollowing(false);
    setLoadingList(true);
    const { data: follows } = await supabase.from("user_followers").select("follower_id").eq("following_id", userId);
    if (follows && follows.length > 0) {
      const ids = follows.map(f => f.follower_id);
      const { data: profiles } = await supabase.from("user_profiles").select("user_id, display_name, username, avatar_url").in("user_id", ids);
      setFollowersList(profiles || []);
    } else {
      setFollowersList([]);
    }
    setLoadingList(false);
  };

  const loadFollowing = async () => {
    if (!userId) return;
    setShowFollowing(true);
    setShowFollowers(false);
    setLoadingList(true);
    const { data: follows } = await supabase.from("user_followers").select("following_id").eq("follower_id", userId);
    if (follows && follows.length > 0) {
      const ids = follows.map(f => f.following_id);
      const { data: profiles } = await supabase.from("user_profiles").select("user_id, display_name, username, avatar_url").in("user_id", ids);
      setFollowingList(profiles || []);
    } else {
      setFollowingList([]);
    }
    setLoadingList(false);
  };

  const fetchChatMessages = async () => {
    if (!user || !userId) return;
    const { data } = await supabase.from("messages").select("*")
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
      .order("created_at", { ascending: true });
    setChatMessages(data || []);
    await supabase.from("messages").update({ is_read: true }).eq("receiver_id", user.id).eq("sender_id", userId).eq("is_read", false);
  };

  const sendChatMessage = async () => {
    if (!user || !userId || !newMessage.trim()) return;
    setSendingMessage(true);
    await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: userId,
      content: newMessage.trim(),
    });
    setNewMessage("");
    setSendingMessage(false);
    fetchChatMessages();
  };

  useEffect(() => {
    if (chatOpen && user && userId) {
      fetchChatMessages();
      const channel = supabase.channel(`dm-${userId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
          const msg = payload.new as ChatMessage;
          if ((msg.sender_id === user.id && msg.receiver_id === userId) || (msg.sender_id === userId && msg.receiver_id === user.id)) {
            setChatMessages(prev => [...prev, msg]);
            if (msg.receiver_id === user.id) {
              supabase.from("messages").update({ is_read: true }).eq("id", msg.id).then(() => {});
            }
          }
        }).subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [chatOpen, user, userId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

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
    return <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-0)" }}>
      <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--text-tertiary)" }} />
    </div>;
  }

  if (!profile) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-0)" }}>
      <div className="text-center">
        <p className="text-lg font-bold mb-4" style={{ color: "var(--text-primary)" }}>Perfil não encontrado</p>
        <Link to="/community" className="gl primary">Voltar</Link>
      </div>
    </div>;
  }

  const followListData = showFollowers ? followersList : followingList;
  const followListTitle = showFollowers ? "Seguidores" : "Seguindo";
  const showListModal = showFollowers || showFollowing;

  const guestNav = !user ? (
    <nav className="sticky top-0 z-20 px-6 py-3">
      <div className="rd-card flex items-center justify-between" style={{ padding: "10px 20px" }}>
        <Link to="/" className="text-base font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>{brandName}</Link>
        <Link to="/login" className="gl sm primary">Entrar</Link>
      </div>
    </nav>
  ) : null;

  const content = (
    <div className="min-h-screen">
      {guestNav}

      {/* Cover */}
      <div className="relative h-48 md:h-64 overflow-hidden rounded-b-[24px]">
        {profile.cover_url ? (
          <img src={profile.cover_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 via-primary/10 to-accent/10" />
        )}
        {isOwner && (
          <label className="absolute bottom-4 right-4 gl sm ghost cursor-pointer flex items-center gap-1">
            <Camera className="h-3 w-3" /> Capa
            <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleUpload("cover", e.target.files[0])} />
          </label>
        )}
      </div>

      {/* Profile header */}
      <div className="max-w-4xl mx-auto px-6 -mt-16 relative z-10">
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
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{profile.display_name}</h1>
            {profile.username && <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>@{profile.username}</p>}
          </div>
          <div className="pb-2 flex gap-2">
            {isOwner ? (
              <button onClick={() => setEditing(!editing)} className="gl sm ghost flex items-center gap-1.5">
                <Edit className="h-3 w-3" /> Editar
              </button>
            ) : (
              <>
                <button onClick={handleFollow}
                  className={`gl sm ${isFollowing ? "ghost" : "primary"}`}>
                  {isFollowing ? "Seguindo" : "Seguir"}
                </button>
                {user && (
                  <button onClick={() => setChatOpen(!chatOpen)}
                    className="gl sm ghost flex items-center gap-1.5">
                    <MessageSquare className="h-3 w-3" /> Mensagem
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-6 mb-6">
          <div className="text-center">
            <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{posts.length}</p>
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Posts</p>
          </div>
          <button onClick={loadFollowers} className="text-center hover:opacity-80 transition-opacity">
            <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{profile.followers_count}</p>
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Seguidores</p>
          </button>
          <button onClick={loadFollowing} className="text-center hover:opacity-80 transition-opacity">
            <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{profile.following_count}</p>
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Seguindo</p>
          </button>
        </div>

        {/* Followers/Following Modal */}
        {showListModal && (
          <div className="rd-card mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>{followListTitle} ({followListData.length})</p>
              <button onClick={() => { setShowFollowers(false); setShowFollowing(false); }}
                className="gl ico xs ghost">
                <X className="h-4 w-4" />
              </button>
            </div>
            {loadingList ? (
              <Loader2 className="h-5 w-5 animate-spin mx-auto" style={{ color: "var(--text-tertiary)" }} />
            ) : followListData.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: "var(--text-tertiary)" }}>Nenhum resultado.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {followListData.map(u => (
                  <Link key={u.user_id} to={`/profile/${u.user_id}`}
                    onClick={() => { setShowFollowers(false); setShowFollowing(false); }}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl transition-colors" style={{ ["--hover-bg" as string]: "var(--bg-3)" }}>
                    {u.avatar_url ? (
                      <img src={u.avatar_url} className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "var(--bg-3)", color: "var(--text-tertiary)" }}>
                        {(u.display_name || "U")[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{u.display_name}</p>
                      {u.username && <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>@{u.username}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bio & socials */}
        {profile.bio && <p className="text-sm text-muted-foreground mb-4">{profile.bio}</p>}
        <div className="flex gap-4 mb-8 flex-wrap">
          {profile.website && (
            <a href={profile.website} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <Globe className="h-3 w-3" /> {profile.website.replace(/^https?:\/\//, "")}
            </a>
          )}
          {profile.social_github && (
            <a href={`https://github.com/${profile.social_github}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 lv-caption hover:text-foreground">
              <Github className="h-3 w-3" /> {profile.social_github}
            </a>
          )}
          {profile.social_twitter && (
            <a href={`https://twitter.com/${profile.social_twitter}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 lv-caption hover:text-foreground">
              <Twitter className="h-3 w-3" /> {profile.social_twitter}
            </a>
          )}
          {profile.social_linkedin && (
            <a href={`https://linkedin.com/in/${profile.social_linkedin}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 lv-caption hover:text-foreground">
              <Linkedin className="h-3 w-3" /> {profile.social_linkedin}
            </a>
          )}
        </div>

        {/* Edit form */}
        {editing && isOwner && (
          <div className="rd-card mb-8 space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-tertiary)" }}>Editar perfil</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: "var(--text-secondary)" }}>Nome</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} className="tb-search" style={{ width: "100%" }} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: "var(--text-secondary)" }}>Username</label>
                <input value={editUsername} onChange={e => setEditUsername(e.target.value)} className="tb-search" style={{ width: "100%" }} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: "var(--text-secondary)" }}>Bio</label>
              <textarea value={editBio} onChange={e => setEditBio(e.target.value)} rows={3}
                style={{ width: "100%", background: "var(--bg-3)", border: "1px solid var(--b1)", borderRadius: "var(--r2)", padding: "8px 12px", fontSize: "13px", color: "var(--text-primary)", resize: "vertical" }} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: "var(--text-secondary)" }}>Website</label>
                <input value={editWebsite} onChange={e => setEditWebsite(e.target.value)} className="tb-search" style={{ width: "100%" }} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: "var(--text-secondary)" }}>GitHub</label>
                <input value={editGithub} onChange={e => setEditGithub(e.target.value)} className="tb-search" style={{ width: "100%" }} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: "var(--text-secondary)" }}>Twitter</label>
                <input value={editTwitter} onChange={e => setEditTwitter(e.target.value)} className="tb-search" style={{ width: "100%" }} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: "var(--text-secondary)" }}>LinkedIn</label>
                <input value={editLinkedin} onChange={e => setEditLinkedin(e.target.value)} className="tb-search" style={{ width: "100%" }} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSaveProfile} className="gl primary">Salvar</button>
              <button onClick={() => setEditing(false)} className="gl ghost">Cancelar</button>
            </div>
          </div>
        )}

        {/* User's posts */}
        <div className="space-y-4 pb-16">
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Publicações ({posts.length})</p>
          {posts.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Nenhuma publicação ainda.</p>
          ) : posts.map(post => (
            <Link key={post.id} to={`/community?post=${post.id}`} className="block">
              <div className="rd-card" style={{ transition: "border-color 0.15s" }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="chip">{post.post_type.toUpperCase()}</span>
                  <span className="text-xs" style={{ color: "var(--text-quaternary)" }}>
                    {format(new Date(post.created_at), "dd MMM yyyy", { locale: ptBR })}
                  </span>
                </div>
                {post.title && <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{post.title}</h3>}
                <p className="text-sm whitespace-pre-wrap mb-3 line-clamp-3" style={{ color: "var(--text-secondary)" }}>{post.content}</p>

                {post.media_urls && post.media_urls.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {post.media_urls.slice(0, 4).map((url, i) => (
                      <img key={i} src={url} alt="" className="rounded-xl w-full max-h-48 object-cover" />
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-4 text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
                  <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> {post.likes_count}</span>
                  <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> {post.comments_count}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Chat panel for DM */}
      {chatOpen && !isOwner && user && (
        <div className="fixed bottom-6 right-6 z-30 w-[360px] max-h-[500px] lv-glass rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
            <div>
              <p className="lv-caption font-medium">Mensagem</p>
              <p className="lv-caption">{profile.display_name}</p>
            </div>
            <button onClick={() => setChatOpen(false)} className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 max-h-[350px]">
            {chatMessages.length === 0 && (
              <p className="lv-caption text-center py-8">
                Envie uma mensagem para iniciar a conversa.
              </p>
            )}
            {chatMessages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender_id === user.id ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] px-3 py-2 rounded-xl text-xs ${
                  msg.sender_id === user.id ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                }`}>
                  <p className="font-medium">{msg.content}</p>
                  <p className={`text-[9px] mt-1 ${msg.sender_id === user.id ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {format(new Date(msg.created_at), "HH:mm")}
                  </p>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="px-4 py-3 border-t border-border/50 flex items-center gap-2">
            <input value={newMessage} onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChatMessage()}
              placeholder="Digite..."
              className="lv-input flex-1 h-9 text-xs" />
            <button onClick={sendChatMessage} disabled={sendingMessage || !newMessage.trim()}
              className="lv-btn-primary h-9 w-9 rounded-xl flex items-center justify-center">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (user) return <AppLayout>{content}</AppLayout>;
  return content;
}
