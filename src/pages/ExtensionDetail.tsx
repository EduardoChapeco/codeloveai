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
  const brandName = tenant?.name || "OrbIOS";
...
      toast.error("OrbIOS Labs é exclusivo para proprietários de White Label.");
      return;
    }
    if (!userHasAccess) {
      toast.error("Faça upgrade do seu plano para acessar esta extensão.");
      navigate("/checkout");
      return;
    }
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
    <nav style={{ position: "sticky", top: 0, zIndex: 20, padding: "12px 24px" }}>
      <div className="rd-card" style={{ padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link to="/" style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", textDecoration: "none" }}>{brandName}</Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link to="/extensoes" style={{ fontSize: 12, color: "var(--text-tertiary)", textDecoration: "none" }}>Extensões</Link>
          <Link to="/login" className="gl sm ghost" style={{ textDecoration: "none" }}>Entrar</Link>
        </div>
      </div>
    </nav>
  ) : null;

  if (loading) {
    return user ? (
      <AppLayout>
        <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Loader2 size={24} className="animate-spin" style={{ color: "var(--text-tertiary)" }} />
        </div>
      </AppLayout>
    ) : (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-0)" }}>
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--text-tertiary)" }} />
      </div>
    );
  }

  if (!ext) {
    const notFoundContent = (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", marginBottom: 16 }}>Extensão não encontrada</h1>
        <Link to="/extensoes" className="gl primary" style={{ textDecoration: "none" }}>Ver todas as extensões</Link>
      </div>
    );
    return user ? <AppLayout>{notFoundContent}</AppLayout> : notFoundContent;
  }

  const Icon = iconMap[ext.icon] || Puzzle;

  const pageContent = (
    <div style={{ minHeight: "100vh", position: "relative" }}>
      {!user && <MeshBackground />}
      {guestNav}

      {/* Breadcrumb */}
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 24px 0" }}>
        <Link to="/extensoes" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-tertiary)", textDecoration: "none" }}>
          <ArrowLeft size={14} /> Voltar para Extensões
        </Link>
      </div>

      {/* Hero */}
      <section style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px 48px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          <div style={{ display: "flex", gap: 32, alignItems: "flex-start", flexWrap: "wrap" }}>
            {/* Icon + Info */}
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                <div className="rd-ico-box" style={{ width: 56, height: 56, borderRadius: "var(--r4)", backgroundColor: ext.hero_color }}>
                  <Icon size={28} color="#fff" />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>{ext.name}</h1>
                    <span className="chip ch-blue sm">v{ext.version}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{ext.tagline}</p>
                </div>
              </div>

              <p className="body-text" style={{ marginBottom: 16 }}>{ext.description}</p>

              {/* Beta Warning */}
              <div className="rd-card" style={{ borderLeft: "3px solid var(--orange)", display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 24, padding: "10px 14px" }}>
                <AlertTriangle size={14} style={{ color: "var(--orange-l)", flexShrink: 0, marginTop: 2 }} />
                <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                  <span style={{ fontWeight: 700, color: "var(--orange-l)" }}>Beta:</span> Esta extensão está em fase beta. Algumas mensagens podem gerar cobrança de créditos no Lovable.
                </p>
              </div>

              {/* CTA Buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {userHasAccess ? (
                  <button onClick={handleDownload} className="gl lg orange">
                    <Download size={16} /> Baixar Extensão
                  </button>
                ) : (
                  <Link to="/checkout" className="gl lg primary" style={{ textDecoration: "none" }}>
                    <Lock size={16} /> Fazer Upgrade
                  </Link>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-tertiary)" }}>
                  <Chrome size={14} /> Chrome Extension
                </div>
              </div>
            </div>

            {/* Status card */}
            <div className="rd-card" style={{ width: 240, flexShrink: 0 }}>
              <div style={{ marginBottom: 16 }}>
                <div className="sec-label" style={{ marginBottom: 4 }}>Tier</div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{tierLabels[ext.tier] || ext.tier}</p>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div className="sec-label" style={{ marginBottom: 4 }}>Versão</div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{ext.version}</p>
              </div>
              <div>
                <div className="sec-label" style={{ marginBottom: 4 }}>Status</div>
                <p style={{ fontSize: 13, fontWeight: 700, color: userHasAccess ? "var(--green-l)" : "var(--text-primary)" }}>
                  {userHasAccess ? "Incluído no seu plano" : "Upgrade necessário"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      {ext.features.length > 0 && (
        <section style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px 48px" }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", marginBottom: 24 }}>Recursos</h2>
          <div className="rd-grid-2">
            {ext.features.map((feat, i) => (
              <div key={i} className="rd-card" style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div className="rd-ico-box sm" style={{ backgroundColor: ext.hero_color + "20" }}>
                  <Check size={14} style={{ color: ext.hero_color }} />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>{feat.title}</p>
                  <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{feat.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Plans */}
      {plans.length > 0 && (
        <section style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px 64px" }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", marginBottom: 24 }}>Disponível nos planos</h2>
          <div className="rd-grid-3">
            {plans.map(plan => (
              <div key={plan.id} className="rd-card" style={{ textAlign: "center" }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>{plan.name}</p>
                <p className="rd-stat-value" style={{ fontSize: 22 }}>
                  R${(plan.price / 100).toFixed(2).replace(".", ",")}
                  <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-tertiary)" }}>{billingLabel[plan.billing_cycle] || ""}</span>
                </p>
                {!userHasAccess && (
                  <Link to="/checkout" className="gl sm orange" style={{ marginTop: 16, display: "inline-flex", textDecoration: "none" }}>
                    <ArrowRight size={12} /> Assinar
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
