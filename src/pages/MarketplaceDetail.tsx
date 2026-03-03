import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import {
  Star, Eye, ShoppingCart, ArrowLeft, Loader2, Code2, Sparkles,
  ExternalLink, Check, Shield, MessageCircle, Play, Key,
  Copy, Monitor, ChevronLeft, ChevronRight, Image as ImageIcon,
  Video, FileText, Zap, Download,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface DemoCredential { label: string; email: string; password: string; }

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
    } finally { setPurchasing(false); }
  };

  const copyCredential = (text: string) => {
    navigator.clipboard?.writeText(text);
    toast.success("Copiado!");
  };

  if (loading) {
    return (
      <AppLayout>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
          <Loader2 size={20} style={{ animation: "gl-spin .7s linear infinite", color: "var(--text-tertiary)" }} />
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
      <div className="rd-page-content" style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Back */}
        <button onClick={() => navigate("/marketplace")} className="gl sm ghost" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 5 }}>
          <ArrowLeft size={13} /> Voltar para a Loja
        </button>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24 }}>
          {/* Left: Preview + Details */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Media Tabs */}
            <div className="rd-card" style={{ padding: 0, overflow: "hidden" }}>
              {/* Tab bar */}
              <div style={{ display: "flex", gap: 4, padding: "10px 12px", borderBottom: "1px solid var(--b1)" }}>
                <button onClick={() => { setActiveTab("preview"); setShowLivePreview(false); }}
                  className={`f-btn ${activeTab === "preview" && !showLivePreview ? "active" : ""}`} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <ImageIcon size={11} /> Preview
                </button>
                {hasLivePreview && (
                  <button onClick={() => { setActiveTab("preview"); setShowLivePreview(true); }}
                    className={`f-btn ${showLivePreview ? "active" : ""}`} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Monitor size={11} /> Live Demo
                  </button>
                )}
                {allMedia.length > 0 && (
                  <button onClick={() => { setActiveTab("screenshots"); setShowLivePreview(false); }}
                    className={`f-btn ${activeTab === "screenshots" ? "active" : ""}`} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <ImageIcon size={11} /> Galeria ({allMedia.length})
                  </button>
                )}
                {hasVideo && (
                  <button onClick={() => { setActiveTab("video"); setShowLivePreview(false); }}
                    className={`f-btn ${activeTab === "video" ? "active" : ""}`} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Video size={11} /> Vídeo
                  </button>
                )}
              </div>

              {/* Content area */}
              <div>
                {showLivePreview && hasLivePreview ? (
                  <div style={{ position: "relative", width: "100%", height: 480 }}>
                    <iframe
                      src={`https://id-preview--${listing.lovable_project_id}.lovable.app`}
                      style={{ width: "100%", height: "100%", border: 0 }}
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                      title="Live Preview"
                    />
                    <div style={{ position: "absolute", bottom: 8, right: 8 }}>
                      <span className="chip green" style={{ fontSize: 8 }}><Monitor size={10} /> Preview ao Vivo</span>
                    </div>
                  </div>
                ) : activeTab === "video" && hasVideo ? (
                  <div style={{ width: "100%", aspectRatio: "16/9", background: "#000" }}>
                    {listing.video_url.includes("youtube.com") || listing.video_url.includes("youtu.be") ? (
                      <iframe
                        src={listing.video_url.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
                        style={{ width: "100%", height: "100%", border: 0 }}
                        allowFullScreen title="Video"
                      />
                    ) : (
                      <video src={listing.video_url} controls style={{ width: "100%", height: "100%" }} />
                    )}
                  </div>
                ) : activeTab === "screenshots" && allMedia.length > 0 ? (
                  <div>
                    <div style={{ width: "100%", aspectRatio: "16/9", background: "var(--bg-3)", overflow: "hidden" }}>
                      {allMedia[activeScreenshot]?.match(/\.(mp4|webm|mov)$/i) ? (
                        <video src={allMedia[activeScreenshot]} controls style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      ) : (
                        <img src={allMedia[activeScreenshot]} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      )}
                    </div>
                    {allMedia.length > 1 && (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 8 }}>
                        <button onClick={() => setActiveScreenshot(p => Math.max(0, p - 1))} disabled={activeScreenshot === 0} className="gl ico xs ghost">
                          <ChevronLeft size={14} />
                        </button>
                        <div style={{ display: "flex", gap: 4 }}>
                          {allMedia.map((url, i) => (
                            <button key={i} onClick={() => setActiveScreenshot(i)}
                              style={{ width: 56, height: 36, borderRadius: "var(--r2)", overflow: "hidden", border: i === activeScreenshot ? "2px solid var(--orange)" : "2px solid transparent", opacity: i === activeScreenshot ? 1 : 0.5 }}>
                              {url.match(/\.(mp4|webm|mov)$/i) ? (
                                <div style={{ width: "100%", height: "100%", background: "var(--bg-4)", display: "flex", alignItems: "center", justifyContent: "center" }}><Play size={10} /></div>
                              ) : (
                                <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              )}
                            </button>
                          ))}
                        </div>
                        <button onClick={() => setActiveScreenshot(p => Math.min(allMedia.length - 1, p + 1))} disabled={activeScreenshot === allMedia.length - 1} className="gl ico xs ghost">
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ width: "100%", aspectRatio: "16/9", background: "var(--bg-3)", overflow: "hidden" }}>
                    {listing.preview_image_url ? (
                      <img src={listing.preview_image_url} alt={listing.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Code2 size={40} style={{ color: "var(--text-quaternary)", opacity: 0.12 }} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Highlights */}
            {highlights.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {highlights.map((h, i) => (
                  <span key={i} className="chip" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Zap size={10} style={{ color: "var(--orange)" }} /> {h}
                  </span>
                ))}
              </div>
            )}

            {/* Demo Credentials */}
            {demoCredentials.length > 0 && (
              <div className="rd-card" style={{ padding: 18 }}>
                <h2 style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <Key size={14} style={{ color: "var(--orange)" }} /> Acessos Demo
                </h2>
                <p style={{ fontSize: 10, color: "var(--text-quaternary)", marginBottom: 12 }}>Use estas credenciais para testar antes de comprar.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {demoCredentials.map((cred, i) => (
                    <div key={i} className="rd-card" style={{ padding: 12, display: "flex", alignItems: "center", gap: 12 }}>
                      <span className="chip orange" style={{ fontSize: 9 }}>{cred.label}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                          <span style={{ fontSize: 10, color: "var(--text-quaternary)" }}>Email:</span>
                          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 600 }}>{cred.email}</span>
                          <button onClick={() => copyCredential(cred.email)} className="gl ico xs ghost"><Copy size={10} /></button>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 10, color: "var(--text-quaternary)" }}>Senha:</span>
                          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 600 }}>{cred.password}</span>
                          <button onClick={() => copyCredential(cred.password)} className="gl ico xs ghost"><Copy size={10} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            <div className="rd-card" style={{ padding: 18 }}>
              <h2 style={{ fontSize: 13, fontWeight: 800, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <FileText size={14} /> Descrição
              </h2>
              <div className="prose prose-sm dark:prose-invert max-w-none" style={{ fontSize: 13, lineHeight: 1.7 }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {listing.long_description || listing.description}
                </ReactMarkdown>
              </div>
            </div>

            {/* Features */}
            {features.length > 0 && (
              <div className="rd-card" style={{ padding: 18 }}>
                <h2 style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>Funcionalidades</h2>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {features.map((f: any, i: number) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Check size={12} style={{ color: "var(--orange)", flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{typeof f === 'string' ? f : f.title || f.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Setup Instructions */}
            {listing.setup_instructions && (
              <div className="rd-card" style={{ padding: 18 }}>
                <h2 style={{ fontSize: 13, fontWeight: 800, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <Sparkles size={14} style={{ color: "var(--orange)" }} /> Instruções de Setup
                </h2>
                <div className="prose prose-sm dark:prose-invert max-w-none" style={{ fontSize: 13 }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{listing.setup_instructions}</ReactMarkdown>
                </div>
              </div>
            )}

            {/* Reviews */}
            <div className="rd-card" style={{ padding: 18 }}>
              <h2 style={{ fontSize: 13, fontWeight: 800, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <MessageCircle size={14} /> Avaliações ({listing.rating_count})
              </h2>
              {reviews.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--text-quaternary)" }}>Nenhuma avaliação ainda.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {reviews.map(r => (
                    <div key={r.id} style={{ borderBottom: "1px solid var(--b1)", paddingBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <div style={{ display: "flex", gap: 1 }}>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} size={10} style={{ color: i < r.rating ? "var(--orange)" : "var(--bg-5)" }} fill={i < r.rating ? "var(--orange)" : "none"} />
                          ))}
                        </div>
                        {r.is_verified_purchase && <Shield size={10} style={{ color: "var(--orange)" }} />}
                      </div>
                      <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Purchase card + Seller */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Purchase card */}
            <div className="rd-card" style={{ padding: 18, position: "sticky", top: 60 }}>
              <h1 style={{ fontSize: 17, fontWeight: 900, color: "var(--text-primary)", marginBottom: 4 }}>{listing.title}</h1>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 14 }}>{listing.description}</p>

              <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text-primary)", marginBottom: 4 }}>
                {listing.price === 0 ? (
                  <span style={{ color: "var(--green)", display: "flex", alignItems: "center", gap: 6 }}><Zap size={20} /> Grátis</span>
                ) : (
                  `R$ ${listing.price.toFixed(2)}`
                )}
              </div>
              <p style={{ fontSize: 10, color: "var(--text-quaternary)", marginBottom: 16 }}>Comissão: 30% &bull; Vendedor recebe 70%</p>

              {alreadyPurchased ? (
                <div className="gl sm" style={{ width: "100%", justifyContent: "center", background: "rgba(16,185,129,.1)", color: "var(--green)", pointerEvents: "none" }}>
                  <Check size={14} /> Você já possui este projeto
                </div>
              ) : (
                <button onClick={handlePurchase} disabled={purchasing} className="gl sm orange" style={{ width: "100%", justifyContent: "center" }}>
                  {purchasing ? <Loader2 size={14} style={{ animation: "gl-spin .7s linear infinite" }} /> : <ShoppingCart size={14} />}
                  {listing.price === 0 ? "Obter Grátis" : "Comprar Agora"}
                </button>
              )}

              {hasLivePreview && (
                <button onClick={() => { setActiveTab("preview"); setShowLivePreview(true); }}
                  className="gl sm ghost" style={{ width: "100%", justifyContent: "center", marginTop: 8 }}>
                  <Monitor size={13} style={{ color: "var(--orange)" }} /> Testar Live Demo
                </button>
              )}

              {listing.demo_url && !hasLivePreview && (
                <a href={listing.demo_url} target="_blank" rel="noopener noreferrer"
                  className="gl sm ghost" style={{ width: "100%", justifyContent: "center", marginTop: 8, textDecoration: "none" }}>
                  <ExternalLink size={13} /> Ver Demo
                </a>
              )}

              {/* Stats */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--b1)", fontSize: 10, color: "var(--text-quaternary)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Eye size={10} /> {listing.views_count}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Download size={10} /> {listing.sales_count} vendas</span>
                {listing.rating > 0 && (
                  <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Star size={10} style={{ color: "var(--orange)" }} /> {listing.rating.toFixed(1)}</span>
                )}
              </div>

              {/* Tech stack */}
              {listing.tech_stack?.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 12 }}>
                  {listing.tech_stack.map((t: string) => (
                    <span key={t} className="chip" style={{ fontSize: 8, padding: "1px 6px" }}>{t}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Seller card */}
            {seller && (
              <div className="rd-card" style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  {seller.avatar_url ? (
                    <img src={seller.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--bg-4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "var(--text-tertiary)" }}>
                      {seller.display_name?.[0] || "?"}
                    </div>
                  )}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{seller.display_name}</span>
                      {seller.is_verified && <Sparkles size={11} style={{ color: "var(--orange)" }} />}
                    </div>
                    <p style={{ fontSize: 10, color: "var(--text-quaternary)" }}>{seller.total_sales} vendas &bull; {seller.rating.toFixed(1)}</p>
                  </div>
                </div>
                {seller.bio && <p style={{ fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.5 }}>{seller.bio}</p>}
                <Link to={`/marketplace/seller/${seller.user_id}`}
                  className="gl sm ghost" style={{ width: "100%", justifyContent: "center", marginTop: 10, textDecoration: "none", fontSize: 11 }}>
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
