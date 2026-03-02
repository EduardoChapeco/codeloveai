import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Github, Globe, Database, Check, ExternalLink } from "lucide-react";

const PROVIDERS = [
  { id: "github", name: "GitHub", icon: Github, desc: "Push código + criar repos", scopes: "repo, read:user", isOAuth: true },
  { id: "vercel", name: "Vercel", icon: Globe, desc: "Deploy automático de apps", scopes: "deployments, projects", isOAuth: true },
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

  useEffect(() => {
    const connected = searchParams.get("connected");
    if (connected) toast.success(`${connected} conectado com sucesso!`);
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;
    loadIntegrations();
  }, [user]);

  async function loadIntegrations() {
    const { data } = await supabase
      .from("cirius_integrations" as any)
      .select("provider, account_login, is_active, updated_at")
      .eq("user_id", user!.id);

    const map: Record<string, any> = {};
    (data || []).forEach((i: any) => { map[i.provider] = i; });
    setIntegrations(map);
    setLoading(false);
  }

  function startOAuth(provider: string) {
    const state = btoa(JSON.stringify({ user_id: user!.id }));
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const callbackUrl = `${supabaseUrl}/functions/v1/cirius-oauth-callback?provider=${provider}`;

    let authUrl = "";
    if (provider === "github") {
      const clientId = ""; // Will need CIRIUS_GITHUB_CLIENT_ID
      authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=repo,read:user&state=${state}&redirect_uri=${encodeURIComponent(callbackUrl)}`;
    } else if (provider === "vercel") {
      const clientId = "";
      authUrl = `https://vercel.com/oauth/authorize?client_id=${clientId}&scope=user&state=${state}&redirect_uri=${encodeURIComponent(callbackUrl)}`;
    } else if (provider === "netlify") {
      const clientId = "";
      authUrl = `https://app.netlify.com/authorize?client_id=${clientId}&response_type=code&state=${state}&redirect_uri=${encodeURIComponent(callbackUrl)}`;
    }

    if (authUrl) {
      window.open(authUrl, "_blank", "width=600,height=700");
    } else {
      toast.error("OAuth Client ID não configurado. Configure nas integrações do admin.");
    }
  }

  async function saveSupabase() {
    if (!sbUrl.trim() || !sbKey.trim()) { toast.error("URL e Service Key são obrigatórios"); return; }
    setSavingSb(true);

    const ref = sbUrl.match(/https:\/\/([^.]+)/)?.[1] || "";
    if (!ref) { toast.error("URL inválida"); setSavingSb(false); return; }

    const { error } = await supabase.from("cirius_integrations" as any).upsert({
      user_id: user!.id,
      provider: "supabase",
      service_key_enc: sbKey.trim(),
      project_ref: ref,
      account_login: sbUrl.trim(),
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,provider" });

    if (error) toast.error(error.message);
    else { toast.success("Supabase conectado!"); await loadIntegrations(); }
    setSavingSb(false);
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
