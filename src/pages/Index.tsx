import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, Zap, Clock, MessageSquare, Shield, ChevronDown, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const plans = [
  { id: "1_day", name: "1 DIA", price: "R$9,99", period: "por dia", description: "Teste rápido" },
  { id: "7_days", name: "7 DIAS", price: "R$49,90", period: "por semana", description: "Ideal para projetos curtos" },
  { id: "1_month", name: "1 MÊS", price: "R$149,90", period: "por mês", description: "Mais popular", popular: true },
  { id: "12_months", name: "12 MESES", price: "R$499,00", period: "ilimitado*", description: "Acesso enquanto ativo", highlight: true },
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

const terms = [
  "Estamos vendendo acesso à extensão CodeLove AI, e não acesso à plataforma Lovable.",
  "A extensão NÃO é oficial e não possui nenhum vínculo com a Lovable.",
  "Não há reembolso caso a extensão pare de funcionar ou seja limitada, independentemente do tempo restante do plano.",
  "O cancelamento ou paralisação temporária do serviço não gera direito a indenização de qualquer natureza.",
  "O serviço é considerado entregue após o envio e ativação do token.",
  "O cliente assume total responsabilidade pela utilização de uma extensão não oficial, podendo ter projetos, contas bloqueados, suspensos ou excluídos a qualquer momento.",
  "Não nos responsabilizamos por quaisquer consequências do uso da extensão.",
  "O plano '12 Meses — Ilimitado' refere-se ao acesso enquanto a extensão estiver ativa. A descontinuação do serviço não gera reembolso.",
  "Nosso método é novo e utiliza a própria plataforma para se comunicar.",
  "Não utilizamos créditos da conta Lovable — todos os projetos, mensagens e planos criados/enviados não descontam créditos.",
];

export default function Index() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubscribe = async (planId: string) => {
    if (!agreedTerms) {
      toast.error("Você precisa concordar com os termos de uso antes de assinar.");
      const termsSection = document.getElementById("terms");
      termsSection?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    setLoadingPlan(planId);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Faça login para assinar um plano.");
      navigate("/login");
      setLoadingPlan(null);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { plan: planId },
      });

      if (error) throw error;
      if (data?.init_point) {
        window.location.href = data.init_point;
      } else {
        toast.error("Erro ao criar checkout. Tente novamente.");
      }
    } catch (err: any) {
      console.error("Checkout error:", err);
      toast.error("Erro ao processar pagamento. Tente novamente.");
    } finally {
      setLoadingPlan(null);
    }
  };

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
                {plan.highlight && (
                  <span className="ep-badge ep-badge-live mb-6 inline-block">MELHOR CUSTO</span>
                )}
                <p className="ep-subtitle mb-2">{plan.name}</p>
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
              <button
                onClick={() => handleSubscribe(plan.id)}
                disabled={loadingPlan === plan.id}
                className={`w-full ${plan.popular || plan.highlight ? "ep-btn-primary" : "ep-btn-secondary"}`}
              >
                {loadingPlan === plan.id ? "PROCESSANDO..." : "ASSINAR"}
              </button>
            </div>
          ))}
        </div>

        {/* Checkout disclaimer */}
        <div className="mt-8 max-w-2xl mx-auto">
          <div className="ep-card-sm flex items-start gap-4">
            <AlertTriangle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                <strong className="text-foreground">Importante:</strong> Ao contratar qualquer plano, você concorda que o serviço é considerado 
                entregue após a ativação do token. O cancelamento ou paralisação temporária da extensão não gera direito a 
                reembolso ou indenização. A extensão é um produto não oficial que pode ser descontinuado a qualquer momento.
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

      {/* Terms */}
      <section id="terms" className="px-8 pb-32 max-w-3xl mx-auto">
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
                Li e concordo com todos os termos acima. Entendo que a extensão não é oficial, que o cancelamento 
                ou paralisação não gera indenização, e assumo total responsabilidade pela sua utilização.
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
