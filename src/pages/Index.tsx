import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Zap, Clock, MessageSquare, Shield, ChevronDown } from "lucide-react";

const plans = [
  { id: "1_day", name: "1 DIA", price: "R$9,99", period: "por dia", description: "Teste rápido" },
  { id: "7_days", name: "7 DIAS", price: "R$49,90", period: "por semana", description: "Ideal para projetos curtos" },
  { id: "1_month", name: "1 MÊS", price: "R$149,90", period: "por mês", description: "Mais popular", popular: true },
  { id: "12_months", name: "12 MESES", price: "R$499,00", period: "por ano", description: "Melhor custo-benefício" },
];

const benefits = [
  { icon: Zap, title: "ENVIOS ILIMITADOS", desc: "Envie quantas mensagens quiser, sem limite algum." },
  { icon: Clock, title: "24/7 SEM PARAR", desc: "Funciona o dia todo, todos os dias, sem interrupções." },
  { icon: MessageSquare, title: "SEM DESCONTAR CRÉDITOS", desc: "Seus créditos Lovable permanecem intactos." },
  { icon: Shield, title: "MÉTODO PRÓPRIO", desc: "Tecnologia exclusiva de comunicação com a plataforma." },
];

const faqs = [
  { q: "Como funciona a extensão?", a: "Após a compra, você recebe acesso à extensão e um token de ativação. Instale a extensão no navegador, ative com o token e comece a usar imediatamente." },
  { q: "Meus créditos do Lovable são descontados?", a: "Não. Nossa extensão utiliza um método próprio de comunicação. Nenhum crédito da sua conta Lovable é utilizado." },
  { q: "A extensão é oficial do Lovable?", a: "Não. A extensão NÃO é oficial e não possui nenhum vínculo com a plataforma Lovable." },
  { q: "E se a extensão parar de funcionar?", a: "Não há reembolso caso a extensão pare de funcionar ou seja limitada. O serviço é considerado entregue após o envio e ativação do token." },
  { q: "Posso ter minha conta bloqueada?", a: "Sim, existe o risco de bloqueio, suspensão ou exclusão da sua conta Lovable. A utilização da extensão é de sua total responsabilidade." },
  { q: "Como recebo o token?", a: "Após a confirmação do pagamento, o admin ativará seu token e ele estará disponível na sua área de membro." },
];

const terms = [
  "Estamos vendendo acesso à extensão CodeLove AI, e não acesso à plataforma Lovable.",
  "A extensão NÃO é oficial e não possui nenhum vínculo com a Lovable.",
  "Não há reembolso caso a extensão pare de funcionar ou seja limitada.",
  "O serviço é considerado entregue após o envio e ativação do token.",
  "O cliente assume total responsabilidade pela utilização de uma extensão não oficial, podendo ter projetos, contas bloqueados, suspensos ou excluídos a qualquer momento.",
  "Não nos responsabilizamos por quaisquer consequências do uso da extensão.",
  "Nosso método é novo e utiliza a própria plataforma para se comunicar.",
  "Não utilizamos créditos da conta Lovable — todos os projetos, mensagens e planos criados/enviados não descontam créditos.",
];

export default function Index() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [agreedTerms, setAgreedTerms] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-20 bg-background border-b border-border px-8 py-5 flex items-center justify-between">
        <span className="ep-label text-sm tracking-[0.3em]">CODELOVE AI</span>
        <div className="flex items-center gap-4">
          <Link to="/login" className="ep-btn-secondary h-10 px-6 text-[9px]">ENTRAR</Link>
          <Link to="/register" className="ep-btn-primary h-10 px-6 text-[9px]">CRIAR CONTA</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-8 py-32 lg:py-40 max-w-5xl mx-auto text-center">
        <p className="ep-subtitle mb-6">EXTENSÃO NÃO OFICIAL PARA LOVABLE</p>
        <h1 className="ep-title mb-8">
          A MELHOR PLATAFORMA DE ENVIOS INFINITOS
        </h1>
        <p className="text-base text-muted-foreground font-medium max-w-2xl mx-auto mb-12">
          Crie quantos projetos quiser, envie quantas mensagens quiser. 24/7 sem parar. 
          Sem descontar créditos da sua conta Lovable.
        </p>
        <a href="#plans" className="ep-btn-primary inline-flex">VER PLANOS</a>
      </section>

      {/* Benefits */}
      <section className="px-8 pb-32 max-w-6xl mx-auto">
        <p className="ep-subtitle text-center mb-4">POR QUE ESCOLHER</p>
        <h2 className="ep-section-title text-center mb-16">CODELOVE AI</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {benefits.map((b) => (
            <div key={b.title} className="ep-card-sm flex flex-col items-start gap-6">
              <div className="h-14 w-14 rounded-[20px] border border-border flex items-center justify-center">
                <b.icon className="h-6 w-6 text-foreground" />
              </div>
              <div>
                <h3 className="ep-label text-[11px] mb-3">{b.title}</h3>
                <p className="text-sm text-muted-foreground font-medium">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Plans */}
      <section id="plans" className="px-8 pb-32 max-w-6xl mx-auto">
        <p className="ep-subtitle text-center mb-4">ESCOLHA SEU PLANO</p>
        <h2 className="ep-section-title text-center mb-16">PLANOS E PREÇOS</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`ep-card-interactive flex flex-col justify-between ${plan.popular ? "ep-card-active" : ""}`}
            >
              <div>
                {plan.popular && (
                  <span className="ep-badge ep-badge-live mb-6 inline-block">POPULAR</span>
                )}
                <p className="ep-subtitle mb-2">{plan.name}</p>
                <p className="ep-value text-4xl mb-1">{plan.price}</p>
                <p className="text-xs text-muted-foreground font-medium mb-6">{plan.period}</p>
                <p className="text-sm text-muted-foreground font-medium mb-8">{plan.description}</p>
                <ul className="space-y-3 mb-8">
                  {["Envios ilimitados", "Sem descontar créditos", "Suporte via chat", "Ativação imediata"].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                      <Check className="h-4 w-4 text-foreground" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <Link
                to="/register"
                className={`w-full ${plan.popular ? "ep-btn-primary" : "ep-btn-secondary"}`}
              >
                ASSINAR
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="px-8 pb-32 max-w-3xl mx-auto">
        <p className="ep-subtitle text-center mb-4">DÚVIDAS FREQUENTES</p>
        <h2 className="ep-section-title text-center mb-16">FAQ</h2>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="ep-card-sm cursor-pointer"
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">{faq.q}</span>
                <ChevronDown
                  className={`h-5 w-5 text-muted-foreground transition-transform duration-300 ${
                    openFaq === i ? "rotate-180" : ""
                  }`}
                />
              </div>
              {openFaq === i && (
                <p className="mt-4 text-sm text-muted-foreground font-medium">{faq.a}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Terms */}
      <section className="px-8 pb-32 max-w-3xl mx-auto">
        <p className="ep-subtitle text-center mb-4">LEIA COM ATENÇÃO</p>
        <h2 className="ep-section-title text-center mb-16">TERMOS DE USO</h2>
        <div className="ep-card space-y-4">
          {terms.map((term, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="ep-label mt-1 shrink-0">{String(i + 1).padStart(2, "0")}.</span>
              <p className="text-sm text-muted-foreground font-medium">{term}</p>
            </div>
          ))}
          <div className="pt-8 border-t border-border">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedTerms}
                onChange={(e) => setAgreedTerms(e.target.checked)}
                className="mt-1 h-4 w-4 rounded-[4px] border border-border accent-foreground"
              />
              <span className="text-sm font-bold text-foreground">
                Li e concordo com todos os termos acima. Entendo que a extensão não é oficial e assumo 
                total responsabilidade pela sua utilização.
              </span>
            </label>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-8 py-8 text-center">
        <p className="ep-subtitle">© 2025 CODELOVE AI — TODOS OS DIREITOS RESERVADOS</p>
      </footer>
    </div>
  );
}
