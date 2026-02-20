import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Users, DollarSign, Gift, Zap, Shield, Copy,
  ArrowRight, Check, Coins, TrendingUp, Link as LinkIcon
} from "lucide-react";

const steps = [
  {
    icon: Users,
    title: "CRIE SUA CONTA",
    desc: "Cadastre-se gratuitamente na plataforma e adquira um plano ativo.",
  },
  {
    icon: LinkIcon,
    title: "ATIVE SEU LINK",
    desc: "Torne-se afiliado e receba seu link exclusivo de indicação (Magic Link).",
  },
  {
    icon: Gift,
    title: "COMPARTILHE",
    desc: "Envie seu link para amigos, comunidades e redes sociais.",
  },
  {
    icon: DollarSign,
    title: "GANHE COMISSÕES",
    desc: "Receba 30% de comissão em cada venda realizada pelo seu link.",
  },
];

const benefits = [
  {
    icon: DollarSign,
    title: "30% DE COMISSÃO",
    desc: "Receba 30% sobre cada venda realizada através do seu link. Comissões são calculadas automaticamente.",
  },
  {
    icon: Gift,
    title: "20% DE DESCONTO PRÓPRIO",
    desc: "Como afiliado, você ganha 20% de desconto em todos os seus próprios planos.",
  },
  {
    icon: Coins,
    title: "PROGRAMA CODECOINS",
    desc: "Cada indicação confirmada = 1 CodeCoin. Acumule 2 CodeCoins por semana e ganhe 7 dias grátis!",
  },
  {
    icon: TrendingUp,
    title: "PAINEL FINANCEIRO",
    desc: "Acompanhe vendas, comissões, faturas semanais e pagamentos em tempo real.",
  },
  {
    icon: Shield,
    title: "PAGAMENTO VIA PIX",
    desc: "Receba suas comissões semanalmente via PIX. Cadastre seus dados bancários no painel.",
  },
  {
    icon: Zap,
    title: "TEMPLATES PRONTOS",
    desc: "Use nossos templates otimizados para WhatsApp e converta mais indicações.",
  },
];

const faqs = [
  {
    q: "Quanto eu ganho por indicação?",
    a: "Você recebe 30% de comissão sobre o valor de cada venda realizada pelo seu link de indicação.",
  },
  {
    q: "Preciso pagar para ser afiliado?",
    a: "Não. Basta ter uma assinatura ativa na plataforma para se tornar afiliado gratuitamente.",
  },
  {
    q: "Como recebo minhas comissões?",
    a: "As comissões são consolidadas em faturas semanais e pagas via PIX. Cadastre seus dados bancários no painel de afiliado.",
  },
  {
    q: "O que são CodeCoins?",
    a: "CodeCoins são moedas virtuais do programa de recompensas. Cada indicação confirmada vale 1 CodeCoin. Com 2 CodeCoins em uma semana, você ganha 7 dias grátis de acesso.",
  },
  {
    q: "Posso usar meu próprio link para comprar?",
    a: "Sim! Como afiliado, ao comprar pelo seu próprio link você recebe 20% de desconto automaticamente.",
  },
  {
    q: "Como funciona o Magic Link?",
    a: "Seu Magic Link é uma URL exclusiva (ex: codeloveai.lovable.app/ref/SEUCODIGO) que identifica todas as vendas feitas por você.",
  },
];

export default function AffiliatesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [enrolling, setEnrolling] = useState(false);
  const [enrollName, setEnrollName] = useState("");
  const [showEnrollForm, setShowEnrollForm] = useState(false);

  const handleEnroll = async () => {
    if (!user) {
      navigate("/login?returnTo=/affiliates");
      return;
    }

    setEnrolling(true);
    try {
      const { data, error } = await supabase.functions.invoke("affiliate-enroll", {
        body: { display_name: enrollName || undefined },
      });

      if (error) throw error;

      if (data?.status === "created") {
        toast.success("🎉 Você agora é um afiliado! Redirecionando...");
        setTimeout(() => navigate("/affiliate"), 1500);
      } else if (data?.error) {
        toast.error(data.error);
      }
    } catch (err: any) {
      const msg = err?.message || "Erro ao se cadastrar como afiliado.";
      toast.error(msg);
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-20 bg-background border-b border-border px-8 py-5 flex items-center justify-between">
        <Link to="/" className="ep-label text-sm tracking-[0.3em]">CODELOVE AI</Link>
        <div className="flex items-center gap-4">
          {!authLoading && user ? (
            <Link to="/dashboard" className="ep-btn-secondary h-10 px-6 text-[9px]">DASHBOARD</Link>
          ) : (
            <>
              <Link to="/login" className="ep-btn-secondary h-10 px-6 text-[9px]">ENTRAR</Link>
              <Link to="/register" className="ep-btn-primary h-10 px-6 text-[9px]">CRIAR CONTA</Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="px-8 py-24 max-w-5xl mx-auto text-center">
        <p className="ep-subtitle mb-6">PROGRAMA DE AFILIADOS</p>
        <h1 className="ep-title mb-8">GANHE DINHEIRO INDICANDO O CODELOVE AI</h1>
        <p className="text-base text-muted-foreground font-medium max-w-2xl mx-auto mb-12">
          Torne-se afiliado, compartilhe seu link exclusivo e receba <strong className="text-foreground">30% de comissão</strong> em cada venda.
          Além disso, ganhe <strong className="text-foreground">20% de desconto</strong> nos seus próprios planos.
        </p>
        <div className="flex items-center justify-center gap-4">
          {!authLoading && user ? (
            <button
              onClick={() => setShowEnrollForm(true)}
              className="ep-btn-primary h-14 px-10 text-[11px]"
            >
              QUERO SER AFILIADO
            </button>
          ) : (
            <Link to="/register" className="ep-btn-primary h-14 px-10 text-[11px]">
              CRIAR CONTA E SER AFILIADO
            </Link>
          )}
        </div>
      </section>

      {/* How it works */}
      <section className="px-8 pb-20 max-w-6xl mx-auto">
        <p className="ep-subtitle text-center mb-4">COMO FUNCIONA</p>
        <h2 className="ep-section-title text-center mb-16">4 PASSOS SIMPLES</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, idx) => (
            <div key={idx} className="ep-card text-center relative">
              <div className="absolute -top-4 -left-2">
                <span className="ep-label text-[32px] text-muted-foreground/20 font-black italic">
                  {String(idx + 1).padStart(2, "0")}
                </span>
              </div>
              <div className="h-16 w-16 rounded-[24px] border border-border flex items-center justify-center mx-auto mb-6">
                <step.icon className="h-6 w-6 text-foreground" />
              </div>
              <h3 className="ep-label text-[11px] mb-3">{step.title}</h3>
              <p className="text-sm text-muted-foreground font-medium">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="px-8 pb-20 max-w-6xl mx-auto">
        <p className="ep-subtitle text-center mb-4">VANTAGENS</p>
        <h2 className="ep-section-title text-center mb-16">POR QUE SER AFILIADO?</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {benefits.map((b, idx) => (
            <div key={idx} className="ep-card">
              <div className="h-14 w-14 rounded-[20px] bg-foreground flex items-center justify-center mb-6">
                <b.icon className="h-6 w-6 text-background" />
              </div>
              <h3 className="ep-label text-[11px] mb-3">{b.title}</h3>
              <p className="text-sm text-muted-foreground font-medium">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Commission Table */}
      <section className="px-8 pb-20 max-w-4xl mx-auto">
        <p className="ep-subtitle text-center mb-4">SIMULAÇÃO</p>
        <h2 className="ep-section-title text-center mb-16">QUANTO VOCÊ PODE GANHAR</h2>
        <div className="ep-card overflow-hidden p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="ep-subtitle text-left p-6">PLANO</th>
                <th className="ep-subtitle text-right p-6">PREÇO</th>
                <th className="ep-subtitle text-right p-6">SUA COMISSÃO (30%)</th>
              </tr>
            </thead>
            <tbody>
              {[
                { plan: "1 Dia", price: 9.99 },
                { plan: "7 Dias", price: 49.90 },
                { plan: "1 Mês", price: 149.90 },
                { plan: "12 Meses", price: 499.00 },
              ].map((row) => (
                <tr key={row.plan} className="border-b border-border/50 last:border-0">
                  <td className="p-6 text-sm font-bold text-foreground">{row.plan}</td>
                  <td className="p-6 text-sm text-muted-foreground font-medium text-right">
                    R${row.price.toFixed(2)}
                  </td>
                  <td className="p-6 text-right">
                    <span className="ep-value text-lg">R${(row.price * 0.3).toFixed(2)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-center text-xs text-muted-foreground font-medium mt-4 italic">
          Exemplo: 10 vendas do plano de 1 Mês = R$449,70 em comissões.
        </p>
      </section>

      {/* FAQ */}
      <section className="px-8 pb-20 max-w-4xl mx-auto">
        <p className="ep-subtitle text-center mb-4">DÚVIDAS FREQUENTES</p>
        <h2 className="ep-section-title text-center mb-16">FAQ</h2>
        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <div key={idx} className="ep-card">
              <h3 className="text-sm font-bold text-foreground mb-2">{faq.q}</h3>
              <p className="text-sm text-muted-foreground font-medium">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-8 pb-24 max-w-4xl mx-auto">
        <div className="ep-card text-center py-16">
          <h2 className="ep-section-title mb-4">PRONTO PARA COMEÇAR?</h2>
          <p className="text-base text-muted-foreground font-medium mb-8 max-w-lg mx-auto">
            Cadastre-se, adquira um plano e ative seu link de afiliado em segundos.
          </p>
          {!authLoading && user ? (
            <button
              onClick={() => setShowEnrollForm(true)}
              className="ep-btn-primary h-14 px-10 text-[11px]"
            >
              ATIVAR MEU LINK DE AFILIADO
            </button>
          ) : (
            <Link to="/register" className="ep-btn-primary h-14 px-10 text-[11px]">
              CRIAR CONTA GRÁTIS
            </Link>
          )}
        </div>
      </section>

      {/* Enrollment Modal */}
      {showEnrollForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-background rounded-[32px] border border-border p-12 max-w-md w-full shadow-2xl">
            <p className="ep-subtitle mb-2">ATIVAÇÃO</p>
            <h3 className="ep-section-title text-2xl mb-2">TORNAR-SE AFILIADO</h3>
            <p className="text-sm text-muted-foreground font-medium mb-8">
              Escolha um nome de exibição para seu perfil de afiliado. Ele aparecerá na sua página de indicação.
            </p>

            <div className="space-y-4">
              <div>
                <label className="ep-subtitle text-[9px] block mb-2 ml-1">NOME DE EXIBIÇÃO</label>
                <input
                  type="text"
                  value={enrollName}
                  onChange={(e) => setEnrollName(e.target.value)}
                  placeholder="Ex: João Dev"
                  className="ep-input w-full border border-border px-6"
                  maxLength={50}
                />
              </div>

              <div className="ep-card-sm bg-muted/30">
                <p className="text-[10px] font-bold text-foreground mb-2 tracking-widest">VOCÊ RECEBERÁ:</p>
                <ul className="space-y-1.5">
                  {["Link exclusivo de indicação", "30% de comissão por venda", "20% de desconto nos seus planos", "Painel financeiro completo", "Programa CodeCoins"].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                      <Check className="h-3 w-3 text-foreground shrink-0" /> {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setShowEnrollForm(false)}
                className="ep-btn-secondary flex-1 h-12 text-[9px]"
              >
                CANCELAR
              </button>
              <button
                onClick={handleEnroll}
                disabled={enrolling}
                className="ep-btn-primary flex-1 h-12 text-[9px]"
              >
                {enrolling ? "ATIVANDO..." : "CONFIRMAR"}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-border px-8 py-8 text-center">
        <p className="ep-subtitle">© 2025 CODELOVE AI — TODOS OS DIREITOS RESERVADOS</p>
      </footer>
    </div>
  );
}
