import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useExtensionAccess } from "@/hooks/useExtensionAccess";
import { useTenant } from "@/contexts/TenantContext";
import AppLayout from "@/components/AppLayout";
import MeshBackground from "@/components/MeshBackground";
import {
  Zap, Rocket, FlaskConical, Puzzle, Check, Lock, ArrowRight, Loader2,
  Star, Download, Shield, Search as SearchIcon, Sparkles, AlertTriangle,
} from "lucide-react";

const iconMap: Record<string, typeof Puzzle> = {
  Zap, Rocket, FlaskConical, Puzzle, Shield, Sparkles, Star,
};

interface Extension {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  hero_color: string;
  tier: string;
  is_featured: boolean;
  version: string;
  features: { title: string; description: string }[];
}

const tierLabels: Record<string, string> = {
  free: "Grátis",
  pro: "Pro",
  enterprise: "Enterprise",
};

const tierColors: Record<string, string> = {
  free: "bg-green-500/10 text-green-600",
  pro: "bg-primary/10 text-primary",
  enterprise: "bg-amber-500/10 text-amber-600",
};

export default function ExtensionStore() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const { hasAccessTo, loading: accessLoading } = useExtensionAccess();
  const brandName = tenant?.name || "Starble";

  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("extension_catalog")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (data) {
        setExtensions(
          data.map((e: any) => ({
            ...e,
            features: Array.isArray(e.features) ? e.features : [],
          }))
        );
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const guestNav = !user ? (
    <nav className="sticky top-0 z-20 px-6 py-3">
      <div className="lv-glass rounded-2xl px-5 py-2.5 flex items-center justify-between">
        <Link to="/" className="text-base font-semibold tracking-tight text-foreground">{brandName}</Link>
        <div className="flex items-center gap-3">
          <Link to="/login" className="lv-btn-secondary h-9 px-4 text-xs">Entrar</Link>
          <Link to="/register" className="lv-btn-primary h-9 px-4 text-xs">Criar Conta</Link>
        </div>
      </div>
    </nav>
  ) : null;

  const content = (
    <div className="min-h-screen relative">
      {!user && <MeshBackground />}
      {guestNav}

      {/* Hero */}
      <section className="px-6 pt-16 pb-12 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-6">
          <Download className="h-3.5 w-3.5" />
          Extensões Chrome
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
          Loja de Extensões
        </h1>
        <p className="text-base text-muted-foreground max-w-2xl mx-auto">
          Potencialize seus projetos Lovable com extensões profissionais. 
          Cada plano desbloqueia ferramentas diferentes.
        </p>

        {/* Beta Warning Banner */}
        <div className="mt-6 max-w-2xl mx-auto rounded-xl border border-amber-500/30 bg-amber-500/5 px-5 py-3 flex items-start gap-3 text-left">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-600">Fase Beta</p>
            <p className="text-[11px] text-muted-foreground">
              Todas as extensões estão em fase beta. Algumas mensagens enviadas podem gerar cobrança de créditos no Lovable. Use com atenção.
            </p>
          </div>
        </div>
      </section>

      {/* Extensions Grid */}
      <section className="px-6 pb-20 max-w-5xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {extensions.map((ext) => {
              const Icon = iconMap[ext.icon] || Puzzle;
              const userHasAccess = !accessLoading && hasAccessTo(ext.slug);

              return (
                <div
                  key={ext.id}
                  className="group clf-liquid-glass hover:ring-1 hover:ring-primary/20 transition-all duration-300 flex flex-col overflow-hidden cursor-pointer"
                  onClick={() => navigate(`/extensoes/${ext.slug}`)}
                >
                  {/* Header with color accent */}
                  <div
                    className="h-32 flex items-center justify-center relative"
                    style={{ background: `linear-gradient(135deg, ${ext.hero_color}15, ${ext.hero_color}05)` }}
                  >
                    <div
                      className="h-16 w-16 rounded-2xl flex items-center justify-center shadow-lg"
                      style={{ backgroundColor: ext.hero_color }}
                    >
                      <Icon className="h-8 w-8 text-white" />
                    </div>
                    {ext.is_featured && (
                      <span className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-bold">
                        <Star className="h-3 w-3" /> Destaque
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-sm font-bold text-foreground">{ext.name}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tierColors[ext.tier] || tierColors.free}`}>
                        {tierLabels[ext.tier] || ext.tier}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-4 line-clamp-2">{ext.tagline}</p>

                    {/* Feature preview */}
                    <div className="space-y-1.5 mb-4 flex-1">
                      {ext.features.slice(0, 3).map((f, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Check className="h-3 w-3 text-primary shrink-0" />
                          <span className="text-[11px] text-muted-foreground">{f.title}</span>
                        </div>
                      ))}
                      {ext.features.length > 3 && (
                        <p className="text-[10px] text-muted-foreground/60 pl-5">
                          +{ext.features.length - 3} recursos
                        </p>
                      )}
                    </div>

                    {/* CTA */}
                    <div className="mt-auto">
                      {userHasAccess ? (
                        <div className="flex items-center gap-2 text-xs font-semibold text-green-600">
                          <Check className="h-4 w-4" /> Desbloqueado
                        </div>
                      ) : ext.tier === "free" ? (
                        <button className="w-full h-9 rounded-xl bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors flex items-center justify-center gap-1.5">
                          Instalar Grátis <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button className="w-full h-9 rounded-xl bg-muted text-muted-foreground text-xs font-semibold hover:bg-muted/80 transition-colors flex items-center justify-center gap-1.5">
                          <Lock className="h-3 w-3" /> Requer Plano {tierLabels[ext.tier]}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* CTA Section */}
        <div className="mt-16 clf-liquid-glass p-8 md:p-12 text-center">
          <h2 className="text-xl font-bold text-foreground mb-3">
            Desbloqueie todas as extensões
          </h2>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto mb-6">
            Faça upgrade para o plano Pro e tenha acesso a todas as ferramentas profissionais.
            A partir de R$9,90/dia.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link to="/precos" className="lv-btn-primary h-10 px-6 text-sm flex items-center gap-2">
              Ver Planos <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/checkout" className="lv-btn-secondary h-10 px-6 text-sm">
              Ir para Checkout
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 px-6 py-6 text-center">
        <p className="text-[10px] text-muted-foreground/60">© 2025 {brandName} — Todos os direitos reservados</p>
      </footer>
    </div>
  );

  if (user) return <AppLayout>{content}</AppLayout>;
  return content;
}
