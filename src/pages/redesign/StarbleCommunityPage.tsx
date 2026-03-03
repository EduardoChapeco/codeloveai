import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Heart, MessageCircle, Eye, Plus, Rss, TestTube,
  Folder, HelpCircle, Lightbulb, Loader2,
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

export default function StarbleCommunityPage() {
  const { user } = useAuth();
  const [activeGroup, setActiveGroup] = useState("feed");
  const [activeFilter, setActiveFilter] = useState("Todos");
  const [activeSubFilter, setActiveSubFilter] = useState("all");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPosts = async () => {
      setLoading(true);
      let query = supabase
        .from("community_posts")
        .select("id, user_id, title, content, likes_count, comments_count, views_count, created_at, post_type")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(20);

      if (activeSubFilter !== "all") {
        query = query.eq("post_type", activeSubFilter);
      }

      const { data } = await query;
      
      // Load profiles
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(p => p.user_id))];
        const { data: profiles } = await supabase
          .from("community_profiles")
          .select("user_id, username, avatar_url")
          .in("user_id", userIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
        const postsWithProfiles = data.map(p => ({
          ...p,
          profile: profileMap.get(p.user_id) as any,
        }));
        setPosts(postsWithProfiles);
      } else {
        setPosts([]);
      }
      setLoading(false);
    };
    loadPosts();
  }, [activeSubFilter]);

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

  return (
    <div style={{ display: "flex", flexDirection: "row", height: "100%" }}>
      {/* Community Sidebar */}
      <div className="comm-sidebar">
        <div className="cs-header">
          <span className="cs-label">Grupos</span>
          <button className="gl ico xs"><Plus size={10} /></button>
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

        {/* Post composer */}
        <div className="post-composer">
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
          <button className="gl sm orange">Postar</button>
        </div>

        {/* Posts */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Loader2 size={20} style={{ animation: "gl-spin .7s linear infinite", color: "var(--text-tertiary)" }} />
          </div>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)", fontSize: 13 }}>
            Nenhum post encontrado.
          </div>
        ) : (
          posts.map((post) => (
            <div key={post.id} className="post-card">
              <div className="post-header">
                <div className="post-av" style={{ color: "var(--text-secondary)" }}>
                  {getInitial(post)}
                </div>
                <div style={{ flex: 1 }}>
                  <div>
                    <span className="post-user">{post.profile?.username || "Usuário"}</span>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginLeft: 5 }}>
                      @{post.profile?.username || "user"}
                    </span>
                  </div>
                  <div className="post-date">{getTimeAgo(post.created_at)}</div>
                </div>
              </div>

              {post.title && <div className="post-title">{post.title}</div>}
              {post.content && (
                <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65, marginBottom: 8 }}>
                  {post.content.slice(0, 300)}
                  {post.content.length > 300 && "..."}
                </div>
              )}

              <div className="post-footer">
                <span className={`post-action ${post.liked ? "liked" : ""}`}>
                  <Heart size={13} /> {post.likes_count}
                </span>
                <span className="post-action">
                  <MessageCircle size={13} /> {post.comments_count}
                </span>
                <span style={{
                  marginLeft: "auto", fontSize: 11, color: "var(--text-quaternary)",
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                  <Eye size={12} /> {post.views_count}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
