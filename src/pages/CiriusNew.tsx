import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Rocket, Globe, Layout,
  ShoppingCart, BarChart3, CheckCircle2, Loader2, Layers
} from "lucide-react";

const TEMPLATE_TYPES = [
  { value: "landing", label: "Landing Page", icon: Globe, desc: "Página única, rápida" },
  { value: "app", label: "Web App", icon: Layout, desc: "Aplicação completa" },
  { value: "dashboard", label: "Dashboard", icon: BarChart3, desc: "Painel de dados" },
  { value: "ecommerce", label: "E-commerce", icon: ShoppingCart, desc: "Loja online" },
  { value: "custom", label: "Custom", icon: Layers, desc: "Descreva livremente" },
];

const FEATURES = [
  "Auth (login/registro)", "Database (CRUD)", "Dashboard", "API integrations",
  "File upload", "Chat/Messaging", "Payments", "Admin panel", "Analytics",
  "Dark mode", "PWA", "SEO optimized",
];

export default function CiriusNew() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [templateType, setTemplateType] = useState("landing");
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);

  function toggleFeature(f: string) {
    setSelectedFeatures(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);
  }

  async function handleCreate() {
    if (!name.trim()) { toast.error("Nome é obrigatório"); return; }
    setCreating(true);
    setProgress(10);
    setProgressLabel("Criando projeto...");

    try {
      // Step 1: Init
      const { data: initData, error: initErr } = await supabase.functions.invoke("cirius-generate", {
        body: {
          action: "init",
          config: {
            name: name.trim(),
            description: description.trim(),
            template_type: templateType,
            source_url: sourceUrl.trim() || null,
            features: selectedFeatures,
          },
        },
      });

      if (initErr || !initData?.project_id) {
        toast.error(initData?.error || "Erro ao criar projeto");
        setCreating(false);
        return;
      }

      const projectId = initData.project_id;
      setProgress(25);
      setProgressLabel("Gerando PRD (plano de tarefas)...");

      // Step 2: Generate PRD automatically
      const { data: prdData } = await supabase.functions.invoke("cirius-generate", {
        body: { action: "generate_prd", project_id: projectId },
      });

      if (prdData?.prd_json) {
        setProgress(50);
        setProgressLabel("PRD pronto! Analisando design...");

        const taskCount = prdData.task_count || prdData.prd_json?.tasks?.length || 0;
        const design = prdData.design || prdData.prd_json?.design;

        toast.success(
          `PRD gerado: ${taskCount} tasks` +
          (design?.pages ? ` · ${design.pages.length} páginas` : "") +
          (design?.tables ? ` · ${design.tables.length} tabelas` : "")
        );

        // Brief pause so user sees the summary
        await new Promise(r => setTimeout(r, 1500));
        setProgress(60);
        setProgressLabel("Iniciando geração de código...");

        // Step 3: Auto-start code generation
        const { data: codeData } = await supabase.functions.invoke("cirius-generate", {
          body: { action: "generate_code", project_id: projectId },
        });

        if (codeData?.started) {
          setProgress(70);
          setProgressLabel("Código em geração via " + (codeData.engine || "Brainchain") + "...");
          toast.success("Geração de código iniciada via " + (codeData.engine || "Brainchain"));
        }
      } else {
        toast.info("PRD salvo — geração manual disponível");
      }

      // Navigate to project page
      await new Promise(r => setTimeout(r, 800));
      navigate(`/cirius/project/${projectId}`);
    } catch (e) {
      toast.error("Erro inesperado");
      console.error(e);
    } finally {
      setCreating(false);
    }
  }

  if (!user) { navigate("/login"); return null; }

  // Creating state - full screen progress
  if (creating) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto p-6 flex flex-col items-center justify-center min-h-[60vh] gap-6">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center shadow-xl shadow-primary/20">
            <Loader2 className="h-8 w-8 text-primary-foreground animate-spin" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold text-foreground">Criando {name}</h2>
            <p className="text-sm text-muted-foreground">{progressLabel}</p>
          </div>
          <div className="w-full max-w-sm space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-center text-muted-foreground font-mono">{progress}%</p>
          </div>

          {/* Pipeline steps */}
          <div className="w-full max-w-sm space-y-2">
            {[
              { label: "Criar projeto", threshold: 10 },
              { label: "Gerar PRD (plano)", threshold: 25 },
              { label: "Definir design", threshold: 50 },
              { label: "Gerar código", threshold: 60 },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                {progress >= s.threshold + 15 ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : progress >= s.threshold ? (
                  <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
                ) : (
                  <div className="h-4 w-4 rounded-full border border-border/50 shrink-0" />
                )}
                <span className={progress >= s.threshold ? "text-foreground" : "text-muted-foreground/50"}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
        <Button variant="ghost" onClick={() => navigate("/cirius")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>

        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
            <Rocket className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Novo Projeto Cirius</h1>
            <p className="text-xs text-muted-foreground">Descreva e a IA cria tudo automaticamente</p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex items-center gap-2">
              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step >= i ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {step > i ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              {i < 2 && <div className={`w-8 h-0.5 ${step > i ? "bg-primary" : "bg-muted"}`} />}
            </div>
          ))}
        </div>

        {/* Step 0: Type */}
        {step === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Que tipo de projeto?</p>
            <div className="grid grid-cols-2 gap-3">
              {TEMPLATE_TYPES.map(t => (
                <div
                  key={t.value}
                  className={`rounded-xl border p-4 cursor-pointer transition-all flex items-center gap-3 ${
                    templateType === t.value
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border/50 hover:border-primary/30 bg-card"
                  }`}
                  onClick={() => setTemplateType(t.value)}
                >
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${
                    templateType === t.value ? "bg-primary/10" : "bg-muted"
                  }`}>
                    <t.icon className={`h-4.5 w-4.5 ${templateType === t.value ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t.label}</p>
                    <p className="text-[11px] text-muted-foreground">{t.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button onClick={() => setStep(1)} className="w-full gap-2">
              Próximo <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 1: Details */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome do Projeto *</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Meu App Incrível" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Descreva o que quer construir</label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Um dashboard para gerenciar clientes com login, CRUD de contatos, gráficos de vendas..." rows={4} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">URL de referência (opcional)</label>
              <Input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)}
                placeholder="https://exemplo.com" type="url" />
              <p className="text-[11px] text-muted-foreground">Cole a URL de um site para usar como inspiração</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(0)}>Voltar</Button>
              <Button onClick={() => setStep(2)} className="flex-1 gap-2">
                Próximo <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Features + Build */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm font-medium">Features (selecione)</p>
            <div className="flex flex-wrap gap-2">
              {FEATURES.map(f => (
                <Badge
                  key={f}
                  variant={selectedFeatures.includes(f) ? "default" : "outline"}
                  className="cursor-pointer transition-all hover:scale-105"
                  onClick={() => toggleFeature(f)}
                >
                  {selectedFeatures.includes(f) && <CheckCircle2 className="h-3 w-3 mr-1" />}
                  {f}
                </Badge>
              ))}
            </div>

            {/* Summary card */}
            <div className="rounded-xl border border-border/50 bg-card p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resumo</p>
              <div className="text-sm space-y-1">
                <p><span className="text-muted-foreground">Tipo:</span> <span className="font-medium">{TEMPLATE_TYPES.find(t => t.value === templateType)?.label}</span></p>
                <p><span className="text-muted-foreground">Nome:</span> <span className="font-medium">{name || "—"}</span></p>
                {description && <p><span className="text-muted-foreground">Desc:</span> {description.slice(0, 80)}{description.length > 80 ? "..." : ""}</p>}
                {sourceUrl && <p><span className="text-muted-foreground">Ref:</span> <span className="text-primary">{sourceUrl}</span></p>}
                <p><span className="text-muted-foreground">Features:</span> {selectedFeatures.length > 0 ? selectedFeatures.join(", ") : "Nenhuma"}</p>
              </div>
              <div className="pt-2 border-t border-border/30 text-[11px] text-muted-foreground">
                Ao clicar em "Gerar", o Cirius criará automaticamente: PRD (plano), design (cores/fontes), e iniciará a geração de código via Brainchain.
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
              <Button onClick={handleCreate} disabled={creating || !name.trim()} className="flex-1 gap-2">
                <Rocket className="h-4 w-4" /> Gerar Projeto Automaticamente
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
