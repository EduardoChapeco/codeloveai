import { Link, useNavigate } from "react-router-dom";
import MeshBackground from "@/components/MeshBackground";
import { useAuth } from "@/hooks/useAuth";
import { useSEO } from "@/hooks/useSEO";
import { useTenant } from "@/contexts/TenantContext";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Users, DollarSign, Gift, Zap, Shield, Copy,
  ArrowRight, Check, Coins, TrendingUp, Link as LinkIcon, X
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

const steps = [
  { icon: Users, title: "Crie sua conta", desc: "Cadastre-se gratuitamente na plataforma e adquira um plano ativo." },
  { icon: LinkIcon, title: "Ative seu link", desc: "Torne-se afiliado e receba seu link exclusivo de indicação (Magic Link)." },
  { icon: Gift, title: "Compartilhe", desc: "Envie seu link para amigos, comunidades e redes sociais." },
  { icon: DollarSign, title: "Ganhe comissões", desc: "Receba 30% de comissão em cada venda realizada pelo seu link." },
];

const benefits = [
  { icon: DollarSign, title: "30% de comissão", desc: "Receba 30% sobre cada venda realizada através do seu link. Comissões são calculadas automaticamente." },
  { icon: Gift, title: "20% de desconto próprio", desc: "Como afiliado, você ganha 20% de desconto em todos os seus próprios planos." },
  { icon: Coins, title: "Programa CodeCoins", desc: "Cada indicação confirmada = 1 CodeCoin. Acumule 2 CodeCoins por semana e ganhe 7 dias grátis!" },
  { icon: TrendingUp, title: "Painel financeiro", desc: "Acompanhe vendas, comissões, faturas semanais e pagamentos em tempo real." },
  { icon: Shield, title: "Pagamento via PIX", desc: "Receba suas comissões semanalmente via PIX. Cadastre seus dados bancários no painel." },
  { icon: Zap, title: "Templates prontos", desc: "Use nossos templates otimizados para WhatsApp e converta mais indicações." },
];

const faqs = [
  { q: "Quanto eu ganho por indicação?", a: "Você recebe 30% de comissão sobre o valor de cada venda realizada pelo seu link de indicação." },
  { q: "Preciso pagar para ser afiliado?", a: "Não. Basta ter uma assinatura ativa na plataforma para se tornar afiliado gratuitamente." },
  { q: "Como recebo minhas comissões?", a: "As comissões são consolidadas em faturas semanais e pagas via PIX. Cadastre seus dados bancários no painel de afiliado." },
  { q: "O que são CodeCoins?", a: "CodeCoins são moedas virtuais do programa de recompensas. Cada indicação confirmada vale 1 CodeCoin. Com 2 CodeCoins em uma semana, você ganha 7 dias grátis de acesso." },
  { q: "Posso usar meu próprio link para comprar?", a: "Sim! Como afiliado, ao comprar pelo seu próprio link você recebe 20% de desconto automaticamente." },
  { q: "Como funciona o Magic Link?", a: "Seu Magic Link é uma URL exclusiva (ex: Starbleai.lovable.app/ref/SEUCODIGO) que identifica todas as vendas feitas por você." },
];

export default function AffiliatesPage() {
  const { user, loading: authLoading } = useAuth();
  const { tenant } = useTenant();
  const brandName = tenant?.name || "Starble";
  useSEO({ title: "Programa de Afiliados", description: `Ganhe 30% de comissão indicando ${brandName}.` });
  const navigate = useNavigate();
  const [enrolling, setEnrolling] = useState(false);
  const [enrollName, setEnrollName] = useState("");
  const [showEnrollForm, setShowEnrollForm] = useState(false);

  const handleEnroll = async () => {
    if (!user) { navigate("/login?returnTo=/affiliates"); return; }
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
      toast.error(err?.message || "Erro ao se cadastrar como afiliado.");
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <div className="min-h-screen relative">
      <MeshBackground />
      <nav className="sticky top-0 z-20 px-6 py-3">
        <div className="lv-glass rounded-2xl px-5 py-2.5 flex items-center justify-between">
          <Link to="/" className="text-base font-semibold tracking-tight text-foreground">{brandName}</Link>
          <div className="flex items-center gap-3">
            {!authLoading && user ? (
              <Link to="/dashboard" className="lv-btn-secondary h-9 px-4 text-xs">Dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="lv-btn-secondary h-9 px-4 text-xs">Entrar</Link>
                <Link to="/register" className="lv-btn-primary h-9 px-4 text-xs">Criar conta</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-20 max-w-4xl mx-auto text-center">
        <p className="lv-overline mb-4">Programa de Afiliados</p>
        <h1 className="lv-heading-xl mb-6">Ganhe dinheiro indicando o {brandName}</h1>
        <p className="lv-body text-base max-w-2xl mx-auto mb-10">
          Torne-se afiliado, compartilhe seu link exclusivo e receba <strong className="text-foreground">30% de comissão</strong> em cada venda.
          Além disso, ganhe <strong className="text-foreground">20% de desconto</strong> nos seus próprios planos.
        </p>
        <div className="flex items-center justify-center gap-4">
          {!authLoading && user ? (
            <button onClick={() => setShowEnrollForm(true)} className="lv-btn-primary lv-btn-lg px-8">
              Quero ser afiliado
            </button>
          ) : (
            <Link to="/register" className="lv-btn-primary lv-btn-lg px-8">
              Criar conta e ser afiliado
            </Link>
          )}
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 pb-16 max-w-5xl mx-auto">
        <p className="lv-overline text-center mb-2">Como funciona</p>
        <h2 className="lv-heading-lg text-center mb-12">4 passos simples</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {steps.map((step, idx) => (
            <div key={idx} className="lv-card text-center relative">
              <div className="absolute -top-3 -left-1">
                <span className="text-3xl font-bold text-foreground/5">{String(idx + 1).padStart(2, "0")}</span>
              </div>
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <step.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="lv-heading-sm text-sm mb-2">{step.title}</h3>
              <p className="lv-body">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="px-6 pb-16 max-w-5xl mx-auto">
        <p className="lv-overline text-center mb-2">Vantagens</p>
        <h2 className="lv-heading-lg text-center mb-12">Por que ser afiliado?</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {benefits.map((b, idx) => (
            <div key={idx} className="lv-card">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <b.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="lv-heading-sm text-sm mb-2">{b.title}</h3>
              <p className="lv-body">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Commission Table */}
      <section className="px-6 pb-16 max-w-3xl mx-auto">
        <p className="lv-overline text-center mb-2">Simulação</p>
        <h2 className="lv-heading-lg text-center mb-12">Quanto você pode ganhar</h2>
        <div className="lv-card overflow-hidden p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/60">
                <th className="lv-overline text-left p-5">Plano</th>
                <th className="lv-overline text-right p-5">Preço</th>
                <th className="lv-overline text-right p-5">Sua comissão (30%)</th>
              </tr>
            </thead>
            <tbody>
              {[
                { plan: "1 Dia", price: 9.99 },
                { plan: "7 Dias", price: 49.90 },
                { plan: "1 Mês", price: 149.90 },
                { plan: "12 Meses", price: 499.00 },
              ].map((row) => (
                <tr key={row.plan} className="border-b border-border/40 last:border-0">
                  <td className="p-5 lv-body-strong">{row.plan}</td>
                  <td className="p-5 lv-body text-right">R${row.price.toFixed(2)}</td>
                  <td className="p-5 text-right">
                    <span className="lv-stat text-lg">R${(row.price * 0.3).toFixed(2)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-center lv-caption mt-3 italic">
          Exemplo: 10 vendas do plano de 1 Mês = R$449,70 em comissões.
        </p>
      </section>

      {/* FAQ */}
      <section className="px-6 pb-16 max-w-3xl mx-auto">
        <p className="lv-overline text-center mb-2">Dúvidas frequentes</p>
        <h2 className="lv-heading-lg text-center mb-12">FAQ</h2>
        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div key={idx} className="lv-card">
              <h3 className="lv-body-strong mb-2">{faq.q}</h3>
              <p className="lv-body">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-20 max-w-3xl mx-auto">
        <div className="lv-card text-center py-12">
          <h2 className="lv-heading-lg mb-3">Pronto para começar?</h2>
          <p className="lv-body text-base mb-8 max-w-md mx-auto">
            Cadastre-se, adquira um plano e ative seu link de afiliado em segundos.
          </p>
          {!authLoading && user ? (
            <button onClick={() => setShowEnrollForm(true)} className="lv-btn-primary lv-btn-lg px-8">
              Ativar meu link de afiliado
            </button>
          ) : (
            <Link to="/register" className="lv-btn-primary lv-btn-lg px-8">
              Criar conta grátis
            </Link>
          )}
        </div>
      </section>

      {/* Enrollment Sheet */}
      <Sheet open={showEnrollForm} onOpenChange={setShowEnrollForm}>
        <SheetContent side="bottom" className="rounded-t-2xl px-6 pb-8 pt-6 max-h-[85vh] overflow-y-auto">
          <SheetHeader className="text-left mb-5">
            <p className="lv-overline mb-1">Ativação</p>
            <SheetTitle className="lv-heading-lg text-xl">Tornar-se afiliado</SheetTitle>
            <SheetDescription className="lv-body">
              Escolha um nome de exibição para seu perfil de afiliado.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5">
            <div>
              <label className="lv-overline ml-1 block mb-1.5">Nome de exibição</label>
              <input
                type="text"
                value={enrollName}
                onChange={(e) => setEnrollName(e.target.value)}
                placeholder="Ex: João Dev"
                className="lv-input h-12 text-base px-5"
                maxLength={50}
              />
            </div>

            <div className="lv-card-sm bg-muted/30">
              <p className="lv-overline mb-3">Você receberá:</p>
              <ul className="space-y-2">
                {["Link exclusivo de indicação", "30% de comissão por venda", "20% de desconto nos seus planos", "Painel financeiro completo", "Programa CodeCoins"].map((item) => (
                  <li key={item} className="flex items-center gap-2 lv-body">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" /> {item}
                  </li>
                ))}
              </ul>
            </div>

            <button onClick={handleEnroll} disabled={enrolling} className="lv-sheet-btn">
              {enrolling ? "Ativando..." : "Confirmar ativação"}
            </button>

            <p className="text-center lv-caption pt-4">{brandName} — Programa de Afiliados</p>
          </div>
        </SheetContent>
      </Sheet>

      <footer className="border-t border-border/60 px-6 py-6 text-center">
        <p className="lv-caption">© 2025 {brandName} — Todos os direitos reservados</p>
      </footer>
    </div>
  );
}
