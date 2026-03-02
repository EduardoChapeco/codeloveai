import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Rocket, Globe, Github, Clock, AlertCircle } from "lucide-react";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  generating_prd: "bg-yellow-500/20 text-yellow-400",
  generating_code: "bg-blue-500/20 text-blue-400",
  deploying: "bg-purple-500/20 text-purple-400",
  live: "bg-green-500/20 text-green-400",
  failed: "bg-red-500/20 text-red-400",
  paused: "bg-orange-500/20 text-orange-400",
};

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  generating_prd: "Gerando PRD",
  generating_code: "Gerando Código",
  deploying: "Fazendo Deploy",
  live: "Online",
  failed: "Falhou",
  paused: "Pausado",
};

export default function CiriusDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadProjects();
  }, [user]);

  async function loadProjects() {
    setLoadingProjects(true);
    const { data } = await supabase.functions.invoke("cirius-status", {
      body: { action: "list" },
    });
    setProjects(data?.projects || []);
    setLoadingProjects(false);
  }

  if (loading) return <AppLayout><div className="min-h-screen bg-background" /></AppLayout>;
  if (!user) { navigate("/login"); return null; }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Cirius</h1>
            <p className="text-muted-foreground mt-1">AI App & Site Builder</p>
          </div>
          <Button onClick={() => navigate("/cirius/new")} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Projeto
          </Button>
        </div>

        {loadingProjects ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse"><CardContent className="h-40" /></Card>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <Rocket className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground text-lg">Nenhum projeto ainda</p>
              <Button onClick={() => navigate("/cirius/new")} variant="outline" className="gap-2">
                <Plus className="h-4 w-4" /> Criar primeiro projeto
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p: any) => (
              <Card
                key={p.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => navigate(`/cirius/project/${p.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg truncate">{p.name}</CardTitle>
                    <Badge className={statusColors[p.status] || ""}>{statusLabels[p.status] || p.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(p.created_at).toLocaleDateString("pt-BR")}
                  </div>
                  {p.generation_engine && (
                    <Badge variant="outline" className="text-xs">{p.generation_engine}</Badge>
                  )}
                  <div className="flex gap-2">
                    {p.github_url && <Github className="h-4 w-4 text-muted-foreground" />}
                    {p.vercel_url && <Globe className="h-4 w-4 text-muted-foreground" />}
                    {p.netlify_url && <Globe className="h-4 w-4 text-muted-foreground" />}
                    {p.status === "failed" && <AlertCircle className="h-4 w-4 text-destructive" />}
                  </div>
                  {p.progress_pct > 0 && p.status !== "live" && (
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${p.progress_pct}%` }} />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
