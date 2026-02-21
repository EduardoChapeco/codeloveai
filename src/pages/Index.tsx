import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Check, Zap, Clock, MessageSquare, Shield, ChevronDown, AlertTriangle, Timer } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSEO } from "@/hooks/useSEO";
import { useTenant } from "@/contexts/TenantContext";
import AppLayout from "@/components/AppLayout";
import MeshBackground from "@/components/MeshBackground";

const plans = [
  {
    id: "1_day", name: "1 Dia", price: "R$19,90", originalPrice: "R$49,90", period: "por dia",
    description: "Perfeito para testar a extensão antes de se comprometer.",
    features: ["Envios ilimitados por 24h", "Sem descontar créditos", "Ativação imediata", "Suporte via chat"],
  },
  {
    id: "7_days", name: "7 Dias", price: "R$89,90", originalPrice: "R$249,90", period: "por semana",
    description: "Ideal para sprints rápidos ou projetos de curta duração.",
    popular: true,
    features: ["Envios ilimitados por 7 dias", "Sem descontar créditos", "Ativação imediata", "Suporte prioritário"],
    badge: "Popular",
  },
  {
    id: "lifetime", name: "Vitalício", price: "R$199,00", originalPrice: "R$499,00", period: "acesso vitalício*",
    description: "Acesso enquanto a extensão estiver funcional. Serviço concluído após ativação.",
    highlight: true,
    features: [
      "Acesso vitalício enquanto a extensão funcionar",
      "Sem descontar créditos",
      "Suporte VIP dedicado",
      "Serviço concluído após ativação",
    ],
    badge: "Melhor custo",
  },
];

const benefits = [
  { icon: Zap, title: "Envios ilimitados", desc: "Envie quantas mensagens quiser, sem limite algum." },
  { icon: Clock, title: "24/7 sem parar", desc: "Funciona o dia todo, todos os dias, sem interrupções." },
  { icon: MessageSquare, title: "Sem descontar créditos", desc: "Seus créditos Lovable permanecem intactos." },
  { icon: Shield, title: "Método próprio", desc: "Tecnologia exclusiva de comunicação com a plataforma." },
];

const faqs = [
  { q: "Como funciona a extensão?", a: "Após a compra, você recebe acesso à extensão e um token de ativação. Instale a extensão no navegador, ative com o token e comece a usar imediatamente. A ativação é registrada automaticamente no sistema." },
  { q: "Meus créditos do Lovable são descontados?", a: "Não. Nossa extensão utiliza um método próprio de comunicação. Nenhum crédito da sua conta Lovable é utilizado." },
  { q: "A extensão é oficial do Lovable?", a: "Não. A extensão NÃO é oficial e não possui nenhum vínculo com a plataforma Lovable. Por ser um método não oficial, está sob risco constante de suspensão." },
  { q: "E se a extensão parar de funcionar?", a: "O serviço é considerado CONCLUÍDO e ENTREGUE a partir do momento da ativação do token. Não há reembolso em nenhuma hipótese. Não temos obrigação de fornecer nova extensão, novo método ou créditos." },
  { q: "Posso ter minha conta bloqueada?", a: "Sim, existe o risco de bloqueio, suspensão ou exclusão da sua conta Lovable a qualquer momento. A utilização da extensão é de sua total responsabilidade." },
  { q: "Como recebo o token?", a: "Após a confirmação do pagamento, seu token será ativado automaticamente e estará disponível na sua área de membro." },
  { q: "Posso compartilhar meu token com outras pessoas?", a: "Não. Cada token possui validação de dispositivo, sendo vinculado ao navegador e máquina onde foi ativado pela primeira vez. O compartilhamento não é possível — tentativas de uso em outro dispositivo resultarão em bloqueio automático do token." },
  { q: "O que significa 'Vitalício'?", a: "O plano Vitalício oferece acesso enquanto a extensão estiver funcional. Caso a extensão pare de funcionar, seja limitada ou descontinuada, não haverá reembolso. Não temos obrigação de fornecer nova extensão, novo método ou créditos. O serviço é considerado concluído após a ativação do token." },
  { q: "O que é rastreado na ativação?", a: "Ao ativar a extensão, registramos IP, dispositivo e localização para fins de comprovação de entrega do serviço. Isso garante que podemos provar que o serviço foi efetivamente utilizado." },
  { q: "Posso ser afiliado?", a: "Sim! Acesse a página de afiliados para se inscrever. Você ganha comissões por cada venda realizada através do seu link e ainda recebe desconto nas suas próprias compras." },
  { q: "O que é White Label?", a: "O programa White Label permite que você revenda a extensão com sua própria marca. Você gerencia seus clientes, define preços e tem seu próprio painel administrativo. Acesse a página de parceiros para mais informações." },
];

const UNLIMITED_DEADLINE = new Date("2026-03-15T23:59:59-03:00").getTime();

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
  const { user, loading: authLoading } = useAuth();
  const { tenant } = useTenant();
  const brandName = tenant?.name || "CodeLove AI";
  useSEO({ title: tenant?.meta_title || brandName, description: tenant?.meta_description || "A melhor plataforma de envios ilimitados para Lovable. 24/7, sem descontar créditos." });

  const guestNav = !authLoading && !user ? (
    <nav className="sticky top-0 z-20 px-6 py-3 flex items-center justify-between">
      <div className="lv-glass rounded-2xl px-5 py-2.5 flex items-center justify-between w-full">
        <span className="text-base font-semibold tracking-tight text-foreground">{brandName}</span>
        <div className="flex items-center gap-2">
          <Link to="/partners" className="lv-btn-ghost h-9 px-3 text-xs">Parceiros</Link>
          <Link to="/community" className="lv-btn-ghost h-9 px-3 text-xs">Comunidade</Link>
          <Link to="/login" className="lv-btn-secondary h-9 px-4 text-xs">Entrar</Link>
          <Link to="/register" className="lv-btn-primary h-9 px-4 text-xs">Criar conta</Link>
        </div>
      </div>
    </nav>
  ) : null;

  const content = (
    <div className="min-h-screen relative">
      {/* Mesh background for guests */}
      {!authLoading && !user && <MeshBackground />}

      {guestNav}

      {/* Hero */}
      <section className="px-6 py-24 lg:py-32 max-w-4xl mx-auto text-center animate-fade-in">
        <p className="lv-overline mb-4">Extensão não oficial para Lovable</p>
        <h1 className="lv-heading-xl mb-6">
          A melhor plataforma de envios infinitos
        </h1>
        <p className="lv-body text-base max-w-2xl mx-auto mb-10">
          Crie quantos projetos quiser, envie quantas mensagens quiser. 24/7 sem parar.
          Sem descontar créditos da sua conta Lovable.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/checkout" className="lv-btn-primary lv-btn-lg">Ver planos</Link>
          <Link to="/register" className="lv-btn-secondary lv-btn-lg">Criar conta</Link>
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

      {/* Plans */}
      <section id="plans" className="px-6 pb-24 max-w-5xl mx-auto">
        <p className="lv-overline text-center mb-3">Nossos planos</p>
        <h2 className="lv-heading-lg text-center mb-6">Planos e preços</h2>

        {/* Limited time banner */}
        <div className="lv-card-sm text-center mb-10 border-primary/20 bg-primary/5">
          <p className="text-sm font-medium text-foreground mb-0.5">⏰ Preços por tempo limitado</p>
          <p className="lv-caption">
            Aproveite os preços promocionais de lançamento. Em breve os valores serão reajustados.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`lv-card-interactive flex flex-col justify-between ${plan.popular ? "lv-card-active" : ""}`}
            >
              <div className="flex flex-col h-full">
                {/* Badge */}
                <div className="min-h-[28px] mb-3">
                  {plan.popular && (
                    <span className="lv-badge lv-badge-primary">{plan.badge}</span>
                  )}
                  {plan.highlight && !countdown.expired && (
                    <span className="lv-badge lv-badge-primary">{plan.badge}</span>
                  )}
                  {plan.highlight && countdown.expired && (
                    <span className="lv-badge lv-badge-muted">Encerrado</span>
                  )}
                </div>

                {/* Countdown */}
                {plan.highlight && !countdown.expired && (
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 mb-4">
                    <div className="flex items-center gap-1.5 justify-center mb-2">
                      <Timer className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-medium text-primary">Oferta encerra em</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      {[
                        { value: countdown.days, label: "d" },
                        { value: countdown.hours, label: "h" },
                        { value: countdown.minutes, label: "m" },
                        { value: countdown.seconds, label: "s" },
                      ].map((t, i) => (
                        <div key={i} className="flex items-baseline gap-0.5">
                          <span className="text-lg font-semibold text-foreground tabular-nums">{String(t.value).padStart(2, "0")}</span>
                          <span className="text-xs text-muted-foreground">{t.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Price */}
                <p className="lv-overline mb-1">{plan.name}</p>
                <p className="text-sm text-muted-foreground line-through">{plan.originalPrice}</p>
                <p className="lv-stat text-3xl mb-1">{plan.price}</p>
                <p className="lv-caption mb-4">{plan.period}</p>

                <p className="lv-body mb-5">{plan.description}</p>

                {/* Features */}
                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 lv-body">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Link
                to={plan.highlight && countdown.expired ? "#" : `/checkout?plan=${plan.id}`}
                className={`w-full text-center ${plan.highlight && countdown.expired ? "lv-btn-secondary opacity-50 pointer-events-none" : plan.popular || plan.highlight ? "lv-btn-primary" : "lv-btn-secondary"}`}
              >
                {plan.highlight && countdown.expired ? "Encerrado" : "Assinar"}
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-5 max-w-2xl mx-auto text-center">
          <p className="lv-caption italic">
            *Vitalício: acesso enquanto a extensão estiver funcional. Serviço considerado concluído após ativação do token.
          </p>
        </div>

        <div className="mt-4 max-w-2xl mx-auto">
          <div className="lv-card-sm flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="lv-caption">
              <strong className="text-foreground">Importante:</strong> O serviço é considerado CONCLUÍDO após a ativação do token.
              Não há reembolso. A extensão é não oficial e está sob risco de suspensão a qualquer momento.
            </p>
          </div>
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
