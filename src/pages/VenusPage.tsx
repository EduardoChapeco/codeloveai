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
    <div className="min-h-screen relative">
      {!user && <MeshBackground />}

      {/* Guest Nav */}
      {!user && (
        <nav className="sticky top-0 z-20 px-6 py-3">
          <div className="lv-glass rounded-2xl px-5 py-2.5 flex items-center justify-between">
            <Link to="/" className="text-base font-semibold tracking-tight text-foreground">{brandName}</Link>
            <div className="flex items-center gap-2">
              <Link to="/community" className="lv-btn-ghost h-9 px-3 text-xs">Comunidade</Link>
              <Link to="/login" className="lv-btn-secondary h-9 px-4 text-xs">Entrar</Link>
              <Link to="/register" className="lv-btn-primary h-9 px-4 text-xs">Começar Grátis</Link>
            </div>
          </div>
        </nav>
      )}

      {/* Breadcrumb */}
      <div className="max-w-5xl mx-auto px-6 pt-6">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao início
        </Link>
      </div>

      {/* ━━━ HERO ━━━ */}
      <section className="px-6 pt-10 pb-20 max-w-4xl mx-auto text-center animate-fade-in">
        <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
          <Crown className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary">God Mode — poder máximo</span>
        </div>

        <div className="flex justify-center mb-8">
          <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-2xl" style={{ boxShadow: "0 20px 60px -12px hsl(var(--primary) / 0.4)" }}>
            <Sparkles className="h-12 w-12 text-primary-foreground" />
          </div>
        </div>

        <h1 className="lv-heading-xl mb-5">
          Starble <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Venus</span>
        </h1>
        <p className="lv-body-lg text-base max-w-2xl mx-auto mb-10 leading-relaxed">
          A extensão nativa mais poderosa do ecossistema. Funciona <strong className="text-foreground">dentro do Lovable</strong> com acesso total:
          modo orquestrado, tasks automatizadas, Brain integrado e build automation.
        </p>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
          {userHasAccess ? (
            <button onClick={handleDownload} className="lv-btn-primary lv-btn-lg flex items-center gap-2" style={{ boxShadow: "0 8px 30px -4px hsl(var(--primary) / 0.35)" }}>
              <Download className="h-5 w-5" /> Baixar Venus
            </button>
          ) : (
            <Link to="/checkout" className="lv-btn-accent lv-btn-lg flex items-center gap-2">
              <Lock className="h-5 w-5" /> Ativar God Mode
            </Link>
          )}
          <div className="flex items-center gap-1.5 lv-caption">
            <Chrome className="h-4 w-4" /> Extensão nativa para Chrome
          </div>
        </div>

        {/* Warning */}
        <div className="max-w-lg mx-auto mt-6 lv-card-sm flex items-start gap-3 text-left" style={{ borderColor: "hsl(var(--destructive) / 0.15)", background: "hsl(var(--destructive) / 0.04)" }}>
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <p className="lv-caption">
            <span className="font-bold text-destructive">Proteção ativa:</span> Tentativas de burlar a validação do token Venus
            resultarão em <strong className="text-foreground">bloqueio permanente</strong> e notificação ao administrador.
          </p>
        </div>
      </section>

      {/* ━━━ FEATURES GRID ━━━ */}
      <section className="px-6 pb-24 max-w-5xl mx-auto">
        <p className="lv-overline text-center mb-3">Funcionalidades</p>
        <h2 className="lv-heading-lg text-center mb-12">Tudo que você precisa</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feat, i) => (
            <div key={i} className="lv-card flex flex-col items-start gap-4 clf-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <feat.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="lv-heading-sm mb-1.5">{feat.title}</h3>
                <p className="lv-body">{feat.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ━━━ PLANS ━━━ */}
      {plans.length > 0 && (
        <section className="px-6 pb-24 max-w-5xl mx-auto">
          <p className="lv-overline text-center mb-3">Planos</p>
          <h2 className="lv-heading-lg text-center mb-12">God Mode</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {plans.map((plan, idx) => {
              const isHighlight = !!plan.highlight_label;
              return (
                <div key={plan.id} className={`lv-card flex flex-col ${isHighlight ? 'ring-2 ring-primary/30' : ''}`}>
                  {isHighlight && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                      <span className="bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-full">
                        {plan.highlight_label}
                      </span>
                    </div>
                  )}
                  <div className="mb-6">
                    <h3 className="lv-heading-sm mb-2">{plan.display_name || plan.name}</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="lv-stat text-3xl">
                        R${(plan.price / 100).toFixed(2).replace(".", ",")}
                      </span>
                      <span className="lv-caption">{billingLabel[plan.billing_cycle] || ""}</span>
                    </div>
                  </div>
                  {plan.features.length > 0 && (
                    <ul className="space-y-3 mb-8 flex-1">
                      {plan.features.map((f, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-primary shrink-0" />
                          <span className="lv-body">{f}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!userHasAccess && (
                    <Link to="/checkout" className={`${isHighlight ? 'lv-btn-primary' : 'lv-btn-secondary'} w-full text-center`}>
                      Assinar Agora
                    </Link>
                  )}
                </div>
              );
            })}
          </div>

          {/* WL Note */}
          <div className="max-w-lg mx-auto mt-10 text-center">
            <p className="lv-caption">
              <strong className="text-foreground">White Labels:</strong> a partir de R$7,96/dia ou R$59,96/mês por pessoa.{" "}
              <Link to="/whitelabel" className="text-primary hover:underline">Saiba mais →</Link>
            </p>
          </div>
        </section>
      )}

      {loading && (
        <div className="flex justify-center pb-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* ━━━ FAQ ━━━ */}
      <section className="px-6 pb-24 max-w-2xl mx-auto">
        <p className="lv-overline text-center mb-3">Dúvidas frequentes</p>
        <h2 className="lv-heading-lg text-center mb-10">FAQ</h2>
        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <div key={i} className="lv-card-sm cursor-pointer" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
              <div className="flex items-center justify-between">
                <span className="lv-body-strong">{faq.q}</span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${openFaq === i ? "rotate-180" : ""}`} />
              </div>
              {openFaq === i && <p className="mt-3 lv-body animate-fade-in">{faq.a}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* ━━━ FOOTER ━━━ */}
      <footer className="border-t border-border/50 px-6 py-8">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="lv-caption">© {new Date().getFullYear()} {brandName} — Todos os direitos reservados</p>
          <div className="flex items-center gap-4">
            <Link to="/" className="lv-caption hover:text-foreground transition-colors">Início</Link>
            <Link to="/community" className="lv-caption hover:text-foreground transition-colors">Comunidade</Link>
            <Link to="/termos" className="lv-caption hover:text-foreground transition-colors">Termos</Link>
            <Link to="/suporte" className="lv-caption hover:text-foreground transition-colors">Suporte</Link>
          </div>
        </div>
      </footer>
    </div>
  );

  return user ? <AppLayout>{content}</AppLayout> : content;
}
