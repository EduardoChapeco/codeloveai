import { useState } from "react";
import { Layers, Github, Globe, Database, CheckCircle2, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  visible: boolean;
  onClose: () => void;
  project?: any;
  onNavigateIntegrations?: () => void;
}

export default function DrawerDeploy({ visible, onClose, project, onNavigateIntegrations }: Props) {
  const [githubOn, setGithubOn] = useState(!!project?.github_url);
  const [deploying, setDeploying] = useState<string | null>(null);

  const projectId = project?.id;

  async function deploy(action: string) {
    if (!projectId) { toast.error("Nenhum projeto selecionado"); return; }
    setDeploying(action);
    try {
      const { data, error } = await supabase.functions.invoke("cirius-deploy", {
        body: { action, project_id: projectId },
      });
      if (error || data?.error) {
        const msg = data?.error || error?.message || "Falha no deploy";
        if (msg.includes("not connected") || msg.includes("Connect via")) {
          toast.error(`${action} não conectado. Vá em Integrações para conectar.`);
        } else {
          toast.error(msg);
        }
      } else {
        toast.success(`${action} deploy concluído!`);
        if (data?.repo_url) window.open(data.repo_url, "_blank");
        if (data?.deploy_url) window.open(data.deploy_url, "_blank");
      }
    } catch {
      toast.error("Erro no deploy");
    }
    setDeploying(null);
  }

  async function deployAll() {
    if (!projectId) { toast.error("Nenhum projeto selecionado"); return; }
    setDeploying("all");
    // Sequential: GitHub → Vercel (needs GitHub first)
    try {
      const { data: ghData, error: ghErr } = await supabase.functions.invoke("cirius-deploy", {
        body: { action: "github", project_id: projectId },
      });
      if (ghErr || ghData?.error) {
        toast.error(ghData?.error || "GitHub deploy falhou");
        setDeploying(null);
        return;
      }
      toast.success(`GitHub: ${ghData?.files_pushed || 0} arquivos pushados`);

      // Try Vercel if connected
      const { data: vData } = await supabase.functions.invoke("cirius-deploy", {
        body: { action: "vercel", project_id: projectId },
      });
      if (vData?.deploy_url) toast.success("Vercel vinculado!");

      // Try Supabase migrations
      const { data: sbData } = await supabase.functions.invoke("cirius-deploy", {
        body: { action: "supabase", project_id: projectId },
      });
      if (sbData?.migrations_applied > 0) toast.success(`${sbData.migrations_applied} migrations aplicadas`);

      toast.success("Deploy completo!");
    } catch {
      toast.error("Erro no deploy");
    }
    setDeploying(null);
  }

  const isDeploying = deploying !== null;

  return (
    <div
      className={`s-drawer ${visible ? "visible" : "hidden to-right"}`}
      style={{ bottom: 88, right: 18, width: 300 }}
    >
      <div className="sdh">
        <div className="sdh-title">
          <Layers size={14} className="text-[var(--green-l)]" /> Deploy
        </div>
        <button className="sd-close" onClick={onClose}>✕</button>
      </div>

      <div style={{ padding: "0 12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        {/* GitHub */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: "var(--r3)", background: "var(--bg-2)", border: "1px solid var(--b0)" }}>
          <Github size={16} className="text-[var(--text-secondary)]" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 500 }}>GitHub</div>
            <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
              {project?.github_repo || "Não conectado"}
            </div>
          </div>
          {project?.github_url ? (
            <a href={project.github_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={14} className="text-[var(--text-tertiary)]" />
            </a>
          ) : (
            <button
              className="gl xs blue"
              onClick={() => deploy("github")}
              disabled={isDeploying}
            >
              {deploying === "github" ? <Loader2 size={12} className="animate-spin" /> : "Push"}
            </button>
          )}
        </div>

        {/* Vercel */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: "var(--r3)", background: "var(--bg-2)", border: "1px solid var(--b0)" }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>▲</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 500 }}>Vercel</div>
            <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
              {project?.vercel_url ? "Online" : "Não conectado"}
            </div>
          </div>
          {project?.vercel_url ? (
            <a href={project.vercel_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={14} className="text-[var(--text-tertiary)]" />
            </a>
          ) : (
            <button
              className="gl xs blue"
              onClick={() => deploy("vercel")}
              disabled={isDeploying}
            >
              {deploying === "vercel" ? <Loader2 size={12} className="animate-spin" /> : "Conectar"}
            </button>
          )}
        </div>

        {/* Netlify */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: "var(--r3)", background: "var(--bg-2)", border: "1px solid var(--b0)" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--teal-l)" }}>NF</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 500 }}>Netlify</div>
            <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
              {project?.netlify_url ? "Online" : "Não conectado"}
            </div>
          </div>
          {project?.netlify_url ? (
            <a href={project.netlify_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={14} className="text-[var(--text-tertiary)]" />
            </a>
          ) : (
            <button
              className="gl xs green"
              onClick={() => deploy("netlify")}
              disabled={isDeploying}
            >
              {deploying === "netlify" ? <Loader2 size={12} className="animate-spin" /> : "Conectar"}
            </button>
          )}
        </div>

        {/* Supabase */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: "var(--r3)", background: "var(--bg-2)", border: "1px solid var(--b0)" }}>
          <Database size={14} className="text-[var(--green-l)]" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 500 }}>Supabase</div>
            <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
              {project?.supabase_url ? "Conectado" : "Não configurado"}
            </div>
          </div>
          {project?.supabase_url ? (
            <button
              className="gl xs"
              onClick={() => deploy("supabase")}
              disabled={isDeploying}
            >
              {deploying === "supabase" ? <Loader2 size={12} className="animate-spin" /> : "Migrate"}
            </button>
          ) : (
            <button className="gl xs" onClick={onNavigateIntegrations}>Config</button>
          )}
        </div>

        {/* Integrations link */}
        <button
          className="gl xs"
          style={{ width: "100%", justifyContent: "center", fontSize: 11 }}
          onClick={onNavigateIntegrations}
        >
          ⚙ Gerenciar Integrações
        </button>

        {/* Deploy All */}
        <button
          className="gl primary"
          style={{ width: "100%", justifyContent: "center", marginTop: 4 }}
          onClick={deployAll}
          disabled={isDeploying}
        >
          {deploying === "all" ? (
            <><Loader2 size={14} className="animate-spin" /> Publicando...</>
          ) : (
            "🚀 Deploy Agora"
          )}
        </button>
      </div>
    </div>
  );
}
