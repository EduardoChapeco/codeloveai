import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Github, Globe, Database, Check, ExternalLink } from "lucide-react";

const PROVIDERS = [
  { id: "github", name: "GitHub", icon: Github, desc: "Push código + criar repos", scopes: "Personal Access Token (repo, read:user)", isOAuth: false, tokenField: true },
  { id: "netlify", name: "Netlify", icon: Globe, desc: "Hosting principal — Deploy automático via OAuth", scopes: "all", isOAuth: true, primary: true },
  { id: "vercel", name: "Vercel", icon: Globe, desc: "Hosting secundário — Deploy via API Token", scopes: "API Token", isOAuth: false, tokenField: true },
  { id: "supabase", name: "Supabase", icon: Database, desc: "Banco de dados, auth e storage via OAuth", scopes: "all (organizations, projects)", isOAuth: true },
];

export default function CiriusIntegrations() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [integrations, setIntegrations] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const [githubToken, setGithubToken] = useState("");
  const [savingGithub, setSavingGithub] = useState(false);
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
    const { data, error } = await supabase.functions.invoke("cirius-generate", {
      body: { action: "oauth_state", provider },
    });
    if (error || !data?.auth_url) {
      toast.error("Falha ao iniciar OAuth. Verifique se o provider está configurado.");
      return;
    }
    window.open(data.auth_url, "_blank", "width=600,height=700");
  }

  async function saveGithub() {
    if (!githubToken.trim()) { toast.error("Personal Access Token é obrigatório"); return; }
    setSavingGithub(true);
    const { data, error } = await supabase.functions.invoke("cirius-generate", {
      body: { action: "save_github_integration", github_token: githubToken.trim() },
    });
    if (error || data?.error) toast.error(data?.error || "Falha ao salvar integração GitHub");
    else { toast.success("GitHub conectado!"); setGithubToken(""); await loadIntegrations(); }
    setSavingGithub(false);
  }

  async function saveVercel() {
    if (!vercelToken.trim()) { toast.error("API Token é obrigatório"); return; }
    setSavingVercel(true);
    const { data, error } = await supabase.functions.invoke("cirius-generate", {
      body: { action: "save_vercel_integration", vercel_token: vercelToken.trim() },
    });
    if (error || data?.error) toast.error(data?.error || "Falha ao salvar integração Vercel");
    else { toast.success("Vercel conectado!"); setVercelToken(""); await loadIntegrations(); }
    setSavingVercel(false);
  }

  if (!user) { navigate("/login"); return null; }

  return (
    <AppLayout>
      <div className="rd-page-content" style={{ maxWidth: 720 }}>
        <div className="rd-page-head" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <button className="gl ico sm ghost" onClick={() => navigate("/cirius")}><ArrowLeft size={14} /></button>
          <h1>Integrações Cirius</h1>
        </div>

        <p className="body-text" style={{ marginBottom: 24 }}>Conecte suas contas para deploy automático dos projetos gerados.</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {PROVIDERS.map(p => {
            const connected = integrations[p.id];
            return (
              <div key={p.id} className="rd-card" style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <p.icon size={28} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="label-lg">{p.name}</span>
                      {(p as any).primary && <span className="chip sm ch-teal">Principal</span>}
                      {connected?.is_active && <span className="chip sm ch-green"><Check size={10} /> Conectado</span>}
                    </div>
                    <div className="caption-sm">{p.desc}</div>
                    {connected?.account_login && (
                      <div className="caption-sm" style={{ marginTop: 4 }}>@{connected.account_login}</div>
                    )}
                  </div>
                  {p.isOAuth && (
                    <button className={`gl sm ${connected ? "ghost" : "primary"}`} onClick={() => startOAuth(p.id)}>
                      <ExternalLink size={12} /> {connected ? "Reconectar" : "Conectar"}
                    </button>
                  )}
                </div>

                {/* GitHub manual form */}
                {p.id === "github" && !connected && (
                  <div style={{ borderTop: "1px solid var(--b1)", marginTop: 12, paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                    <input className="rd-input" placeholder="ghp_xxxxxxxxxxxx" type="password" value={githubToken} onChange={e => setGithubToken(e.target.value)} />
                    <div className="caption-sm">
                      Gere em <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" style={{ color: "var(--blue-l)", textDecoration: "underline" }}>github.com/settings/tokens</a> → Fine-grained ou Classic com scopes <code style={{ background: "var(--bg-3)", padding: "1px 4px", borderRadius: 4, fontSize: 10 }}>repo</code> e <code style={{ background: "var(--bg-3)", padding: "1px 4px", borderRadius: 4, fontSize: 10 }}>read:user</code>
                    </div>
                    <button className="gl sm primary" onClick={saveGithub} disabled={savingGithub}>
                      {savingGithub ? "Validando..." : "Salvar GitHub"}
                    </button>
                  </div>
                )}

                {/* Vercel manual form */}
                {p.id === "vercel" && !connected && (
                  <div style={{ borderTop: "1px solid var(--b1)", marginTop: 12, paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                    <input className="rd-input" placeholder="Vercel API Token" type="password" value={vercelToken} onChange={e => setVercelToken(e.target.value)} />
                    <div className="caption-sm">Gere em vercel.com → Settings → Tokens</div>
                    <button className="gl sm primary" onClick={saveVercel} disabled={savingVercel}>
                      {savingVercel ? "Salvando..." : "Salvar Vercel"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
