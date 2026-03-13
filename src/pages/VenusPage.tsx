import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useExtensionAccess } from "@/hooks/useExtensionAccess";
import { useTenant } from "@/contexts/TenantContext";
import AppLayout from "@/components/AppLayout";
import MeshBackground from "@/components/MeshBackground";
import { toast } from "sonner";
import {
  Sparkles, Shield, Zap, Brain, Workflow, Download, Lock, ArrowLeft,
  Check, Loader2, Crown, AlertTriangle, Cpu, Target, Bolt, Chrome,
  ChevronDown,
} from "lucide-react";

interface VenusPlan {
  id: string;
  name: string;
  display_name: string;
  price: number;
  billing_cycle: string;
  highlight_label: string | null;
  features: string[];
}

const features = [
  { icon: Crown, title: "God Mode", desc: "Acesso ilimitado a todas as funcionalidades sem restrições." },
  { icon: Workflow, title: "Modo Orquestrado", desc: "Automação inteligente com execução sequencial e paralela." },
  { icon: Brain, title: "OrbIOS AI Brain", desc: "IA contextual que entende seu projeto e executa correções." },
...
  const brandName = tenant?.name || "OrbIOS";
  const [plans, setPlans] = useState<VenusPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const userHasAccess = !accessLoading && hasAccessTo("venus");

  useEffect(() => {
    const load = async () => {
      const { data: peData } = await supabase
        .from("plan_extensions")
        .select("plan_id")
        .eq("extension_id", "f1a2b3c4-d5e6-7890-abcd-ef1234567890");

      if (peData && peData.length > 0) {
        const planIds = peData.map((pe: any) => pe.plan_id);
        const { data: plansData } = await supabase
          .from("plans")
          .select("id, name, display_name, price, billing_cycle, highlight_label, features")
          .in("id", planIds)
          .eq("is_active", true)
          .eq("is_public", true)
          .order("price", { ascending: true });

        setPlans((plansData || []).map((p: any) => ({
          ...p,
          features: Array.isArray(p.features) ? p.features : [],
        })));
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleDownload = async () => {
    if (!user) { navigate("/login"); return; }
    if (!userHasAccess) {
      toast.error("Ative o plano God Mode para acessar a Venus.");
      navigate("/checkout");
      return;
    }
    const { data: extFile } = await supabase
      .from("extension_files")
      .select("file_url, version")
      .eq("extension_id", "f1a2b3c4-d5e6-7890-abcd-ef1234567890")
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
      toast.info("Extensão disponível em breve.");
    }
  };

  const billingLabel: Record<string, string> = { daily: "/dia", monthly: "/mês" };

  const content = (
    <div className="venus-page">
      {!user && <MeshBackground />}

      {/* Guest Nav */}
      {!user && (
        <nav className="venus-guest-nav">
          <div className="rd-card" style={{ padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Link to="/" style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", textDecoration: "none" }}>{brandName}</Link>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Link to="/community" className="gl sm ghost" style={{ textDecoration: "none" }}>Comunidade</Link>
              <Link to="/login" className="gl sm ghost" style={{ textDecoration: "none" }}>Entrar</Link>
              <Link to="/register" className="gl sm primary" style={{ textDecoration: "none" }}>Começar Grátis</Link>
            </div>
          </div>
        </nav>
      )}

      {/* Breadcrumb */}
      <div className="venus-container venus-breadcrumb">
        <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-tertiary)", textDecoration: "none" }}>
          <ArrowLeft size={14} /> Voltar ao início
        </Link>
      </div>

      {/* HERO */}
      <section className="venus-hero">
        <div className="venus-hero-icon">
          <Sparkles size={32} color="#fff" />
        </div>

        <h1 className="venus-hero-title">
          Venus <span>AI</span>
        </h1>
        <p className="venus-hero-sub">
          A extensão nativa mais poderosa do ecossistema. Funciona <strong>dentro do Lovable</strong> com acesso total:
          modo orquestrado, tasks automatizadas, Brain integrado e build automation.
        </p>

        {/* CTA */}
        <div className="venus-cta-row">
          {userHasAccess ? (
            <button onClick={handleDownload} className="gl lg primary">
              <Download size={18} /> Baixar Venus
            </button>
          ) : (
            <Link to="/checkout" className="gl lg primary" style={{ textDecoration: "none" }}>
              <Lock size={18} /> Ativar God Mode
            </Link>
          )}
        </div>
        <div className="venus-chrome-note">
          <Chrome size={13} /> Extensão nativa para Chrome
        </div>
      </section>

      {/* FEATURES */}
      <section className="venus-section">
        <div className="venus-container">
          <div className="venus-section-head">
            <span className="sec-label">Funcionalidades</span>
            <h2>Tudo que você precisa</h2>
          </div>
          <div className="venus-feat-grid">
            {features.map((feat, i) => (
              <div key={i} className="venus-feat-card">
                <div className="venus-feat-ico">
                  <feat.icon size={16} />
                </div>
                <div>
                  <p className="venus-feat-title">{feat.title}</p>
                  <p className="venus-feat-desc">{feat.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECURITY NOTICE */}
      <section className="venus-section" style={{ paddingTop: 0 }}>
        <div className="venus-container">
          <div className="venus-warning">
            <AlertTriangle size={15} />
            <p>
              <strong>Proteção ativa:</strong> Tentativas de burlar a validação do token Venus
              resultarão em <strong>bloqueio permanente</strong> e notificação ao administrador.
            </p>
          </div>
        </div>
      </section>

      {/* PLANS */}
      {plans.length > 0 && (
        <section className="venus-section">
          <div className="venus-container">
            <div className="venus-section-head">
              <span className="sec-label">Planos</span>
              <h2>God Mode</h2>
            </div>
            <div className="venus-plans-grid">
              {plans.map((plan) => {
                const isHighlight = !!plan.highlight_label;
                return (
                  <div key={plan.id} className={`venus-plan-card ${isHighlight ? "highlight" : ""}`}>
                    {isHighlight && (
                      <span className="venus-plan-badge">{plan.highlight_label}</span>
                    )}
                    <div className="venus-plan-head">
                      <p className="venus-plan-name">{plan.display_name || plan.name}</p>
                      <div className="venus-plan-price">
                        <span className="venus-price-value">
                          R${(plan.price / 100).toFixed(2).replace(".", ",")}
                        </span>
                        <span className="venus-price-cycle">{billingLabel[plan.billing_cycle] || ""}</span>
                      </div>
                    </div>
                    {plan.features.length > 0 && (
                      <div className="venus-plan-features">
                        {plan.features.map((f, i) => (
                          <div key={i} className="venus-plan-feat-item">
                            <Check size={13} />
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {!userHasAccess && (
                      <Link to="/checkout" className={`gl ${isHighlight ? "primary" : ""}`} style={{ width: "100%", justifyContent: "center", textDecoration: "none" }}>
                        Assinar Agora
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="venus-wl-note">
              <strong>White Labels:</strong> a partir de R$7,96/dia ou R$59,96/mês por pessoa.{" "}
              <Link to="/whitelabel" style={{ color: "var(--blue-l)" }}>Saiba mais →</Link>
            </p>
          </div>
        </section>
      )}

      {loading && (
        <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
          <Loader2 size={20} className="animate-spin" style={{ color: "var(--text-tertiary)" }} />
        </div>
      )}

      {/* FAQ */}
      <section className="venus-section">
        <div className="venus-container venus-faq-container">
          <div className="venus-section-head">
            <span className="sec-label">Dúvidas frequentes</span>
            <h2>FAQ</h2>
          </div>
          <div className="venus-faq-list">
            {faqs.map((faq, i) => (
              <div key={i} className="venus-faq-item" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                <div className="venus-faq-q">
                  <span>{faq.q}</span>
                  <ChevronDown size={14} style={{ transition: "transform .2s", transform: openFaq === i ? "rotate(180deg)" : "none" }} />
                </div>
                {openFaq === i && <p className="venus-faq-a">{faq.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="venus-footer">
        <div className="venus-container venus-footer-inner">
          <p>© {new Date().getFullYear()} {brandName} — Todos os direitos reservados</p>
          <div className="venus-footer-links">
            <Link to="/">Início</Link>
            <Link to="/community">Comunidade</Link>
            <Link to="/termos">Termos</Link>
            <Link to="/suporte">Suporte</Link>
          </div>
        </div>
      </footer>
    </div>
  );

  return user ? <AppLayout>{content}</AppLayout> : content;
}
