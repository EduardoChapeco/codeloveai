import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import TopProjectsBanner from "@/components/community/TopProjectsBanner";
import {
  Heart, MessageCircle, Eye, Plus, Rss, TestTube,
  Folder, HelpCircle, Lightbulb, Loader2, X,
  Send, Bookmark, Share2, MoreHorizontal,
} from "lucide-react";

interface Post {
  id: string;
  user_id: string;
  title: string;
  content: string;
  likes_count: number;
  comments_count: number;
  views_count: number;
  created_at: string;
  post_type: string;
  profile?: { display_name: string; username: string; avatar_url: string };
  liked?: boolean;
}

const FILTERS = ["Todos", "Recentes", "Populares", "Seguindo"];
const GROUPS = [
  { id: "feed", label: "Feed Geral", icon: Rss },
  { id: "test", label: "Teste & Feedback", icon: TestTube },
];
const SUB_FILTERS = [
  { id: "all", label: "Todos" },
  { id: "project", label: "Projetos", icon: Folder },
  { id: "question", label: "Dúvidas", icon: HelpCircle },
  { id: "tip", label: "Dicas", icon: Lightbulb },
];

const POST_TYPE_MAP: Record<string, { label: string; color: string }> = {
  project: { label: "Projeto", color: "var(--blue)" },
  question: { label: "Dúvida", color: "var(--orange)" },
  tip: { label: "Dica", color: "var(--green)" },
};

export default function StarbleCommunityPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeGroup, setActiveGroup] = useState("feed");
  const [activeFilter, setActiveFilter] = useState("Todos");
  const [activeSubFilter, setActiveSubFilter] = useState("all");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  // Composer state
  const [showComposer, setShowComposer] = useState(false);
  const [compTitle, setCompTitle] = useState("");
  const [compContent, setCompContent] = useState("");
  const [compType, setCompType] = useState("project");
  const [posting, setPosting] = useState(false);

  // Load posts
  const loadPosts = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("community_posts")
      .select("id, user_id, title, content, likes_count, comments_count, views_count, created_at, post_type")
      .eq("is_deleted", false);

    if (activeFilter === "Populares") {
      query = query.order("likes_count", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    if (activeSubFilter !== "all") {
      query = query.eq("post_type", activeSubFilter);
    }

    query = query.limit(30);
    const { data } = await query;

    if (data && data.length > 0) {
      const userIds = [...new Set(data.map(p => p.user_id))];
      const { data: profiles } = await supabase
        .from("community_profiles")
        .select("user_id, username, avatar_url")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Check likes
      if (user) {
        const { data: likes } = await (supabase as any)
          .from("community_likes")
          .select("post_id")
          .eq("user_id", user.id)
          .in("post_id", data.map((p: any) => p.id));
        if (likes) setLikedPosts(new Set((likes as any[]).map((l: any) => l.post_id)));
      }

      setPosts(data.map(p => ({
        ...p,
        profile: profileMap.get(p.user_id) as any,
      })));
    } else {
      setPosts([]);
    }
    setLoading(false);
  }, [activeSubFilter, activeFilter, user]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  // Like toggle
  const toggleLike = async (postId: string) => {
    if (!user) return toast.error("Faça login para curtir");
    const isLiked = likedPosts.has(postId);

    // Optimistic update
    setLikedPosts(prev => {
      const next = new Set(prev);
      if (isLiked) next.delete(postId); else next.add(postId);
      return next;
    });
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, likes_count: p.likes_count + (isLiked ? -1 : 1) } : p
    ));

    if (isLiked) {
      await (supabase as any).from("community_likes").delete().eq("user_id", user.id).eq("post_id", postId);
    } else {
      await (supabase as any).from("community_likes").insert({ user_id: user.id, post_id: postId });
    }
  };

  // Create post
  const handlePost = async () => {
    if (!user) return;
    if (!compTitle.trim()) return toast.error("Título obrigatório");
    setPosting(true);
    try {
      const { error } = await supabase.from("community_posts").insert({
        user_id: user.id,
        title: compTitle.trim(),
        content: compContent.trim(),
        post_type: compType,
      });
      if (error) throw error;
      toast.success("Post publicado!");
      setShowComposer(false);
      setCompTitle("");
      setCompContent("");
      setCompType("project");
      loadPosts();
    } catch (err: any) {
      toast.error(err.message || "Erro ao publicar");
    } finally {
      setPosting(false);
    }
  };

  const getInitial = (post: Post) => {
    if (post.profile?.username) return post.profile.username[0].toUpperCase();
    return "U";
  };

  const getTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  // If Test & Feedback group is selected, navigate there
  if (activeGroup === "test") {
    navigate("/community/tests");
    return null;
  }

  return (
    <div style={{ display: "flex", flexDirection: "row", height: "100%" }}>
      {/* Community Sidebar */}
      <div className="comm-sidebar">
        <div className="cs-header">
          <span className="cs-label">Grupos</span>
          <button className="gl ico xs" onClick={() => setShowComposer(true)}><Plus size={10} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 8, scrollbarWidth: "none" as any }}>
          {GROUPS.map((g) => (
            <button
              key={g.id}
              className={`group-btn ${activeGroup === g.id ? "active" : ""}`}
              onClick={() => setActiveGroup(g.id)}
            >
              <g.icon size={13} />
              {g.label}
            </button>
          ))}

          <div style={{
            fontSize: "9.5px", fontWeight: 700, letterSpacing: ".08em",
            textTransform: "uppercase" as const, color: "var(--text-quaternary)",
            padding: "14px 10px 5px",
          }}>
            Filtrar
          </div>
          {SUB_FILTERS.map((f) => (
            <button
              key={f.id}
              className={`group-btn ${activeSubFilter === f.id ? "active" : ""}`}
              onClick={() => setActiveSubFilter(f.id)}
            >
              <div style={{
                width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                background: activeSubFilter === f.id ? "var(--orange)" : "var(--bg-5)",
              }} />
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main feed */}
      <div className="comm-main">
        {/* Top Projects Banner */}
        <div style={{ marginBottom: 20 }}>
          <TopProjectsBanner />
        </div>

        {/* Filters */}
        <div className="comm-filters">
          {FILTERS.map((f) => (
            <button
              key={f}
              className={`f-btn ${activeFilter === f ? "active" : ""}`}
              onClick={() => setActiveFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Post composer trigger */}
        <div className="post-composer" onClick={() => setShowComposer(true)}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "linear-gradient(135deg, var(--blue), var(--indigo))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0,
          }}>
            {user?.email?.[0]?.toUpperCase() || "U"}
          </div>
          <div style={{ flex: 1, fontSize: 13, color: "var(--text-quaternary)" }}>
            Compartilhe algo com a comunidade...
          </div>
          <button className="gl sm orange" onClick={(e) => { e.stopPropagation(); setShowComposer(true); }}>
            Postar
          </button>
        </div>

        {/* Posts */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Loader2 size={20} style={{ animation: "gl-spin .7s linear infinite", color: "var(--text-tertiary)" }} />
          </div>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)", fontSize: 13 }}>
            Nenhum post encontrado. Seja o primeiro a publicar!
          </div>
        ) : (
          posts.map((post) => {
            const isLiked = likedPosts.has(post.id);
            const typeInfo = POST_TYPE_MAP[post.post_type];
            return (
              <div key={post.id} className="post-card">
                <div className="post-header">
                  <div className="post-av" style={{ color: "var(--text-secondary)" }}>
                    {getInitial(post)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span className="post-user">{post.profile?.username || "Usuário"}</span>
                      <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                        @{post.profile?.username || "user"}
                      </span>
                      {typeInfo && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: "1px 7px",
                          borderRadius: 9999, background: `color-mix(in srgb, ${typeInfo.color} 15%, transparent)`,
                          color: typeInfo.color, letterSpacing: ".03em",
                        }}>
                          {typeInfo.label}
                        </span>
                      )}
                    </div>
                    <div className="post-date">{getTimeAgo(post.created_at)}</div>
                  </div>
                  <button className="gl ico xs ghost" style={{ opacity: 0.4 }}>
                    <MoreHorizontal size={12} />
                  </button>
                </div>

                {post.title && <div className="post-title">{post.title}</div>}
                {post.content && (
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65, marginBottom: 8 }}>
                    {post.content.slice(0, 400)}
                    {post.content.length > 400 && "..."}
                  </div>
                )}

                <div className="post-footer">
                  <span
                    className={`post-action ${isLiked ? "liked" : ""}`}
                    onClick={() => toggleLike(post.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <Heart size={13} fill={isLiked ? "currentColor" : "none"} /> {post.likes_count}
                  </span>
                  <span className="post-action">
                    <MessageCircle size={13} /> {post.comments_count}
                  </span>
                  <span className="post-action">
                    <Share2 size={12} />
                  </span>
                  <span className="post-action">
                    <Bookmark size={12} />
                  </span>
                  <span style={{
                    marginLeft: "auto", fontSize: 11, color: "var(--text-quaternary)",
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
                    <Eye size={12} /> {post.views_count}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Post Modal */}
      {showComposer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
          onClick={() => setShowComposer(false)}
        >
          <div
            className="rd-card w-full max-w-lg"
            onClick={e => e.stopPropagation()}
            style={{ padding: 24 }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <p style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>Novo Post</p>
              <button onClick={() => setShowComposer(false)} className="gl ico xs ghost"><X size={14} /></button>
            </div>

            {/* Post type selector */}
            <div style={{ marginBottom: 14 }}>
              <label className="sec-label" style={{ display: "block", marginBottom: 8 }}>TIPO</label>
              <div style={{ display: "flex", gap: 6 }}>
                {SUB_FILTERS.filter(f => f.id !== "all").map(f => (
                  <button
                    key={f.id}
                    className={`f-btn ${compType === f.id ? "active" : ""}`}
                    onClick={() => setCompType(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label className="sec-label" style={{ display: "block", marginBottom: 6 }}>TÍTULO *</label>
              <input
                value={compTitle}
                onChange={e => setCompTitle(e.target.value)}
                placeholder="Título do seu post"
                maxLength={120}
                style={{
                  width: "100%", height: 38, padding: "0 12px", borderRadius: "var(--r2)",
                  background: "var(--bg-3)", border: "1px solid var(--b1)",
                  color: "var(--text-primary)", fontSize: 13, fontFamily: "var(--font)",
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="sec-label" style={{ display: "block", marginBottom: 6 }}>CONTEÚDO</label>
              <textarea
                value={compContent}
                onChange={e => setCompContent(e.target.value)}
                placeholder="Compartilhe detalhes, dúvidas ou dicas..."
                rows={5}
                maxLength={2000}
                style={{
                  width: "100%", padding: 12, borderRadius: "var(--r2)",
                  background: "var(--bg-3)", border: "1px solid var(--b1)",
                  color: "var(--text-primary)", fontSize: 13, resize: "none",
                  fontFamily: "var(--font)", lineHeight: 1.6,
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setShowComposer(false)} className="gl sm ghost">CANCELAR</button>
              <button
                onClick={handlePost}
                disabled={posting || !compTitle.trim()}
                className="gl sm orange"
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                {posting ? <Loader2 size={13} style={{ animation: "gl-spin .7s linear infinite" }} /> : <Send size={12} />}
                PUBLICAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
