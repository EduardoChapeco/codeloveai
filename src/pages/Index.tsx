import { useState } from "react";
import { Link } from "react-router-dom";
import { Zap, Clock, MessageSquare, Shield, ChevronDown, Puzzle, Code2, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSEO } from "@/hooks/useSEO";
import { useTenant } from "@/contexts/TenantContext";
import AppLayout from "@/components/AppLayout";
import MeshBackground from "@/components/MeshBackground";

const benefits = [
  { icon: Zap, title: "Envios ilimitados", desc: "Envie quantas mensagens quiser, sem limite algum." },
  { icon: Clock, title: "24/7 sem parar", desc: "Funciona o dia todo, todos os dias, sem interrupções." },
  { icon: MessageSquare, title: "Sem descontar créditos", desc: "Seus créditos Lovable permanecem intactos." },
  { icon: Shield, title: "100% Gratuito", desc: "Plataforma completamente gratuita. Sem planos, sem pagamentos." },
];

const faqs = [
  { q: "Como funciona a extensão?", a: "Após criar sua conta, você recebe automaticamente acesso à extensão e um token de ativação. Instale a extensão no navegador, ative com o token e comece a usar imediatamente." },
  { q: "Meus créditos do Lovable são descontados?", a: "Não. Nossa extensão utiliza um método próprio de comunicação. Nenhum crédito da sua conta Lovable é utilizado." },
  { q: "É realmente gratuito?", a: "Sim! A plataforma é 100% gratuita. Basta criar uma conta e você recebe acesso por 1 ano automaticamente." },
  { q: "Posso ter minha conta bloqueada?", a: "Existe o risco de bloqueio, suspensão ou exclusão da sua conta Lovable a qualquer momento. A utilização da extensão é de sua total responsabilidade." },
  { q: "Como recebo o token?", a: "Ao criar sua conta, seu token será gerado automaticamente e estará disponível na sua área de membro." },
  { q: "Posso compartilhar meu token com outras pessoas?", a: "Não. Cada token possui validação de dispositivo, sendo vinculado ao navegador e máquina onde foi ativado pela primeira vez." },
];

export default function Index() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { user, loading: authLoading } = useAuth();
  const { tenant } = useTenant();
  const brandName = "Code Lovable Oficial";
  useSEO({ title: brandName, description: "Extensão oficial para mensagens ilimitadas. Edite projetos diretamente sem gastar créditos." });

  const guestNav = !authLoading && !user ? (
    <nav className="sticky top-0 z-20 px-6 py-3 flex items-center justify-between">
      <div className="lv-glass rounded-2xl px-5 py-2.5 flex items-center justify-between w-full">
        <span className="text-base font-semibold tracking-tight text-foreground">{brandName}</span>
        <div className="flex items-center gap-2">
          <Link to="/community" className="lv-btn-ghost h-9 px-3 text-xs">Comunidade</Link>
          <Link to="/login" className="lv-btn-secondary h-9 px-4 text-xs">Entrar</Link>
          <Link to="/register" className="lv-btn-primary h-9 px-4 text-xs">Criar conta grátis</Link>
        </div>
      </div>
    </nav>
  ) : null;

  const content = (
    <div className="min-h-screen relative">
      {!authLoading && !user && <MeshBackground />}

      {guestNav}

      {/* Hero */}
      <section className="px-6 py-24 lg:py-32 max-w-4xl mx-auto text-center animate-fade-in">
        <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary">100% Gratuito</span>
        </div>
        <h1 className="lv-heading-xl mb-6">
          Integração com a Lovable
        </h1>
        <p className="lv-body text-base max-w-2xl mx-auto mb-4">
          Edite projetos diretamente da CodeLove sem gastar créditos.
        </p>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-10">
          Extensão oficial para mensagens ilimitadas. Crie sua conta e comece a usar agora.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/register" className="lv-btn-primary lv-btn-lg">Criar conta grátis</Link>
          <Link to="/login" className="lv-btn-secondary lv-btn-lg">Já tenho conta</Link>
        </div>
      </section>

      {/* Benefits */}
      <section className="px-6 pb-24 max-w-5xl mx-auto">
        <p className="lv-overline text-center mb-3">Por que escolher</p>
        <h2 className="lv-heading-lg text-center mb-12">{brandName}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {benefits.map((b, i) => (
            <div key={b.title} className="lv-card flex flex-col items-start gap-4" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <b.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="lv-heading-sm mb-2">{b.title}</h3>
                <p className="lv-body">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 pb-24 max-w-4xl mx-auto">
        <p className="lv-overline text-center mb-3">Como funciona</p>
        <h2 className="lv-heading-lg text-center mb-12">3 passos simples</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { step: "01", icon: Code2, title: "Crie sua conta", desc: "Cadastre-se gratuitamente e receba seu token automaticamente." },
            { step: "02", icon: Puzzle, title: "Instale a extensão", desc: "Baixe e instale a extensão no Chrome." },
            { step: "03", icon: Zap, title: "Comece a usar", desc: "Abra lovable.dev e envie mensagens ilimitadas." },
          ].map((item) => (
            <div key={item.step} className="lv-card text-center">
              <span className="text-4xl font-bold text-primary/10 mb-4 block">{item.step}</span>
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="lv-heading-sm mb-2">{item.title}</h3>
              <p className="lv-body">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 pb-24 max-w-2xl mx-auto">
        <p className="lv-overline text-center mb-3">Dúvidas frequentes</p>
        <h2 className="lv-heading-lg text-center mb-10">FAQ</h2>
        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="lv-card-sm cursor-pointer"
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
            >
              <div className="flex items-center justify-between">
                <span className="lv-body-strong">{faq.q}</span>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                    openFaq === i ? "rotate-180" : ""
                  }`}
                />
              </div>
              {openFaq === i && (
                <p className="mt-3 lv-body animate-fade-in">{faq.a}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 px-6 py-6 text-center">
        <p className="lv-caption">© {new Date().getFullYear()} {brandName} — Todos os direitos reservados</p>
      </footer>
    </div>
  );

  if (!authLoading && user) {
    return <AppLayout>{content}</AppLayout>;
  }
  return content;
}
