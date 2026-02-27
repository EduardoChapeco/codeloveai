import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";
import AppLayout from "@/components/AppLayout";
import MeshBackground from "@/components/MeshBackground";
import {
  Search, Star, Eye, ShoppingCart, Loader2,
  Tag, Code2, Sparkles, TrendingUp, Package, Flame, Gamepad2,
  Zap, Crown, ChevronRight, Download,
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
  { value: "all", label: "Todos", icon: Gamepad2 },
  { value: "webapp", label: "Web App", icon: Code2 },
  { value: "dashboard", label: "Dashboard", icon: TrendingUp },
  { value: "landing", label: "Landing", icon: Zap },
  { value: "saas", label: "SaaS", icon: Crown },
  { value: "ecommerce", label: "E-commerce", icon: ShoppingCart },
  { value: "portfolio", label: "Portfólio", icon: Star },
  { value: "tool", label: "Tool", icon: Package },
];

export default function Marketplace() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const navigate = useNavigate();

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

      {/* ── Gamer Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/8 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative px-6 pt-10 pb-6 max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-2">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-accent flex items-center justify-center shadow-lg shadow-primary/30 relative">
              <Gamepad2 className="h-7 w-7 text-primary-foreground" />
              <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <Flame className="h-3 w-3 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-foreground">
                STORE
              </h1>
              <p className="text-xs text-muted-foreground font-medium tracking-wide uppercase">
                Projetos prontos • Templates • SaaS Kits
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Search + Categories Bar ── */}
      <section className="px-6 pb-6 max-w-6xl mx-auto">
        <div className="flex flex-col gap-4">
          {/* Search */}
          <div className="flex items-center gap-3">
            <div className="flex-1 relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar projetos..."
                className="w-full h-11 pl-11 pr-4 rounded-xl text-sm clf-liquid-glass focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/30 transition-all placeholder:text-muted-foreground/50"
              />
            </div>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="h-11 px-4 rounded-xl text-xs font-semibold clf-liquid-glass text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="recent">Recentes</option>
              <option value="popular">🔥 Hot</option>
              <option value="price_asc">Menor preço</option>
              <option value="price_desc">Maior preço</option>
            </select>
            {user && (
              <Link
                to="/marketplace/vender"
                className="h-11 px-5 rounded-xl text-xs font-bold bg-gradient-to-r from-primary to-primary/80 text-primary-foreground flex items-center gap-2 hover:shadow-lg hover:shadow-primary/25 transition-all active:scale-[0.97] whitespace-nowrap"
              >
                <Tag className="h-3.5 w-3.5" /> Vender
              </Link>
            )}
          </div>

          {/* Category Pills — gamer style */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {categories.map(c => {
              const active = category === c.value;
              const Icon = c.icon;
              return (
                <button
                  key={c.value}
                  onClick={() => setCategory(c.value)}
                  className={`flex items-center gap-2 h-9 px-4 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 ${
                    active
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/30 scale-[1.02]"
                      : "bg-card/40 backdrop-blur-sm border border-border/30 text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-card/60"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Listings ── */}
      <section className="px-6 pb-20 max-w-6xl mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
            <p className="text-xs text-muted-foreground font-medium">Carregando loja...</p>
          </div>
        ) : listings.length === 0 ? (
          <EmptyStore hasUser={!!user} />
        ) : (
          <>
            {/* Featured — Hero Cards */}
            {featured.length > 0 && (
              <div className="mb-10">
                <SectionHeader icon={Crown} label="DESTAQUES" color="text-amber-500" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {featured.map(listing => (
                    <FeaturedCard key={listing.id} listing={listing} onClick={() => navigate(`/marketplace/${listing.slug}`)} />
                  ))}
                </div>
              </div>
            )}

            {/* Regular Grid */}
            {regular.length > 0 && (
              <div>
                <SectionHeader icon={Flame} label="TODOS OS PROJETOS" color="text-primary" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {regular.map(listing => (
                    <ListingCard key={listing.id} listing={listing} onClick={() => navigate(`/marketplace/${listing.slug}`)} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );

  if (user) return <AppLayout>{content}</AppLayout>;
  return content;
}

/* ── Section Header ── */
function SectionHeader({ icon: Icon, label, color }: { icon: typeof Star; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-5">
      <Icon className={`h-4 w-4 ${color}`} />
      <span className="text-[11px] font-black uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
      <div className="flex-1 h-px bg-border/30" />
    </div>
  );
}

/* ── Empty Store ── */
function EmptyStore({ hasUser }: { hasUser: boolean }) {
  return (
    <div className="text-center py-24">
      <div className="h-24 w-24 mx-auto rounded-3xl bg-gradient-to-br from-muted/30 to-muted/10 flex items-center justify-center mb-6">
        <Gamepad2 className="h-10 w-10 text-muted-foreground/20" />
      </div>
      <h3 className="text-lg font-bold mb-2 text-foreground">Nenhum projeto encontrado</h3>
      <p className="text-sm text-muted-foreground mb-6">Seja o primeiro a publicar!</p>
      {hasUser && (
        <Link
          to="/marketplace/vender"
          className="inline-flex items-center gap-2 h-11 px-6 rounded-xl text-sm font-bold bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:shadow-lg hover:shadow-primary/25 transition-all"
        >
          <Tag className="h-4 w-4" /> Publicar Projeto
        </Link>
      )}
    </div>
  );
}

/* ── Featured Card (large, gamer hero) ── */
function FeaturedCard({ listing, onClick }: { listing: Listing; onClick: () => void }) {
  const seller = listing.seller_profiles;

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.01] hover:shadow-xl hover:shadow-primary/10 relative clf-liquid-glass hover:border-primary/30"
    >
      {/* Image */}
      <div className="relative aspect-[16/9] bg-muted/10 overflow-hidden">
        {listing.preview_image_url ? (
          <img src={listing.preview_image_url} alt={listing.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5">
            <Code2 className="h-12 w-12 text-muted-foreground/10" />
          </div>
        )}

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Featured badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/90 text-white text-[10px] font-black uppercase tracking-wider shadow-lg">
          <Crown className="h-3 w-3" /> DESTAQUE
        </div>

        {/* Price */}
        <div className="absolute top-3 right-3">
          <PriceBadge price={listing.price} large />
        </div>

        {/* Bottom info on image */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="text-lg font-black text-white mb-1 truncate group-hover:text-primary-foreground transition-colors">
            {listing.title}
          </h3>
          <p className="text-xs text-white/70 line-clamp-1">{listing.description}</p>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="p-3.5 flex items-center justify-between">
        <SellerInfo seller={seller} />
        <StatsRow listing={listing} />
      </div>
    </div>
  );
}

/* ── Regular Card ── */
function ListingCard({ listing, onClick }: { listing: Listing; onClick: () => void }) {
  const seller = listing.seller_profiles;

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/8 clf-liquid-glass hover:border-primary/30"
    >
      {/* Image */}
      <div className="relative aspect-[16/10] bg-muted/10 overflow-hidden">
        {listing.preview_image_url ? (
          <img src={listing.preview_image_url} alt={listing.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-primary/3 to-accent/3">
            <Code2 className="h-8 w-8 text-muted-foreground/10" />
          </div>
        )}

        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Price badge */}
        <div className="absolute top-2.5 right-2.5">
          <PriceBadge price={listing.price} />
        </div>

        {/* Hover CTA */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
          <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/90 text-primary-foreground text-xs font-bold backdrop-blur-sm shadow-lg">
            Ver Detalhes <ChevronRight className="h-3 w-3" />
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-3.5">
        <h3 className="text-sm font-bold text-foreground mb-1 truncate group-hover:text-primary transition-colors">
          {listing.title}
        </h3>
        <p className="text-[11px] text-muted-foreground line-clamp-2 mb-3 leading-relaxed">{listing.description}</p>

        <div className="flex items-center justify-between">
          <SellerInfo seller={seller} />
          <StatsRow listing={listing} />
        </div>

        {listing.tech_stack.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {listing.tech_stack.slice(0, 4).map(t => (
              <span key={t} className="px-2 py-0.5 rounded-md bg-muted/30 text-[9px] font-semibold text-muted-foreground border border-border/20">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Subcomponents ── */
function PriceBadge({ price, large }: { price: number; large?: boolean }) {
  const isFree = price === 0;
  return (
    <span className={`inline-flex items-center gap-1 rounded-xl font-black shadow-lg backdrop-blur-md ${
      large ? "px-3.5 py-1.5 text-sm" : "px-2.5 py-1 text-xs"
    } ${
      isFree
        ? "bg-emerald-500/90 text-white"
        : "bg-black/70 text-white border border-white/10"
    }`}>
      {isFree ? (
        <>
          <Zap className={large ? "h-4 w-4" : "h-3 w-3"} /> FREE
        </>
      ) : (
        `R$ ${price.toFixed(2)}`
      )}
    </span>
  );
}

function SellerInfo({ seller }: { seller: Listing["seller_profiles"] }) {
  return (
    <div className="flex items-center gap-2">
      {seller?.avatar_url ? (
        <img src={seller.avatar_url} alt="" className="h-5 w-5 rounded-full object-cover ring-1 ring-border/30" />
      ) : (
        <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-[8px] font-black text-primary">{seller?.display_name?.[0] || "?"}</span>
        </div>
      )}
      <span className="text-[11px] text-muted-foreground font-medium">{seller?.display_name || "Anônimo"}</span>
      {seller?.is_verified && <Sparkles className="h-3 w-3 text-primary" />}
    </div>
  );
}

function StatsRow({ listing }: { listing: Listing }) {
  return (
    <div className="flex items-center gap-2.5 text-[10px] text-muted-foreground/60 font-semibold">
      <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" /> {listing.views_count}</span>
      <span className="flex items-center gap-0.5"><Download className="h-3 w-3" /> {listing.sales_count}</span>
      {listing.rating > 0 && (
        <span className="flex items-center gap-0.5 text-amber-500"><Star className="h-3 w-3 fill-amber-400" /> {listing.rating.toFixed(1)}</span>
      )}
    </div>
  );
}
