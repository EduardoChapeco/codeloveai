import { useState } from "react";
import { useSEO } from "@/hooks/useSEO";
import { Link } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { ChevronDown, Building2, CreditCard, Palette, Users, Eye, HelpCircle, Shield } from "lucide-react";

interface FaqItem { icon: React.ElementType; question: string; answer: string; }

const faqs: FaqItem[] = [
  { icon: Building2, question: "O que é o White Label do Starble?", answer: "Você recebe uma versão da extensão Starble com sua própria marca — logo, cores e nome — para oferecer aos seus clientes. Sua empresa aparece no produto, não a Starble." },
  { icon: CreditCard, question: "Quanto custa?", answer: "O custo é de 40% do preço do plano: R$7,96/dia ou R$59,96/mês por usuário ativo. Você define os preços para seus clientes — a margem é sua. Sem taxa de setup." },
  { icon: Palette, question: "Como configuro minha extensão?", answer: "Após o pagamento, você acessa o wizard de onboarding onde define: nome do produto, logo, cores principais, tipo de cobrança (por mensagem ou por hora) e quais módulos quer exibir." },
  { icon: Eye, question: "Posso ver como ficará antes de pagar?", answer: "Sim. O preview ao vivo mostra exatamente como sua extensão ficará durante a configuração." },
  { icon: Users, question: "Como funciono como afiliado White Label?", answer: "Você gera um link único. Quando alguém cria um tenant White Label pelo seu link, você recebe 30% do setup fee e 30% da mensalidade recorrente de cada usuário ativo desse tenant." },
  { icon: HelpCircle, question: "Posso ter afiliados no meu White Label?", answer: "Sim. Você pode criar seu próprio programa de afiliados com comissões que você define." },
  { icon: Shield, question: "A Starble aparece no meu produto?", answer: "Não. Seu produto tem apenas a sua marca. Os clientes finais não têm como identificar a tecnologia base." },
];

export default function WhiteLabelFAQ() {
  useSEO({ title: "FAQ White Label — Starble", description: "Perguntas frequentes sobre o programa White Label da Starble" });
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <AppLayout>
      <div className="rd-page-content narrow">
        {/* Header */}
        <div className="rd-page-head" style={{ textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 14px", borderRadius: "var(--r-full)", background: "rgba(245,158,11,0.1)", color: "var(--orange-l)", fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
            <HelpCircle className="w-4 h-4" /> FAQ
          </div>
          <h1 style={{ fontSize: 28 }}>White Label — Perguntas Frequentes</h1>
          <p style={{ maxWidth: 500, margin: "8px auto 0" }}>Tudo que você precisa saber sobre ter sua própria versão da extensão Starble.</p>
        </div>

        {/* Accordion */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i;
            const Icon = faq.icon;
            return (
              <div key={i} className="rd-card" style={{ padding: 0, overflow: "hidden" }}>
                <button onClick={() => setOpenIndex(isOpen ? null : i)} className="w-full flex items-center gap-3 text-left" style={{ padding: "14px 18px" }}>
                  <div className="rd-ico-box sm" style={{ background: "rgba(245,158,11,0.1)" }}>
                    <Icon className="w-4 h-4" style={{ color: "var(--orange-l)" }} />
                  </div>
                  <span className="flex-1" style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{faq.question}</span>
                  <ChevronDown className="w-5 h-5" style={{ color: "var(--text-tertiary)", transition: "transform .2s", transform: isOpen ? "rotate(180deg)" : "rotate(0)" }} />
                </button>
                <div style={{ overflow: "hidden", transition: "all .2s", maxHeight: isOpen ? 240 : 0, opacity: isOpen ? 1 : 0 }}>
                  <div style={{ padding: "0 18px 14px 56px", fontSize: 13, lineHeight: 1.6, color: "var(--text-secondary)" }}>{faq.answer}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="rd-card" style={{ textAlign: "center", marginTop: 40, padding: 32 }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Pronto para começar?</p>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 20, maxWidth: 400, margin: "0 auto 20px" }}>Crie sua plataforma com preview ao vivo durante o setup.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/whitelabel/onboarding" className="gl orange" style={{ textDecoration: "none" }}>
              <Building2 className="w-4 h-4" /> Criar meu White Label
            </Link>
            <Link to="/whitelabel" className="gl ghost" style={{ textDecoration: "none" }}>Saiba mais</Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
