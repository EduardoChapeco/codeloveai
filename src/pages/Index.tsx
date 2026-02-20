import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Check, Zap, Clock, MessageSquare, Shield, ChevronDown, AlertTriangle, Timer } from "lucide-react";

const plans = [
  { id: "1_day", name: "1 DIA", price: "R$9,99", originalPrice: "R$29,97", period: "por dia", description: "Teste rápido" },
  { id: "7_days", name: "7 DIAS", price: "R$49,90", originalPrice: "R$149,70", period: "por semana", description: "Ideal para projetos curtos" },
  { id: "1_month", name: "1 MÊS", price: "R$149,90", originalPrice: "R$449,70", period: "por mês", description: "Mais popular", popular: true },
  { id: "12_months", name: "12 MESES", price: "R$499,00", originalPrice: "R$1.497,00", period: "ilimitado*", description: "Acesso enquanto ativo", highlight: true },
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
  { q: "Posso compartilhar meu token com outras pessoas?", a: "Não. Cada token possui validação de dispositivo, sendo vinculado ao navegador e máquina onde foi ativado pela primeira vez. O compartilhamento não é possível — tentativas de uso em outro dispositivo resultarão em bloqueio automático do token." },
  { q: "O que significa 'ilimitado' no plano de 12 meses?", a: "Significa que o acesso é válido enquanto a extensão estiver ativa e funcional. Caso a extensão seja descontinuada, limitada ou pare de funcionar, não haverá reembolso proporcional ou integral." },
];

// Countdown: unlimited plan disappears Feb 25, 2026 23:59:59 BRT
const UNLIMITED_DEADLINE = new Date("2026-02-25T23:59:59-03:00").getTime();

function useCountdown(deadline: number) {
  const [timeLeft, setTimeLeft] = useState(() => {
    const diff = deadline - Date.now();
    return diff > 0 ? diff : 0;
  });

  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => {
      const diff = deadline - Date.now();
      setTimeLeft(diff > 0 ? diff : 0);
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline, timeLeft]);

  const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

  return { days, hours, minutes, seconds, expired: timeLeft <= 0 };
}

export default function Index() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const countdown = useCountdown(UNLIMITED_DEADLINE);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-20 bg-background border-b border-border px-8 py-5 flex items-center justify-between">
        <span className="ep-label text-sm tracking-[0.3em]">CODELOVE AI</span>
        <div className="flex items-center gap-4">
          <Link to="/community" className="ep-btn-secondary h-10 px-6 text-[9px]">COMUNIDADE</Link>
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
        <Link to="/checkout" className="ep-btn-primary inline-flex">VER PLANOS</Link>
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

      {/* Plans preview */}
      <section id="plans" className="px-8 pb-32 max-w-6xl mx-auto">
        <p className="ep-subtitle text-center mb-4">NOSSOS PLANOS</p>
        <h2 className="ep-section-title text-center mb-8">PLANOS E PREÇOS</h2>
        
        {/* Limited time banner */}
        <div className="ep-card-sm border-foreground/20 bg-foreground/5 text-center mb-12">
          <p className="text-xs font-bold text-foreground tracking-widest mb-1">⏰ PREÇOS POR TEMPO LIMITADO</p>
          <p className="text-[11px] text-muted-foreground font-medium">
            Aproveite os preços promocionais de lançamento. Em breve os valores serão reajustados para a tabela original.
          </p>
        </div>

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
                {plan.highlight && !countdown.expired && (
                  <div className="mb-4">
                    <span className="ep-badge ep-badge-live mb-3 inline-block">MELHOR CUSTO</span>
                    <div className="bg-foreground/5 border border-foreground/20 rounded-[10px] p-3">
                      <div className="flex items-center gap-1.5 justify-center mb-2">
                        <Timer className="h-3.5 w-3.5 text-foreground" />
                        <span className="text-[9px] font-bold text-foreground tracking-widest">OFERTA ENCERRA EM</span>
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        {[
                          { value: countdown.days, label: "D" },
                          { value: countdown.hours, label: "H" },
                          { value: countdown.minutes, label: "M" },
                          { value: countdown.seconds, label: "S" },
                        ].map((t, i) => (
                          <div key={i} className="flex items-baseline gap-0.5">
                            <span className="text-lg font-black text-foreground tabular-nums">{String(t.value).padStart(2, "0")}</span>
                            <span className="text-[8px] font-bold text-muted-foreground">{t.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {plan.highlight && countdown.expired && (
                  <span className="ep-badge ep-badge-offline mb-6 inline-block">ENCERRADO</span>
                )}
                <p className="ep-subtitle mb-2">{plan.name}</p>
                <p className="text-sm text-muted-foreground line-through font-medium">{plan.originalPrice}</p>
                <p className="ep-value text-4xl mb-1">{plan.price}</p>
                <p className="text-xs text-muted-foreground font-medium mb-2">{plan.period}</p>
                {plan.highlight && (
                  <p className="text-[10px] text-muted-foreground font-medium mb-6 italic">
                    *Acesso válido enquanto a extensão estiver ativa
                  </p>
                )}
                {!plan.highlight && <div className="mb-6" />}
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
                to={plan.highlight && countdown.expired ? "#" : `/checkout?plan=${plan.id}`}
                className={`w-full text-center ${plan.highlight && countdown.expired ? "ep-btn-secondary opacity-50 pointer-events-none" : plan.popular || plan.highlight ? "ep-btn-primary" : "ep-btn-secondary"}`}
              >
                {plan.highlight && countdown.expired ? "ENCERRADO" : "ASSINAR"}
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-8 max-w-2xl mx-auto">
          <div className="ep-card-sm flex items-start gap-4">
            <AlertTriangle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                <strong className="text-foreground">Importante:</strong> Ao contratar qualquer plano, você concorda que o serviço é considerado
                entregue após a ativação do token. A extensão é um produto não oficial.
              </p>
            </div>
          </div>
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

      {/* Footer */}
      <footer className="border-t border-border px-8 py-8 text-center">
        <p className="ep-subtitle">© 2025 CODELOVE AI — TODOS OS DIREITOS RESERVADOS</p>
      </footer>
    </div>
  );
}
