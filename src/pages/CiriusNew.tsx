import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Rocket, BarChart3, ShoppingCart, Settings, Briefcase, Puzzle,
  Link as LinkIcon, ChevronDown, Zap, Database, Shield, CreditCard,
  HardDrive, Clock, ArrowRight, Layers, Code2, Cpu, Globe,
} from "lucide-react";
import { classifyIntent, generatePRDTasks, type ProjectBlueprint, type PRDTask } from "@/lib/cirius/intentClassifier";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ENGINE_LABELS: Record<string, { label: string; desc: string }> = {
  brainchain: { label: "Brainchain", desc: "Pool rápido — geração instantânea" },
  brain: { label: "Brain", desc: "IA pessoal — código especializado" },
  orchestrator: { label: "Orchestrator", desc: "Multi-task — projetos complexos" },
  claude_direct: { label: "Claude Direct", desc: "Sem Brains — geração direta via Claude" },
};

const INTENT_LABELS: Record<string, string> = {
  landing_page: "Landing Page",
  marketing_site: "Site Institucional",
  crud_system: "Sistema CRUD",
  dashboard: "Dashboard",
  ecommerce: "E-commerce",
  saas_app: "SaaS App",
  api_only: "API / Backend",
  component: "Componente UI",
  custom: "Projeto Customizado",
};

const FALLBACK_TEMPLATES = [
  { icon: Rocket, label: "Landing Page", prompt: "Crie uma landing page moderna e responsiva com hero section, features, depoimentos e CTA. Design clean e profissional.", color: "orange" },
  { icon: BarChart3, label: "Dashboard", prompt: "Crie um dashboard de analytics com gráficos de vendas, métricas de usuários, tabelas de dados recentes e filtros por período.", color: "blue" },
  { icon: ShoppingCart, label: "E-commerce", prompt: "Crie uma loja online com catálogo de produtos, carrinho de compras, checkout e painel de gerenciamento de pedidos.", color: "green" },
  { icon: Settings, label: "Sistema CRUD", prompt: "Crie um sistema de gerenciamento com cadastro, listagem, edição e exclusão. Inclua autenticação e filtros de busca.", color: "purple" },
  { icon: Briefcase, label: "SaaS App", prompt: "Crie um aplicativo SaaS com autenticação, planos de assinatura, dashboard do usuário, billing e painel administrativo.", color: "indigo" },
  { icon: Puzzle, label: "Componente UI", prompt: "Crie um componente de UI reutilizável com variações, estados interativos, animações e documentação de uso.", color: "teal" },
];

const COLOR_MAP: Record<string, string> = {
  orange: "ib-orange", blue: "ib-blue", green: "ib-green",
  purple: "ib-purple", indigo: "ib-indigo", teal: "ib-teal",
};

export default function CiriusNew() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [prompt, setPrompt] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [projectName, setProjectName] = useState("");
  const [deployGithub, setDeployGithub] = useState(true);
  const [deployVercel, setDeployVercel] = useState(false);
  const [createSupabase, setCreateSupabase] = useState(false);
  const [noBrains, setNoBrains] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dbTemplates, setDbTemplates] = useState<Array<{ id: string; name: string; description: string | null; prompt_template: string; category: string | null }>>([]);

  // Fetch templates from DB
  useEffect(() => {
    supabase.from("cirius_templates" as any)
      .select("id, name, description, prompt_template, category")
      .eq("is_premium", false)
      .order("usage_count", { ascending: false })
      .limit(12)
      .then(({ data }) => {
        if (data && data.length > 0) setDbTemplates(data as any);
      });
  }, []);

  const [blueprint, setBlueprint] = useState<ProjectBlueprint | null>(null);
  const [prdTasks, setPrdTasks] = useState<PRDTask[]>([]);

  useEffect(() => {
    if (!prompt.trim() || prompt.trim().length < 5) {
      setBlueprint(null);
      setPrdTasks([]);
      return;
    }
    const timer = setTimeout(() => {
      const bp = classifyIntent(prompt);
      setBlueprint(bp);
      setPrdTasks(generatePRDTasks(prompt, bp));
      setCreateSupabase(bp.needsDatabase);
    }, 500);
    return () => clearTimeout(timer);
  }, [prompt]);

  const estimatedTime = useMemo(() => {
    if (!blueprint) return null;
    const mins = blueprint.estimatedTasks * 1.5;
    return mins < 2 ? "~1 min" : `~${Math.round(mins)} min`;
  }, [blueprint]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return toast.error("Descreva o que você quer criar");
    if (!user) return toast.error("Faça login para continuar");

    setLoading(true);
    try {
      const name = projectName.trim() || `Projeto ${new Date().toLocaleDateString("pt-BR")}`;
      const { data, error } = await supabase.functions.invoke("cirius-generate", {
        body: {
          action: "start",
          user_prompt: prompt,
          project_name: name,
          source_url: sourceUrl || undefined,
          config: {
            deploy_github: deployGithub,
            deploy_vercel: deployVercel,
            create_supabase: createSupabase,
            no_brains: noBrains,
          },
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao iniciar geração");
      toast.success("Projeto iniciado!");
      const pid = data.project_id;
      if (pid) navigate(`/cirius/editor/${pid}`);
      else navigate("/cirius");
    } catch (e) {
      toast.error((e as Error).message || "Erro ao gerar projeto");
    } finally {
      setLoading(false);
    }
  }, [prompt, projectName, sourceUrl, deployGithub, deployVercel, createSupabase, noBrains, user, navigate]);

  return (
    <AppLayout>
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        {/* Header */}
        <div className="page-header">
          <div className="ph-top">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div className="nav-ico-box ib-orange"><Zap size={16} /></div>
              <div>
                <div className="ph-title">Novo Projeto</div>
                <div className="ph-sub">Descreva sua ideia e gere código funcional em minutos</div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px 32px", scrollbarWidth: "thin", scrollbarColor: "var(--bg-5) transparent" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, maxWidth: 960, alignItems: "start" }}>

            {/* LEFT — Main Input */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Prompt */}
              <div className="rd-card" style={{ padding: 16 }}>
                <div className="sec-label" style={{ marginBottom: 8 }}>Descreva seu projeto</div>
                <textarea
                  className="rd-input"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={"Descreva o que você quer criar...\n\nEx: \"Uma landing page moderna para minha startup de IA\"\nEx: \"Sistema de gerenciamento de clientes com CRUD completo\""}
                  style={{ minHeight: 140, resize: "none", lineHeight: 1.55, fontFamily: "var(--font)" }}
                />
              </div>

              {/* Source URL */}
              <div style={{ position: "relative" }}>
                <LinkIcon size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--tq)" }} />
                <input
                  className="rd-input"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://site-que-quero-replicar.com (opcional)"
                  style={{ paddingLeft: 36 }}
                />
              </div>

              {/* Config toggle */}
              <button
                className="gl sm ghost"
                onClick={() => setConfigOpen(!configOpen)}
                style={{ alignSelf: "flex-start" }}
              >
                <Settings size={12} />
                Configurações
                <ChevronDown size={12} style={{ transition: "transform .2s", transform: configOpen ? "rotate(180deg)" : "none" }} />
              </button>

              {configOpen && (
                <div className="rd-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                  <input
                    className="rd-input"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Nome do projeto (opcional)"
                  />
                  {[
                    { label: "Deploy no GitHub", icon: Globe, checked: deployGithub, set: setDeployGithub },
                    { label: "Deploy no Vercel", icon: Layers, checked: deployVercel, set: setDeployVercel },
                    { label: "Criar banco Supabase", icon: Database, checked: createSupabase, set: setCreateSupabase },
                    { label: "No Brains (Claude direto)", icon: Cpu, checked: noBrains, set: setNoBrains },
                  ].map((opt) => (
                    <label key={opt.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "var(--ts)", cursor: "pointer" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <opt.icon size={13} style={{ color: "var(--tt)" }} />
                        {opt.label}
                      </span>
                      <span
                        onClick={(e) => { e.preventDefault(); opt.set(!opt.checked); }}
                        style={{
                          width: 32, height: 18, borderRadius: "var(--rF)",
                          background: opt.checked ? "var(--orange)" : "var(--bg-5)",
                          position: "relative", transition: "background .15s", cursor: "pointer",
                        }}
                      >
                        <span style={{
                          position: "absolute", top: 2, left: opt.checked ? 16 : 2,
                          width: 14, height: 14, borderRadius: "50%",
                          background: "#fff", transition: "left .15s",
                        }} />
                      </span>
                    </label>
                  ))}
                  {noBrains && (
                    <p style={{ fontSize: 10, color: "var(--orange-l)", paddingLeft: 22, opacity: 0.8 }}>
                      Gera o projeto inteiro via Claude/OpenRouter em uma única chamada — sem orquestrador nem Brain.
                    </p>
                  )}
                </div>
              )}

              {/* Templates — DB-sourced or fallback */}
              <div>
                <div className="sec-label" style={{ marginBottom: 10 }}>Templates Rápidos</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  {dbTemplates.length > 0 ? dbTemplates.map((t) => {
                    const CATEGORY_ICONS: Record<string, typeof Rocket> = {
                      landing_page: Rocket, dashboard: BarChart3, ecommerce: ShoppingCart,
                      crud_system: Settings, saas_app: Briefcase, marketing_site: Globe, custom: Puzzle,
                    };
                    const CATEGORY_COLORS: Record<string, string> = {
                      landing_page: "orange", dashboard: "blue", ecommerce: "green",
                      crud_system: "purple", saas_app: "indigo", marketing_site: "teal", custom: "orange",
                    };
                    const Icon = CATEGORY_ICONS[t.category || "custom"] || Puzzle;
                    const color = CATEGORY_COLORS[t.category || "custom"] || "orange";
                    return (
                      <button
                        key={t.id}
                        onClick={() => setPrompt(t.prompt_template)}
                        className="rd-card"
                        style={{
                          padding: "12px 14px", textAlign: "left", cursor: "pointer",
                          display: "flex", alignItems: "center", gap: 10,
                          transition: "all .15s var(--ease)",
                        }}
                      >
                        <div className={`nav-ico-box ${COLOR_MAP[color]}`} style={{ width: 30, height: 30, borderRadius: "var(--r2)" }}>
                          <Icon size={14} />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ts)" }}>{t.name}</span>
                          {t.description && <span style={{ fontSize: 10, color: "var(--tt)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</span>}
                        </div>
                      </button>
                    );
                  }) : FALLBACK_TEMPLATES.map((t) => (
                    <button
                      key={t.label}
                      onClick={() => setPrompt(t.prompt)}
                      className="rd-card"
                      style={{
                        padding: "12px 14px", textAlign: "left", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 10,
                        transition: "all .15s var(--ease)",
                      }}
                    >
                      <div className={`nav-ico-box ${COLOR_MAP[t.color]}`} style={{ width: 30, height: 30, borderRadius: "var(--r2)" }}>
                        <t.icon size={14} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ts)" }}>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate button */}
              <button
                className={`gl lg orange ${loading ? "loading" : ""}`}
                onClick={handleGenerate}
                disabled={loading || !prompt.trim()}
                style={{ width: "100%", justifyContent: "center", marginTop: 4 }}
              >
                {loading ? "Gerando..." : (
                  <>Gerar Projeto <ArrowRight size={14} /></>
                )}
              </button>
            </div>

            {/* RIGHT — Blueprint Panel */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, position: "sticky", top: 0 }}>
              {!blueprint ? (
                <div className="rd-card" style={{
                  padding: 40, display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", textAlign: "center",
                  minHeight: 240,
                }}>
                  <Cpu size={32} style={{ color: "var(--tq)", marginBottom: 12 }} />
                  <p style={{ fontSize: 12, color: "var(--tt)", lineHeight: 1.6 }}>
                    Comece a digitar para ver o blueprint em tempo real
                  </p>
                </div>
              ) : (
                <>
                  {/* Blueprint Card */}
                  <div className="rd-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div className="sec-label">Blueprint Detectado</div>
                      {estimatedTime && (
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--tt)" }}>
                          <Clock size={11} /> {estimatedTime}
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <span className="chip sm ch-blue">
                        {INTENT_LABELS[blueprint.intent] || blueprint.intent}
                      </span>
                      <span className={`chip sm ${noBrains ? "ch-orange" : "ch-gray"}`}>
                        {noBrains ? ENGINE_LABELS.claude_direct.label : ENGINE_LABELS[blueprint.suggestedEngine]?.label}
                      </span>
                    </div>

                    <p style={{ fontSize: 11, color: "var(--tt)" }}>
                      {noBrains ? ENGINE_LABELS.claude_direct.desc : ENGINE_LABELS[blueprint.suggestedEngine]?.desc}
                    </p>

                    {/* Capabilities */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {blueprint.needsDatabase && <span className="chip sm ch-green"><Database size={10} /> Database</span>}
                      {blueprint.needsAuth && <span className="chip sm ch-orange"><Shield size={10} /> Auth</span>}
                      {blueprint.needsPayments && <span className="chip sm ch-purple"><CreditCard size={10} /> Payments</span>}
                      {blueprint.needsStorage && <span className="chip sm ch-teal"><HardDrive size={10} /> Storage</span>}
                    </div>

                    {/* Tables */}
                    {blueprint.supabaseTables.length > 0 && (
                      <div>
                        <p style={{ fontSize: 10, color: "var(--tt)", marginBottom: 4 }}>Tabelas</p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {blueprint.supabaseTables.map((t) => (
                            <code key={t} style={{
                              fontSize: 10, fontFamily: "var(--mono)",
                              background: "var(--bg-4)", color: "var(--ts)",
                              padding: "1px 6px", borderRadius: "var(--r1)",
                            }}>{t}</code>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Features */}
                    {blueprint.features.length > 0 && (
                      <div>
                        <p style={{ fontSize: 10, color: "var(--tt)", marginBottom: 4 }}>Features</p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {blueprint.features.map((f) => (
                            <span key={f} className="chip sm ch-gray">{f}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* PRD Tasks */}
                  {prdTasks.length > 0 && (
                    <div className="rd-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                      <div className="sec-label">O que será gerado</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {prdTasks.map((task, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12 }}>
                            <span style={{
                              width: 20, height: 20, borderRadius: "var(--r1)",
                              background: "var(--bg-4)", display: "flex",
                              alignItems: "center", justifyContent: "center",
                              fontSize: 10, fontFamily: "var(--mono)", color: "var(--tt)",
                              flexShrink: 0, marginTop: 1,
                            }}>{i + 1}</span>
                            <span style={{ color: "var(--ts)", lineHeight: 1.5 }}>{task.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tech Stack */}
                  <div className="rd-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div className="sec-label">Stack Técnica</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {[
                        { icon: Code2, label: "React + Vite + TypeScript" },
                        { icon: Layers, label: "Tailwind CSS + shadcn/ui" },
                        ...(blueprint.needsDatabase ? [{ icon: Database, label: "Supabase (Postgres + Auth)" }] : []),
                        ...(deployGithub ? [{ icon: Globe, label: "GitHub Repository" }] : []),
                        ...(deployVercel ? [{ icon: Layers, label: "Vercel Hosting" }] : []),
                      ].map((s, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--ts)" }}>
                          <s.icon size={13} style={{ color: "var(--tt)" }} />
                          <span>{s.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
