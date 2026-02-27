import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Eye, Flame, Star, ExternalLink } from "lucide-react";

/* ── Banner gradient templates (auto-assigned by hash) ── */
const BANNER_TEMPLATES = [
  { bg: "linear-gradient(135deg, hsl(211 80% 12%), hsl(263 60% 16%))", accent: "hsl(211 100% 60%)" },
  { bg: "linear-gradient(135deg, hsl(340 70% 14%), hsl(290 50% 18%))", accent: "hsl(340 80% 60%)" },
  { bg: "linear-gradient(135deg, hsl(160 60% 10%), hsl(200 70% 16%))", accent: "hsl(160 70% 50%)" },
  { bg: "linear-gradient(135deg, hsl(30 80% 14%), hsl(350 60% 16%))", accent: "hsl(30 90% 60%)" },
  { bg: "linear-gradient(135deg, hsl(250 70% 14%), hsl(200 60% 18%))", accent: "hsl(250 80% 65%)" },
  { bg: "linear-gradient(135deg, hsl(180 60% 10%), hsl(140 50% 14%))", accent: "hsl(180 70% 50%)" },
  { bg: "linear-gradient(135deg, hsl(0 0% 8%), hsl(240 10% 14%))", accent: "hsl(211 100% 60%)" },
  { bg: "linear-gradient(135deg, hsl(270 60% 12%), hsl(320 50% 16%))", accent: "hsl(270 70% 65%)" },
];

function hashIndex(id: string, len: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return Math.abs(h) % len;
}

interface TopProject {
  id: string;
  title: string;
  preview_url: string;
  project_name: string | null;
  feedbacks_count: number;
  reactions_count: number;
  user_id: string;
  created_at: string;
  profile_name?: string;
}

export default function TopProjectsBanner() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<TopProject[]>([]);
  const [current, setCurrent] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    (async () => {
      // Fetch top sessions by engagement (feedbacks + reactions), exclude those for sale (marketplace)
      const { data } = await supabase
        .from("community_test_sessions")
        .select("id, title, preview_url, project_name, feedbacks_count, reactions_count, user_id, created_at")
        .eq("status", "active")
        .order("reactions_count", { ascending: false })
        .limit(20);

      if (!data || data.length === 0) return;

      // Score and rank — only top projects
      const scored = data
        .map(d => ({ ...d, score: (d.feedbacks_count || 0) * 2 + (d.reactions_count || 0) }))
        .filter(d => d.score >= 1) // at least some engagement
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);

      if (scored.length === 0) return;

      // Fetch profiles
      const uids = [...new Set(scored.map(s => s.user_id))];
      const { data: profs } = await supabase.from("profiles").select("user_id, name").in("user_id", uids);
      const profMap: Record<string, string> = {};
      profs?.forEach((p: any) => { profMap[p.user_id] = p.name || "Anônimo"; });

      setProjects(scored.map(s => ({ ...s, profile_name: profMap[s.user_id] })));
    })();
  }, []);

  // Auto-advance
  useEffect(() => {
    if (projects.length <= 1) return;
    autoRef.current = setInterval(() => {
      setCurrent(p => (p + 1) % projects.length);
    }, 5000);
    return () => clearInterval(autoRef.current);
  }, [projects.length]);

  const goTo = useCallback((idx: number) => {
    setCurrent(idx);
    clearInterval(autoRef.current);
    autoRef.current = setInterval(() => {
      setCurrent(p => (p + 1) % projects.length);
    }, 5000);
  }, [projects.length]);

  if (projects.length === 0) return null;

  const proj = projects[current];
  const tpl = BANNER_TEMPLATES[hashIndex(proj.id, BANNER_TEMPLATES.length)];

  return (
    <div className="relative overflow-hidden rounded-2xl" style={{ minHeight: 200 }}>
      {/* Background gradient */}
      <div className="absolute inset-0 transition-all duration-700" style={{ background: tpl.bg }} />

      {/* Decorative mesh circles */}
      <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full opacity-10 blur-3xl"
        style={{ background: tpl.accent }} />
      <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full opacity-8 blur-3xl"
        style={{ background: tpl.accent }} />

      {/* Content */}
      <div className="relative z-10 flex flex-col md:flex-row items-stretch gap-4 p-5 md:p-6">
        {/* Info */}
        <div className="flex-1 flex flex-col justify-center min-w-0 gap-3">
          <div className="flex items-center gap-2">
            <Star className="h-3.5 w-3.5" style={{ color: tpl.accent }} />
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/50">Projeto em destaque</span>
          </div>
          <h3 className="text-lg md:text-xl font-black text-white truncate">{proj.title}</h3>
          {proj.project_name && (
            <p className="text-xs text-white/50 truncate">{proj.project_name}</p>
          )}
          <div className="flex items-center gap-4 mt-1">
            <span className="text-[10px] text-white/40 flex items-center gap-1">
              <Flame className="h-3 w-3" style={{ color: tpl.accent }} /> {proj.reactions_count} reações
            </span>
            <span className="text-[10px] text-white/40 flex items-center gap-1">
              <Eye className="h-3 w-3" /> {proj.feedbacks_count} feedbacks
            </span>
            <span className="text-[10px] text-white/30">{proj.profile_name}</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => navigate(`/community/test/${proj.id}`)}
              className="h-9 px-5 rounded-xl text-xs font-bold text-white flex items-center gap-2 transition-all hover:scale-[1.03] active:scale-95"
              style={{ background: tpl.accent, boxShadow: `0 4px 20px ${tpl.accent}40` }}
            >
              <Eye className="h-3.5 w-3.5" /> Testar & Opinar
            </button>
            <a
              href={proj.preview_url}
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 w-9 rounded-xl flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* Preview thumbnail */}
        <div className="relative w-full md:w-[280px] lg:w-[340px] h-[160px] md:h-auto rounded-xl overflow-hidden shrink-0 border border-white/10">
          <iframe
            src={proj.preview_url}
            className="w-[200%] h-[200%] origin-top-left scale-50 pointer-events-none border-0"
            title={proj.title}
            tabIndex={-1}
            sandbox="allow-scripts allow-same-origin"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
          <div className="absolute top-2 right-2">
            <span className="text-[8px] font-bold bg-green-500/30 text-green-300 px-2 py-0.5 rounded-full flex items-center gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" /> AO VIVO
            </span>
          </div>
        </div>
      </div>

      {/* Dots navigation */}
      {projects.length > 1 && (
        <div className="relative z-10 flex items-center justify-center gap-1.5 pb-4">
          {projects.length > 3 && current > 0 && (
            <button onClick={() => goTo((current - 1 + projects.length) % projects.length)}
              className="h-6 w-6 rounded-full flex items-center justify-center text-white/40 hover:text-white/80 transition-colors">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          )}
          {projects.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === current ? "w-6 bg-white/80" : "w-1.5 bg-white/20 hover:bg-white/40"
              }`}
            />
          ))}
          {projects.length > 3 && current < projects.length - 1 && (
            <button onClick={() => goTo((current + 1) % projects.length)}
              className="h-6 w-6 rounded-full flex items-center justify-center text-white/40 hover:text-white/80 transition-colors">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
