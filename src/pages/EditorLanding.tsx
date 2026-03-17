import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { Code2, Sparkles, Zap, Shield, Crown, ArrowRight, Check } from "lucide-react";

const features = [
  { icon: Code2, title: "Editor Visual", desc: "Edite projetos Lovable diretamente no painel" },
  { icon: Zap, title: "10 edições grátis/dia", desc: "Comece sem pagar nada, teste à vontade" },
  { icon: Shield, title: "Modo seguro", desc: "Edições via proxy sem consumir seus créditos Lovable" },
  { icon: Sparkles, title: "Star AI integrada", desc: "IA para gerar código, design e scraping" },
];

const plans = [
  { name: "Grátis", price: "R$ 0", msgs: "10/dia", highlight: false },
  { name: "Venus Diário", price: "R$ 19,90", msgs: "Ilimitado", highlight: true },
  { name: "Venus Mensal", price: "R$ 149,90", msgs: "Ilimitado", highlight: false },
];

export default function EditorLanding() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  if (loading) return <div className="min-h-screen bg-background" />;

  return (
    <AppLayout>
      <div className="min-h-screen p-6 md:p-12 max-w-5xl mx-auto space-y-16">
        {/* Hero */}
        <div className="text-center space-y-6 pt-8">
          <div className="chip inline-flex items-center gap-2 px-5 py-2.5">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-primary">Novo recurso</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight leading-tight">
            Edite seus projetos<br />
            <span className="text-primary">direto no Starble</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Envie instruções e veja as alterações ao vivo. Comece com 10 edições gratuitas por dia.
          </p>
          <button
            onClick={() => navigate(user ? "/lovable/projects" : "/login")}
            className="gl primary h-14 px-8 rounded-2xl text-base font-semibold
              hover:scale-105 active:scale-95 inline-flex items-center gap-3
              shadow-lg shadow-primary/20"
          >
            {user ? "Ir para Projetos" : "Começar Grátis"}
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map(f => (
            <div key={f.title} className="rd-card p-6 flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{f.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Plans */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-center text-foreground">Planos de edição</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {plans.map(p => (
              <div
                key={p.name}
                className={`rd-card p-5 text-center space-y-3 transition-transform hover:scale-[1.03] ${
                  p.highlight ? "ring-2 ring-primary/30" : ""
                }`}
              >
                {p.highlight && (
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                    <Crown className="h-3 w-3" /> Recomendado
                  </div>
                )}
                <p className="text-lg font-bold text-foreground">{p.name}</p>
                <p className="text-2xl font-black text-foreground">{p.price}</p>
                <p className="text-xs text-muted-foreground">{p.msgs} mensagens</p>
                <div className="flex items-center justify-center gap-1 text-xs text-primary">
                  <Check className="h-3 w-3" /> Preview ao vivo
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA final */}
        <div className="rd-card p-8 text-center space-y-4">
          <Crown className="h-8 w-8 text-primary mx-auto" />
          <h3 className="text-xl font-bold text-foreground">Pronto para editar?</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Conecte sua conta Lovable e comece a editar projetos gratuitamente.
          </p>
          <button
            onClick={() => navigate(user ? "/lovable/projects" : "/register")}
            className="gl primary h-12 px-6 rounded-2xl font-semibold
              hover:scale-105 active:scale-95 inline-flex items-center gap-2"
          >
            Começar agora <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
