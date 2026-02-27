import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import {
  Star, Eye, ShoppingCart, ArrowLeft, Loader2, Code2, Sparkles,
  ExternalLink, Check, Package, Shield, MessageCircle, Play, Key,
  Copy, Monitor, ChevronLeft, ChevronRight, Image as ImageIcon,
  Video, FileText, Zap, Download,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const glassCard = {
  background: "var(--liquid-glass-bg, rgba(255,255,255,0.04))",
  backdropFilter: "blur(40px) saturate(200%)",
  WebkitBackdropFilter: "blur(40px) saturate(200%)",
  border: "0.5px solid var(--clf-border)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 12px rgba(0,0,0,0.08)",
} as const;

interface DemoCredential {
  label: string;
  email: string;
  password: string;
}

export default function MarketplaceDetail() {
  const { slug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [listing, setListing] = useState<any>(null);
  const [seller, setSeller] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [alreadyPurchased, setAlreadyPurchased] = useState(false);
  const [activeTab, setActiveTab] = useState<"preview" | "screenshots" | "video">("preview");
  const [activeScreenshot, setActiveScreenshot] = useState(0);
  const [showLivePreview, setShowLivePreview] = useState(false);

  useEffect(() => {
    if (!slug) return;
    const load = async () => {
      const { data } = await supabase
        .from("marketplace_listings")
        .select("*, seller_profiles(id, user_id, display_name, bio, avatar_url, is_verified, total_sales, rating, rating_count)")
        .eq("slug", slug)
        .single();

      if (!data) { navigate("/marketplace"); return; }
      setListing(data);
      setSeller((data as any).seller_profiles);

      const { data: revs } = await supabase
        .from("marketplace_reviews")
        .select("*")
        .eq("listing_id", data.id)
        .order("created_at", { ascending: false })
        .limit(20);
      setReviews(revs || []);

      if (user) {
        const { data: purchase } = await supabase
          .from("marketplace_purchases")
          .select("id")
          .eq("listing_id", data.id)
          .eq("buyer_id", user.id)
          .eq("status", "paid")
          .maybeSingle();
        setAlreadyPurchased(!!purchase);
      }

      supabase.from("marketplace_listings")
        .update({ views_count: (data.views_count || 0) + 1 } as any)
        .eq("id", data.id)
        .then(() => {});

      setLoading(false);
    };
    load();
  }, [slug, user, navigate]);

  const handlePurchase = async () => {
    if (!user) { navigate("/login?returnTo=/marketplace/" + slug); return; }
    if (!listing) return;
    setPurchasing(true);
    try {
      const { data, error } = await supabase.functions.invoke("marketplace-checkout", {
        body: { listing_id: listing.id, payment_method: "pix" },
      });
      if (error) throw error;

      if (data?.free) {
        toast.success("Projeto adquirido! Iniciando onboarding...");
        setAlreadyPurchased(true);
        if (data.purchase_id) navigate(`/marketplace/onboarding/${data.purchase_id}`);
      } else if (data?.pix_code) {
        toast.success("PIX gerado! Copie o código para pagar.");
        navigator.clipboard?.writeText(data.pix_code);
        if (data.purchase_id) navigate(`/marketplace/onboarding/${data.purchase_id}`);
      } else if (data?.init_point) {
        window.open(data.init_point, "_blank");
      }
    } catch (err: any) {
      toast.error("Erro ao processar compra: " + (err.message || "tente novamente"));
    } finally {
      setPurchasing(false);
    }
  };

  const copyCredential = (text: string) => {
    navigator.clipboard?.writeText(text);
    toast.success("Copiado!");
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!listing) return null;

  const screenshots: string[] = listing.screenshots || [];
  const mediaUrls: string[] = listing.media_urls || [];
  const features: any[] = Array.isArray(listing.features) ? listing.features : [];
  const highlights: string[] = listing.highlights || [];
  const demoCredentials: DemoCredential[] = Array.isArray(listing.demo_credentials) ? listing.demo_credentials : [];
  const hasLivePreview = !!listing.lovable_project_id;
  const hasVideo = !!listing.video_url;
  const allMedia = [...screenshots, ...mediaUrls];

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Back */}
        <button onClick={() => navigate("/marketplace")} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para a Loja
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Preview + Details */}
          <div className="lg:col-span-2 space-y-6">

            {/* ── Media Tabs ── */}
            <div className="rounded-2xl overflow-hidden" style={glassCard}>
              {/* Tab bar */}
              <div className="flex items-center gap-1 px-4 pt-3 pb-2" style={{ borderBottom: "0.5px solid var(--clf-border)" }}>
                <button onClick={() => { setActiveTab("preview"); setShowLivePreview(false); }}
                  className={`h-8 px-4 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all ${activeTab === "preview" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                  <ImageIcon className="h-3 w-3" /> Preview
                </button>
                {hasLivePreview && (
                  <button onClick={() => { setActiveTab("preview"); setShowLivePreview(true); }}
                    className={`h-8 px-4 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all ${showLivePreview ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                    <Monitor className="h-3 w-3" /> Live Demo
                  </button>
                )}
                {allMedia.length > 0 && (
                  <button onClick={() => { setActiveTab("screenshots"); setShowLivePreview(false); }}
                    className={`h-8 px-4 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all ${activeTab === "screenshots" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                    <ImageIcon className="h-3 w-3" /> Galeria ({allMedia.length})
                  </button>
                )}
                {hasVideo && (
                  <button onClick={() => { setActiveTab("video"); setShowLivePreview(false); }}
                    className={`h-8 px-4 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all ${activeTab === "video" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                    <Video className="h-3 w-3" /> Vídeo
                  </button>
                )}
              </div>

              {/* Content area */}
              <div className="relative">
                {/* Live Preview — sandboxed iframe, no URL visible */}
                {showLivePreview && hasLivePreview ? (
                  <div className="relative w-full" style={{ height: "520px" }}>
                    <iframe
                      src={`https://id-preview--${listing.lovable_project_id}.lovable.app`}
                      className="w-full h-full border-0"
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                      style={{ pointerEvents: "auto" }}
                      title="Live Preview"
                    />
                    <div className="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl bg-black/60 text-white text-[10px] font-bold flex items-center gap-1.5 backdrop-blur-sm">
                      <Monitor className="h-3 w-3" /> Preview ao Vivo
                    </div>
                  </div>
                ) : activeTab === "video" && hasVideo ? (
                  <div className="w-full aspect-video bg-black">
                    {listing.video_url.includes("youtube.com") || listing.video_url.includes("youtu.be") ? (
                      <iframe
                        src={listing.video_url.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
                        className="w-full h-full border-0"
                        allowFullScreen
                        title="Video"
                      />
                    ) : (
                      <video src={listing.video_url} controls className="w-full h-full" />
                    )}
                  </div>
                ) : activeTab === "screenshots" && allMedia.length > 0 ? (
                  <div className="relative">
                    <div className="w-full aspect-[16/9] bg-muted/10 overflow-hidden">
                      {allMedia[activeScreenshot]?.match(/\.(mp4|webm|mov)$/i) ? (
                        <video src={allMedia[activeScreenshot]} controls className="w-full h-full object-contain" />
                      ) : (
                        <img src={allMedia[activeScreenshot]} alt="" className="w-full h-full object-contain" />
                      )}
                    </div>
                    {allMedia.length > 1 && (
                      <div className="flex items-center justify-between px-3 py-2">
                        <button onClick={() => setActiveScreenshot(p => Math.max(0, p - 1))}
                          disabled={activeScreenshot === 0}
                          className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30">
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <div className="flex gap-1.5">
                          {allMedia.map((url, i) => (
                            <button key={i} onClick={() => setActiveScreenshot(i)}
                              className={`h-12 w-20 rounded-lg overflow-hidden border-2 transition-all ${i === activeScreenshot ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"}`}>
                              {url.match(/\.(mp4|webm|mov)$/i) ? (
                                <div className="h-full w-full bg-muted/30 flex items-center justify-center"><Play className="h-3 w-3" /></div>
                              ) : (
                                <img src={url} alt="" className="h-full w-full object-cover" />
                              )}
                            </button>
                          ))}
                        </div>
                        <button onClick={() => setActiveScreenshot(p => Math.min(allMedia.length - 1, p + 1))}
                          disabled={activeScreenshot === allMedia.length - 1}
                          className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30">
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Default: cover image */
                  <div className="w-full aspect-[16/9] bg-muted/10 overflow-hidden">
                    {listing.preview_image_url ? (
                      <img src={listing.preview_image_url} alt={listing.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Code2 className="h-16 w-16 text-muted-foreground/10" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Highlights */}
            {highlights.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {highlights.map((h, i) => (
                  <span key={i} className="px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5" style={glassCard}>
                    <Zap className="h-3 w-3 text-primary" /> {h}
                  </span>
                ))}
              </div>
            )}

            {/* Demo Credentials */}
            {demoCredentials.length > 0 && (
              <div className="rounded-2xl p-6" style={glassCard}>
                <h2 className="text-sm font-black mb-4 flex items-center gap-2">
                  <Key className="h-4 w-4 text-primary" /> Acessos Demo
                </h2>
                <p className="text-[11px] text-muted-foreground/60 mb-4">Use estas credenciais para testar o projeto antes de comprar.</p>
                <div className="space-y-3">
                  {demoCredentials.map((cred, i) => (
                    <div key={i} className="rounded-xl p-4 flex items-center gap-4" style={{ ...glassCard, background: "rgba(255,255,255,0.02)" }}>
                      <div className="shrink-0">
                        <span className="px-3 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-bold">{cred.label}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] text-muted-foreground/60">Email:</span>
                          <span className="text-xs font-mono font-semibold truncate">{cred.email}</span>
                          <button onClick={() => copyCredential(cred.email)} className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-primary">
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground/60">Senha:</span>
                          <span className="text-xs font-mono font-semibold">{cred.password}</span>
                          <button onClick={() => copyCredential(cred.password)} className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-primary">
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            <div className="rounded-2xl p-6" style={glassCard}>
              <h2 className="text-sm font-black mb-4 flex items-center gap-2">
                <FileText className="h-4 w-4" /> Descrição
              </h2>
              <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {listing.long_description || listing.description}
                </ReactMarkdown>
              </div>
            </div>

            {/* Features */}
            {features.length > 0 && (
              <div className="rounded-2xl p-6" style={glassCard}>
                <h2 className="text-sm font-black mb-3">Funcionalidades</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {features.map((f: any, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="text-xs text-muted-foreground">{typeof f === 'string' ? f : f.title || f.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Setup Instructions */}
            {listing.setup_instructions && (
              <div className="rounded-2xl p-6" style={glassCard}>
                <h2 className="text-sm font-black mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" /> Instruções de Setup
                </h2>
                <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{listing.setup_instructions}</ReactMarkdown>
                </div>
              </div>
            )}

            {/* Reviews */}
            <div className="rounded-2xl p-6" style={glassCard}>
              <h2 className="text-sm font-black mb-3 flex items-center gap-2">
                <MessageCircle className="h-4 w-4" /> Avaliações ({listing.rating_count})
              </h2>
              {reviews.length === 0 ? (
                <p className="text-xs text-muted-foreground/60">Nenhuma avaliação ainda.</p>
              ) : (
                <div className="space-y-4">
                  {reviews.map(r => (
                    <div key={r.id} className="border-b border-border/20 pb-3 last:border-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`h-3 w-3 ${i < r.rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/20"}`} />
                          ))}
                        </div>
                        {r.is_verified_purchase && <Shield className="h-3 w-3 text-primary" />}
                      </div>
                      <p className="text-xs text-muted-foreground">{r.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Purchase card + Seller */}
          <div className="space-y-4">
            {/* Purchase card */}
            <div className="rounded-2xl p-6 sticky top-20" style={glassCard}>
              <h1 className="text-lg font-black text-foreground mb-1">{listing.title}</h1>
              <p className="text-xs text-muted-foreground mb-4">{listing.description}</p>

              <div className="text-3xl font-black text-foreground mb-1">
                {listing.price === 0 ? (
                  <span className="text-emerald-500 flex items-center gap-2"><Zap className="h-6 w-6" /> Grátis</span>
                ) : (
                  `R$ ${listing.price.toFixed(2)}`
                )}
              </div>
              <p className="text-[10px] text-muted-foreground/60 mb-5">Comissão: 30% • Vendedor recebe 70%</p>

              {alreadyPurchased ? (
                <div className="h-12 rounded-2xl bg-green-500/10 text-green-600 text-sm font-bold flex items-center justify-center gap-2">
                  <Check className="h-4 w-4" /> Você já possui este projeto
                </div>
              ) : (
                <button
                  onClick={handlePurchase}
                  disabled={purchasing}
                  className="w-full h-12 rounded-2xl bg-primary text-primary-foreground text-sm font-black flex items-center justify-center gap-2 hover:shadow-xl hover:shadow-primary/25 transition-all disabled:opacity-50"
                >
                  {purchasing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
                  {listing.price === 0 ? "Obter Grátis" : "Comprar Agora"}
                </button>
              )}

              {hasLivePreview && (
                <button onClick={() => { setActiveTab("preview"); setShowLivePreview(true); }}
                  className="w-full h-10 mt-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all" style={glassCard}>
                  <Monitor className="h-3.5 w-3.5 text-primary" /> Testar Live Demo
                </button>
              )}

              {listing.demo_url && !hasLivePreview && (
                <a href={listing.demo_url} target="_blank" rel="noopener noreferrer"
                  className="w-full h-10 mt-3 rounded-2xl text-xs font-medium flex items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors" style={glassCard}>
                  <ExternalLink className="h-3.5 w-3.5" /> Ver Demo
                </a>
              )}

              {/* Stats */}
              <div className="flex items-center justify-between mt-5 pt-4 border-t border-border/20">
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Eye className="h-3 w-3" /> {listing.views_count}</span>
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Download className="h-3 w-3" /> {listing.sales_count} vendas</span>
                {listing.rating > 0 && (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Star className="h-3 w-3 text-amber-400" /> {listing.rating.toFixed(1)}</span>
                )}
              </div>

              {/* Tech stack */}
              {listing.tech_stack?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {listing.tech_stack.map((t: string) => (
                    <span key={t} className="px-2.5 py-1 rounded-xl bg-muted/30 text-[9px] font-semibold text-muted-foreground border border-border/20">{t}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Seller card */}
            {seller && (
              <div className="rounded-2xl p-5" style={glassCard}>
                <div className="flex items-center gap-3 mb-3">
                  {seller.avatar_url ? (
                    <img src={seller.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">{seller.display_name?.[0] || "?"}</span>
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold">{seller.display_name}</span>
                      {seller.is_verified && <Sparkles className="h-3.5 w-3.5 text-primary" />}
                    </div>
                    <p className="text-[10px] text-muted-foreground">{seller.total_sales} vendas • ⭐ {seller.rating.toFixed(1)}</p>
                  </div>
                </div>
                {seller.bio && <p className="text-xs text-muted-foreground line-clamp-3">{seller.bio}</p>}
                <Link to={`/marketplace/seller/${seller.user_id}`}
                  className="w-full h-8 mt-3 rounded-lg border border-border/30 text-[11px] font-medium flex items-center justify-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                  Ver Perfil do Vendedor
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
