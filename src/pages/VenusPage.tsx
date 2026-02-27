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

export default function VenusPage() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const { hasAccessTo, loading: accessLoading } = useExtensionAccess();
  const brandName = tenant?.name || "Starble";
  const [plans, setPlans] = useState<VenusPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const userHasAccess = !accessLoading && hasAccessTo("venus");

  useEffect(() => {
    const load = async () => {
      // Fetch plans linked to Venus extension
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

  const billingLabel: Record<string, string> = { daily: "/dia", monthly: "/mês" };

  const content = (
    <div className="min-h-screen relative">
      {!user && <MeshBackground />}
      {!user && (
        <nav className="sticky top-0 z-20 px-6 py-3">
          <div className="lv-glass rounded-2xl px-5 py-2.5 flex items-center justify-between">
            <Link to="/" className="text-base font-semibold tracking-tight text-foreground">{brandName}</Link>
            <div className="flex items-center gap-3">
              <Link to="/extensoes" className="text-xs text-muted-foreground hover:text-foreground">Extensões</Link>
              <Link to="/login" className="lv-btn-secondary h-9 px-4 text-xs">Entrar</Link>
            </div>
          </div>
        </nav>
      )}

      {/* Breadcrumb */}
      <div className="max-w-5xl mx-auto px-6 pt-6">
        <Link to="/extensoes" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para Extensões
        </Link>
      </div>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-10 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold mb-6">
          <Crown className="h-3.5 w-3.5" /> GOD MODE
        </div>

        <div className="flex justify-center mb-6">
          <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-2xl shadow-purple-500/30">
            <Sparkles className="h-12 w-12 text-white" />
          </div>
        </div>

        <h1 className="text-4xl md:text-5xl font-black text-foreground mb-4 tracking-tight">
          Starble <span className="bg-gradient-to-r from-purple-400 to-violet-500 bg-clip-text text-transparent">Venus</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
          A extensão nativa mais poderosa do ecossistema. Funciona <strong>dentro do Lovable</strong> com acesso total:
          modo orquestrado, tasks automatizadas, Brain integrado e build automation. Poder máximo, zero fricção.
        </p>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {userHasAccess ? (
            <button onClick={handleDownload} className="lv-btn-primary h-12 px-8 text-sm font-bold flex items-center gap-2 shadow-lg shadow-primary/20">
              <Download className="h-5 w-5" /> Baixar Venus
            </button>
          ) : (
            <Link to="/checkout" className="lv-btn-primary h-12 px-8 text-sm font-bold flex items-center gap-2 shadow-lg shadow-primary/20">
              <Lock className="h-5 w-5" /> Ativar God Mode
            </Link>
          )}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Chrome className="h-4 w-4" /> Extensão nativa para Chrome
          </div>
        </div>

        {/* Warning */}
        <div className="max-w-lg mx-auto mt-8 rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-3 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground text-left">
            <span className="font-bold text-amber-600">Proteção ativa:</span> Tentativas de burlar a validação do token Venus
            resultarão em <strong>bloqueio permanente da conta</strong> e notificação imediata ao administrador.
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <h2 className="text-xl font-bold text-foreground mb-8 text-center">Funcionalidades Exclusivas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feat, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-5 hover:border-purple-500/30 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center mb-3">
                <feat.icon className="h-5 w-5 text-purple-400" />
              </div>
              <p className="text-sm font-bold text-foreground mb-1">{feat.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      {plans.length > 0 && (
        <section className="max-w-5xl mx-auto px-6 pb-20">
          <h2 className="text-xl font-bold text-foreground mb-8 text-center">Planos God Mode</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {plans.map(plan => (
              <div key={plan.id} className="relative rounded-2xl border border-purple-500/20 bg-card p-6 text-center hover:border-purple-500/40 transition-colors">
                {plan.highlight_label && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-purple-500 text-white text-[10px] font-black">
                    {plan.highlight_label}
                  </div>
                )}
                <p className="text-sm font-bold text-foreground mb-2 mt-2">{plan.display_name || plan.name}</p>
                <p className="text-3xl font-black text-foreground">
                  R${(plan.price / 100).toFixed(2).replace(".", ",")}
                  <span className="text-sm font-normal text-muted-foreground">{billingLabel[plan.billing_cycle] || ""}</span>
                </p>
                {plan.features.length > 0 && (
                  <ul className="mt-4 space-y-2 text-left">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Check className="h-3.5 w-3.5 text-purple-400 shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {!userHasAccess && (
                  <Link to="/checkout" className="lv-btn-primary h-10 px-6 text-xs mt-5 inline-flex items-center gap-1">
                    Assinar Agora
                  </Link>
                )}
              </div>
            ))}
          </div>

          {/* WL Note */}
          <div className="max-w-lg mx-auto mt-10 text-center">
            <p className="text-xs text-muted-foreground">
              <strong>Para White Labels:</strong> a partir de R$7,96/dia ou R$59,96/mês por pessoa (40% do plano).{" "}
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
    </div>
  );

  return user ? <AppLayout>{content}</AppLayout> : content;
}
