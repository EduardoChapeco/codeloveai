import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import {
  Star, Eye, ShoppingCart, ArrowLeft, Loader2, Code2, Sparkles,
  ExternalLink, Check, Package, Shield, MessageCircle,
} from "lucide-react";
import { toast } from "sonner";

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

      // Load reviews
      const { data: revs } = await supabase
        .from("marketplace_reviews")
        .select("*")
        .eq("listing_id", data.id)
        .order("created_at", { ascending: false })
        .limit(20);
      setReviews(revs || []);

      // Check if already purchased
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

      // Increment views (best effort)
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
      // Use marketplace-checkout edge function for Mercado Pago payment
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

  const screenshots = listing.screenshots || [];
  const features = Array.isArray(listing.features) ? listing.features : [];

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Back */}
        <button onClick={() => navigate("/marketplace")} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para a Loja
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Preview + Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Main preview */}
            <div className="rounded-2xl overflow-hidden border border-border/30 bg-muted/10">
              {listing.preview_image_url ? (
                <img src={listing.preview_image_url} alt={listing.title} className="w-full aspect-[16/9] object-cover" />
              ) : (
                <div className="w-full aspect-[16/9] flex items-center justify-center">
                  <Code2 className="h-16 w-16 text-muted-foreground/10" />
                </div>
              )}
            </div>

            {/* Screenshots */}
            {screenshots.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {screenshots.map((url: string, i: number) => (
                  <div key={i} className="rounded-xl overflow-hidden border border-border/20 aspect-video">
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            )}

            {/* Description */}
            <div className="clf-liquid-glass rounded-2xl p-6">
              <h2 className="text-sm font-bold mb-3">Descrição</h2>
              <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {listing.long_description || listing.description}
              </div>
            </div>

            {/* Features */}
            {features.length > 0 && (
              <div className="clf-liquid-glass rounded-2xl p-6">
                <h2 className="text-sm font-bold mb-3">Funcionalidades</h2>
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

            {/* Reviews */}
            <div className="clf-liquid-glass rounded-2xl p-6">
              <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
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
            <div className="clf-liquid-glass rounded-2xl p-6 sticky top-20">
              <h1 className="text-lg font-bold text-foreground mb-1">{listing.title}</h1>
              <p className="text-xs text-muted-foreground mb-4">{listing.description}</p>

              <div className="text-2xl font-bold text-foreground mb-1">
                {listing.price === 0 ? "Grátis" : `R$ ${listing.price.toFixed(2)}`}
              </div>
              <p className="text-[10px] text-muted-foreground/60 mb-4">Comissão da plataforma: 30% • Vendedor recebe 70%</p>

              {alreadyPurchased ? (
                <div className="h-11 rounded-xl bg-green-500/10 text-green-600 text-sm font-semibold flex items-center justify-center gap-2">
                  <Check className="h-4 w-4" /> Você já possui este projeto
                </div>
              ) : (
                <button
                  onClick={handlePurchase}
                  disabled={purchasing}
                  className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {purchasing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
                  {listing.price === 0 ? "Obter Grátis" : "Comprar Agora"}
                </button>
              )}

              {listing.demo_url && (
                <a href={listing.demo_url} target="_blank" rel="noopener noreferrer"
                  className="w-full h-9 mt-3 rounded-xl border border-border/40 text-xs font-medium flex items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                  <ExternalLink className="h-3.5 w-3.5" /> Ver Demo
                </a>
              )}

              {/* Stats */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/20">
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Eye className="h-3 w-3" /> {listing.views_count}</span>
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><ShoppingCart className="h-3 w-3" /> {listing.sales_count} vendas</span>
                {listing.rating > 0 && (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Star className="h-3 w-3 text-amber-400" /> {listing.rating.toFixed(1)}</span>
                )}
              </div>

              {/* Tech stack */}
              {listing.tech_stack?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-4">
                  {listing.tech_stack.map((t: string) => (
                    <span key={t} className="px-2 py-0.5 rounded-full bg-muted/40 text-[9px] text-muted-foreground">{t}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Seller card */}
            {seller && (
              <div className="clf-liquid-glass rounded-2xl p-5">
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
