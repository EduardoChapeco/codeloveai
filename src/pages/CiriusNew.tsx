import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Rocket, Globe, FileText, Layout, ShoppingCart, BarChart3, Sparkles } from "lucide-react";

const TEMPLATE_TYPES = [
  { value: "landing", label: "Landing Page", icon: Globe, desc: "Página única, rápida" },
  { value: "app", label: "Web App", icon: Layout, desc: "Aplicação completa" },
  { value: "dashboard", label: "Dashboard", icon: BarChart3, desc: "Painel de dados" },
  { value: "ecommerce", label: "E-commerce", icon: ShoppingCart, desc: "Loja online" },
  { value: "custom", label: "Custom", icon: Sparkles, desc: "Descreva livremente" },
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
      toast.success("Projeto criado!");

      // Step 2: Generate PRD
      toast.info("Gerando PRD...");
      const { data: prdData } = await supabase.functions.invoke("cirius-generate", {
        body: { action: "generate_prd", project_id: projectId },
      });

      if (prdData?.prd_json) {
        toast.success(`PRD gerado: ${prdData.task_count} tasks (${prdData.engine_selected})`);
      }

      navigate(`/cirius/project/${projectId}`);
    } catch (e) {
      toast.error("Erro inesperado");
      console.error(e);
    } finally {
      setCreating(false);
    }
  }

  if (!user) { navigate("/login"); return null; }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <Button variant="ghost" onClick={() => navigate("/cirius")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>

        <h1 className="text-2xl font-bold text-foreground">Novo Projeto Cirius</h1>

        {/* Step 0: Type */}
        {step === 0 && (
          <div className="space-y-4">
            <p className="text-muted-foreground">Que tipo de projeto?</p>
            <div className="grid grid-cols-2 gap-3">
              {TEMPLATE_TYPES.map(t => (
                <Card
                  key={t.value}
                  className={`cursor-pointer transition-all ${templateType === t.value ? "border-primary ring-2 ring-primary/20" : "hover:border-primary/50"}`}
                  onClick={() => setTemplateType(t.value)}
                >
                  <CardContent className="flex items-center gap-3 p-4">
                    <t.icon className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium text-sm">{t.label}</p>
                      <p className="text-xs text-muted-foreground">{t.desc}</p>
                    </div>
                  </CardContent>
                </Card>
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
              <label className="text-sm font-medium">Descrição</label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Descreva o que você quer construir..." rows={4} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">URL de referência (opcional)</label>
              <Input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)}
                placeholder="https://exemplo.com" type="url" />
              <p className="text-xs text-muted-foreground">Cole a URL de um site para usar como inspiração (StarCrawl)</p>
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
                  className="cursor-pointer"
                  onClick={() => toggleFeature(f)}
                >
                  {f}
                </Badge>
              ))}
            </div>

            <Card className="bg-muted/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Resumo</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p><strong>Tipo:</strong> {TEMPLATE_TYPES.find(t => t.value === templateType)?.label}</p>
                <p><strong>Nome:</strong> {name || "—"}</p>
                {description && <p><strong>Descrição:</strong> {description.slice(0, 100)}</p>}
                {sourceUrl && <p><strong>Ref:</strong> {sourceUrl}</p>}
                <p><strong>Features:</strong> {selectedFeatures.length > 0 ? selectedFeatures.join(", ") : "Nenhuma"}</p>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
              <Button onClick={handleCreate} disabled={creating || !name.trim()} className="flex-1 gap-2">
                {creating ? "Criando..." : <><Rocket className="h-4 w-4" /> Gerar Projeto</>}
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
