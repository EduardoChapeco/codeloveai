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
  ArrowRight, ChevronDown,
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
  { icon: Workflow, title: "Modo Orquestrado", desc: "Automação inteligente com execução sequencial e paralela de tarefas." },
  { icon: Brain, title: "Star AI Brain", desc: "IA contextual integrada que entende seu projeto e executa correções." },
  { icon: Cpu, title: "Chat Multi-Modo", desc: "5 modos: task, chat, security fix, build error e task error." },
  { icon: Bolt, title: "Build Automation", desc: "Detecção e correção automática de erros de build em tempo real." },
  { icon: Target, title: "Tasks & PRD Engine", desc: "Motor de geração e execução de PRDs com acompanhamento." },
  { icon: Shield, title: "Anti-Bypass Protection", desc: "Proteção avançada contra uso não autorizado com bloqueio automático." },
  { icon: Zap, title: "Zero Latência", desc: "Execução direta via canal nativo — sem intermediários, sem delay." },
];

const faqs = [
  { q: "Preciso de um plano Lovable pago?", a: "Não necessariamente. Venus funciona com qualquer conta Lovable, mas ter um plano pago pode melhorar a experiência geral." },
  { q: "O que acontece se meu token expirar?", a: "A extensão detecta automaticamente tokens expirados e tenta um refresh. Se falhar, basta reconectar na extensão." },
  { q: "Posso usar em múltiplos projetos?", a: "Sim! Venus funciona em qualquer projeto Lovable vinculado à sua conta. Basta selecionar o projeto ativo na extensão." },
  { q: "É seguro usar?", a: "Venus utiliza criptografia de ponta, tokens CLF1 assinados via HMAC-SHA256 e validação de hardware. Tentativas de bypass resultam em bloqueio automático." },
];

export default function VenusPage() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const { hasAccessTo, loading: accessLoading } = useExtensionAccess();
  const brandName = tenant?.name || "Starble";
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
    <div style={{ minHeight: "100vh", position: "relative" }}>
      {!user && <MeshBackground />}

      {/* Guest Nav */}
      {!user && (
        <nav style={{ position: "sticky", top: 0, zIndex: 20, padding: "12px 24px" }}>
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
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 24px 0" }}>
        <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-tertiary)", textDecoration: "none" }}>
          <ArrowLeft size={14} /> Voltar ao início
        </Link>
      </div>

      {/* HERO */}
      <section style={{ padding: "40px 24px 80px", maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
        <div className="chip ch-orange" style={{ marginBottom: 24 }}>
          <Crown size={14} /> God Mode — poder máximo
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
          <div className="rd-ico-box" style={{ width: 80, height: 80, borderRadius: "var(--r5)", background: "linear-gradient(135deg, var(--orange), #f97316)", boxShadow: "0 20px 60px -12px rgba(245,158,11,0.4)" }}>
            <Sparkles size={36} color="#000" />
          </div>
        </div>

        <h1 style={{ fontSize: 36, fontWeight: 900, letterSpacing: "-0.04em", color: "var(--text-primary)", marginBottom: 20 }}>
          Starble <span style={{ background: "linear-gradient(135deg, var(--orange-l), var(--orange))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Venus</span>
        </h1>
        <p className="body-text" style={{ fontSize: 14, maxWidth: 560, margin: "0 auto 40px", lineHeight: 1.7 }}>
          A extensão nativa mais poderosa do ecossistema. Funciona <strong style={{ color: "var(--text-primary)" }}>dentro do Lovable</strong> com acesso total:
          modo orquestrado, tasks automatizadas, Brain integrado e build automation.
        </p>

        {/* CTA */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            {userHasAccess ? (
              <button onClick={handleDownload} className="gl lg orange">
                <Download size={18} /> Baixar Venus
              </button>
            ) : (
              <Link to="/checkout" className="gl lg primary" style={{ textDecoration: "none" }}>
                <Lock size={18} /> Ativar God Mode
              </Link>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-tertiary)" }}>
            <Chrome size={14} /> Extensão nativa para Chrome
          </div>
        </div>

        {/* Warning */}
        <div className="rd-card" style={{ maxWidth: 480, margin: "0 auto", borderLeft: "3px solid var(--red)", display: "flex", alignItems: "flex-start", gap: 12, textAlign: "left" }}>
          <AlertTriangle size={16} style={{ color: "var(--red-l)", flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
            <span style={{ fontWeight: 700, color: "var(--red-l)" }}>Proteção ativa:</span> Tentativas de burlar a validação do token Venus
            resultarão em <strong style={{ color: "var(--text-primary)" }}>bloqueio permanente</strong> e notificação ao administrador.
          </p>
        </div>
      </section>

      {/* FEATURES GRID */}
      <section style={{ padding: "0 24px 96px", maxWidth: 1000, margin: "0 auto" }}>
        <div className="sec-label" style={{ textAlign: "center", marginBottom: 12 }}>Funcionalidades</div>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: "var(--text-primary)", textAlign: "center", marginBottom: 48 }}>Tudo que você precisa</h2>
        <div className="rd-grid-4">
          {features.map((feat, i) => (
            <div key={i} className="rd-card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="rd-ico-box ib-orange">
                <feat.icon size={18} />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>{feat.title}</p>
                <p className="body-text">{feat.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PLANS */}
      {plans.length > 0 && (
        <section style={{ padding: "0 24px 96px", maxWidth: 1000, margin: "0 auto" }}>
          <div className="sec-label" style={{ textAlign: "center", marginBottom: 12 }}>Planos</div>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: "var(--text-primary)", textAlign: "center", marginBottom: 48 }}>God Mode</h2>
          <div className="rd-grid-2" style={{ maxWidth: 700, margin: "0 auto" }}>
            {plans.map((plan) => {
              const isHighlight = !!plan.highlight_label;
              return (
                <div key={plan.id} className="rd-card" style={{
                  display: "flex", flexDirection: "column",
                  border: isHighlight ? "1.5px solid rgba(245,158,11,0.35)" : undefined,
                  position: "relative",
                }}>
                  {isHighlight && (
                    <span className="chip ch-orange" style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)" }}>
                      {plan.highlight_label}
                    </span>
                  )}
                  <div style={{ marginBottom: 24 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>{plan.display_name || plan.name}</p>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                      <span className="rd-stat-value" style={{ fontSize: 28 }}>
                        R${(plan.price / 100).toFixed(2).replace(".", ",")}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{billingLabel[plan.billing_cycle] || ""}</span>
                    </div>
                  </div>
                  {plan.features.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32, flex: 1 }}>
                      {plan.features.map((f, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Check size={14} style={{ color: "var(--green)", flexShrink: 0 }} />
                          <span className="body-text">{f}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {!userHasAccess && (
                    <Link to="/checkout" className={isHighlight ? "gl orange" : "gl"} style={{ width: "100%", justifyContent: "center", textDecoration: "none" }}>
                      Assinar Agora
                    </Link>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ maxWidth: 480, margin: "40px auto 0", textAlign: "center" }}>
            <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
              <strong style={{ color: "var(--text-primary)" }}>White Labels:</strong> a partir de R$7,96/dia ou R$59,96/mês por pessoa.{" "}
              <Link to="/whitelabel" style={{ color: "var(--blue-l)" }}>Saiba mais →</Link>
            </p>
          </div>
        </section>
      )}

      {loading && (
        <div style={{ display: "flex", justifyContent: "center", paddingBottom: 64 }}>
          <Loader2 size={24} className="animate-spin" style={{ color: "var(--text-tertiary)" }} />
        </div>
      )}

      {/* FAQ */}
      <section style={{ padding: "0 24px 96px", maxWidth: 600, margin: "0 auto" }}>
        <div className="sec-label" style={{ textAlign: "center", marginBottom: 12 }}>Dúvidas frequentes</div>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: "var(--text-primary)", textAlign: "center", marginBottom: 40 }}>FAQ</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {faqs.map((faq, i) => (
            <div key={i} className="rd-card" style={{ cursor: "pointer" }} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{faq.q}</span>
                <ChevronDown size={14} style={{ color: "var(--text-tertiary)", transition: "transform .2s", transform: openFaq === i ? "rotate(180deg)" : "none" }} />
              </div>
              {openFaq === i && <p className="body-text" style={{ marginTop: 12 }}>{faq.a}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid var(--b1)", padding: "32px 24px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>© {new Date().getFullYear()} {brandName} — Todos os direitos reservados</p>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Link to="/" style={{ fontSize: 11, color: "var(--text-tertiary)", textDecoration: "none" }}>Início</Link>
            <Link to="/community" style={{ fontSize: 11, color: "var(--text-tertiary)", textDecoration: "none" }}>Comunidade</Link>
            <Link to="/termos" style={{ fontSize: 11, color: "var(--text-tertiary)", textDecoration: "none" }}>Termos</Link>
            <Link to="/suporte" style={{ fontSize: 11, color: "var(--text-tertiary)", textDecoration: "none" }}>Suporte</Link>
          </div>
        </div>
      </footer>
    </div>
  );

  return user ? <AppLayout>{content}</AppLayout> : content;
}
