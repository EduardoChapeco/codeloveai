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
  { slug: "primeiros-passos", title: "Primeiros Passos com o OrbIOS", category: "getting_started", summary: "Como instalar a extensão, conectar sua conta e começar a usar." },
  { slug: "extensao-chrome", title: "Usando a Extensão Chrome", category: "extension", summary: "Funcionalidades, atalhos e configurações da extensão." },
  { slug: "planos-limites", title: "Planos e Limites de Uso", category: "plans", summary: "Entenda os limites de cada plano e como fazer upgrade." },
  { slug: "seguranca-boas-praticas", title: "Segurança e Boas Práticas", category: "security", summary: "Como manter seus projetos seguros com o OrbIOS." },
  { slug: "white-label-guia", title: "White Label — Guia para Operadores", category: "white_label", summary: "Como configurar e gerenciar sua plataforma White Label." },
  { slug: "brain-lab-intro", title: "O que é o OrbIOS Brain?", category: "brain_lab", summary: "Entenda o que é o Brain Lab, seus recursos e como funciona." },
  { slug: "orchestrator-intro", title: "Como funciona o Orchestrator Engine?", category: "orchestrator", summary: "Compreenda o motor autônomo de criação de projetos." },
  { slug: "labs-acesso", title: "OrbIOS Labs — Acesso e Restrições", category: "brain_lab", summary: "Saiba quem pode acessar Labs e como funciona a exclusividade para White Label." },
  { slug: "backups-recomendacoes", title: "Backups e Boas Práticas de Projeto", category: "security", summary: "Por que e como manter backups do seu Supabase e código-fonte." },
  { slug: "integracao-github", title: "Conectando seu Projeto ao GitHub", category: "getting_started", summary: "Passo-a-passo para sincronizar seus projetos com o GitHub." },
  { slug: "supabase-externo", title: "Usando Supabase Externo", category: "getting_started", summary: "Por que recomendamos Supabase próprio e como configurar." },
  { slug: "afiliados-como-funciona", title: "Programa de Afiliados — Como Funciona", category: "faq", summary: "Tudo sobre comissões, pagamentos e regras do programa." },
  { slug: "limite-mensagens", title: "Como funciona o limite de mensagens?", category: "plans", summary: "Entenda o sistema de cotas e como ele é calculado." },
  { slug: "modulos-extras", title: "Módulos Extras e Cobrança", category: "plans", summary: "O admin master pode ativar módulos extras com cobrança por tenant." },
];

export default function HelpCenter() {
  useSEO({ title: "Central de Ajuda — OrbIOS", description: "Encontre respostas para suas dúvidas sobre o OrbIOS." });
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
      <div className="rd-page-content" style={{ maxWidth: 1100, paddingTop: 48, paddingBottom: 48 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div className="rd-ico-box" style={{ width: 64, height: 64, borderRadius: 16, margin: "0 auto 24px", background: "rgba(59,130,246,0.12)", color: "var(--blue-l)" }}>
            <BookOpen style={{ width: 32, height: 32 }} />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.04em", color: "var(--text-primary)", marginBottom: 6 }}>Central de Ajuda</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", maxWidth: 400, margin: "0 auto" }}>Artigos, guias e respostas para tudo sobre o Starble.</p>
        </div>

        {/* Search */}
        <div style={{ position: "relative", maxWidth: 480, margin: "0 auto 40px" }}>
          <Search size={14} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-quaternary)" }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar artigos..."
            className="rd-input"
            style={{ height: 44, paddingLeft: 38, fontSize: 14 }}
          />
        </div>

        {/* Category Cards Grid */}
        {!search && !activeCategory && (
          <div className="rd-grid-4" style={{ marginBottom: 48 }}>
            {categories.map(c => {
              const count = getCategoryArticles(c.id).length;
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveCategory(c.id)}
                  className="rd-card"
                  style={{ textAlign: "left", cursor: "pointer", transition: "all .14s" }}
                >
                  <div className="rd-ico-box" style={{ marginBottom: 12, background: "rgba(59,130,246,0.12)", color: "var(--blue-l)" }}>
                    {c.icon}
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>{c.label}</p>
                  <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 10, lineHeight: 1.5 }}>{c.desc}</p>
                  <p style={{ fontSize: 10, color: "var(--text-quaternary)" }}>{count} {count === 1 ? "artigo" : "artigos"}</p>
                </button>
              );
            })}
          </div>
        )}

        {/* Active Category Filter */}
        {activeCategory && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
            <button onClick={() => setActiveCategory(null)} style={{ fontSize: 12, color: "var(--text-tertiary)", cursor: "pointer", background: "none", border: "none" }}>
              ← Todas as categorias
            </button>
            <span style={{ fontSize: 12, color: "var(--text-quaternary)" }}>/</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
              {categories.find(c => c.id === activeCategory)?.label}
            </span>
          </div>
        )}

        {/* Search filter chips */}
        {search && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
            <button
              onClick={() => setActiveCategory(null)}
              className={!activeCategory ? "gl xs orange" : "gl xs ghost"}
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
                  className={activeCategory === c.id ? "gl xs orange" : "gl xs ghost"}
                >
                  {c.label} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Articles Grid */}
        {(search || activeCategory) && (
          <div className="rd-grid-2">
            {filtered.length === 0 ? (
              <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "60px 0", color: "var(--text-tertiary)", fontSize: 13 }}>
                Nenhum artigo encontrado. <Link to="/suporte" style={{ color: "var(--blue-l)" }}>Abrir um ticket de suporte</Link>
              </div>
            ) : (
              filtered.map(a => {
                const cat = categories.find(c => c.id === a.category);
                return (
                  <Link
                    key={a.slug}
                    to={`/ajuda/${a.slug}`}
                    className="rd-card"
                    style={{ display: "flex", alignItems: "flex-start", gap: 14, textDecoration: "none", color: "inherit" }}
                  >
                    <div className="rd-ico-box sm" style={{ background: "rgba(59,130,246,0.1)", color: "var(--blue-l)", flexShrink: 0, marginTop: 2 }}>
                      {cat?.icon || <BookOpen size={14} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>{a.title}</p>
                      <p style={{ fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.5 }}>{a.summary}</p>
                      <p style={{ fontSize: 10, color: "var(--text-quaternary)", marginTop: 6 }}>{cat?.label}</p>
                    </div>
                    <ChevronRight size={14} style={{ color: "var(--text-quaternary)", flexShrink: 0, marginTop: 4 }} />
                  </Link>
                );
              })
            )}
          </div>
        )}

        {/* Support CTA */}
        <div className="rd-card" style={{ textAlign: "center", padding: 32, marginTop: 48 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: "var(--text-primary)", marginBottom: 6 }}>Não encontrou o que procurava?</h2>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>Nossa equipe de suporte está pronta para ajudar você.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/suporte" className="gl primary">Abrir Ticket de Suporte</Link>
            <Link to="/termos" className="gl ghost" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <ExternalLink size={13} /> Termos de Uso
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
