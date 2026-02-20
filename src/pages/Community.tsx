import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Heart, MessageCircle, Share2, Plus, Hash, TrendingUp,
  Image as ImageIcon, Link as LinkIcon, Folder, HelpCircle,
  Lightbulb, Eye, LogOut, Users, Loader2, Send, X
} from "lucide-react";

interface Post {
  id: string;
  user_id: string;
  post_type: string;
  title: string;
  content: string;
  media_urls: string[];
  link_url: string;
  link_preview_title: string;
  link_preview_description: string;
  link_preview_image: string;
  project_name: string;
  project_url: string;
  project_preview_image: string;
  likes_count: number;
  comments_count: number;
  is_pinned: boolean;
  created_at: string;
  // joined
  profile?: { display_name: string; username: string; avatar_url: string };
  liked?: boolean;
}

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: { display_name: string; username: string; avatar_url: string };
}

const POST_TYPES = [
  { id: "all", label: "TODOS", icon: TrendingUp },
  { id: "project", label: "PROJETOS", icon: Folder },
  { id: "question", label: "DÚVIDAS", icon: HelpCircle },
  { id: "tip", label: "DICAS", icon: Lightbulb },
  { id: "showcase", label: "SHOWCASE", icon: Eye },
];

export default function Community() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterType = searchParams.get("type") || "all";
  const filterTag = searchParams.get("tag") || "";

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [hashtags, setHashtags] = useState<{ id: string; name: string; slug: string; posts_count: number }[]>([]);
  const [showNewPost, setShowNewPost] = useState(false);
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [profiles, setProfiles] = useState<Record<string, { display_name: string; username: string; avatar_url: string }>>({});

  // New post form
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newType, setNewType] = useState<string>("post");
  const [newProjectUrl, setNewProjectUrl] = useState("");
  const [newHashtags, setNewHashtags] = useState("");
  const [newMediaFiles, setNewMediaFiles] = useState<File[]>([]);
  const [posting, setPosting] = useState(false);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("community_posts")
      .select("*")
      .eq("is_deleted", false)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);

    if (filterType !== "all") {
      query = query.eq("post_type", filterType);
    }

    const { data } = await query;
    const postsList = data || [];

    // Fetch profiles for all post authors
    const userIds = [...new Set(postsList.map(p => p.user_id))];
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from("user_profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", userIds);

      const profileMap: Record<string, any> = {};
      (profilesData || []).forEach(p => {
        profileMap[p.user_id] = p;
      });
      setProfiles(prev => ({ ...prev, ...profileMap }));
    }

    // Check likes if logged in
    if (user) {
      const { data: likes } = await supabase
        .from("post_likes")
        .select("post_id")
        .eq("user_id", user.id)
        .in("post_id", postsList.map(p => p.id));

      const likedSet = new Set((likes || []).map(l => l.post_id));
      postsList.forEach(p => (p as any).liked = likedSet.has(p.id));
    }

    setPosts(postsList as Post[]);
    setLoading(false);
  }, [filterType, user]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  useEffect(() => {
    supabase.from("hashtags").select("*").order("posts_count", { ascending: false }).limit(20)
      .then(({ data }) => setHashtags(data || []));
  }, []);

  const handleLike = async (postId: string) => {
    if (!user) return toast.error("Faça login para curtir.");
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    if ((post as any).liked) {
      await supabase.from("post_likes").delete().eq("user_id", user.id).eq("post_id", postId);
      await supabase.from("community_posts").update({ likes_count: Math.max(0, post.likes_count - 1) }).eq("id", postId);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, liked: false, likes_count: Math.max(0, p.likes_count - 1) } as any : p));
    } else {
      await supabase.from("post_likes").insert({ user_id: user.id, post_id: postId });
      await supabase.from("community_posts").update({ likes_count: post.likes_count + 1 }).eq("id", postId);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, liked: true, likes_count: p.likes_count + 1 } as any : p));
    }
  };

  const loadComments = async (postId: string) => {
    if (expandedComments === postId) {
      setExpandedComments(null);
      return;
    }
    setExpandedComments(postId);
    const { data } = await supabase
      .from("post_comments")
      .select("*")
      .eq("post_id", postId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true });

    const commentsList = data || [];
    const userIds = [...new Set(commentsList.map(c => c.user_id))];
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from("user_profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", userIds);
      const profileMap: Record<string, any> = {};
      (profilesData || []).forEach(p => { profileMap[p.user_id] = p; });
      setProfiles(prev => ({ ...prev, ...profileMap }));
    }

    setComments(commentsList as Comment[]);
  };

  const submitComment = async (postId: string) => {
    if (!user) return toast.error("Faça login para comentar.");
    if (!newComment.trim()) return;

    await supabase.from("post_comments").insert({ user_id: user.id, post_id: postId, content: newComment.trim() });
    const post = posts.find(p => p.id === postId);
    if (post) {
      await supabase.from("community_posts").update({ comments_count: post.comments_count + 1 }).eq("id", postId);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p));
    }
    setNewComment("");
    loadComments(postId);
  };

  const submitPost = async () => {
    if (!user) return toast.error("Faça login para publicar.");
    if (!newContent.trim() && !newTitle.trim()) return toast.error("Escreva algo para publicar.");
    setPosting(true);

    try {
      // Upload media files
      const mediaUrls: string[] = [];
      for (const file of newMediaFiles) {
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from("community").upload(path, file);
        if (!error) {
          const { data: urlData } = supabase.storage.from("community").getPublicUrl(path);
          mediaUrls.push(urlData.publicUrl);
        }
      }

      // Fetch link preview if URL provided
      let linkPreview = { title: "", description: "", image: "" };
      if (newProjectUrl.trim() && !newProjectUrl.includes("lovable.app")) {
        try {
          const { data: previewData } = await supabase.functions.invoke("link-preview", {
            body: { url: newProjectUrl.trim() },
          });
          if (previewData) linkPreview = previewData;
        } catch { /* ignore preview errors */ }
      }

      const { data: postData, error: postError } = await supabase
        .from("community_posts")
        .insert({
          user_id: user.id,
          post_type: newType,
          title: newTitle.trim(),
          content: newContent.trim(),
          media_urls: mediaUrls,
          project_url: newProjectUrl.trim(),
          project_name: newType === "project" ? newTitle.trim() : "",
          link_preview_title: linkPreview.title,
          link_preview_description: linkPreview.description,
          link_preview_image: linkPreview.image,
        })
        .select("id")
        .single();

      if (postError) throw postError;

      // Parse and create hashtags
      const tags = newHashtags.split(/[,#\s]+/).filter(Boolean).map(t => t.toLowerCase().trim()).slice(0, 5);
      for (const tag of tags) {
        const slug = tag.replace(/[^a-z0-9]/g, "");
        if (!slug) continue;
        const { data: existing } = await supabase.from("hashtags").select("id").eq("slug", slug).maybeSingle();
        let hashtagId: string;
        if (existing) {
          hashtagId = existing.id;
          await supabase.from("hashtags").update({ posts_count: (hashtags.find(h => h.id === hashtagId)?.posts_count || 0) + 1 }).eq("id", hashtagId);
        } else {
          const { data: newTag } = await supabase.from("hashtags").insert({ name: tag, slug }).select("id").single();
          if (!newTag) continue;
          hashtagId = newTag.id;
        }
        await supabase.from("post_hashtags").insert({ post_id: postData.id, hashtag_id: hashtagId });
      }

      // Ensure user has a profile
      const { data: existingProfile } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existingProfile) {
        await supabase.from("user_profiles").insert({
          user_id: user.id,
          display_name: user.user_metadata?.name || user.email?.split("@")[0] || "Usuário",
          username: user.email?.split("@")[0]?.replace(/[^a-z0-9_]/g, "") || `user_${Date.now()}`,
        });
      }

      // Update profile post count
      // Increment posts count
      const { data: currentProfile } = await supabase.from("user_profiles").select("posts_count").eq("user_id", user.id).maybeSingle();
      if (currentProfile) {
        await supabase.from("user_profiles").update({ posts_count: (currentProfile.posts_count || 0) + 1 }).eq("user_id", user.id);
      }

      toast.success("Publicado!");
      setShowNewPost(false);
      setNewTitle("");
      setNewContent("");
      setNewType("post");
      setNewProjectUrl("");
      setNewHashtags("");
      setNewMediaFiles([]);
      fetchPosts();
    } catch (err: any) {
      toast.error("Erro ao publicar: " + (err.message || ""));
    } finally {
      setPosting(false);
    }
  };

  const getProfile = (userId: string) => profiles[userId] || { display_name: "Usuário", username: "", avatar_url: "" };

  const typeIcon = (type: string) => {
    const map: Record<string, any> = { project: Folder, question: HelpCircle, tip: Lightbulb, showcase: Eye };
    const Icon = map[type] || Hash;
    return <Icon className="h-3 w-3" />;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-20 bg-background border-b border-border px-8 py-5 flex items-center justify-between">
        <Link to="/" className="ep-label text-sm tracking-[0.3em]">CODELOVE AI</Link>
        <div className="flex items-center gap-4">
          <Link to="/community" className="ep-badge ep-badge-live">COMUNIDADE</Link>
          {user ? (
            <>
              <Link to="/dashboard" className="ep-btn-secondary h-10 px-4 text-[9px]">DASHBOARD</Link>
              <Link to={`/profile/${user.id}`} className="ep-btn-secondary h-10 px-4 text-[9px]">MEU PERFIL</Link>
              <button onClick={signOut} className="ep-btn-icon h-10 w-10 rounded-[14px]"><LogOut className="h-4 w-4" /></button>
            </>
          ) : (
            <>
              <Link to="/login" className="ep-btn-secondary h-10 px-6 text-[9px]">ENTRAR</Link>
              <Link to="/register" className="ep-btn-primary h-10 px-6 text-[9px]">CRIAR CONTA</Link>
            </>
          )}
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-8 py-8 flex gap-8">
        {/* Sidebar */}
        <aside className="hidden lg:block w-64 shrink-0 space-y-6">
          {/* Post type filter */}
          <div className="ep-card space-y-1">
            <p className="ep-subtitle mb-3">FILTRAR</p>
            {POST_TYPES.map(t => (
              <button
                key={t.id}
                onClick={() => setSearchParams(t.id === "all" ? {} : { type: t.id })}
                className={`w-full flex items-center gap-2 text-left px-3 py-2 rounded-[10px] text-xs font-bold transition-colors ${
                  filterType === t.id ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <t.icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            ))}
          </div>

          {/* Trending hashtags */}
          <div className="ep-card space-y-2">
            <p className="ep-subtitle mb-3">TRENDING</p>
            {hashtags.slice(0, 10).map(h => (
              <button
                key={h.id}
                onClick={() => setSearchParams({ tag: h.slug })}
                className="flex items-center gap-2 text-xs text-muted-foreground font-medium hover:text-foreground transition-colors"
              >
                <Hash className="h-3 w-3" /> {h.name}
                <span className="text-[10px] text-muted-foreground/60">{h.posts_count}</span>
              </button>
            ))}
            {hashtags.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhuma hashtag ainda.</p>
            )}
          </div>

          {/* Stats */}
          <div className="ep-card text-center">
            <Users className="h-5 w-5 mx-auto mb-2 text-foreground" />
            <p className="ep-value text-xl">{posts.length}</p>
            <p className="ep-subtitle">POSTS</p>
          </div>
        </aside>

        {/* Main feed */}
        <main className="flex-1 space-y-6 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="ep-subtitle mb-1">COMUNIDADE</p>
              <h1 className="ep-section-title text-2xl">FEED</h1>
            </div>
            {user && (
              <button onClick={() => setShowNewPost(true)} className="ep-btn-primary h-10 px-6 text-[9px] flex items-center gap-2">
                <Plus className="h-3.5 w-3.5" /> PUBLICAR
              </button>
            )}
          </div>

          {/* Mobile filters */}
          <div className="flex gap-2 flex-wrap lg:hidden">
            {POST_TYPES.map(t => (
              <button
                key={t.id}
                onClick={() => setSearchParams(t.id === "all" ? {} : { type: t.id })}
                className={`ep-btn-secondary h-8 px-3 text-[8px] ${filterType === t.id ? "bg-foreground text-background" : ""}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* New post modal */}
          {showNewPost && (
            <div className="ep-card border-foreground/20">
              <div className="flex items-center justify-between mb-4">
                <p className="ep-subtitle">NOVA PUBLICAÇÃO</p>
                <button onClick={() => setShowNewPost(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
              </div>

              <div className="flex gap-2 mb-4 flex-wrap">
                {[["post", "Post"], ["project", "Projeto"], ["question", "Dúvida"], ["tip", "Dica"], ["showcase", "Showcase"]].map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setNewType(id)}
                    className={`ep-btn-secondary h-8 px-3 text-[8px] ${newType === id ? "bg-foreground text-background" : ""}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <input
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="Título (opcional)"
                className="w-full bg-muted border border-border rounded-[10px] px-4 py-2.5 text-sm mb-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
              />

              <textarea
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                placeholder="Escreva sua publicação..."
                rows={4}
                className="w-full bg-muted border border-border rounded-[10px] px-4 py-2.5 text-sm mb-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground resize-none"
              />

              {(newType === "project" || newType === "showcase") && (
                <input
                  value={newProjectUrl}
                  onChange={e => setNewProjectUrl(e.target.value)}
                  placeholder="URL do projeto (ex: https://meuapp.lovable.app)"
                  className="w-full bg-muted border border-border rounded-[10px] px-4 py-2.5 text-sm mb-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                />
              )}

              <input
                value={newHashtags}
                onChange={e => setNewHashtags(e.target.value)}
                placeholder="Hashtags (ex: react, lovable, dica)"
                className="w-full bg-muted border border-border rounded-[10px] px-4 py-2.5 text-sm mb-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
              />

              <div className="flex items-center justify-between">
                <label className="ep-btn-secondary h-8 px-3 text-[8px] flex items-center gap-1 cursor-pointer">
                  <ImageIcon className="h-3 w-3" /> MÍDIA
                  <input type="file" multiple accept="image/*,video/*,.gif" className="hidden"
                    onChange={e => setNewMediaFiles(Array.from(e.target.files || []))} />
                </label>
                {newMediaFiles.length > 0 && <span className="text-xs text-muted-foreground">{newMediaFiles.length} arquivo(s)</span>}
                <button onClick={submitPost} disabled={posting} className="ep-btn-primary h-10 px-6 text-[9px]">
                  {posting ? "PUBLICANDO..." : "PUBLICAR"}
                </button>
              </div>
            </div>
          )}

          {/* Posts */}
          {loading ? (
            <div className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /></div>
          ) : posts.length === 0 ? (
            <div className="text-center py-20">
              <p className="ep-subtitle mb-2">NENHUMA PUBLICAÇÃO</p>
              <p className="text-sm text-muted-foreground">Seja o primeiro a publicar na comunidade!</p>
            </div>
          ) : (
            posts.map(post => {
              const profile = getProfile(post.user_id);
              return (
                <div key={post.id} className="ep-card">
                  {/* Header */}
                  <div className="flex items-start gap-3 mb-4">
                    <Link to={`/profile/${post.user_id}`} className="shrink-0">
                      {profile.avatar_url ? (
                        <img src={profile.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                          {(profile.display_name || "U")[0].toUpperCase()}
                        </div>
                      )}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link to={`/profile/${post.user_id}`} className="text-sm font-bold text-foreground hover:underline">
                          {profile.display_name || "Usuário"}
                        </Link>
                        {profile.username && (
                          <span className="text-xs text-muted-foreground">@{profile.username}</span>
                        )}
                        <span className="ep-badge text-[7px] flex items-center gap-1">
                          {typeIcon(post.post_type)} {post.post_type.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(post.created_at), "dd MMM yyyy · HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>

                  {/* Content */}
                  {post.title && <h3 className="text-base font-bold text-foreground mb-2">{post.title}</h3>}
                  <p className="text-sm text-muted-foreground font-medium whitespace-pre-wrap mb-4">{post.content}</p>

                  {/* Media */}
                  {post.media_urls && post.media_urls.length > 0 && (
                    <div className={`grid gap-2 mb-4 ${post.media_urls.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                      {post.media_urls.map((url, i) => (
                        url.match(/\.(mp4|webm|mov)$/i) ? (
                          <video key={i} src={url} controls className="rounded-[10px] w-full max-h-96 object-cover" />
                        ) : (
                          <img key={i} src={url} alt="" className="rounded-[10px] w-full max-h-96 object-cover cursor-pointer"
                            onClick={() => window.open(url, "_blank")} />
                        )
                      ))}
                    </div>
                  )}

                  {/* Project link with live preview */}
                  {post.project_url && (
                    <div className="mb-4">
                      {post.project_url.includes("lovable.app") ? (
                        <div className="rounded-[12px] overflow-hidden border border-border">
                          <div className="bg-muted px-3 py-2 flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <Eye className="h-3.5 w-3.5 text-foreground shrink-0" />
                              <span className="text-xs font-bold text-foreground truncate">{post.project_name || "Preview ao vivo"}</span>
                            </div>
                            <a href={post.project_url} target="_blank" rel="noopener noreferrer"
                              className="text-[9px] font-bold text-muted-foreground hover:text-foreground">
                              ABRIR ↗
                            </a>
                          </div>
                          <iframe
                            src={post.project_url}
                            className="w-full h-[300px] border-0"
                            sandbox="allow-scripts allow-same-origin"
                            loading="lazy"
                            title={post.project_name || "Project preview"}
                          />
                        </div>
                      ) : (
                        <a href={post.project_url} target="_blank" rel="noopener noreferrer"
                          className="ep-card-sm flex items-center gap-3 hover:border-foreground/30 transition-colors">
                          {post.link_preview_image && (
                            <img src={post.link_preview_image} alt="" className="h-16 w-24 rounded-[8px] object-cover shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">
                              {post.link_preview_title || post.project_name || post.project_url}
                            </p>
                            {post.link_preview_description && (
                              <p className="text-[10px] text-muted-foreground truncate">{post.link_preview_description}</p>
                            )}
                            <p className="text-[9px] text-muted-foreground/60 truncate mt-0.5">{post.project_url}</p>
                          </div>
                        </a>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-6 pt-3 border-t border-border">
                    <button onClick={() => handleLike(post.id)}
                      className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${
                        (post as any).liked ? "text-red-500" : "text-muted-foreground hover:text-foreground"
                      }`}>
                      <Heart className={`h-4 w-4 ${(post as any).liked ? "fill-red-500" : ""}`} />
                      {post.likes_count}
                    </button>
                    <button onClick={() => loadComments(post.id)}
                      className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
                      <MessageCircle className="h-4 w-4" /> {post.comments_count}
                    </button>
                    <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/community?post=${post.id}`); toast.success("Link copiado!"); }}
                      className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
                      <Share2 className="h-4 w-4" /> COMPARTILHAR
                    </button>
                  </div>

                  {/* Comments */}
                  {expandedComments === post.id && (
                    <div className="mt-4 pt-4 border-t border-border space-y-3">
                      {comments.map(c => {
                        const cp = getProfile(c.user_id);
                        return (
                          <div key={c.id} className="flex gap-2">
                            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                              {cp.avatar_url ? (
                                <img src={cp.avatar_url} className="h-7 w-7 rounded-full object-cover" />
                              ) : (cp.display_name || "U")[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="text-xs">
                                <span className="font-bold text-foreground">{cp.display_name || "Usuário"}</span>
                                <span className="text-muted-foreground ml-2">{format(new Date(c.created_at), "dd/MM HH:mm")}</span>
                              </p>
                              <p className="text-sm text-muted-foreground font-medium">{c.content}</p>
                            </div>
                          </div>
                        );
                      })}
                      {user && (
                        <div className="flex gap-2">
                          <input value={newComment} onChange={e => setNewComment(e.target.value)}
                            placeholder="Escreva um comentário..."
                            onKeyDown={e => e.key === "Enter" && submitComment(post.id)}
                            className="flex-1 bg-muted border border-border rounded-[10px] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground" />
                          <button onClick={() => submitComment(post.id)} className="ep-btn-primary h-9 w-9 p-0 flex items-center justify-center">
                            <Send className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </main>
      </div>
    </div>
  );
}
