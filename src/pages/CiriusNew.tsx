import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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

const TEMPLATES = [
  {
    icon: Rocket,
    label: "Landing Page",
    prompt: "Crie uma landing page moderna e responsiva com hero section, features, depoimentos e CTA. Design clean e profissional.",
  },
  {
    icon: BarChart3,
    label: "Dashboard",
    prompt: "Crie um dashboard de analytics com gráficos de vendas, métricas de usuários, tabelas de dados recentes e filtros por período.",
  },
  {
    icon: ShoppingCart,
    label: "E-commerce",
    prompt: "Crie uma loja online com catálogo de produtos, carrinho de compras, checkout e painel de gerenciamento de pedidos.",
  },
  {
    icon: Settings,
    label: "Sistema CRUD",
    prompt: "Crie um sistema de gerenciamento com cadastro, listagem, edição e exclusão. Inclua autenticação e filtros de busca.",
  },
  {
    icon: Briefcase,
    label: "SaaS App",
    prompt: "Crie um aplicativo SaaS com autenticação, planos de assinatura, dashboard do usuário, billing e painel administrativo.",
  },
  {
    icon: Puzzle,
    label: "Componente UI",
    prompt: "Crie um componente de UI reutilizável com variações, estados interativos, animações e documentação de uso.",
  },
];

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

  const [blueprint, setBlueprint] = useState<ProjectBlueprint | null>(null);
  const [prdTasks, setPrdTasks] = useState<PRDTask[]>([]);

  // Debounced classification
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
    <div className="rd-page-content">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-600/20 flex items-center justify-center">
            <Zap className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight" style={{ fontFamily: "Geist, sans-serif" }}>
              Cirius — Gerador de Projetos
            </h1>
            <p className="text-xs text-neutral-500">Descreva sua ideia e gere código funcional em minutos</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* ── LEFT COLUMN ── */}
          <div className="lg:col-span-3 space-y-5">
            {/* Main prompt */}
            <Card className="border-neutral-800/60 bg-neutral-900/50 p-5 backdrop-blur">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={`Descreva o que você quer criar...\n\nEx: "Uma landing page moderna para minha startup de IA"\nEx: "Sistema de gerenciamento de clientes com CRUD completo"\nEx: "Dashboard de vendas com gráficos e relatórios"`}
                className="min-h-[140px] bg-neutral-950/60 border-neutral-800/50 text-sm text-neutral-200 placeholder:text-neutral-600 resize-none focus-visible:ring-blue-500/40"
              />
            </Card>

            {/* Source URL */}
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-600" />
              <Input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://site-que-quero-replicar.com (opcional)"
                className="pl-9 bg-neutral-900/50 border-neutral-800/60 text-sm text-neutral-300 placeholder:text-neutral-600 focus-visible:ring-blue-500/40"
              />
            </div>

            {/* Config */}
            <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-2 text-xs text-neutral-500 hover:text-neutral-300 transition-colors w-full">
                  <Settings className="h-3.5 w-3.5" />
                  <span>Configurações</span>
                  <ChevronDown className={`h-3.5 w-3.5 ml-auto transition-transform ${configOpen ? "rotate-180" : ""}`} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-3">
                <Input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Nome do projeto (opcional)"
                  className="bg-neutral-900/50 border-neutral-800/60 text-sm text-neutral-300 placeholder:text-neutral-600 focus-visible:ring-blue-500/40"
                />
                <div className="flex flex-col gap-2.5">
                  <label className="flex items-center justify-between text-xs text-neutral-400">
                    <span className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" /> Deploy no GitHub</span>
                    <Switch checked={deployGithub} onCheckedChange={setDeployGithub} />
                  </label>
                  <label className="flex items-center justify-between text-xs text-neutral-400">
                    <span className="flex items-center gap-2"><Layers className="h-3.5 w-3.5" /> Deploy no Vercel</span>
                    <Switch checked={deployVercel} onCheckedChange={setDeployVercel} />
                  </label>
                  <label className="flex items-center justify-between text-xs text-neutral-400">
                    <span className="flex items-center gap-2"><Database className="h-3.5 w-3.5" /> Criar banco Supabase</span>
                    <Switch checked={createSupabase} onCheckedChange={setCreateSupabase} />
                  </label>
                  <label className="flex items-center justify-between text-xs text-neutral-400">
                    <span className="flex items-center gap-2"><Cpu className="h-3.5 w-3.5" /> No Brains (Claude direto)</span>
                    <Switch checked={noBrains} onCheckedChange={setNoBrains} />
                  </label>
                  {noBrains && (
                    <p className="text-[10px] text-amber-400/70 pl-6">
                      Gera o projeto inteiro via Claude/OpenRouter em uma única chamada — sem orquestrador nem Brain.
                    </p>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Templates */}
            <div>
              <p className="text-xs text-neutral-500 mb-3">Templates Rápidos</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.label}
                    onClick={() => setPrompt(t.prompt)}
                    className="group flex items-center gap-2.5 rounded-lg border border-neutral-800/50 bg-neutral-900/40 px-3 py-2.5 text-left transition hover:border-blue-600/40 hover:bg-blue-600/5"
                  >
                    <t.icon className="h-4 w-4 text-neutral-500 group-hover:text-blue-400 shrink-0 transition-colors" />
                    <span className="text-xs text-neutral-400 group-hover:text-neutral-200 transition-colors">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Generate button */}
            <Button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm gap-2 transition-colors disabled:opacity-40"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Gerando...
                </span>
              ) : (
                <>
                  Gerar Projeto
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>

          {/* ── RIGHT COLUMN — Live Preview ── */}
          <div className="lg:col-span-2 space-y-4">
            {!blueprint ? (
              <Card className="border-neutral-800/40 bg-neutral-900/30 p-6 flex flex-col items-center justify-center min-h-[260px] text-center backdrop-blur">
                <Cpu className="h-8 w-8 text-neutral-700 mb-3" />
                <p className="text-sm text-neutral-500">
                  Comece a digitar para ver o blueprint em tempo real
                </p>
              </Card>
            ) : (
              <>
                {/* Blueprint Card */}
                <Card className="border-neutral-800/50 bg-neutral-900/40 p-4 backdrop-blur space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Blueprint Detectado</h3>
                    {estimatedTime && (
                      <span className="flex items-center gap-1 text-[11px] text-neutral-500">
                        <Clock className="h-3 w-3" /> {estimatedTime}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-blue-600/15 text-blue-400 border-blue-600/20 text-xs">
                      {INTENT_LABELS[blueprint.intent] || blueprint.intent}
                    </Badge>
                    <Badge variant="outline" className={`text-[11px] border-neutral-700/50 ${noBrains ? "text-amber-400 border-amber-500/30" : "text-neutral-500"}`}>
                      {noBrains ? ENGINE_LABELS.claude_direct.label : ENGINE_LABELS[blueprint.suggestedEngine]?.label}
                    </Badge>
                  </div>

                  <p className="text-[11px] text-neutral-600">
                    {noBrains ? ENGINE_LABELS.claude_direct.desc : ENGINE_LABELS[blueprint.suggestedEngine]?.desc}
                  </p>

                  {/* Capabilities */}
                  <div className="flex flex-wrap gap-1.5">
                    {blueprint.needsDatabase && (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-400/80 bg-emerald-600/10 rounded px-1.5 py-0.5">
                        <Database className="h-3 w-3" /> Database
                      </span>
                    )}
                    {blueprint.needsAuth && (
                      <span className="flex items-center gap-1 text-[11px] text-amber-400/80 bg-amber-600/10 rounded px-1.5 py-0.5">
                        <Shield className="h-3 w-3" /> Auth
                      </span>
                    )}
                    {blueprint.needsPayments && (
                      <span className="flex items-center gap-1 text-[11px] text-purple-400/80 bg-purple-600/10 rounded px-1.5 py-0.5">
                        <CreditCard className="h-3 w-3" /> Payments
                      </span>
                    )}
                    {blueprint.needsStorage && (
                      <span className="flex items-center gap-1 text-[11px] text-cyan-400/80 bg-cyan-600/10 rounded px-1.5 py-0.5">
                        <HardDrive className="h-3 w-3" /> Storage
                      </span>
                    )}
                  </div>

                  {/* Tables */}
                  {blueprint.supabaseTables.length > 0 && (
                    <div>
                      <p className="text-[11px] text-neutral-500 mb-1">Tabelas</p>
                      <div className="flex flex-wrap gap-1">
                        {blueprint.supabaseTables.map((t) => (
                          <code key={t} className="text-[10px] bg-neutral-800/60 text-neutral-400 rounded px-1.5 py-0.5">{t}</code>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Features */}
                  {blueprint.features.length > 0 && (
                    <div>
                      <p className="text-[11px] text-neutral-500 mb-1">Features</p>
                      <div className="flex flex-wrap gap-1">
                        {blueprint.features.map((f) => (
                          <Badge key={f} variant="outline" className="text-[10px] text-neutral-500 border-neutral-700/40">{f}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>

                {/* PRD Tasks */}
                {prdTasks.length > 0 && (
                  <Card className="border-neutral-800/50 bg-neutral-900/40 p-4 backdrop-blur space-y-2.5">
                    <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider">O que será gerado</h3>
                    <div className="space-y-1.5">
                      {prdTasks.map((task, i) => (
                        <div key={i} className="flex items-start gap-2.5 text-xs">
                          <span className="mt-0.5 h-5 w-5 rounded bg-neutral-800/60 flex items-center justify-center text-[10px] text-neutral-500 font-mono shrink-0">
                            {i + 1}
                          </span>
                          <span className="text-neutral-400 leading-relaxed">{task.title}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Tech Stack */}
                <Card className="border-neutral-800/50 bg-neutral-900/40 p-4 backdrop-blur space-y-2.5">
                  <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Stack Técnica</h3>
                  <div className="space-y-1.5">
                    {[
                      { icon: Code2, label: "React + Vite + TypeScript" },
                      { icon: Layers, label: "Tailwind CSS + shadcn/ui" },
                      ...(blueprint.needsDatabase ? [{ icon: Database, label: "Supabase (Postgres + Auth)" }] : []),
                      ...(deployGithub ? [{ icon: Globe, label: "GitHub Repository" }] : []),
                      ...(deployVercel ? [{ icon: Layers, label: "Vercel Hosting" }] : []),
                    ].map((s, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-neutral-400">
                        <s.icon className="h-3.5 w-3.5 text-neutral-600" />
                        <span>{s.label}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
