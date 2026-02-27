import { Link } from "react-router-dom";
import { Check, Users, Building2, Zap, Shield, MessageSquare, Clock, ChevronDown, ArrowRight, Star, DollarSign, Globe, Layers } from "lucide-react";
import { useState } from "react";
import { useSEO } from "@/hooks/useSEO";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import MeshBackground from "@/components/MeshBackground";

const affiliateFeatures = [
  { icon: DollarSign, title: "Comissões por venda", desc: "Ganhe comissão em cada venda feita pelo seu link de indicação." },
  { icon: Users, title: "Desconto próprio", desc: "Como afiliado, você tem desconto automático em suas próprias compras." },
  { icon: Star, title: "Dashboard exclusivo", desc: "Acompanhe vendas, comissões e referrals em tempo real." },
  { icon: MessageSquare, title: "Suporte dedicado", desc: "Canal direto de suporte para afiliados." },
];

const wlFeatures = [
  { icon: Building2, title: "Sua própria marca", desc: "Logo, cores, domínio customizado e temas personalizados." },
  { icon: Globe, title: "Domínio próprio", desc: "Use seu domínio ou um subdomínio dedicado." },
  { icon: Layers, title: "Painel admin completo", desc: "Gerencie membros, tokens, finanças e extensão do seu tenant." },
  { icon: DollarSign, title: "Carteira virtual", desc: "Controle financeiro com carteira, ledger e faturas automáticas." },
  { icon: Users, title: "Seus próprios afiliados", desc: "Crie programa de afiliados dentro do seu tenant." },
  { icon: Shield, title: "Termos customizáveis", desc: "Defina seus próprios termos de uso para checkout." },
];

const modules = [
  { title: "Dashboard", desc: "Painel principal com status de assinatura, tokens ativos e download da extensão." },
  { title: "Comunidade", desc: "Feed social com posts, projetos, prompts e interação entre membros." },
  { title: "Chat AI", desc: "Assistente inteligente integrado para suporte e dúvidas." },
  { title: "Afiliados", desc: "Sistema completo de indicação com links, comissões e dashboard de ganhos." },
  { title: "Lovable Connect", desc: "Integração direta com conta Lovable para gerenciar projetos." },
  { title: "Admin Tenant", desc: "Painel de administração para gerenciar marca, membros, tokens e finanças." },
  { title: "Checkout", desc: "Fluxo de compra com PIX instantâneo e cartão via Mercado Pago." },
  { title: "Rastreamento de ativação", desc: "Registro de IP, dispositivo e localização na ativação da extensão." },
];

const faqs = [
  { q: "Quanto custa para ser afiliado?", a: "É gratuito! Basta se cadastrar na plataforma e solicitar inscrição como afiliado. Você recebe um link único e começa a ganhar comissões imediatamente." },
  { q: "Qual a comissão dos afiliados?", a: "A comissão varia conforme configuração do administrador. Afiliados também recebem desconto automático nas próprias compras." },
  { q: "Como funciona o White Label?", a: "Você adquire um plano White Label e recebe seu próprio tenant com marca personalizada. Pode configurar logo, cores, domínio e termos. Seus clientes compram através do seu site." },
  { q: "Quanto custa o White Label?", a: "O custo é de 40% do preço do plano: R$7,96 por usuário/dia ou R$59,96 por usuário/mês. Sem taxa de setup. A margem é toda sua." },
  { q: "Preciso ter conhecimento técnico?", a: "Não. Tudo é gerenciado pelo painel administrativo. Upload de extensão, gestão de tokens, financeiro — tudo via interface visual." },
  { q: "Como recebo meus ganhos?", a: "Afiliados recebem via PIX semanalmente. Tenants White Label têm carteira virtual com saque disponível." },
];

export default function PartnersLanding() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { tenant } = useTenant();
  const { user, loading: authLoading } = useAuth();
  const brandName = tenant?.name || "Starble";
  useSEO({ title: `Parceiros — ${brandName}`, description: "Programa de afiliados e White Label. Ganhe comissões ou revenda com sua própria marca." });

  const content = (
    <div className="min-h-screen relative">
      <MeshBackground />

      {/* Nav */}
      <nav className="sticky top-0 z-20 px-6 py-3">
        <div className="lv-glass rounded-2xl px-5 py-2.5 flex items-center justify-between">
          <Link to="/" className="text-base font-semibold tracking-tight text-foreground">{brandName}</Link>
          <div className="flex items-center gap-2">
            <Link to="/login" className="lv-btn-secondary h-9 px-4 text-xs">Entrar</Link>
            <Link to="/register" className="lv-btn-primary h-9 px-4 text-xs">Criar conta</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-24 lg:py-32 max-w-4xl mx-auto text-center animate-fade-in">
        <p className="lv-overline mb-4">Programa de Parceiros</p>
        <h1 className="lv-heading-xl mb-6">Ganhe dinheiro com {brandName}</h1>
        <p className="lv-body text-base max-w-2xl mx-auto mb-10">
          Seja afiliado e ganhe comissões por cada venda, ou monte seu próprio negócio com White Label — sua marca, seus clientes, seus preços.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <a href="#affiliates" className="lv-btn-primary lv-btn-lg">Ser Afiliado</a>
          <a href="#whitelabel" className="lv-btn-secondary lv-btn-lg">White Label</a>
        </div>
      </section>

      {/* Affiliates Section */}
      <section id="affiliates" className="px-6 pb-24 max-w-5xl mx-auto">
        <p className="lv-overline text-center mb-3">Programa de Afiliados</p>
        <h2 className="lv-heading-lg text-center mb-4">Indique e ganhe</h2>
        <p className="lv-body text-center max-w-2xl mx-auto mb-12">
          Cadastre-se como afiliado gratuitamente. Compartilhe seu link e ganhe comissão em cada venda. Você também recebe desconto automático nas suas compras.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {affiliateFeatures.map((f, i) => (
            <div key={f.title} className="lv-card flex flex-col items-start gap-4" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="lv-heading-sm mb-2">{f.title}</h3>
                <p className="lv-body">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center">
          <Link to="/register" className="lv-btn-primary lv-btn-lg inline-flex items-center gap-2">
            Quero ser afiliado <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* White Label Section */}
      <section id="whitelabel" className="px-6 pb-24 max-w-5xl mx-auto">
        <p className="lv-overline text-center mb-3">White Label</p>
        <h2 className="lv-heading-lg text-center mb-4">Sua marca, seu negócio</h2>
        <p className="lv-body text-center max-w-2xl mx-auto mb-12">
          Monte uma operação completa com sua própria marca. Logo, cores, domínio, termos customizados, painel admin e programa de afiliados próprio.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {wlFeatures.map((f, i) => (
            <div key={f.title} className="lv-card flex flex-col items-start gap-4" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="lv-heading-sm mb-2">{f.title}</h3>
                <p className="lv-body">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center">
          <Link to="/register" className="lv-btn-primary lv-btn-lg inline-flex items-center gap-2">
            Quero White Label <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Modules */}
      <section className="px-6 pb-24 max-w-5xl mx-auto">
        <p className="lv-overline text-center mb-3">Módulos inclusos</p>
        <h2 className="lv-heading-lg text-center mb-12">Tudo que você precisa</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {modules.map((m) => (
            <div key={m.title} className="lv-card-sm">
              <h3 className="lv-heading-sm mb-2">{m.title}</h3>
              <p className="lv-body">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 pb-24 max-w-2xl mx-auto">
        <p className="lv-overline text-center mb-3">Dúvidas frequentes</p>
        <h2 className="lv-heading-lg text-center mb-10">FAQ Parceiros</h2>
        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <div key={i} className="lv-card-sm cursor-pointer" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
              <div className="flex items-center justify-between">
                <span className="lv-body-strong">{faq.q}</span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${openFaq === i ? "rotate-180" : ""}`} />
              </div>
              {openFaq === i && <p className="mt-3 lv-body animate-fade-in">{faq.a}</p>}
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
