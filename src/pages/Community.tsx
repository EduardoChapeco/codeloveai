import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Heart, MessageCircle, Share2, Plus, Hash, TrendingUp,
  Image as ImageIcon, Link as LinkIcon, Folder, HelpCircle,
  Lightbulb, Eye, LogOut, Users, Loader2, Send, X,
  ChevronLeft, ChevronRight
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

/* ─── Media Carousel ─── */
function MediaCarousel({ urls }: { urls: string[] }) {
  const [current, setCurrent] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const total = urls.length;

  const goTo = (idx: number) => {
    setCurrent(Math.max(0, Math.min(idx, total - 1)));
  };

  if (total === 0) return null;

  return (
    <div className="relative rounded-[14px] overflow-hidden bg-muted mb-4 group">
      {/* Slides */}
      <div
        ref={containerRef}
        className="flex transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {urls.map((url, i) =>
          url.match(/\.(mp4|webm|mov)$/i) ? (
            <div key={i} className="w-full shrink-0">
              <video src={url} controls className="w-full max-h-[420px] object-contain bg-black" />
            </div>
          ) : (
            <div key={i} className="w-full shrink-0">
              <img
                src={url}
                alt=""
                className="w-full max-h-[420px] object-cover cursor-pointer"
                onClick={() => window.open(url, "_blank")}
              />
            </div>
          )
        )}
      </div>

      {/* Navigation arrows */}
      {total > 1 && (
        <>
          <button
            onClick={() => goTo(current - 1)}
            className={`absolute left-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-[10px] bg-background/80 backdrop-blur border border-border flex items-center justify-center transition-opacity ${
              current === 0 ? "opacity-0 pointer-events-none" : "opacity-0 group-hover:opacity-100"
            }`}
          >
            <ChevronLeft className="h-4 w-4 text-foreground" />
          </button>
          <button
            onClick={() => goTo(current + 1)}
            className={`absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-[10px] bg-background/80 backdrop-blur border border-border flex items-center justify-center transition-opacity ${
              current === total - 1 ? "opacity-0 pointer-events-none" : "opacity-0 group-hover:opacity-100"
            }`}
          >
            <ChevronRight className="h-4 w-4 text-foreground" />
          </button>
        </>
      )}

      {/* Dots indicator */}
      {total > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {urls.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`h-1.5 rounded-[3px] transition-all duration-200 ${
                i === current ? "w-5 bg-foreground" : "w-1.5 bg-foreground/30"
              }`}
            />
          ))}
        </div>
      )}

      {/* Counter badge */}
      {total > 1 && (
        <div className="absolute top-3 right-3 bg-background/70 backdrop-blur rounded-[8px] px-2.5 py-1">
          <span className="text-[10px] font-bold text-foreground">{current + 1}/{total}</span>
        </div>
      )}
    </div>
  );
}

/* ─── Threads-style Post Composer ─── */
function PostComposer({
  user,
  profile,
  onSubmit,
  posting,
}: {
  user: any;
  profile: { display_name: string; username: string; avatar_url: string };
  onSubmit: (data: { title: string; content: string; type: string; projectUrl: string; hashtags: string; files: File[] }) => void;
  posting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState("post");
  const [projectUrl, setProjectUrl] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []).slice(0, 10);
    setFiles(prev => [...prev, ...selected]);
    selected.forEach(f => {
      const reader = new FileReader();
      reader.onload = () => setPreviews(prev => [...prev, reader.result as string]);
      reader.readAsDataURL(f);
    });
  };

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = () => {
    onSubmit({ title, content, type, projectUrl, hashtags, files });
    setContent("");
    setTitle("");
    setType("post");
    setProjectUrl("");
    setHashtags("");
    setFiles([]);
    setPreviews([]);
    setExpanded(false);
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textRef.current) {
      textRef.current.style.height = "auto";
      textRef.current.style.height = textRef.current.scrollHeight + "px";
    }
  }, [content]);

  return (
    <div className="ep-card border-border/50">
      <div className="flex gap-3">
        {/* Avatar with thread line */}
        <div className="flex flex-col items-center">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-10 w-10 rounded-[14px] object-cover border border-border" />
          ) : (
            <div className="h-10 w-10 rounded-[14px] bg-foreground flex items-center justify-center text-xs font-bold text-background">
              {(profile.display_name || "U")[0].toUpperCase()}
            </div>
          )}
          {expanded && <div className="w-[2px] flex-1 bg-border mt-2 rounded-full" />}
        </div>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold text-foreground">{profile.display_name}</span>
            {profile.username && <span className="text-xs text-muted-foreground">@{profile.username}</span>}
          </div>

          <textarea
            ref={textRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            onFocus={() => setExpanded(true)}
            placeholder="O que está construindo?"
            rows={1}
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 resize-none focus:outline-none font-medium leading-relaxed"
          />

          {/* Expanded options */}
          {expanded && (
            <div className="mt-3 space-y-3 animate-fade-in">
              {/* Type pills */}
              <div className="flex gap-1.5 flex-wrap">
                {[["post", "Post"], ["project", "Projeto"], ["question", "Dúvida"], ["tip", "Dica"], ["showcase", "Showcase"]].map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setType(id)}
                    className={`h-7 px-3 rounded-[8px] text-[9px] font-bold tracking-wider transition-all ${
                      type === id
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Title */}
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Título (opcional)"
                className="w-full bg-muted/50 border border-border/50 rounded-[10px] px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/20"
              />

              {/* Project URL */}
              {(type === "project" || type === "showcase") && (
                <div className="flex items-center gap-2 bg-muted/50 border border-border/50 rounded-[10px] px-4 py-2">
                  <LinkIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <input
                    value={projectUrl}
                    onChange={e => setProjectUrl(e.target.value)}
                    placeholder="URL do projeto (ex: meuapp.lovable.app)"
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                  />
                </div>
              )}

              {/* Hashtags */}
              <div className="flex items-center gap-2 bg-muted/50 border border-border/50 rounded-[10px] px-4 py-2">
                <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <input
                  value={hashtags}
                  onChange={e => setHashtags(e.target.value)}
                  placeholder="react, lovable, dica"
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                />
              </div>

              {/* Media preview thumbnails */}
              {previews.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {previews.map((src, i) => (
                    <div key={i} className="relative h-20 w-20 rounded-[10px] overflow-hidden border border-border group">
                      <img src={src} alt="" className="h-full w-full object-cover" />
                      <button
                        onClick={() => removeFile(i)}
                        className="absolute top-1 right-1 h-5 w-5 rounded-[6px] bg-background/80 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3 text-foreground" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Bottom bar */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <label className="h-8 w-8 rounded-[10px] bg-muted hover:bg-muted/80 flex items-center justify-center cursor-pointer transition-colors">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    <input type="file" multiple accept="image/*,video/*,.gif" className="hidden" onChange={handleFileChange} />
                  </label>
                  {files.length > 0 && (
                    <span className="text-[10px] text-muted-foreground font-bold">{files.length} ARQUIVO(S)</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setExpanded(false); setContent(""); setTitle(""); setFiles([]); setPreviews([]); }}
                    className="h-9 px-4 rounded-[10px] text-[9px] font-bold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    CANCELAR
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={posting || (!content.trim() && !title.trim())}
                    className="ep-btn-primary h-9 px-5 text-[9px] disabled:opacity-40"
                  >
                    {posting ? "PUBLICANDO..." : "PUBLICAR"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Community() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterType = searchParams.get("type") || "all";
  const filterTag = searchParams.get("tag") || "";

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [hashtags, setHashtags] = useState<{ id: string; name: string; slug: string; posts_count: number }[]>([]);
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, { display_name: string; username: string; avatar_url: string }>>({});

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login?returnTo=/community");
    }
  }, [user, authLoading, navigate]);

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

    const userIds = [...new Set(postsList.map(p => p.user_id))];
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from("user_profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", userIds);

      const profileMap: Record<string, any> = {};
      (profilesData || []).forEach(p => { profileMap[p.user_id] = p; });
      setProfiles(prev => ({ ...prev, ...profileMap }));
    }

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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return null;

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

  const submitPost = async (data: { title: string; content: string; type: string; projectUrl: string; hashtags: string; files: File[] }) => {
    if (!user) return toast.error("Faça login para publicar.");
    if (!data.content.trim() && !data.title.trim()) return toast.error("Escreva algo para publicar.");
    setPosting(true);

    try {
      const mediaUrls: string[] = [];
      for (const file of data.files) {
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from("community").upload(path, file);
        if (!error) {
          const { data: urlData } = supabase.storage.from("community").getPublicUrl(path);
          mediaUrls.push(urlData.publicUrl);
        }
      }

      let linkPreview = { title: "", description: "", image: "" };
      const isLovableUrl = (() => { try { return new URL(data.projectUrl.trim()).hostname.endsWith(".lovable.app"); } catch { return false; } })();
      if (data.projectUrl.trim() && !isLovableUrl) {
        try {
          const { data: previewData } = await supabase.functions.invoke("link-preview", {
            body: { url: data.projectUrl.trim() },
          });
          if (previewData) linkPreview = previewData;
        } catch { /* ignore */ }
      }

      const { data: postData, error: postError } = await supabase
        .from("community_posts")
        .insert({
          user_id: user.id,
          post_type: data.type,
          title: data.title.trim(),
          content: data.content.trim(),
          media_urls: mediaUrls,
          project_url: data.projectUrl.trim(),
          project_name: data.type === "project" ? data.title.trim() : "",
          link_preview_title: linkPreview.title,
          link_preview_description: linkPreview.description,
          link_preview_image: linkPreview.image,
        })
        .select("id")
        .single();

      if (postError) throw postError;

      const tags = data.hashtags.split(/[,#\s]+/).filter(Boolean).map(t => t.toLowerCase().trim()).slice(0, 5);
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

      const { data: existingProfile } = await supabase
        .from("user_profiles").select("id").eq("user_id", user.id).maybeSingle();
      if (!existingProfile) {
        await supabase.from("user_profiles").insert({
          user_id: user.id,
          display_name: user.user_metadata?.name || user.email?.split("@")[0] || "Usuário",
          username: user.email?.split("@")[0]?.replace(/[^a-z0-9_]/g, "") || `user_${Date.now()}`,
        });
      }

      const { data: currentProfile } = await supabase.from("user_profiles").select("posts_count").eq("user_id", user.id).maybeSingle();
      if (currentProfile) {
        await supabase.from("user_profiles").update({ posts_count: (currentProfile.posts_count || 0) + 1 }).eq("user_id", user.id);
      }

      toast.success("Publicado!");
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

  const myProfile = getProfile(user.id);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-20 bg-background border-b border-border px-8 py-5 flex items-center justify-between">
        <Link to="/" className="ep-label text-sm tracking-[0.3em]">CODELOVE AI</Link>
        <div className="flex items-center gap-4">
          <Link to="/community" className="ep-badge ep-badge-live">COMUNIDADE</Link>
          <Link to="/dashboard" className="ep-btn-secondary h-10 px-4 text-[9px]">DASHBOARD</Link>
          <Link to={`/profile/${user.id}`} className="ep-btn-secondary h-10 px-4 text-[9px]">MEU PERFIL</Link>
          <button onClick={signOut} className="ep-btn-icon h-10 w-10 rounded-[14px]"><LogOut className="h-4 w-4" /></button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-8 py-8 flex gap-8">
        {/* Sidebar */}
        <aside className="hidden lg:block w-64 shrink-0 space-y-6">
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

          <div className="ep-card text-center">
            <Users className="h-5 w-5 mx-auto mb-2 text-foreground" />
            <p className="ep-value text-xl">{posts.length}</p>
            <p className="ep-subtitle">POSTS</p>
          </div>
        </aside>

        {/* Main feed */}
        <main className="flex-1 space-y-4 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="ep-subtitle mb-1">COMUNIDADE</p>
              <h1 className="ep-section-title text-2xl">FEED</h1>
            </div>
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

          {/* Threads-style inline composer */}
          <PostComposer
            user={user}
            profile={myProfile}
            onSubmit={submitPost}
            posting={posting}
          />

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
                  {/* Threads-style header with avatar + thread line */}
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <Link to={`/profile/${post.user_id}`} className="shrink-0">
                        {profile.avatar_url ? (
                          <img src={profile.avatar_url} alt="" className="h-10 w-10 rounded-[14px] object-cover border border-border" />
                        ) : (
                          <div className="h-10 w-10 rounded-[14px] bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                            {(profile.display_name || "U")[0].toUpperCase()}
                          </div>
                        )}
                      </Link>
                      {expandedComments === post.id && <div className="w-[2px] flex-1 bg-border mt-2 rounded-full" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* User info row */}
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link to={`/profile/${post.user_id}`} className="text-sm font-bold text-foreground hover:underline">
                            {profile.display_name || "Usuário"}
                          </Link>
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(post.created_at), "dd MMM", { locale: ptBR })}
                          </span>
                        </div>
                        <span className="ep-badge text-[7px] flex items-center gap-1">
                          {typeIcon(post.post_type)} {post.post_type.toUpperCase()}
                        </span>
                      </div>

                      {/* Content */}
                      {post.title && <h3 className="text-base font-bold text-foreground mb-1">{post.title}</h3>}
                      <p className="text-sm text-muted-foreground font-medium whitespace-pre-wrap mb-3 leading-relaxed">{post.content}</p>

                      {/* Media Carousel */}
                      {post.media_urls && post.media_urls.length > 0 && (
                        <MediaCarousel urls={post.media_urls} />
                      )}

                      {/* Project link with live preview */}
                      {post.project_url && (
                        <div className="mb-3">
                          {(() => { try { return new URL(post.project_url).hostname.endsWith(".lovable.app"); } catch { return false; } })() ? (
                            <a href={post.project_url} target="_blank" rel="noopener noreferrer" className="block group">
                              <div className="rounded-[14px] overflow-hidden border border-border hover:border-foreground/30 transition-colors">
                                <div className="relative">
                                  <iframe
                                    src={post.project_url}
                                    className="w-full h-[280px] border-0 pointer-events-none"
                                    sandbox="allow-scripts allow-same-origin"
                                    loading="lazy"
                                    title={post.project_name || "Project preview"}
                                  />
                                  <div className="absolute inset-0 bg-transparent group-hover:bg-black/5 transition-colors" />
                                </div>
                                <div className="bg-muted/50 px-4 py-2.5 flex items-center justify-between border-t border-border">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="h-5 w-5 rounded-[6px] bg-foreground/10 flex items-center justify-center shrink-0">
                                      <Eye className="h-3 w-3 text-foreground" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-foreground truncate">{post.project_name || "Preview ao vivo"}</p>
                                      <p className="text-[10px] text-muted-foreground truncate">{(() => { try { return new URL(post.project_url).hostname; } catch { return post.project_url; } })()}</p>
                                    </div>
                                  </div>
                                  <span className="text-[9px] font-bold text-muted-foreground group-hover:text-foreground transition-colors shrink-0 ml-2">
                                    ABRIR ↗
                                  </span>
                                </div>
                              </div>
                            </a>
                          ) : (
                            <a href={post.project_url} target="_blank" rel="noopener noreferrer"
                              className="block rounded-[14px] overflow-hidden border border-border hover:border-foreground/30 transition-colors group">
                              {post.link_preview_image && (
                                <div className="relative w-full h-[160px] bg-muted">
                                  <img src={post.link_preview_image} alt="" className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-transparent group-hover:bg-black/5 transition-colors" />
                                </div>
                              )}
                              <div className="bg-muted/50 px-4 py-2.5 border-t border-border">
                                <p className="text-sm font-bold text-foreground truncate mb-0.5">
                                  {post.link_preview_title || post.project_name || post.project_url}
                                </p>
                                {post.link_preview_description && (
                                  <p className="text-xs text-muted-foreground line-clamp-2 mb-1">{post.link_preview_description}</p>
                                )}
                                <p className="text-[10px] text-muted-foreground/60 truncate">{(() => { try { return new URL(post.project_url).hostname; } catch { return post.project_url; } })()}</p>
                              </div>
                            </a>
                          )}
                        </div>
                      )}

                      {/* Actions - Threads style */}
                      <div className="flex items-center gap-5">
                        <button onClick={() => handleLike(post.id)}
                          className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${
                            (post as any).liked ? "text-red-500" : "text-muted-foreground hover:text-foreground"
                          }`}>
                          <Heart className={`h-[18px] w-[18px] ${(post as any).liked ? "fill-red-500" : ""}`} />
                          {post.likes_count > 0 && post.likes_count}
                        </button>
                        <button onClick={() => loadComments(post.id)}
                          className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
                          <MessageCircle className="h-[18px] w-[18px]" />
                          {post.comments_count > 0 && post.comments_count}
                        </button>
                        <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/community?post=${post.id}`); toast.success("Link copiado!"); }}
                          className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
                          <Share2 className="h-[18px] w-[18px]" />
                        </button>
                      </div>

                      {/* Reply count label */}
                      {post.comments_count > 0 && expandedComments !== post.id && (
                        <button
                          onClick={() => loadComments(post.id)}
                          className="text-xs text-muted-foreground/60 font-medium mt-2 hover:text-muted-foreground transition-colors"
                        >
                          {post.comments_count} {post.comments_count === 1 ? "resposta" : "respostas"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Comments - Threads style */}
                  {expandedComments === post.id && (
                    <div className="ml-[52px] mt-3 space-y-3">
                      {comments.map(c => {
                        const cp = getProfile(c.user_id);
                        return (
                          <div key={c.id} className="flex gap-2.5">
                            <Link to={`/profile/${c.user_id}`}>
                              {cp.avatar_url ? (
                                <img src={cp.avatar_url} className="h-7 w-7 rounded-[10px] object-cover border border-border" />
                              ) : (
                                <div className="h-7 w-7 rounded-[10px] bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                                  {(cp.display_name || "U")[0].toUpperCase()}
                                </div>
                              )}
                            </Link>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-foreground">{cp.display_name || "Usuário"}</span>
                                <span className="text-[10px] text-muted-foreground">{format(new Date(c.created_at), "dd/MM HH:mm")}</span>
                              </div>
                              <p className="text-sm text-muted-foreground font-medium leading-relaxed">{c.content}</p>
                            </div>
                          </div>
                        );
                      })}
                      {user && (
                        <div className="flex gap-2.5 items-center">
                          <div className="h-7 w-7 rounded-[10px] bg-muted flex items-center justify-center shrink-0">
                            {myProfile.avatar_url ? (
                              <img src={myProfile.avatar_url} className="h-7 w-7 rounded-[10px] object-cover border border-border" />
                            ) : (
                              <span className="text-[10px] font-bold text-muted-foreground">
                                {(myProfile.display_name || "U")[0].toUpperCase()}
                              </span>
                            )}
                          </div>
                          <input value={newComment} onChange={e => setNewComment(e.target.value)}
                            placeholder="Responder..."
                            onKeyDown={e => e.key === "Enter" && submitComment(post.id)}
                            className="flex-1 bg-transparent border-b border-border/50 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30" />
                          <button onClick={() => submitComment(post.id)} className="h-7 w-7 rounded-[10px] bg-foreground flex items-center justify-center shrink-0">
                            <Send className="h-3 w-3 text-background" />
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
