import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, BookOpen, Zap, Globe, Building2, CreditCard, Shield, HelpCircle, ChevronRight, ExternalLink } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useSEO } from "@/hooks/useSEO";

const categories = [
  { id: "getting_started", label: "Primeiros Passos", icon: <Zap className="h-5 w-5" />, color: "text-primary", bg: "bg-primary/10 border-primary/20" },
  { id: "extension", label: "Extensão Chrome", icon: <Globe className="h-5 w-5" />, color: "text-primary", bg: "bg-primary/10 border-primary/20" },
  { id: "brain_lab", label: "Brain Lab", icon: <BookOpen className="h-5 w-5" />, color: "text-primary", bg: "bg-primary/10 border-primary/20" },
  { id: "orchestrator", label: "Orchestrator", icon: <Zap className="h-5 w-5" />, color: "text-primary", bg: "bg-primary/10 border-primary/20" },
  { id: "white_label", label: "White Label", icon: <Building2 className="h-5 w-5" />, color: "text-primary", bg: "bg-primary/10 border-primary/20" },
  { id: "plans", label: "Planos e Cobrança", icon: <CreditCard className="h-5 w-5" />, color: "text-primary", bg: "bg-primary/10 border-primary/20" },
  { id: "security", label: "Segurança", icon: <Shield className="h-5 w-5" />, color: "text-primary", bg: "bg-primary/10 border-primary/20" },
  { id: "faq", label: "FAQ Geral", icon: <HelpCircle className="h-5 w-5" />, color: "text-primary", bg: "bg-primary/10 border-primary/20" },
];

const articles = [
  { slug: "primeiros-passos", title: "Primeiros Passos com o Starble", category: "getting_started", summary: "Como instalar a extensão, conectar sua conta e começar a usar." },
  { slug: "extensao-chrome", title: "Usando a Extensão Chrome", category: "extension", summary: "Funcionalidades, atalhos e configurações da extensão." },
  { slug: "planos-limites", title: "Planos e Limites de Uso", category: "plans", summary: "Entenda os limites de cada plano e como fazer upgrade." },
  { slug: "seguranca-boas-praticas", title: "Segurança e Boas Práticas", category: "security", summary: "Como manter seus projetos seguros com o Starble." },
  { slug: "white-label-guia", title: "White Label — Guia para Operadores", category: "white_label", summary: "Como configurar e gerenciar sua plataforma White Label." },
  { slug: "brain-lab-intro", title: "O que é o Starble Brain?", category: "brain_lab", summary: "Entenda o que é o Brain Lab, seus recursos e como funciona." },
  { slug: "orchestrator-intro", title: "Como funciona o Orchestrator Engine?", category: "orchestrator", summary: "Compreenda o motor autônomo de criação de projetos." },
  { slug: "backups-recomendacoes", title: "Backups e Boas Práticas de Projeto", category: "security", summary: "Por que e como manter backups do seu Supabase e código-fonte." },
  { slug: "integracao-github", title: "Conectando seu Projeto ao GitHub", category: "getting_started", summary: "Passo-a-passo para sincronizar seus projetos com o GitHub." },
  { slug: "supabase-externo", title: "Usando Supabase Externo", category: "getting_started", summary: "Por que recomendamos Supabase próprio e como configurar." },
  { slug: "afiliados-como-funciona", title: "Programa de Afiliados — Como Funciona", category: "faq", summary: "Tudo sobre comissões, pagamentos e regras do programa." },
  { slug: "limite-mensagens", title: "Como funciona o limite de mensagens?", category: "plans", summary: "Entenda o sistema de cotas e como ele é calculado." },
];

export default function HelpCenter() {
  useSEO({ title: "Central de Ajuda — Starble", description: "Encontre respostas para suas dúvidas sobre o Starble." });
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = articles.filter(a => {
    const matchSearch = !search || a.title.toLowerCase().includes(search.toLowerCase()) || a.summary.toLowerCase().includes(search.toLowerCase());
    const matchCat = !activeCategory || a.category === activeCategory;
    return matchSearch && matchCat;
  });

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
          <h1 className="lv-heading-lg mb-3">Central de Ajuda</h1>
          <p className="lv-body max-w-md mx-auto">Artigos, guias e respostas para tudo sobre o Starble.</p>
        </div>

        {/* Search */}
        <div className="relative max-w-lg mx-auto mb-12">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar artigos..."
            className="lv-input pl-11"
          />
        </div>

        {/* Categories */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          {categories.map(c => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(activeCategory === c.id ? null : c.id)}
              className={`lv-card-sm text-left transition-all ${
                activeCategory === c.id ? "lv-card-active" : ""
              }`}
            >
              <div className={`mb-2 ${activeCategory === c.id ? "text-primary" : "text-muted-foreground"}`}>{c.icon}</div>
              <p className={`text-xs font-semibold ${activeCategory === c.id ? "text-primary" : "text-foreground"}`}>{c.label}</p>
            </button>
          ))}
        </div>

        {/* Articles */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-16 lv-body">
              Nenhum artigo encontrado. <Link to="/suporte" className="text-primary hover:underline">Abrir um ticket de suporte</Link>
            </div>
          ) : (
            filtered.map(a => (
              <Link
                key={a.slug}
                to={`/ajuda/${a.slug}`}
                className="lv-card-interactive flex items-center justify-between !p-4 group"
              >
                <div>
                  <h3 className="lv-body-strong mb-0.5">{a.title}</h3>
                  <p className="lv-caption">{a.summary}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 ml-4" />
              </Link>
            ))
          )}
        </div>

        {/* Support CTA */}
        <div className="mt-16 lv-card p-8 text-center">
          <h2 className="lv-heading-sm mb-2">Não encontrou o que procurava?</h2>
          <p className="lv-body mb-6">Nossa equipe de suporte está pronta para ajudar você.</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link to="/suporte" className="lv-btn-primary">
              Abrir Ticket de Suporte
            </Link>
            <Link to="/termos" className="lv-btn-secondary flex items-center gap-2">
              <ExternalLink className="h-4 w-4" /> Termos de Uso
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
