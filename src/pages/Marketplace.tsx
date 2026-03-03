import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";
import AppLayout from "@/components/AppLayout";
import TopProjectsBanner from "@/components/community/TopProjectsBanner";
import {
  Search, Star, Eye, ShoppingCart, Loader2,
  Tag, Code2, Sparkles, TrendingUp, Package, Flame, Gamepad2,
  Zap, Crown, ChevronRight, Download, Grid3X3,
  Rocket, Cpu, Globe, Palette, Database, Bot, Layers,
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
  { value: "all", label: "Todos", icon: Grid3X3 },
  { value: "webapp", label: "Web App", icon: Globe },
  { value: "dashboard", label: "Dashboard", icon: TrendingUp },
  { value: "landing", label: "Landing", icon: Rocket },
  { value: "saas", label: "SaaS", icon: Layers },
  { value: "ecommerce", label: "E-commerce", icon: ShoppingCart },
  { value: "portfolio", label: "Portfólio", icon: Palette },
  { value: "tool", label: "Ferramenta", icon: Cpu },
  { value: "ai", label: "IA / Bot", icon: Bot },
  { value: "api", label: "API / Backend", icon: Database },
];

const sortOptions = [
  { value: "recent", label: "Recentes" },
  { value: "popular", label: "Hot" },
  { value: "price_asc", label: "Menor preço" },
  { value: "price_desc", label: "Maior preço" },
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
    <div className="rd-page-content">
      {/* Header */}
      <div className="rd-page-head">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div className="nav-ico-box" style={{ background: "linear-gradient(135deg, var(--orange), var(--red))" }}>
              <Gamepad2 size={18} />
            </div>
            <div>
              <div className="sec-label">MARKETPLACE</div>
              <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-.02em", color: "var(--text-primary)" }}>
                STORE
              </h1>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                Projetos prontos &bull; Templates &bull; SaaS Kits
              </p>
            </div>
          </div>
          {user && (
            <Link to="/marketplace/vender" className="gl sm orange" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
              <Tag size={13} /> Vender Projeto
            </Link>
          )}
        </div>
      </div>

      {/* Top Projects Banner */}
      <div style={{ marginBottom: 20 }}>
        <TopProjectsBanner />
      </div>

      {/* Search + Sort + Categories */}
      <div className="rd-card" style={{ padding: 16, marginBottom: 20 }}>
        {/* Row 1: Search + Sort */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, position: "relative", minWidth: 200 }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-quaternary)" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar projetos, templates, kits..."
              style={{
                width: "100%", height: 38, paddingLeft: 34, paddingRight: 12,
                borderRadius: "var(--r3)", background: "var(--bg-3)", border: "1px solid var(--b1)",
                color: "var(--text-primary)", fontSize: 12, fontFamily: "var(--font)",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {sortOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setSortBy(opt.value as any)}
                className={`f-btn ${sortBy === opt.value ? "active" : ""}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Category Pills */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none" as any, paddingBottom: 2 }}>
          {categories.map(c => {
            const active = category === c.value;
            const Icon = c.icon;
            return (
              <button
                key={c.value}
                className={`f-btn ${active ? "active" : ""}`}
                onClick={() => setCategory(c.value)}
                style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}
              >
                <Icon size={12} /> {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Listings */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <Loader2 size={24} style={{ animation: "gl-spin .7s linear infinite", color: "var(--text-tertiary)" }} />
        </div>
      ) : listings.length === 0 ? (
        <EmptyStore hasUser={!!user} />
      ) : (
        <>
          {featured.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <SectionHeader icon={Crown} label="DESTAQUES" />
              <div className="rd-grid-2">
                {featured.map(listing => (
                  <FeaturedCard key={listing.id} listing={listing} onClick={() => navigate(`/marketplace/${listing.slug}`)} />
                ))}
              </div>
            </div>
          )}

          {regular.length > 0 && (
            <div>
              <SectionHeader icon={Flame} label="TODOS OS PROJETOS" />
              <div className="rd-grid-3">
                {regular.map(listing => (
                  <ListingCard key={listing.id} listing={listing} onClick={() => navigate(`/marketplace/${listing.slug}`)} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  if (user) return <AppLayout>{content}</AppLayout>;
  return content;
}

/* ── Section Header ── */
function SectionHeader({ icon: Icon, label }: { icon: typeof Star; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
      <Icon size={14} style={{ color: "var(--orange)" }} />
      <span className="sec-label">{label}</span>
      <div style={{ flex: 1, height: 1, background: "var(--b1)" }} />
    </div>
  );
}

/* ── Empty Store ── */
function EmptyStore({ hasUser }: { hasUser: boolean }) {
  return (
    <div className="rd-card" style={{ textAlign: "center", padding: "48px 20px" }}>
      <Gamepad2 size={40} style={{ color: "var(--text-quaternary)", opacity: 0.2, margin: "0 auto 12px" }} />
      <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Nenhum projeto encontrado</p>
      <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>Seja o primeiro a publicar!</p>
      {hasUser && (
        <Link to="/marketplace/vender" className="gl sm orange" style={{ marginTop: 16, display: "inline-flex", textDecoration: "none" }}>
          <Tag size={13} /> Publicar Projeto
        </Link>
      )}
    </div>
  );
}

/* ── Featured Card ── */
function FeaturedCard({ listing, onClick }: { listing: Listing; onClick: () => void }) {
  const seller = listing.seller_profiles;
  return (
    <div onClick={onClick} className="rd-card interactive" style={{ padding: 0, cursor: "pointer", overflow: "hidden" }}>
      <div style={{ position: "relative", aspectRatio: "16/9", background: "var(--bg-3)", overflow: "hidden" }}>
        {listing.preview_image_url ? (
          <img src={listing.preview_image_url} alt={listing.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Code2 size={32} style={{ color: "var(--text-quaternary)", opacity: 0.15 }} />
          </div>
        )}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,.6) 0%, transparent 60%)" }} />
        <div style={{ position: "absolute", top: 10, left: 10 }}>
          <span className="chip orange" style={{ fontSize: 8 }}><Crown size={10} /> DESTAQUE</span>
        </div>
        <div style={{ position: "absolute", top: 10, right: 10 }}>
          <PriceBadge price={listing.price} />
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 16 }}>
          <h3 style={{ fontSize: 17, fontWeight: 900, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{listing.title}</h3>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{listing.description}</p>
        </div>
      </div>
      <div style={{ padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
    <div onClick={onClick} className="rd-card interactive" style={{ padding: 0, cursor: "pointer", overflow: "hidden" }}>
      <div style={{ position: "relative", aspectRatio: "16/10", background: "var(--bg-3)", overflow: "hidden" }}>
        {listing.preview_image_url ? (
          <img src={listing.preview_image_url} alt={listing.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Code2 size={24} style={{ color: "var(--text-quaternary)", opacity: 0.12 }} />
          </div>
        )}
        <div style={{ position: "absolute", top: 8, right: 8 }}>
          <PriceBadge price={listing.price} />
        </div>
      </div>
      <div style={{ padding: 14 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>{listing.title}</h3>
        <p style={{ fontSize: 11, color: "var(--text-tertiary)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden", marginBottom: 10, lineHeight: 1.5 }}>{listing.description}</p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <SellerInfo seller={seller} />
          <StatsRow listing={listing} />
        </div>
        {listing.tech_stack.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 10 }}>
            {listing.tech_stack.slice(0, 4).map(t => (
              <span key={t} className="chip" style={{ fontSize: 8, padding: "1px 6px" }}>{t}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Subcomponents ── */
function PriceBadge({ price }: { price: number }) {
  const isFree = price === 0;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 10px", borderRadius: 9999, fontSize: 11, fontWeight: 800,
      background: isFree ? "rgba(16,185,129,.85)" : "rgba(0,0,0,.65)",
      color: "#fff", backdropFilter: "blur(8px)",
    }}>
      {isFree ? <><Zap size={11} /> FREE</> : `R$ ${price.toFixed(2)}`}
    </span>
  );
}

function SellerInfo({ seller }: { seller: Listing["seller_profiles"] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {seller?.avatar_url ? (
        <img src={seller.avatar_url} alt="" style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover" }} />
      ) : (
        <div style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--bg-4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: "var(--text-tertiary)" }}>
          {seller?.display_name?.[0] || "?"}
        </div>
      )}
      <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{seller?.display_name || "Anônimo"}</span>
      {seller?.is_verified && <Sparkles size={10} style={{ color: "var(--orange)" }} />}
    </div>
  );
}

function StatsRow({ listing }: { listing: Listing }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, color: "var(--text-quaternary)" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Eye size={10} /> {listing.views_count}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Download size={10} /> {listing.sales_count}</span>
      {listing.rating > 0 && (
        <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Star size={10} style={{ color: "var(--orange)" }} /> {listing.rating.toFixed(1)}</span>
      )}
    </div>
  );
}
