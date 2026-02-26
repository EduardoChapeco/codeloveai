import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useExtensionAccess } from "@/hooks/useExtensionAccess";
import { useTenant } from "@/contexts/TenantContext";
import AppLayout from "@/components/AppLayout";
import MeshBackground from "@/components/MeshBackground";
import { toast } from "sonner";
import {
  Zap, Rocket, FlaskConical, Puzzle, Check, Lock, ArrowRight, Loader2,
  ArrowLeft, Star, Download, Shield, Sparkles, ExternalLink, Chrome, AlertTriangle,
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
  requirements: string[];
}

interface LinkedPlan {
  id: string;
  name: string;
  price: number;
  billing_cycle: string;
}

const tierLabels: Record<string, string> = { free: "Grátis", pro: "Pro", enterprise: "Enterprise", white_label_only: "White Label" };

export default function ExtensionDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const { hasAccessTo, loading: accessLoading } = useExtensionAccess();
  const brandName = tenant?.name || "Starble";

  const [ext, setExt] = useState<Extension | null>(null);
  const [plans, setPlans] = useState<LinkedPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("extension_catalog")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();

      if (!data) {
        setLoading(false);
        return;
      }

      const raw = data as Record<string, unknown>;
      setExt({
        id: raw.id as string,
        slug: raw.slug as string,
        name: raw.name as string,
        tagline: raw.tagline as string,
        description: raw.description as string,
        icon: raw.icon as string,
        hero_color: raw.hero_color as string,
        tier: raw.tier as string,
        is_featured: raw.is_featured as boolean,
        version: raw.version as string,
        features: Array.isArray(raw.features) ? (raw.features as { title: string; description: string }[]) : [],
        requirements: Array.isArray(raw.requirements) ? (raw.requirements as string[]) : [],
      });

      // Fetch linked plans
      const { data: peData } = await supabase
        .from("plan_extensions")
        .select("plan_id")
        .eq("extension_id", data.id);

      if (peData && peData.length > 0) {
        const planIds = peData.map((pe: any) => pe.plan_id);
        const { data: plansData } = await supabase
          .from("plans")
          .select("id, name, price, billing_cycle")
          .in("id", planIds)
          .eq("is_active", true)
          .eq("is_public", true)
          .order("price", { ascending: true });

        setPlans((plansData || []) as LinkedPlan[]);
      }
      setLoading(false);
    };
    fetch();
  }, [slug]);

  const userHasAccess = !accessLoading && slug ? hasAccessTo(slug) : false;

  const handleDownload = async () => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (!ext) return;

    // Labs is restricted to White Label owners only
    if (ext.tier === "white_label_only") {
      toast.error("Starble Labs é exclusivo para proprietários de White Label.");
      return;
    }

    if (!userHasAccess) {
      toast.error("Faça upgrade do seu plano para acessar esta extensão.");
      navigate("/checkout");
      return;
    }
    // Get latest extension file FOR THIS SPECIFIC EXTENSION
    const { data: extFile } = await supabase
      .from("extension_files")
      .select("file_url, version, instructions")
      .eq("extension_id", ext.id)
      .eq("is_latest", true)
      .maybeSingle();

    if (extFile?.file_url) {
      const { data: signedUrl } = await supabase.storage
        .from("extensions")
        .createSignedUrl(extFile.file_url, 300);
      if (signedUrl?.signedUrl) {
        window.open(signedUrl.signedUrl, "_blank");
        toast.success("Download iniciado!");
      }
    } else {
      toast.info("Extensão disponível em breve. Estamos preparando o arquivo.");
    }
  };

  const billingLabel: Record<string, string> = { daily: "/dia", monthly: "/mês", weekly: "/semana" };

  const guestNav = !user ? (
    <nav className="sticky top-0 z-20 px-6 py-3">
      <div className="lv-glass rounded-2xl px-5 py-2.5 flex items-center justify-between">
        <Link to="/" className="text-base font-semibold tracking-tight text-foreground">{brandName}</Link>
        <div className="flex items-center gap-3">
          <Link to="/extensoes" className="text-xs text-muted-foreground hover:text-foreground">Extensões</Link>
          <Link to="/login" className="lv-btn-secondary h-9 px-4 text-xs">Entrar</Link>
        </div>
      </div>
    </nav>
  ) : null;

  if (loading) {
    return user ? (
      <AppLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    ) : (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!ext) {
    const notFoundContent = (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <h1 className="text-2xl font-bold mb-4">Extensão não encontrada</h1>
        <Link to="/extensoes" className="lv-btn-primary h-10 px-6 text-sm">Ver todas as extensões</Link>
      </div>
    );
    return user ? <AppLayout>{notFoundContent}</AppLayout> : notFoundContent;
  }

  const Icon = iconMap[ext.icon] || Puzzle;

  const pageContent = (
    <div className="min-h-screen relative">
      {!user && <MeshBackground />}
      {guestNav}

      {/* Breadcrumb */}
      <div className="max-w-4xl mx-auto px-6 pt-6">
        <Link to="/extensoes" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para Extensões
        </Link>
      </div>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-8 pb-12">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* Icon + Info */}
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-4">
              <div
                className="h-16 w-16 rounded-2xl flex items-center justify-center shadow-lg shrink-0"
                style={{ backgroundColor: ext.hero_color }}
              >
                <Icon className="h-8 w-8 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl font-bold text-foreground">{ext.name}</h1>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    v{ext.version}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{ext.tagline}</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed mb-4">{ext.description}</p>

            {/* Beta Warning */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-2.5 flex items-start gap-2.5 mb-6">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground">
                <span className="font-semibold text-amber-600">Beta:</span> Esta extensão está em fase beta. Algumas mensagens podem gerar cobrança de créditos no Lovable.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex items-center gap-3">
              {userHasAccess ? (
                <button onClick={handleDownload} className="lv-btn-primary h-11 px-6 text-sm flex items-center gap-2">
                  <Download className="h-4 w-4" /> Baixar Extensão
                </button>
              ) : (
                <Link to="/checkout" className="lv-btn-primary h-11 px-6 text-sm flex items-center gap-2">
                  <Lock className="h-4 w-4" /> Fazer Upgrade
                </Link>
              )}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Chrome className="h-4 w-4" /> Chrome Extension
              </div>
            </div>
          </div>

          {/* Status card */}
          <div className="w-full md:w-64 shrink-0 rounded-2xl border border-border bg-card p-5 space-y-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Tier</p>
              <p className="text-sm font-bold text-foreground">{tierLabels[ext.tier] || ext.tier}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Versão</p>
              <p className="text-sm font-bold text-foreground">{ext.version}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Status</p>
              <p className="text-sm font-bold text-foreground">{userHasAccess ? "✓ Incluído no seu plano" : "Upgrade necessário"}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      {ext.features.length > 0 && (
        <section className="max-w-4xl mx-auto px-6 pb-12">
          <h2 className="text-lg font-bold text-foreground mb-6">Recursos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ext.features.map((feat, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: ext.hero_color + "20" }}>
                    <Check className="h-4 w-4" style={{ color: ext.hero_color }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-1">{feat.title}</p>
                    <p className="text-xs text-muted-foreground">{feat.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Plans */}
      {plans.length > 0 && (
        <section className="max-w-4xl mx-auto px-6 pb-16">
          <h2 className="text-lg font-bold text-foreground mb-6">Disponível nos planos</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map(plan => (
              <div key={plan.id} className="rounded-2xl border border-border bg-card p-5 text-center">
                <p className="text-sm font-bold text-foreground mb-2">{plan.name}</p>
                <p className="text-2xl font-black text-foreground">
                  R${(plan.price / 100).toFixed(2).replace(".", ",")}
                  <span className="text-xs font-normal text-muted-foreground">{billingLabel[plan.billing_cycle] || ""}</span>
                </p>
                {!userHasAccess && (
                  <Link to="/checkout" className="lv-btn-primary h-9 px-4 text-xs mt-4 inline-flex items-center gap-1">
                    <ArrowRight className="h-3.5 w-3.5" /> Assinar
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );

  return user ? <AppLayout>{pageContent}</AppLayout> : pageContent;
}
