import { useState } from "react";
import { useSEO } from "@/hooks/useSEO";
import AppLayout from "@/components/AppLayout";
import { ChevronDown, Building2, CreditCard, Palette, Users, Eye, HelpCircle, Shield } from "lucide-react";

interface FaqItem {
  icon: React.ElementType;
  question: string;
  answer: string;
}

const faqs: FaqItem[] = [
  {
    icon: Building2,
    question: "O que é o White Label do Starble?",
    answer:
      "Você recebe uma versão da extensão Starble com sua própria marca — logo, cores e nome — para oferecer aos seus clientes. Sua empresa aparece no produto, não a Starble.",
  },
  {
    icon: CreditCard,
    question: "Quanto custa?",
    answer:
      "Setup único de R$299. Depois, você paga apenas por usuário ativo (conforme seu plano). Não há mensalidade fixa.",
  },
  {
    icon: Palette,
    question: "Como configuro minha extensão?",
    answer:
      "Após o pagamento, você acessa o wizard de onboarding onde define: nome do produto, logo, cores principais, tipo de cobrança (por mensagem ou por hora) e quais módulos quer exibir.",
  },
  {
    icon: Eye,
    question: "Posso ver como ficará antes de pagar?",
    answer:
      "Sim. O preview ao vivo mostra exatamente como sua extensão ficará durante a configuração.",
  },
  {
    icon: Users,
    question: "Como funciono como afiliado White Label?",
    answer:
      "Você gera um link único. Quando alguém cria um tenant White Label pelo seu link, você recebe 30% do setup fee e 30% da mensalidade recorrente de cada usuário ativo desse tenant.",
  },
  {
    icon: HelpCircle,
    question: "Posso ter afiliados no meu White Label?",
    answer:
      "Sim. Você pode criar seu próprio programa de afiliados com comissões que você define.",
  },
  {
    icon: Shield,
    question: "A Starble aparece no meu produto?",
    answer:
      "Não. Seu produto tem apenas a sua marca. Os clientes finais não têm como identificar a tecnologia base.",
  },
];

export default function WhiteLabelFAQ() {
  useSEO("FAQ White Label — Starble", "Perguntas frequentes sobre o programa White Label da Starble");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            <HelpCircle className="w-4 h-4" />
            FAQ
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            White Label — Perguntas Frequentes
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Tudo que você precisa saber sobre ter sua própria versão da extensão Starble.
          </p>
        </div>

        {/* Accordion */}
        <div className="space-y-3">
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i;
            const Icon = faq.icon;
            return (
              <div
                key={i}
                className="rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm overflow-hidden transition-all duration-200 hover:border-primary/30"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left"
                >
                  <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon className="w-4.5 h-4.5 text-primary" />
                  </div>
                  <span className="flex-1 font-semibold text-foreground text-[15px]">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-200 ${
                    isOpen ? "max-h-60 opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <div className="px-5 pb-4 pl-[4.25rem] text-muted-foreground text-sm leading-relaxed">
                    {faq.answer}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <a
            href="/wl/setup"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            <Building2 className="w-4 h-4" />
            Criar meu White Label
          </a>
        </div>
      </div>
    </AppLayout>
  );
}
