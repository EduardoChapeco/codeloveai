import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, BookOpen, Zap, Globe, Building2, CreditCard, Shield, HelpCircle, ChevronRight, ExternalLink, FlaskConical, Bot } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useSEO } from "@/hooks/useSEO";

const categories = [
  { id: "getting_started", label: "Primeiros Passos", icon: <Zap className="h-5 w-5" />, desc: "Instalação, conta e configuração inicial" },
  { id: "extension", label: "Extensão Chrome", icon: <Globe className="h-5 w-5" />, desc: "Funcionalidades e troubleshooting" },
  { id: "brain_lab", label: "Brain & Labs", icon: <FlaskConical className="h-5 w-5" />, desc: "Brain, Orchestrator e StarCrawl" },
  { id: "orchestrator", label: "Orchestrator", icon: <Bot className="h-5 w-5" />, desc: "Motor autônomo de criação" },
  { id: "white_label", label: "White Label", icon: <Building2 className="h-5 w-5" />, desc: "Marca própria e gestão de tenant" },
  { id: "plans", label: "Planos e Cobrança", icon: <CreditCard className="h-5 w-5" />, desc: "Limites, upgrade e pagamentos" },
  { id: "security", label: "Segurança", icon: <Shield className="h-5 w-5" />, desc: "Backups, boas práticas e proteção" },
  { id: "faq", label: "FAQ Geral", icon: <HelpCircle className="h-5 w-5" />, desc: "Perguntas frequentes" },
];

const articles = [
  { slug: "primeiros-passos", title: "Primeiros Passos com o Starble", category: "getting_started", summary: "Como instalar a extensão, conectar sua conta e começar a usar." },
  { slug: "extensao-chrome", title: "Usando a Extensão Chrome", category: "extension", summary: "Funcionalidades, atalhos e configurações da extensão." },
  { slug: "planos-limites", title: "Planos e Limites de Uso", category: "plans", summary: "Entenda os limites de cada plano e como fazer upgrade." },
  { slug: "seguranca-boas-praticas", title: "Segurança e Boas Práticas", category: "security", summary: "Como manter seus projetos seguros com o Starble." },
  { slug: "white-label-guia", title: "White Label — Guia para Operadores", category: "white_label", summary: "Como configurar e gerenciar sua plataforma White Label." },
  { slug: "brain-lab-intro", title: "O que é o Starble Brain?", category: "brain_lab", summary: "Entenda o que é o Brain Lab, seus recursos e como funciona." },
  { slug: "orchestrator-intro", title: "Como funciona o Orchestrator Engine?", category: "orchestrator", summary: "Compreenda o motor autônomo de criação de projetos." },
  { slug: "labs-acesso", title: "Starble Labs — Acesso e Restrições", category: "brain_lab", summary: "Saiba quem pode acessar Labs e como funciona a exclusividade para White Label." },
  { slug: "backups-recomendacoes", title: "Backups e Boas Práticas de Projeto", category: "security", summary: "Por que e como manter backups do seu Supabase e código-fonte." },
  { slug: "integracao-github", title: "Conectando seu Projeto ao GitHub", category: "getting_started", summary: "Passo-a-passo para sincronizar seus projetos com o GitHub." },
  { slug: "supabase-externo", title: "Usando Supabase Externo", category: "getting_started", summary: "Por que recomendamos Supabase próprio e como configurar." },
  { slug: "afiliados-como-funciona", title: "Programa de Afiliados — Como Funciona", category: "faq", summary: "Tudo sobre comissões, pagamentos e regras do programa." },
  { slug: "limite-mensagens", title: "Como funciona o limite de mensagens?", category: "plans", summary: "Entenda o sistema de cotas e como ele é calculado." },
  { slug: "modulos-extras", title: "Módulos Extras e Cobrança", category: "plans", summary: "O admin master pode ativar módulos extras com cobrança por tenant." },
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

  const getCategoryArticles = (catId: string) => articles.filter(a => a.category === catId);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3">Central de Ajuda</h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">Artigos, guias e respostas para tudo sobre o Starble.</p>
        </div>

        {/* Search */}
        <div className="relative max-w-lg mx-auto mb-12">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar artigos..."
            className="w-full h-11 rounded-xl border border-border bg-card pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Category Cards Grid */}
        {!search && !activeCategory && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            {categories.map(c => {
              const count = getCategoryArticles(c.id).length;
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveCategory(c.id)}
                  className="group rounded-2xl border border-border/60 bg-card p-5 text-left hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200"
                >
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-3 group-hover:bg-primary/15 transition-colors">
                    {c.icon}
                  </div>
                  <p className="text-sm font-semibold text-foreground mb-1">{c.label}</p>
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{c.desc}</p>
                  <p className="text-[10px] text-muted-foreground/60">{count} {count === 1 ? "artigo" : "artigos"}</p>
                </button>
              );
            })}
          </div>
        )}

        {/* Active Category Filter */}
        {activeCategory && (
          <div className="flex items-center gap-3 mb-8">
            <button
              onClick={() => setActiveCategory(null)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Todas as categorias
            </button>
            <span className="text-xs text-muted-foreground">/</span>
            <span className="text-xs font-semibold text-foreground">
              {categories.find(c => c.id === activeCategory)?.label}
            </span>
          </div>
        )}

        {/* Search filter chips */}
        {search && (
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setActiveCategory(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!activeCategory ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            >
              Todos ({articles.filter(a => !search || a.title.toLowerCase().includes(search.toLowerCase()) || a.summary.toLowerCase().includes(search.toLowerCase())).length})
            </button>
            {categories.map(c => {
              const count = articles.filter(a => a.category === c.id && (!search || a.title.toLowerCase().includes(search.toLowerCase()) || a.summary.toLowerCase().includes(search.toLowerCase()))).length;
              if (count === 0) return null;
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveCategory(activeCategory === c.id ? null : c.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeCategory === c.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                >
                  {c.label} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Articles Grid */}
        {(search || activeCategory) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.length === 0 ? (
              <div className="col-span-full text-center py-16 text-sm text-muted-foreground">
                Nenhum artigo encontrado. <Link to="/suporte" className="text-primary hover:underline">Abrir um ticket de suporte</Link>
              </div>
            ) : (
              filtered.map(a => {
                const cat = categories.find(c => c.id === a.category);
                return (
                  <Link
                    key={a.slug}
                    to={`/ajuda/${a.slug}`}
                    className="group rounded-2xl border border-border/60 bg-card p-5 hover:border-primary/30 hover:shadow-md transition-all duration-200 flex items-start gap-4"
                  >
                    <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5 group-hover:bg-primary/15 transition-colors">
                      {cat?.icon || <BookOpen className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{a.title}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{a.summary}</p>
                      <p className="text-[10px] text-muted-foreground/50 mt-2">{cat?.label}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary shrink-0 mt-1 transition-colors" />
                  </Link>
                );
              })
            )}
          </div>
        )}

        {/* Support CTA */}
        <div className="mt-16 rounded-2xl border border-border bg-card p-8 text-center">
          <h2 className="text-lg font-bold text-foreground mb-2">Não encontrou o que procurava?</h2>
          <p className="text-sm text-muted-foreground mb-6">Nossa equipe de suporte está pronta para ajudar você.</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link to="/suporte" className="inline-flex items-center gap-2 h-10 px-6 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
              Abrir Ticket de Suporte
            </Link>
            <Link to="/termos" className="inline-flex items-center gap-2 h-10 px-6 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
              <ExternalLink className="h-4 w-4" /> Termos de Uso
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
