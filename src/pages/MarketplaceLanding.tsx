import { Link } from "react-router-dom";
import MeshBackground from "@/components/MeshBackground";
import {
  Gamepad2, Flame, Zap, Crown, ShoppingCart, Code2,
  Rocket, Shield, TrendingUp, Star, ChevronRight, Sparkles,
  Globe, Layers, Bot, Download, Eye,
} from "lucide-react";

const FEATURES = [
  { icon: Rocket, title: "Deploy Instantâneo", desc: "Compre e tenha seu projeto rodando em minutos. Sem setup complicado." },
  { icon: Shield, title: "Pagamento Seguro", desc: "Transações via Mercado Pago com PIX e cartão. Proteção total ao comprador." },
  { icon: TrendingUp, title: "Ganhe Vendendo", desc: "Publique seus projetos e receba 70% de cada venda. Split automático." },
  { icon: Code2, title: "Código Completo", desc: "Receba o código-fonte completo. React, TypeScript, Supabase e mais." },
  { icon: Bot, title: "Projetos com IA", desc: "Templates com inteligência artificial integrada, prontos para uso." },
  { icon: Globe, title: "Comunidade Ativa", desc: "Teste projetos, dê feedback e ganhe recompensas na comunidade." },
];

const CATEGORIES = [
  { label: "Web Apps", icon: Globe, color: "from-blue-500 to-cyan-500" },
  { label: "Dashboards", icon: TrendingUp, color: "from-violet-500 to-purple-500" },
  { label: "Landing Pages", icon: Rocket, color: "from-amber-500 to-orange-500" },
  { label: "SaaS Kits", icon: Layers, color: "from-emerald-500 to-teal-500" },
  { label: "E-commerce", icon: ShoppingCart, color: "from-pink-500 to-rose-500" },
  { label: "IA / Bots", icon: Bot, color: "from-fuchsia-500 to-purple-500" },
];

export default function MarketplaceLanding() {
  return (
    <div className="min-h-screen relative bg-background text-foreground overflow-hidden">
      <MeshBackground />

      {/* ── Hero Section ── */}
      <section className="relative min-h-[90vh] flex items-center justify-center px-6">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-primary/8 rounded-full blur-[200px] pointer-events-none" />
        
        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-8">
          <span className="chip indigo">
            <Flame className="h-3.5 w-3.5" />
            Marketplace de Projetos Prontos
            <Sparkles className="h-3.5 w-3.5" />
          </span>

          <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.1]">
            <span className="text-foreground">PROJETOS</span>
            <br />
            <span className="bg-gradient-to-r from-primary via-primary/80 to-accent bg-clip-text text-transparent">
              PRONTOS PARA USAR
            </span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Compre templates, SaaS kits e projetos completos com código-fonte. 
            Ou venda seus projetos e ganhe <span className="text-primary font-bold">70% de cada venda</span>.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link to="/marketplace" className="gl primary lg">
              <ShoppingCart className="h-5 w-5" /> Explorar Store
            </Link>
            <Link to="/register" className="gl lg ghost">
              <TagIcon className="h-5 w-5" /> Começar a Vender
            </Link>
          </div>

          <div className="flex items-center justify-center gap-8 pt-4">
            <div className="text-center">
              <div className="text-2xl font-black text-foreground">30%</div>
              <div className="rd-label" style={{ textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 10 }}>Comissão</div>
            </div>
            <div className="h-8 w-px bg-border/30" />
            <div className="text-center">
              <div className="text-2xl font-black text-foreground">PIX</div>
              <div className="rd-label" style={{ textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 10 }}>Instantâneo</div>
            </div>
            <div className="h-8 w-px bg-border/30" />
            <div className="text-center">
              <div className="text-2xl font-black text-foreground">100%</div>
              <div className="rd-label" style={{ textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 10 }}>Código-fonte</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Categories Section ── */}
      <section className="relative py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="rd-heading mb-3" style={{ fontSize: "1.75rem" }}>CATEGORIAS</h2>
            <p className="rd-body" style={{ opacity: 0.6 }}>Encontre o projeto perfeito para o seu negócio</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {CATEGORIES.map(cat => (
              <Link key={cat.label} to="/marketplace" className="group rd-card flex items-center gap-4" style={{ height: 96, padding: "0 1.5rem" }}>
                <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${cat.color} flex items-center justify-center shrink-0`}>
                  <cat.icon className="h-6 w-6 text-white" />
                </div>
                <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{cat.label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Section ── */}
      <section className="relative py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="rd-heading mb-3" style={{ fontSize: "1.75rem" }}>POR QUE USAR?</h2>
            <p className="rd-body" style={{ opacity: 0.6 }}>Tudo que você precisa para comprar e vender projetos</p>
          </div>

          <div className="rd-grid-3">
            {FEATURES.map(feat => (
              <div key={feat.title} className="rd-card group">
                <div className="rd-ico-box mb-4">
                  <feat.icon className="h-5 w-5" />
                </div>
                <h3 className="rd-body mb-2" style={{ fontWeight: 700 }}>{feat.title}</h3>
                <p className="rd-body" style={{ opacity: 0.6 }}>{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Seller CTA ── */}
      <section className="relative py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="rd-card text-center relative overflow-hidden" style={{ padding: "2.5rem" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[200px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="relative z-10">
              <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-6">
                <Crown className="h-8 w-8 text-white" />
              </div>
              <h2 className="rd-heading mb-3" style={{ fontSize: "1.5rem" }}>Comece a Vender Hoje</h2>
              <p className="rd-body mb-6 max-w-lg mx-auto" style={{ opacity: 0.6 }}>
                Publique seus projetos na loja e receba <span className="text-primary font-bold">70%</span> de cada venda direto na sua conta. 
                Sem burocracia, split automático via Mercado Pago.
              </p>
              <Link to="/register" className="gl primary lg inline-flex items-center gap-3">
                <Rocket className="h-5 w-5" /> Criar Conta Grátis
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative py-10 px-6 border-t border-border/20">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Gamepad2 className="h-5 w-5 text-primary" />
            <span className="rd-label" style={{ fontWeight: 700 }}>Starble Store</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/termos" className="rd-label hover:text-foreground transition-colors">Termos</Link>
            <Link to="/marketplace" className="rd-label hover:text-foreground transition-colors">Loja</Link>
            <Link to="/login" className="rd-label hover:text-foreground transition-colors">Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function TagIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/>
      <path d="M7 7h.01"/>
    </svg>
  );
}
