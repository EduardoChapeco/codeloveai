import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Github, Globe, Database, Check, ExternalLink } from "lucide-react";

const PROVIDERS = [
  { id: "github", name: "GitHub", icon: Github, desc: "Push código + criar repos", scopes: "Personal Access Token (repo, read:user)", isOAuth: false, tokenField: true },
  { id: "vercel", name: "Vercel", icon: Globe, desc: "Deploy automático de apps", scopes: "API Token", isOAuth: false, tokenField: true },
  { id: "netlify", name: "Netlify", icon: Globe, desc: "Deploy por ZIP ou Git", scopes: "all", isOAuth: true },
  { id: "supabase", name: "Supabase", icon: Database, desc: "Aplicar migrations SQL", scopes: "service_role", isOAuth: false },
];

export default function CiriusIntegrations() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [integrations, setIntegrations] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  // Supabase manual fields
  const [sbUrl, setSbUrl] = useState("");
  const [sbKey, setSbKey] = useState("");
  const [savingSb, setSavingSb] = useState(false);

  // GitHub manual fields
  const [githubToken, setGithubToken] = useState("");
  const [savingGithub, setSavingGithub] = useState(false);

  // Vercel manual fields
  const [vercelToken, setVercelToken] = useState("");
  const [savingVercel, setSavingVercel] = useState(false);

  useEffect(() => {
    const connected = searchParams.get("connected");
    if (connected) toast.success(`${connected} conectado com sucesso!`);
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;
    loadIntegrations();
  }, [user]);

  async function loadIntegrations() {
    // Only select non-sensitive fields — tokens never reach the frontend
    const { data } = await supabase
      .from("cirius_integrations" as any)
      .select("provider, account_login, is_active, updated_at")
      .eq("user_id", user!.id);

    const map: Record<string, any> = {};
    (data || []).forEach((i: any) => { map[i.provider] = i; });
    setIntegrations(map);
    setLoading(false);
  }

  async function startOAuth(provider: string) {
    // Generate signed state server-side via edge function
    const { data, error } = await supabase.functions.invoke("cirius-generate", {
      body: { action: "oauth_state", provider },
    });

    if (error || !data?.auth_url) {
      toast.error("Falha ao iniciar OAuth. Verifique se o provider está configurado.");
      return;
    }

    window.open(data.auth_url, "_blank", "width=600,height=700");
  }

  async function saveSupabase() {
    if (!sbUrl.trim() || !sbKey.trim()) { toast.error("URL e Service Key são obrigatórios"); return; }
    setSavingSb(true);

    // Send to edge function — service key never stored from client side
    const { data, error } = await supabase.functions.invoke("cirius-generate", {
      body: {
        action: "save_supabase_integration",
        supabase_url: sbUrl.trim(),
        service_key: sbKey.trim(),
      },
    });

    if (error || data?.error) {
      toast.error(data?.error || "Falha ao salvar integração");
    } else {
      toast.success("Supabase conectado!");
      setSbUrl("");
      setSbKey("");
      await loadIntegrations();
    }
    setSavingSb(false);
  }

  async function saveGithub() {
    if (!githubToken.trim()) { toast.error("Personal Access Token é obrigatório"); return; }
    setSavingGithub(true);
    const { data, error } = await supabase.functions.invoke("cirius-generate", {
      body: { action: "save_github_integration", github_token: githubToken.trim() },
    });
    if (error || data?.error) {
      toast.error(data?.error || "Falha ao salvar integração GitHub");
    } else {
      toast.success("GitHub conectado!");
      setGithubToken("");
      await loadIntegrations();
    }
    setSavingGithub(false);
  }

  async function saveVercel() {
    if (!vercelToken.trim()) { toast.error("API Token é obrigatório"); return; }
    setSavingVercel(true);
    const { data, error } = await supabase.functions.invoke("cirius-generate", {
      body: { action: "save_vercel_integration", vercel_token: vercelToken.trim() },
    });
    if (error || data?.error) {
      toast.error(data?.error || "Falha ao salvar integração Vercel");
    } else {
      toast.success("Vercel conectado!");
      setVercelToken("");
      await loadIntegrations();
    }
    setSavingVercel(false);
  }

  if (!user) { navigate("/login"); return null; }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/cirius")}><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-2xl font-bold text-foreground">Integrações Cirius</h1>
        </div>

        <p className="text-muted-foreground">Conecte suas contas para deploy automático dos projetos gerados.</p>

        <div className="space-y-4">
          {PROVIDERS.map(p => {
            const connected = integrations[p.id];
            return (
              <Card key={p.id}>
                <CardContent className="flex items-center gap-4 py-4">
                  <p.icon className="h-8 w-8 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{p.name}</h3>
                      {connected?.is_active && <Badge variant="default" className="gap-1"><Check className="h-3 w-3" /> Conectado</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{p.desc}</p>
                    {connected?.account_login && (
                      <p className="text-xs text-muted-foreground mt-1">@{connected.account_login}</p>
                    )}
                  </div>
                  {p.isOAuth ? (
                    <Button
                      variant={connected ? "outline" : "default"}
                      size="sm"
                      onClick={() => startOAuth(p.id)}
                      className="gap-2"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {connected ? "Reconectar" : "Conectar"}
                    </Button>
                  ) : null}
                </CardContent>

                {/* GitHub manual form */}
                {p.id === "github" && !connected && (
                  <CardContent className="pt-0 space-y-3 border-t mt-2">
                    <Input placeholder="ghp_xxxxxxxxxxxx" type="password" value={githubToken} onChange={e => setGithubToken(e.target.value)} />
                    <p className="text-xs text-muted-foreground">
                      Gere em <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="underline text-primary">github.com/settings/tokens</a> → Fine-grained ou Classic com scopes <code className="bg-muted px-1 rounded text-xs">repo</code> e <code className="bg-muted px-1 rounded text-xs">read:user</code>
                    </p>
                    <Button onClick={saveGithub} disabled={savingGithub} size="sm">
                      {savingGithub ? "Validando..." : "Salvar GitHub"}
                    </Button>
                  </CardContent>
                )}

                {/* Vercel manual form */}
                {p.id === "vercel" && !connected && (
                  <CardContent className="pt-0 space-y-3 border-t mt-2">
                    <Input placeholder="Vercel API Token" type="password" value={vercelToken} onChange={e => setVercelToken(e.target.value)} />
                    <p className="text-xs text-muted-foreground">Gere em vercel.com → Settings → Tokens</p>
                    <Button onClick={saveVercel} disabled={savingVercel} size="sm">
                      {savingVercel ? "Salvando..." : "Salvar Vercel"}
                    </Button>
                  </CardContent>
                )}

                {/* Supabase manual form */}
                {p.id === "supabase" && !connected && (
                  <CardContent className="pt-0 space-y-3 border-t mt-2">
                    <Input placeholder="https://xxxxx.supabase.co" value={sbUrl} onChange={e => setSbUrl(e.target.value)} />
                    <Input placeholder="service_role key" type="password" value={sbKey} onChange={e => setSbKey(e.target.value)} />
                    <p className="text-xs text-destructive">⚠️ A service key tem acesso total ao banco. Nunca compartilhe.</p>
                    <Button onClick={saveSupabase} disabled={savingSb} size="sm">
                      {savingSb ? "Salvando..." : "Salvar Supabase"}
                    </Button>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
