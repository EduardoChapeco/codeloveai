import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";
import AppLayout from "@/components/AppLayout";
import MeshBackground from "@/components/MeshBackground";
import {
  Search, Star, Eye, ShoppingCart, ArrowRight, Loader2,
  Tag, Code2, Sparkles, Filter, TrendingUp, Package,
} from "lucide-react";

interface Listing {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  tags: string[];
  price: number;
  currency: string;
  preview_image_url: string | null;
  screenshots: string[];
  tech_stack: string[];
  is_featured: boolean;
  views_count: number;
  sales_count: number;
  rating: number;
  rating_count: number;
  seller_id: string;
  seller_profiles?: { display_name: string; avatar_url: string | null; is_verified: boolean } | null;
}

const categories = [
  { value: "all", label: "Todos" },
  { value: "webapp", label: "Web App" },
  { value: "dashboard", label: "Dashboard" },
  { value: "landing", label: "Landing Page" },
  { value: "saas", label: "SaaS" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "portfolio", label: "Portfólio" },
  { value: "tool", label: "Ferramenta" },
];

export default function Marketplace() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const brandName = tenant?.name || "Starble";

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sortBy, setSortBy] = useState<"recent" | "popular" | "price_asc" | "price_desc">("recent");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      let query = supabase
        .from("marketplace_listings")
        .select("*, seller_profiles(display_name, avatar_url, is_verified)")
        .eq("status", "published")
        .order(
          sortBy === "popular" ? "sales_count" : sortBy === "price_asc" || sortBy === "price_desc" ? "price" : "created_at",
          { ascending: sortBy === "price_asc" }
        );

      if (category !== "all") query = query.eq("category", category);
      if (search.trim()) query = query.ilike("title", `%${search.trim()}%`);

      const { data } = await query.limit(50);
      setListings((data as any[]) || []);
      setLoading(false);
    };
    load();
  }, [category, sortBy, search]);

  const featured = listings.filter(l => l.is_featured);
  const regular = listings.filter(l => !l.is_featured);

  const content = (
    <div className="min-h-screen relative">
      {!user && <MeshBackground />}

      {/* Hero */}
      <section className="px-6 pt-12 pb-8 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <Package className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Loja de Projetos</h1>
            <p className="text-xs text-muted-foreground">Compre e venda projetos prontos — templates, SaaS, dashboards e mais</p>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-8">
          <div className="flex-1 min-w-[240px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar projetos..."
              className="lv-input w-full pl-10 pr-4"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {categories.map(c => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                className={`h-8 px-3.5 rounded-[10px] text-xs font-semibold whitespace-nowrap transition-all ${
                  category === c.value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "clf-liquid-glass text-muted-foreground hover:text-foreground"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="lv-input h-8 w-auto px-3 text-xs"
            >
            <option value="recent">Mais recentes</option>
            <option value="popular">Mais vendidos</option>
            <option value="price_asc">Menor preço</option>
            <option value="price_desc">Maior preço</option>
          </select>

          {user && (
            <Link
              to="/marketplace/vender"
              className="lv-btn-primary h-8 px-4 text-xs"
            >
              <Tag className="h-3.5 w-3.5" /> Vender Projeto
            </Link>
          )}
        </div>
      </section>

      {/* Listings */}
      <section className="px-6 pb-20 max-w-6xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-20">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/20 mb-4" />
            <p className="text-sm text-muted-foreground mb-2">Nenhum projeto encontrado</p>
            <p className="text-xs text-muted-foreground/60">Seja o primeiro a publicar!</p>
            {user && (
              <Link to="/marketplace/vender" className="lv-btn-primary h-9 px-5 text-xs mt-4 inline-flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" /> Publicar Projeto
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Featured */}
            {featured.length > 0 && (
              <div className="mb-10">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Destaques</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {featured.map(listing => (
                    <ListingCard key={listing.id} listing={listing} featured onClick={() => navigate(`/marketplace/${listing.slug}`)} />
                  ))}
                </div>
              </div>
            )}

            {/* Regular grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {regular.map(listing => (
                <ListingCard key={listing.id} listing={listing} onClick={() => navigate(`/marketplace/${listing.slug}`)} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );

  if (user) return <AppLayout>{content}</AppLayout>;
  return content;
}

function ListingCard({ listing, featured, onClick }: { listing: Listing; featured?: boolean; onClick: () => void }) {
  const seller = listing.seller_profiles;

  return (
    <div
      onClick={onClick}
      className={`group cursor-pointer rounded-2xl overflow-hidden transition-all duration-300 hover:ring-1 hover:ring-primary/30 ${
        featured ? "clf-liquid-glass" : "clf-liquid-glass"
      }`}
    >
      {/* Preview image */}
      <div className={`relative bg-muted/20 ${featured ? "aspect-[16/9]" : "aspect-[16/10]"}`}>
        {listing.preview_image_url ? (
          <img src={listing.preview_image_url} alt={listing.title} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <Code2 className="h-8 w-8 text-muted-foreground/15" />
          </div>
        )}
        {listing.is_featured && (
          <span className="absolute top-3 left-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/90 text-white text-[10px] font-bold">
            <Star className="h-2.5 w-2.5" /> Destaque
          </span>
        )}
        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm text-white text-xs font-bold">
          {listing.price === 0 ? "Grátis" : `R$ ${listing.price.toFixed(2)}`}
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="text-sm font-bold text-foreground mb-1 truncate group-hover:text-primary transition-colors">
          {listing.title}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{listing.description}</p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {seller?.avatar_url ? (
              <img src={seller.avatar_url} alt="" className="h-5 w-5 rounded-full object-cover" />
            ) : (
              <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-[8px] font-bold text-primary">{seller?.display_name?.[0] || "?"}</span>
              </div>
            )}
            <span className="text-[11px] text-muted-foreground">{seller?.display_name || "Anônimo"}</span>
            {seller?.is_verified && <Sparkles className="h-3 w-3 text-primary" />}
          </div>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
            <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" /> {listing.views_count}</span>
            <span className="flex items-center gap-0.5"><ShoppingCart className="h-3 w-3" /> {listing.sales_count}</span>
            {listing.rating > 0 && (
              <span className="flex items-center gap-0.5"><Star className="h-3 w-3 text-amber-400" /> {listing.rating.toFixed(1)}</span>
            )}
          </div>
        </div>

        {listing.tech_stack.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {listing.tech_stack.slice(0, 4).map(t => (
              <span key={t} className="px-1.5 py-0.5 rounded bg-muted/40 text-[9px] text-muted-foreground">{t}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
