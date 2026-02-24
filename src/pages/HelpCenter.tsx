import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, BookOpen, Zap, Globe, Building2, CreditCard, Shield, HelpCircle, ChevronRight, ExternalLink } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useSEO } from "@/hooks/useSEO";

const categories = [
  { id: "getting_started", label: "Primeiros Passos", icon: <Zap className="h-5 w-5" />, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  { id: "extension", label: "Extensão Chrome", icon: <Globe className="h-5 w-5" />, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  { id: "brain_lab", label: "Brain Lab", icon: <BookOpen className="h-5 w-5" />, color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
  { id: "orchestrator", label: "Orchestrator", icon: <Zap className="h-5 w-5" />, color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/20" },
  { id: "white_label", label: "White Label", icon: <Building2 className="h-5 w-5" />, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  { id: "plans", label: "Planos e Cobrança", icon: <CreditCard className="h-5 w-5" />, color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/20" },
  { id: "security", label: "Segurança", icon: <Shield className="h-5 w-5" />, color: "text-slate-400", bg: "bg-slate-500/10 border-slate-500/20" },
  { id: "faq", label: "FAQ Geral", icon: <HelpCircle className="h-5 w-5" />, color: "text-teal-400", bg: "bg-teal-500/10 border-teal-500/20" },
];

// Static articles for client-side display (could be fetched from Supabase)
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
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mx-auto mb-6">
            <BookOpen className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-3">Central de Ajuda</h1>
          <p className="text-muted-foreground max-w-md mx-auto">Artigos, guias e respostas para tudo sobre o Starble.</p>
        </div>

        {/* Search */}
        <div className="relative max-w-lg mx-auto mb-12">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar artigos..."
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
          />
        </div>

        {/* Categories */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          {categories.map(c => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(activeCategory === c.id ? null : c.id)}
              className={`p-4 rounded-xl border text-left transition-all ${
                activeCategory === c.id
                  ? `${c.bg} border-current`
                  : "bg-muted/30 border-border/60 hover:border-border"
              }`}
            >
              <div className={`mb-2 ${activeCategory === c.id ? c.color : "text-muted-foreground"}`}>{c.icon}</div>
              <p className={`text-xs font-semibold ${activeCategory === c.id ? c.color : "text-foreground"}`}>{c.label}</p>
            </button>
          ))}
        </div>

        {/* Articles */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              Nenhum artigo encontrado. <Link to="/suporte" className="text-primary hover:underline">Abrir um ticket de suporte</Link>
            </div>
          ) : (
            filtered.map(a => (
              <Link
                key={a.slug}
                to={`/ajuda/${a.slug}`}
                className="flex items-center justify-between p-4 rounded-xl bg-muted/20 border border-border/60 hover:border-border hover:bg-muted/40 transition-all group"
              >
                <div>
                  <h3 className="font-medium text-sm mb-0.5">{a.title}</h3>
                  <p className="text-xs text-muted-foreground">{a.summary}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 ml-4" />
              </Link>
            ))
          )}
        </div>

        {/* Support CTA */}
        <div className="mt-16 p-6 rounded-2xl bg-gradient-to-r from-violet-500/10 to-indigo-500/10 border border-violet-500/20 text-center">
          <h2 className="font-bold mb-2">Não encontrou o que procurava?</h2>
          <p className="text-sm text-muted-foreground mb-4">Nossa equipe de suporte está pronta para ajudar você.</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link to="/suporte" className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2">
              Abrir Ticket de Suporte
            </Link>
            <Link to="/termos" className="px-5 py-2 rounded-lg bg-muted text-muted-foreground text-sm font-medium hover:bg-muted/80 transition-colors flex items-center gap-2">
              <ExternalLink className="h-4 w-4" /> Termos de Uso
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
