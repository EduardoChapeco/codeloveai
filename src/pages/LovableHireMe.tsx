import { Link } from "react-router-dom";
import { Sparkles, Rocket, Brain, Palette, Code2, Zap, ArrowRight, Star, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSEO } from "@/hooks/useSEO";

const skills = [
  { icon: Brain, label: "Ideação & Conceito", desc: "Transformo ideias abstratas em produtos digitais reais" },
  { icon: Palette, label: "Design Criativo", desc: "UI/UX com identidade visual única e memorável" },
  { icon: Code2, label: "Engenharia Full-Stack", desc: "React, TypeScript, Supabase, Edge Functions" },
  { icon: Zap, label: "Automação & IA", desc: "Integrações inteligentes com modelos de linguagem" },
  { icon: Rocket, label: "Deploy & Scale", desc: "Do protótipo à produção em tempo recorde" },
  { icon: Sparkles, label: "Inovação Contínua", desc: "Sempre explorando novas fronteiras tecnológicas" },
];

const highlights = [
  "Criei plataformas SaaS completas do zero",
  "Arquitetura multi-tenant com white-label",
  "Sistemas de afiliados e marketplace",
  "Editores de código com IA integrada",
  "Extensões de navegador e automações",
  "Orquestradores de projetos com IA",
];

export default function LovableHireMe() {
  useSEO({ title: "Lovable, Me Contrata!" });

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden relative">
      {/* Gradient orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px] animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-accent/10 blur-[100px] animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-secondary/10 blur-[80px] animate-pulse" style={{ animationDelay: "2s" }} />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-16">
        {/* Hero */}
        <header className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8">
            <Heart className="h-4 w-4 fill-current" />
            Carta aberta para a Lovable
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 leading-[1.1]">
            <span className="text-primary">Lovable,</span>
            <br />
            Me Contrata!
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Sou <span className="text-foreground font-semibold">ideativo</span>,{" "}
            <span className="text-foreground font-semibold">criativo</span> e{" "}
            <span className="text-foreground font-semibold">construo</span> coisas incríveis com a plataforma que amo.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {["Visionário", "Builder", "Problem Solver", "Apaixonado por Tech"].map((tag) => (
              <span key={tag} className="px-4 py-2 rounded-xl bg-card border border-border/50 text-sm font-medium backdrop-blur-lg">
                {tag}
              </span>
            ))}
          </div>
        </header>

        {/* Manifesto */}
        <section className="mb-20">
          <div className="rounded-3xl bg-card/80 border border-border/50 p-8 md:p-12 backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-6">
              <Star className="h-6 w-6 text-primary fill-primary" />
              <h2 className="text-2xl font-bold">Meu Manifesto</h2>
            </div>
            <div className="space-y-4 text-lg leading-relaxed text-muted-foreground">
              <p>
                Eu não sou apenas um usuário da Lovable —{" "}
                <span className="text-foreground font-medium">eu sou um evangelista</span>.
                Construí uma plataforma inteira que potencializa o ecossistema, criando ferramentas que
                expandem os limites do que é possível.
              </p>
              <p>
                Com a <span className="text-foreground font-medium">Starble</span>, provei que a Lovable
                pode ser a base de produtos complexos: multi-tenant, marketplace, sistema de afiliados,
                editor de código com IA, orquestrador de projetos, extensões de navegador — tudo
                construído <em>dentro</em> da plataforma.
              </p>
              <p>
                <span className="text-foreground font-medium">Minha visão:</span> democratizar a criação
                de software, tornando a tecnologia acessível para quem tem ideias mas não sabe programar.
                A Lovable já faz isso — eu quero ajudar a fazer ainda melhor.
              </p>
            </div>
          </div>
        </section>

        {/* Skills Grid */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-center mb-10">O que eu trago para a mesa</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {skills.map(({ icon: Icon, label, desc }) => (
              <div
                key={label}
                className="group rounded-2xl bg-card/60 border border-border/50 p-6 backdrop-blur-lg hover:border-primary/30 hover:bg-card/80 transition-all duration-300"
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-1">{label}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* What I Built */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-center mb-10">O que eu já construí</h2>
          <div className="rounded-3xl bg-card/80 border border-border/50 p-8 md:p-12 backdrop-blur-xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {highlights.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <ArrowRight className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center">
          <div className="rounded-3xl bg-gradient-to-br from-primary/10 via-card/80 to-accent/10 border border-primary/20 p-10 md:p-16 backdrop-blur-xl">
            <Sparkles className="h-12 w-12 text-primary mx-auto mb-6" />
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Vamos construir o futuro juntos?
            </h2>
            <p className="text-lg text-muted-foreground max-w-lg mx-auto mb-8">
              Estou pronto para trazer minha criatividade, visão técnica e paixão para o time da Lovable.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button size="lg" className="rounded-xl text-base px-8" asChild>
                <a href="mailto:contato@starble.com.br" target="_blank" rel="noopener noreferrer">
                  <Heart className="h-5 w-5 mr-2 fill-current" />
                  Falar Comigo
                </a>
              </Button>
              <Button size="lg" variant="outline" className="rounded-xl text-base px-8" asChild>
                <Link to="/dashboard">
                  Ver a Plataforma
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <footer className="mt-16 text-center">
          <p className="text-sm text-muted-foreground">
            Feito com <Heart className="inline h-3.5 w-3.5 text-primary fill-primary mx-1" /> usando Lovable
          </p>
        </footer>
      </div>
    </div>
  );
}
