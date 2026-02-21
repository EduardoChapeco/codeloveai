import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { useSEO } from "@/hooks/useSEO";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Heart, MessageCircle, Share2, Hash, TrendingUp,
  Image as ImageIcon, Link as LinkIcon, Folder, HelpCircle,
  Lightbulb, Eye, LogOut, Users, Loader2, Send, X,
  ChevronLeft, ChevronRight, Play, Gift, Copy, FileText,
  Code, Layout, Square, RectangleHorizontal, Columns, Check,
  MoreHorizontal, Pencil, Archive, Trash2, Lock, Search,
  EyeOff, Maximize2, Volume2, VolumeX
} from "lucide-react";
import AppLayout from "@/components/AppLayout";

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
  prompt_text: string;
  copy_count: number;
  likes_count: number;
  comments_count: number;
  views_count: number;
  is_pinned: boolean;
  is_archived: boolean;
  is_blurred: boolean;
  rewarded: boolean;
  created_at: string;
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

const MEDIA_TEMPLATES = [
  { id: "threads", label: "THREADS", icon: Columns, desc: "Carrossel horizontal" },
  { id: "presentation", label: "APRESENTAÇÃO", icon: Layout, desc: "Slide fullwidth" },
  { id: "card-9-16", label: "9:16", icon: Square, desc: "Card vertical" },
  { id: "card-16-9", label: "16:9", icon: RectangleHorizontal, desc: "Card horizontal" },
];

/* ─── Fullscreen Media Viewer ─── */
function FullscreenMediaViewer({ urls, initialIndex, onClose }: { urls: string[]; initialIndex: number; onClose: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const total = urls.length;
  const url = urls[currentIndex];
  const isVideoFile = /\.(mp4|webm|mov)$/i.test(url);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setCurrentIndex(p => (p - 1 + total) % total);
      if (e.key === "ArrowRight") setCurrentIndex(p => (p + 1) % total);
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", handleKey); document.body.style.overflow = ""; };
  }, [total, onClose]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
      if (isPlaying) videoRef.current.play().catch(() => {});
    }
  }, [currentIndex, isPlaying, isMuted]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center" onClick={onClose}>
      <div className="relative w-full h-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 z-10 h-10 w-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-white hover:bg-white/20 transition-colors">
          <X className="h-5 w-5" />
        </button>
        {total > 1 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-white/10 backdrop-blur rounded-full px-4 py-1.5">
            <span className="text-sm font-bold text-white">{currentIndex + 1} / {total}</span>
          </div>
        )}
        {total > 1 && (
          <>
            <button onClick={() => setCurrentIndex(p => (p - 1 + total) % total)} className="absolute left-4 top-1/2 -translate-y-1/2 z-10 h-12 w-12 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-white hover:bg-white/20 transition-colors">
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button onClick={() => setCurrentIndex(p => (p + 1) % total)} className="absolute right-4 top-1/2 -translate-y-1/2 z-10 h-12 w-12 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-white hover:bg-white/20 transition-colors">
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
        {isVideoFile ? (
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <video ref={videoRef} src={url} autoPlay loop playsInline muted={isMuted}
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
              onClick={() => { if (videoRef.current) { if (videoRef.current.paused) { videoRef.current.play(); setIsPlaying(true); } else { videoRef.current.pause(); setIsPlaying(false); } } }} />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              <button onClick={() => setIsMuted(!isMuted)} className="h-10 w-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-white hover:bg-white/20">
                {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
            </div>
            {!isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="h-16 w-16 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                  <Play className="h-8 w-8 text-white ml-1" />
                </div>
              </div>
            )}
          </div>
        ) : (
          <img src={url} alt="" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" />
        )}
      </div>
    </div>
  );
}

/* ─── Media display by template ─── */
function MediaCarousel({ urls, template = "threads", isBlurred = false, onOpenFullscreen }: { urls: string[]; template?: string; isBlurred?: boolean; onOpenFullscreen?: (index: number) => void }) {
  const [unmuted, setUnmuted] = useState<Set<number>>(new Set());
  const [playing, setPlaying] = useState<Set<number>>(new Set());
  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());
  const total = urls.length;

  useEffect(() => {
    const firstVideo = videoRefs.current.get(0);
    if (firstVideo) { firstVideo.muted = true; firstVideo.play().catch(() => {}); setPlaying(new Set([0])); }
  }, []);

  if (total === 0) return null;
  const isVideo = (url: string) => /\.(mp4|webm|mov)$/i.test(url);

  const toggleAudio = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    const video = videoRefs.current.get(idx);
    if (!video) return;
    setUnmuted(prev => {
      const next = new Set(prev);
      if (next.has(idx)) { next.delete(idx); video.muted = true; }
      else { next.add(idx); video.muted = false; }
      return next;
    });
  };

  const togglePlayPause = (idx: number) => {
    const video = videoRefs.current.get(idx);
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setPlaying(prev => { const n = new Set(prev); n.add(idx); return n; });
    } else {
      video.pause();
      setPlaying(prev => { const n = new Set(prev); n.delete(idx); return n; });
    }
  };

  const renderMedia = (url: string, idx: number, className: string) => {
    const hasAudio = isVideo(url);
    const isMuted = !unmuted.has(idx);
    const isPlaying = playing.has(idx);
    return (
      <div key={idx} className={`relative overflow-hidden bg-muted cursor-pointer group ${className}`}
        onClick={() => hasAudio ? togglePlayPause(idx) : onOpenFullscreen?.(idx)}>
        {hasAudio ? (
          <video ref={el => { if (el) videoRefs.current.set(idx, el); }} src={url} muted={isMuted} autoPlay={idx === 0} loop playsInline
            className={`w-full h-full object-cover ${isBlurred ? "blur-xl" : ""}`} />
        ) : (
          <img src={url} alt="" className={`w-full h-full object-cover ${isBlurred ? "blur-xl" : ""}`} />
        )}
        {/* Blur overlay label */}
        {isBlurred && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="bg-background/80 backdrop-blur rounded-[12px] px-4 py-2 flex items-center gap-2">
              <EyeOff className="h-4 w-4 text-foreground" />
              <span className="text-xs font-bold text-foreground">CONTEÚDO SENSÍVEL</span>
            </div>
          </div>
        )}
        {/* Fullscreen button */}
        <button onClick={(e) => { e.stopPropagation(); onOpenFullscreen?.(idx); }}
          className="absolute top-2 right-2 h-8 w-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center z-10 hover:bg-background/95 transition-colors opacity-0 group-hover:opacity-100"
          title="Tela cheia">
          <Maximize2 className="h-3.5 w-3.5 text-foreground" />
        </button>
        {/* Audio toggle icon */}
        {hasAudio && (
          <button onClick={(e) => toggleAudio(e, idx)}
            className="absolute top-2 left-2 h-8 w-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center z-10 hover:bg-background/95 transition-colors"
            title={isMuted ? "Ativar áudio" : "Desativar áudio"}>
            {isMuted ? (
              <VolumeX className="h-3.5 w-3.5 text-foreground" />
            ) : (
              <Volume2 className="h-3.5 w-3.5 text-foreground" />
            )}
          </button>
        )}
        {/* Play/pause overlay for videos */}
        {hasAudio && !isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
            <div className="h-12 w-12 rounded-full bg-background/90 backdrop-blur flex items-center justify-center">
              <Play className="h-5 w-5 text-foreground ml-0.5" />
            </div>
          </div>
        )}
      </div>
    );
  };

  // Presentation: fullwidth slideshow with arrows
  if (template === "presentation") {
    return (
      <div className="relative mb-4 rounded-[14px] overflow-hidden border border-border">
        {renderMedia(urls[currentSlide], currentSlide, "w-full aspect-video")}
        {total > 1 && (
          <>
            <button onClick={(e) => { e.stopPropagation(); setCurrentSlide(p => (p - 1 + total) % total); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center">
              <ChevronLeft className="h-4 w-4 text-foreground" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); setCurrentSlide(p => (p + 1) % total); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center">
              <ChevronRight className="h-4 w-4 text-foreground" />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {urls.map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all ${i === currentSlide ? "w-4 bg-foreground" : "w-1.5 bg-foreground/40"}`} />
              ))}
            </div>
          </>
        )}
        <div className="absolute top-2 right-2 bg-background/70 backdrop-blur rounded-[8px] px-2 py-0.5">
          <span className="text-[9px] font-bold text-foreground">{currentSlide + 1}/{total}</span>
        </div>
      </div>
    );
  }

  // Card 9:16 vertical
  if (template === "card-9-16") {
    return (
      <div className="mb-4">
        <div ref={scrollRef} className="flex gap-2 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-2" style={{ scrollbarWidth: "none" }}>
          {urls.map((url, i) => (
            <div key={i} className="relative shrink-0 snap-center rounded-[14px] overflow-hidden border border-border" style={{ width: "180px", height: "320px" }}>
              {renderMedia(url, i, "w-full h-full")}
              <div className="absolute top-2 right-2 bg-background/70 backdrop-blur rounded-[8px] px-2 py-0.5">
                <span className="text-[9px] font-bold text-foreground">{i + 1}/{total}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Card 16:9 horizontal
  if (template === "card-16-9") {
    return (
      <div className="mb-4">
        <div ref={scrollRef} className="flex gap-2 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-2" style={{ scrollbarWidth: "none" }}>
          {urls.map((url, i) => (
            <div key={i} className="relative shrink-0 snap-center rounded-[14px] overflow-hidden border border-border" style={{ width: "320px", height: "180px" }}>
              {renderMedia(url, i, "w-full h-full")}
              <div className="absolute top-2 right-2 bg-background/70 backdrop-blur rounded-[8px] px-2 py-0.5">
                <span className="text-[9px] font-bold text-foreground">{i + 1}/{total}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default: Threads carousel
  if (total === 1) {
    const url = urls[0];
    return (
      <div className="mb-4 rounded-[14px] overflow-hidden border border-border">
        {renderMedia(url, 0, "w-full max-h-[420px]")}
      </div>
    );
  }

  return (
    <div className="mb-4">
      <div ref={scrollRef} className="flex gap-2 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-2" style={{ scrollbarWidth: "none" }}>
        {urls.map((url, i) => (
          <div key={i} className="relative shrink-0 snap-center rounded-[14px] overflow-hidden border border-border"
            style={{ width: total === 2 ? "calc(50% - 4px)" : "200px", height: "260px" }}>
            {renderMedia(url, i, "w-full h-full")}
            <div className="absolute top-2 right-2 bg-background/70 backdrop-blur rounded-[8px] px-2 py-0.5">
              <span className="text-[9px] font-bold text-foreground">{i + 1}/{total}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Prompt/CMD Block with Copy ─── */
function PromptBlock({ text, postId, userId, copyCount: initialCopyCount }: { text: string; postId: string; userId?: string; copyCount: number }) {
  const [copied, setCopied] = useState(false);
  const [copyCount, setCopyCount] = useState(initialCopyCount);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setCopyCount(prev => prev + 1);
    setTimeout(() => setCopied(false), 2000);

    // Track copy
    if (userId) {
      try {
        await supabase.from("post_copies").insert({ post_id: postId, user_id: userId });
        // Increment counter (best effort)
        await supabase.from("community_posts").update({ copy_count: copyCount + 1 }).eq("id", postId);
      } catch { /* ignore */ }
    }
  };

  return (
    <div className="mb-3 rounded-[14px] overflow-hidden border border-border bg-muted/50">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Code className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[9px] font-bold text-muted-foreground tracking-widest">PROMPT</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-muted-foreground font-medium">{copyCount} {copyCount === 1 ? "cópia" : "cópias"}</span>
          <button onClick={handleCopy}
            className={`flex items-center gap-1.5 h-7 px-3 rounded-[8px] text-[9px] font-bold transition-all ${
              copied ? "bg-green-500/20 text-green-500" : "bg-foreground/10 text-foreground hover:bg-foreground/20"
            }`}>
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "COPIADO" : "COPIAR"}
          </button>
        </div>
      </div>
      <pre className="px-4 py-3 text-sm text-foreground font-mono whitespace-pre-wrap break-words leading-relaxed max-h-[300px] overflow-y-auto">
        {text}
      </pre>
    </div>
  );
}

/* ─── Static Project Preview with iframe ─── */
function StaticProjectPreview({ url, name }: { url: string; name?: string }) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  let hostname = url;
  try { hostname = new URL(url).hostname; } catch {}
  const isLovable = (() => { try { return new URL(url).hostname.endsWith(".lovable.app"); } catch { return false; } })();

  return (
    <div className="block group mb-3">
      <div className="rounded-[14px] overflow-hidden border border-border hover:border-foreground/30 transition-colors">
        <div className="relative bg-muted" style={{ height: isLovable ? "280px" : "200px" }}>
          {isLovable ? (
            <>
              {!iframeLoaded && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
              <iframe
                src={url}
                title={name || "Preview"}
                className="w-full h-full border-0 pointer-events-none"
                style={{ transform: "scale(0.5)", transformOrigin: "top left", width: "200%", height: "200%" }}
                sandbox="allow-scripts allow-same-origin"
                onLoad={() => setIframeLoaded(true)}
                loading="lazy"
              />
              {/* Protection overlay — click opens in new tab */}
              <a href={url} target="_blank" rel="noopener noreferrer"
                className="absolute inset-0 z-20 bg-transparent hover:bg-black/5 transition-colors flex items-end justify-center pb-3">
                <span className="bg-background/90 backdrop-blur rounded-full px-3 py-1.5 text-[9px] font-bold text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                  ABRIR PROJETO ↗
                </span>
              </a>
            </>
          ) : (
            <a href={url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center h-full gap-3">
              <div className="h-16 w-16 rounded-[18px] bg-foreground/10 flex items-center justify-center">
                <LinkIcon className="h-8 w-8 text-foreground/60" />
              </div>
              <p className="text-xs text-muted-foreground font-medium">Abrir link externo</p>
            </a>
          )}
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="bg-muted/50 px-4 py-2.5 flex items-center justify-between border-t border-border block">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-5 w-5 rounded-[6px] bg-foreground/10 flex items-center justify-center shrink-0">
              <Eye className="h-3 w-3 text-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground truncate">{name || "Preview"}</p>
              <p className="text-[10px] text-muted-foreground truncate">{hostname}</p>
            </div>
          </div>
          <span className="text-[9px] font-bold text-muted-foreground group-hover:text-foreground transition-colors shrink-0 ml-2">
            ABRIR ↗
          </span>
        </a>
      </div>
    </div>
  );
}


/* ─── Link Preview Card ─── */
function LinkPreviewCard({ post }: { post: Post }) {
  if (!post.link_preview_title && !post.link_preview_image) return null;
  let hostname = post.project_url;
  try { hostname = new URL(post.project_url).hostname; } catch {}
  return (
    <a href={post.project_url} target="_blank" rel="noopener noreferrer"
      className="block rounded-[14px] overflow-hidden border border-border hover:border-foreground/30 transition-colors group mb-3">
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
        <p className="text-[10px] text-muted-foreground/60 truncate">{hostname}</p>
      </div>
    </a>
  );
}

/* ─── Post Composer ─── */
function PostComposer({
  user,
  profile,
  onSubmit,
  posting,
}: {
  user: any;
  profile: { display_name: string; username: string; avatar_url: string };
  onSubmit: (data: { title: string; content: string; type: string; projectUrl: string; hashtags: string; files: File[]; promptText: string; mediaTemplate: string; isBlurred: boolean }) => void;
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
  const [promptText, setPromptText] = useState("");
  const [mediaTemplate, setMediaTemplate] = useState("threads");
  const [isBlurred, setIsBlurred] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []).slice(0, 10);
    setFiles(prev => [...prev, ...selected]);
    selected.forEach(f => {
      if (f.type.startsWith("image/") || f.type.startsWith("video/")) {
        const reader = new FileReader();
        reader.onload = () => setPreviews(prev => [...prev, reader.result as string]);
        reader.readAsDataURL(f);
      } else {
        // Document file — show icon placeholder
        setPreviews(prev => [...prev, `doc:${f.name}`]);
      }
    });
  };

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = () => {
    if (posting) return;
    onSubmit({ title, content, type, projectUrl, hashtags, files, promptText, mediaTemplate, isBlurred });
    setContent(""); setTitle(""); setType("post"); setProjectUrl(""); setHashtags("");
    setFiles([]); setPreviews([]); setPromptText(""); setMediaTemplate("threads"); setIsBlurred(false); setExpanded(false);
  };

  useEffect(() => {
    if (textRef.current) { textRef.current.style.height = "auto"; textRef.current.style.height = textRef.current.scrollHeight + "px"; }
  }, [content]);

  return (
    <div className="space-y-2">
      {/* Reward + Spam Warning Badge */}
      <div className="ep-card-sm bg-muted/30 flex items-start gap-3 py-3 px-4">
        <Gift className="h-4 w-4 text-foreground shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-[10px] font-bold text-foreground tracking-widest">+1H DE TOKEN POR POST</p>
          <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
            Cada publicação adiciona 1 hora ao seu plano (máx. 5/dia). Posts sem conteúdo real (spam, em branco, duplicados) podem resultar em <strong className="text-foreground">suspensão ou banimento</strong>. Identificamos seu dispositivo.
          </p>
        </div>
      </div>

      <div className="ep-card border-border/50">
        <div className="flex gap-3">
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

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-bold text-foreground">{profile.display_name}</span>
              {profile.username && <span className="text-xs text-muted-foreground">@{profile.username}</span>}
            </div>

            <textarea
              ref={textRef} value={content} onChange={e => setContent(e.target.value)}
              onFocus={() => setExpanded(true)} placeholder="O que está construindo?"
              rows={1} className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 resize-none focus:outline-none font-medium leading-relaxed"
            />

            {expanded && (
              <div className="mt-3 space-y-3 animate-fade-in">
                {/* Type pills */}
                <div className="flex gap-1.5 flex-wrap">
                  {[["post", "Post"], ["project", "Projeto"], ["question", "Dúvida"], ["tip", "Dica"], ["showcase", "Showcase"]].map(([id, label]) => (
                    <button key={id} onClick={() => setType(id)}
                      className={`h-7 px-3 rounded-[8px] text-[9px] font-bold tracking-wider transition-all ${
                        type === id ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}>
                      {label.toUpperCase()}
                    </button>
                  ))}
                </div>

                {/* Title */}
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título (opcional)"
                  className="w-full bg-muted/50 border border-border/50 rounded-[10px] px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/20" />

                {/* Project URL */}
                {(type === "project" || type === "showcase") && (
                  <div className="flex items-center gap-2 bg-muted/50 border border-border/50 rounded-[10px] px-4 py-2">
                    <LinkIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <input value={projectUrl} onChange={e => setProjectUrl(e.target.value)}
                      placeholder="URL do projeto (ex: meuapp.lovable.app)"
                      className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none" />
                  </div>
                )}

                {/* Prompt/CMD field */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Code className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[9px] font-bold text-muted-foreground tracking-widest">PROMPT / CÓDIGO (OPCIONAL)</span>
                  </div>
                  <textarea value={promptText} onChange={e => setPromptText(e.target.value)}
                    placeholder="Cole seu prompt, código ou comando aqui..."
                    rows={3}
                    className="w-full bg-muted/50 border border-border/50 rounded-[10px] px-4 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/20 resize-none" />
                </div>

                {/* Hashtags */}
                <div className="flex items-center gap-2 bg-muted/50 border border-border/50 rounded-[10px] px-4 py-2">
                  <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <input value={hashtags} onChange={e => setHashtags(e.target.value)} placeholder="react, lovable, dica"
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none" />
                </div>

                {/* Media template selector */}
                {(files.length > 0 || previews.length > 0) && (
                  <div className="space-y-1.5">
                    <span className="text-[9px] font-bold text-muted-foreground tracking-widest">ESTILO DE MÍDIA</span>
                    <div className="flex gap-1.5 flex-wrap">
                      {MEDIA_TEMPLATES.map(t => (
                        <button key={t.id} onClick={() => setMediaTemplate(t.id)}
                          className={`flex items-center gap-1.5 h-7 px-3 rounded-[8px] text-[9px] font-bold tracking-wider transition-all ${
                            mediaTemplate === t.id ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                          }`}>
                          <t.icon className="h-3 w-3" /> {t.label}
                        </button>
                      ))}
                    </div>
                    {/* Blur toggle */}
                    <button onClick={() => setIsBlurred(!isBlurred)}
                      className={`flex items-center gap-1.5 h-7 px-3 rounded-[8px] text-[9px] font-bold tracking-wider transition-all ${
                        isBlurred ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}>
                      <EyeOff className="h-3 w-3" /> {isBlurred ? "BLUR ATIVO" : "ATIVAR BLUR"}
                    </button>
                  </div>
                )}

                {/* Media preview */}
                {previews.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {previews.map((src, i) => (
                      <div key={i} className="relative h-24 w-24 rounded-[12px] overflow-hidden border border-border shrink-0 group">
                        {src.startsWith("doc:") ? (
                          <div className="h-full w-full bg-muted flex flex-col items-center justify-center gap-1">
                            <FileText className="h-6 w-6 text-muted-foreground" />
                            <span className="text-[8px] text-muted-foreground font-bold truncate max-w-[70px]">{src.replace("doc:", "")}</span>
                          </div>
                        ) : files[i]?.type.startsWith("video/") ? (
                          <video src={src} className="h-full w-full object-cover" muted />
                        ) : (
                          <img src={src} alt="" className="h-full w-full object-cover" />
                        )}
                        <button onClick={() => removeFile(i)}
                          className="absolute top-1 right-1 h-5 w-5 rounded-[6px] bg-background/80 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
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
                      <input type="file" multiple accept="image/*,video/*,.gif,.doc,.docx,.txt,.ppt,.pptx,.xls,.xlsx,.pdf" className="hidden" onChange={handleFileChange} />
                    </label>
                    {files.length > 0 && (
                      <span className="text-[10px] text-muted-foreground font-bold">{files.length} ARQUIVO(S)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setExpanded(false); setContent(""); setTitle(""); setFiles([]); setPreviews([]); setPromptText(""); }}
                      className="h-9 px-4 rounded-[10px] text-[9px] font-bold text-muted-foreground hover:text-foreground transition-colors">
                      CANCELAR
                    </button>
                    <button onClick={handleSubmit} disabled={posting || (!content.trim() && !title.trim() && !promptText.trim())}
                      className="ep-btn-primary h-9 px-5 text-[9px] disabled:opacity-40">
                      {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : "PUBLICAR"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── View Tracker Hook ─── */
function useViewTracker(userId: string | undefined) {
  const trackedRef = useRef<Set<string>>(new Set());
  const trackView = useCallback(async (postId: string) => {
    if (!userId || trackedRef.current.has(postId)) return;
    trackedRef.current.add(postId);
    try {
      await supabase.from("post_views").insert({ post_id: postId, user_id: userId });
      const { data: post } = await supabase.from("community_posts").select("views_count").eq("id", postId).single();
      if (post) await supabase.from("community_posts").update({ views_count: post.views_count + 1 }).eq("id", postId);
    } catch {}
  }, [userId]);
  return trackView;
}

/* ─── Post View Observer ─── */
function PostViewObserver({ postId, onView, children }: { postId: string; onView: (id: string) => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => { if (entry.isIntersecting) onView(postId); });
    }, { threshold: 0.5 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [postId, onView]);
  return <div ref={ref}>{children}</div>;
}

export default function Community() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  useSEO({ title: "Comunidade", description: "Comunidade CodeLove AI — compartilhe projetos, prompts e conecte-se com outros membros." });
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterType = searchParams.get("type") || "all";

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);
  const PAGE_SIZE = 20;
  const [hashtags, setHashtags] = useState<{ id: string; name: string; slug: string; posts_count: number }[]>([]);
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, { display_name: string; username: string; avatar_url: string }>>({});
  const postingRef = useRef(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const fetchingRef = useRef(false);

  // CRUD state
  const [editingPost, setEditingPost] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [postMenuOpen, setPostMenuOpen] = useState<string | null>(null);
  
  // Fullscreen media state
  const [fullscreenMedia, setFullscreenMedia] = useState<{ urls: string[]; index: number } | null>(null);

  // User search
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<{ user_id: string; display_name: string; username: string; avatar_url: string }[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) { setUserResults([]); return; }
    setSearchingUsers(true);
    const q = query.trim().toLowerCase();
    const { data } = await supabase.from("user_profiles").select("user_id, display_name, username, avatar_url")
      .or(`display_name.ilike.%${q}%,username.ilike.%${q}%`).limit(10);
    setUserResults(data || []);
    setSearchingUsers(false);
  }, []);

  const trackView = useViewTracker(user?.id);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login?returnTo=/community");
  }, [user, authLoading, navigate]);

  const userIdRef = useRef<string | undefined>(user?.id);
  userIdRef.current = user?.id;

  const fetchPosts = useCallback(async (reset = false) => {
    const currentUserId = userIdRef.current;
    if (!currentUserId) {
      setLoading(false);
      return;
    }
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    const page = reset ? 0 : pageRef.current;
    if (reset) {
      setLoading(true);
      setHasMore(true);
      pageRef.current = 0;
    } else {
      setLoadingMore(true);
    }

    try {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase.from("community_posts").select("*").eq("is_deleted", false).eq("is_archived", false)
        .order("is_pinned", { ascending: false }).order("created_at", { ascending: false }).range(from, to);
      if (filterType !== "all") query = query.eq("post_type", filterType);
      const { data, error } = await query;

      if (error) {
        console.error("Error fetching posts:", error);
        if (reset) setPosts([]);
        return;
      }

      const postsList = (data || []) as Post[];

      if (postsList.length < PAGE_SIZE) {
        setHasMore(false);
      }

      const userIds = [...new Set(postsList.map(p => p.user_id))];
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase.from("user_profiles").select("user_id, display_name, username, avatar_url").in("user_id", userIds);
        const profileMap: Record<string, any> = {};
        (profilesData || []).forEach(p => { profileMap[p.user_id] = p; });
        setProfiles(prev => ({ ...prev, ...profileMap }));
      }

      if (postsList.length > 0) {
        const postIds = postsList.map(p => p.id);
        const { data: likes } = await supabase.from("post_likes").select("post_id").eq("user_id", currentUserId).in("post_id", postIds);
        const likedSet = new Set((likes || []).map(l => l.post_id));
        postsList.forEach(p => (p as any).liked = likedSet.has(p.id));
      }

      if (reset) {
        setPosts(postsList);
      } else {
        setPosts(prev => {
          // Deduplicate by id
          const existingIds = new Set(prev.map(p => p.id));
          const newPosts = postsList.filter(p => !existingIds.has(p.id));
          return [...prev, ...newPosts];
        });
      }
      pageRef.current = page + 1;
    } catch (err) { console.error("Error fetching posts:", err); }
    finally {
      setLoading(false);
      setLoadingMore(false);
      fetchingRef.current = false;
    }
  }, [filterType]);

  // Reset on filter or user change — use stable user.id
  const userId = user?.id;
  useEffect(() => {
    if (userId) fetchPosts(true);
  }, [fetchPosts, userId]);

  // Stable refs for intersection observer
  const fetchPostsRef = useRef(fetchPosts);
  fetchPostsRef.current = fetchPosts;
  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;
  const loadingStateRef = useRef({ loading, loadingMore });
  loadingStateRef.current = { loading, loadingMore };

  // Infinite scroll observer — stable, no re-subscription
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      const { loading: l, loadingMore: lm } = loadingStateRef.current;
      if (entries[0].isIntersecting && hasMoreRef.current && !l && !lm && !fetchingRef.current) {
        fetchPostsRef.current(false);
      }
    }, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => { supabase.from("hashtags").select("*").order("posts_count", { ascending: false }).limit(20).then(({ data }) => setHashtags(data || [])); }, []);

  if (authLoading) return (<div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>);
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
    if (expandedComments === postId) { setExpandedComments(null); return; }
    setExpandedComments(postId);
    const { data } = await supabase.from("post_comments").select("*").eq("post_id", postId).eq("is_deleted", false).order("created_at", { ascending: true });
    const commentsList = data || [];
    const userIds = [...new Set(commentsList.map(c => c.user_id))];
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase.from("user_profiles").select("user_id, display_name, username, avatar_url").in("user_id", userIds);
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

  // ─── Post CRUD ───
  const startEditPost = (post: Post) => {
    setEditingPost(post.id);
    setEditTitle(post.title || "");
    setEditContent(post.content || "");
    setEditPrompt(post.prompt_text || "");
    setPostMenuOpen(null);
  };

  const cancelEditPost = () => {
    setEditingPost(null);
    setEditTitle("");
    setEditContent("");
    setEditPrompt("");
  };

  const saveEditPost = async (postId: string) => {
    if (!editContent.trim() && !editTitle.trim() && !editPrompt.trim()) return toast.error("Post não pode ficar vazio.");
    const { error } = await supabase.from("community_posts").update({
      title: editTitle.trim(),
      content: editContent.trim(),
      prompt_text: editPrompt.trim(),
    }).eq("id", postId);
    if (error) return toast.error("Erro ao editar: " + error.message);
    toast.success("Post atualizado!");
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, title: editTitle.trim(), content: editContent.trim(), prompt_text: editPrompt.trim() } : p));
    cancelEditPost();
  };

  const archivePost = async (post: Post) => {
    setPostMenuOpen(null);
    if (!confirm("Arquivar este post? Ele não aparecerá mais no feed.")) return;
    await supabase.from("community_posts").update({ is_archived: true }).eq("id", post.id);
    toast.success("Post arquivado!");
    setPosts(prev => prev.filter(p => p.id !== post.id));
  };

  const deletePost = async (post: Post) => {
    setPostMenuOpen(null);
    if (post.rewarded && !isAdmin) {
      toast.error("Este post gerou recompensa de token e não pode ser excluído.");
      return;
    }
    if (!confirm("Excluir este post permanentemente?")) return;
    await supabase.from("community_posts").update({ is_deleted: true }).eq("id", post.id);
    toast.success("Post excluído!");
    setPosts(prev => prev.filter(p => p.id !== post.id));
  };

  const deleteComment = async (commentId: string, postId: string) => {
    if (!confirm("Excluir este comentário?")) return;
    await supabase.from("post_comments").update({ is_deleted: true }).eq("id", commentId);
    const post = posts.find(p => p.id === postId);
    if (post) {
      await supabase.from("community_posts").update({ comments_count: Math.max(0, post.comments_count - 1) }).eq("id", postId);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: Math.max(0, p.comments_count - 1) } : p));
    }
    setComments(prev => prev.filter(c => c.id !== commentId));
    toast.success("Comentário excluído!");
  };

  const submitPost = async (data: { title: string; content: string; type: string; projectUrl: string; hashtags: string; files: File[]; promptText: string; mediaTemplate: string; isBlurred: boolean }) => {
    if (!user) return toast.error("Faça login para publicar.");
    if (!data.content.trim() && !data.title.trim() && !data.promptText.trim()) return toast.error("Escreva algo para publicar.");
    if (postingRef.current) return;
    postingRef.current = true;
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
          const { data: previewData } = await supabase.functions.invoke("link-preview", { body: { url: data.projectUrl.trim() } });
          if (previewData) linkPreview = previewData;
        } catch {}
      }

      // Determine post_type based on content
      let postType = data.type;
      if (data.promptText.trim() && !data.files.length && data.type === "post") {
        postType = "tip"; // Auto-categorize prompt-only posts as tips
      }

      const { data: postData, error: postError } = await supabase.from("community_posts").insert({
        user_id: user.id,
        post_type: postType,
        title: data.title.trim(),
        content: data.content.trim(),
        media_urls: mediaUrls,
        project_url: data.projectUrl.trim(),
        project_name: data.type === "project" ? data.title.trim() : "",
        link_preview_title: linkPreview.title,
        link_preview_description: linkPreview.description,
        link_preview_image: linkPreview.image,
        prompt_text: data.promptText.trim(),
        is_blurred: data.isBlurred,
      } as any).select("id").single();

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
        await supabase.from("post_hashtags").insert({ post_id: postData!.id, hashtag_id: hashtagId });
      }

      const { data: existingProfile } = await supabase.from("user_profiles").select("id").eq("user_id", user.id).maybeSingle();
      if (!existingProfile) {
        await supabase.from("user_profiles").insert({
          user_id: user.id,
          display_name: user.user_metadata?.name || user.email?.split("@")[0] || "Usuário",
          username: user.email?.split("@")[0]?.replace(/[^a-z0-9_]/g, "") || `user_${Date.now()}`,
        });
      }

      const { data: currentProfile } = await supabase.from("user_profiles").select("posts_count").eq("user_id", user.id).maybeSingle();
      if (currentProfile) await supabase.from("user_profiles").update({ posts_count: (currentProfile.posts_count || 0) + 1 }).eq("user_id", user.id);

      try {
        const { data: rewardData, error: rewardError } = await supabase.functions.invoke("reward-post", { body: { post_id: postData!.id } });
        console.log("[Community] reward-post response:", { rewardData, rewardError });
        if (rewardError) {
          console.error("[Community] reward-post error:", rewardError);
          toast.success("Publicado!");
        } else if (rewardData?.rewarded) {
          toast.success("Publicado! 🎉 +1h de token adicionada ao seu plano!");
        } else if (rewardData?.error) {
          toast.success(`Publicado! (${rewardData.error})`);
        } else {
          toast.success("Publicado!");
        }
      } catch (rewardErr) {
        console.error("[Community] reward-post catch:", rewardErr);
        toast.success("Publicado!");
      }
      await fetchPosts(true);
    } catch (err: any) {
      toast.error("Erro ao publicar: " + (err.message || ""));
    } finally { setPosting(false); postingRef.current = false; }
  };

  const getProfile = (userId: string) => profiles[userId] || { display_name: "Usuário", username: "", avatar_url: "" };
  const typeIcon = (type: string) => {
    const map: Record<string, any> = { project: Folder, question: HelpCircle, tip: Lightbulb, showcase: Eye };
    const Icon = map[type] || Hash;
    return <Icon className="h-3 w-3" />;
  };
  const myProfile = getProfile(user.id);

  return (
    <AppLayout>
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-8 py-8 flex gap-8">
        {/* Sidebar */}
        <aside className="hidden lg:block w-64 shrink-0 space-y-6">
          <div className="ep-card space-y-1">
            <p className="ep-subtitle mb-3">FILTRAR</p>
            {POST_TYPES.map(t => (
              <button key={t.id} onClick={() => setSearchParams(t.id === "all" ? {} : { type: t.id })}
                className={`w-full flex items-center gap-2 text-left px-3 py-2 rounded-[10px] text-xs font-bold transition-colors ${
                  filterType === t.id ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
                }`}>
                <t.icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            ))}
          </div>
          <div className="ep-card space-y-2">
            <p className="ep-subtitle mb-3">TRENDING</p>
            {hashtags.slice(0, 10).map(h => (
              <button key={h.id} onClick={() => setSearchParams({ tag: h.slug })}
                className="flex items-center gap-2 text-xs text-muted-foreground font-medium hover:text-foreground transition-colors">
                <Hash className="h-3 w-3" /> {h.name}
                <span className="text-[10px] text-muted-foreground/60">{h.posts_count}</span>
              </button>
            ))}
            {hashtags.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma hashtag ainda.</p>}
          </div>
          {/* User search */}
          <div className="ep-card">
            <p className="ep-subtitle mb-3">ENCONTRAR PESSOAS</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input value={userSearch} onChange={e => { setUserSearch(e.target.value); searchUsers(e.target.value); }}
                placeholder="Buscar nome ou @usuario..."
                className="w-full bg-muted border border-border/50 rounded-[10px] pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/20" />
            </div>
            {searchingUsers && <Loader2 className="h-4 w-4 animate-spin mx-auto mt-3 text-muted-foreground" />}
            {userResults.length > 0 && (
              <div className="mt-2 space-y-1">
                {userResults.map(u => (
                  <Link key={u.user_id} to={`/profile/${u.user_id}`}
                    className="flex items-center gap-2.5 px-2 py-2 rounded-[8px] hover:bg-muted transition-colors">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-muted-foreground/20 flex items-center justify-center text-[10px] font-bold">
                        {(u.display_name || "U")[0].toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{u.display_name}</p>
                      {u.username && <p className="text-[10px] text-muted-foreground">@{u.username}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
            {userSearch.length >= 2 && !searchingUsers && userResults.length === 0 && (
              <p className="text-[10px] text-muted-foreground text-center mt-2">Nenhum resultado.</p>
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
              <button key={t.id} onClick={() => setSearchParams(t.id === "all" ? {} : { type: t.id })}
                className={`ep-btn-secondary h-8 px-3 text-[8px] ${filterType === t.id ? "bg-foreground text-background" : ""}`}>
                {t.label}
              </button>
            ))}
          </div>

          <PostComposer user={user} profile={myProfile} onSubmit={submitPost} posting={posting} />

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
              const isOwner = user?.id === post.user_id;
              const canManagePost = isOwner || isAdmin;
              const isEditing = editingPost === post.id;
              return (
                <PostViewObserver key={post.id} postId={post.id} onView={trackView}>
                  <div className="ep-card">
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
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link to={`/profile/${post.user_id}`} className="text-sm font-bold text-foreground hover:underline">
                              {profile.display_name || "Usuário"}
                            </Link>
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(post.created_at), "dd MMM", { locale: ptBR })}
                            </span>
                            {post.rewarded && (
                              <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground/60" title="Post recompensado — não pode ser excluído">
                                <Lock className="h-2.5 w-2.5" />
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="ep-badge text-[7px] flex items-center gap-1">
                              {typeIcon(post.post_type)} {post.post_type.toUpperCase()}
                            </span>
                            {/* Owner actions menu */}
                            {canManagePost && (
                              <div className="relative">
                                <button onClick={() => setPostMenuOpen(postMenuOpen === post.id ? null : post.id)}
                                  className="h-7 w-7 rounded-[8px] flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>
                                {postMenuOpen === post.id && (
                                  <div className="absolute right-0 top-8 z-20 bg-card border border-border rounded-[12px] shadow-lg py-1 min-w-[160px] animate-fade-in">
                                    <button onClick={() => startEditPost(post)}
                                      className="w-full flex items-center gap-2 px-4 py-2 text-xs font-bold text-foreground hover:bg-muted transition-colors">
                                      <Pencil className="h-3.5 w-3.5" /> EDITAR
                                    </button>
                                    <button onClick={() => archivePost(post)}
                                      className="w-full flex items-center gap-2 px-4 py-2 text-xs font-bold text-foreground hover:bg-muted transition-colors">
                                      <Archive className="h-3.5 w-3.5" /> ARQUIVAR
                                    </button>
                    {post.rewarded && !isAdmin ? (
                                      <div className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-muted-foreground/50 cursor-not-allowed">
                                        <Lock className="h-3.5 w-3.5" /> EXCLUIR (BLOQUEADO)
                                      </div>
                                    ) : (
                                      <button onClick={() => deletePost(post)}
                                        className="w-full flex items-center gap-2 px-4 py-2 text-xs font-bold text-destructive hover:bg-destructive/10 transition-colors">
                                        <Trash2 className="h-3.5 w-3.5" /> EXCLUIR
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Edit mode */}
                        {isEditing ? (
                          <div className="space-y-2 mb-3">
                            <input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Título"
                              className="w-full bg-muted/50 border border-border/50 rounded-[10px] px-4 py-2 text-sm font-bold text-foreground focus:outline-none focus:border-foreground/20" />
                            <textarea value={editContent} onChange={e => setEditContent(e.target.value)} placeholder="Conteúdo" rows={3}
                              className="w-full bg-muted/50 border border-border/50 rounded-[10px] px-4 py-2 text-sm text-foreground font-medium focus:outline-none focus:border-foreground/20 resize-none" />
                            <textarea value={editPrompt} onChange={e => setEditPrompt(e.target.value)} placeholder="Prompt (opcional)" rows={2}
                              className="w-full bg-muted/50 border border-border/50 rounded-[10px] px-4 py-2 text-sm text-foreground font-mono focus:outline-none focus:border-foreground/20 resize-none" />
                            <div className="flex gap-2 justify-end">
                              <button onClick={cancelEditPost} className="h-8 px-4 rounded-[8px] text-[9px] font-bold text-muted-foreground hover:text-foreground">CANCELAR</button>
                              <button onClick={() => saveEditPost(post.id)} className="ep-btn-primary h-8 px-4 text-[9px]">SALVAR</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {post.title && <h3 className="text-base font-bold text-foreground mb-1">{post.title}</h3>}
                            <p className="text-sm text-muted-foreground font-medium whitespace-pre-wrap mb-3 leading-relaxed">{post.content}</p>
                          </>
                        )}

                        {/* Media */}
                        {!isEditing && post.media_urls && post.media_urls.length > 0 && (
                          <MediaCarousel urls={post.media_urls} template="threads" isBlurred={post.is_blurred} onOpenFullscreen={(idx) => setFullscreenMedia({ urls: post.media_urls, index: idx })} />
                        )}

                        {/* Prompt/CMD block */}
                        {!isEditing && post.prompt_text && (
                          <PromptBlock text={post.prompt_text} postId={post.id} userId={user?.id} copyCount={post.copy_count || 0} />
                        )}

                        {/* Static project preview */}
                        {!isEditing && post.project_url && (
                          <>
                            {(() => { try { return new URL(post.project_url).hostname.endsWith(".lovable.app"); } catch { return false; } })() ? (
                              <StaticProjectPreview url={post.project_url} name={post.project_name} />
                            ) : (
                              <LinkPreviewCard post={post} />
                            )}
                          </>
                        )}

                        {/* Actions */}
                        {!isEditing && (
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
                            {post.copy_count > 0 && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground/60">
                                <Copy className="h-3.5 w-3.5" /> {post.copy_count}
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-xs text-muted-foreground/50 ml-auto">
                              <Eye className="h-3.5 w-3.5" /> {post.views_count || 0}
                            </span>
                          </div>
                        )}

                        {!isEditing && post.comments_count > 0 && expandedComments !== post.id && (
                          <button onClick={() => loadComments(post.id)}
                            className="text-xs text-muted-foreground/60 font-medium mt-2 hover:text-muted-foreground transition-colors">
                            {post.comments_count} {post.comments_count === 1 ? "resposta" : "respostas"}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Comments */}
                    {expandedComments === post.id && (
                      <div className="ml-[52px] mt-3 space-y-3">
                        {comments.map(c => {
                          const cp = getProfile(c.user_id);
                          const isCommentOwner = user?.id === c.user_id;
                          return (
                            <div key={c.id} className="flex gap-2.5 group">
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
                                  {(isCommentOwner || isAdmin) && (
                                    <button onClick={() => deleteComment(c.id, post.id)}
                                      className="opacity-0 group-hover:opacity-100 h-5 w-5 rounded-[6px] flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                                      title="Excluir comentário">
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  )}
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
                </PostViewObserver>
              );
            })
          )}

          {/* Infinite scroll trigger */}
          <div ref={loadMoreRef} className="py-4">
            {loadingMore && (
              <div className="text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              </div>
            )}
          </div>

          {/* End of feed */}
          {!loading && !hasMore && posts.length > 0 && (
            <div className="text-center py-12 space-y-3">
              <div className="h-12 w-12 mx-auto rounded-[14px] bg-muted flex items-center justify-center">
                <Check className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Tudo por hoje! 🎉</p>
                <p className="text-xs text-muted-foreground mt-1">Você viu todas as publicações. Volte mais tarde para novidades!</p>
              </div>
            </div>
          )}
        </main>
      </div>
      {/* Fullscreen media viewer */}
      {fullscreenMedia && (
        <FullscreenMediaViewer
          urls={fullscreenMedia.urls}
          initialIndex={fullscreenMedia.index}
          onClose={() => setFullscreenMedia(null)}
        />
      )}
    </div>
    </AppLayout>
  );
}
