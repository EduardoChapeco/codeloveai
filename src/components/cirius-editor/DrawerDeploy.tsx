import { useState } from "react";
import { Layers, Github, Globe, Database, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  visible: boolean;
  onClose: () => void;
  project?: any;
  onNavigateIntegrations?: () => void;
}

export default function DrawerDeploy({ visible, onClose, project, onNavigateIntegrations }: Props) {
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
    try {
      // Step 1: GitHub push
      const { data: ghData, error: ghErr } = await supabase.functions.invoke("cirius-deploy", {
        body: { action: "github", project_id: projectId },
      });
      if (ghErr || ghData?.error) {
        toast.error(ghData?.error || "GitHub deploy falhou");
        setDeploying(null);
        return;
      }
      toast.success(`GitHub: ${ghData?.files_pushed || 0} arquivos pushados`);

      // Step 2: Netlify (primary hosting)
      const { data: nData } = await supabase.functions.invoke("cirius-deploy", {
        body: { action: "netlify", project_id: projectId },
      });
      if (nData?.deploy_url) toast.success("Netlify deploy live!");

      // Step 3: Supabase migrations
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
        <DeployRow
          icon={<Github size={16} className="text-[var(--text-secondary)]" />}
          name="GitHub"
          status={project?.github_repo || "Não conectado"}
          url={project?.github_url}
          actionLabel="Push"
          onAction={() => deploy("github")}
          deploying={deploying === "github"}
          disabled={isDeploying}
        />

        {/* Netlify (PRIMARY) */}
        <DeployRow
          icon={<span style={{ fontSize: 12, fontWeight: 700, color: "var(--teal-l)" }}>NF</span>}
          name="Netlify"
          badge="Principal"
          status={project?.netlify_url ? "Online" : "Não conectado"}
          url={project?.netlify_url}
          actionLabel={project?.netlify_url ? "Redeploy" : "Conectar"}
          onAction={() => deploy("netlify")}
          deploying={deploying === "netlify"}
          disabled={isDeploying}
          btnClass="gl xs green"
        />

        {/* Vercel (secondary) */}
        <DeployRow
          icon={<span style={{ fontSize: 14, fontWeight: 700 }}>▲</span>}
          name="Vercel"
          badge="Secundário"
          status={project?.vercel_url ? "Online" : "Não conectado"}
          url={project?.vercel_url}
          actionLabel={project?.vercel_url ? "Redeploy" : "Conectar"}
          onAction={() => deploy("vercel")}
          deploying={deploying === "vercel"}
          disabled={isDeploying}
        />

        {/* Supabase */}
        <DeployRow
          icon={<Database size={14} className="text-[var(--green-l)]" />}
          name="Supabase"
          status={project?.supabase_url ? "Conectado" : "Não configurado"}
          url={undefined}
          actionLabel={project?.supabase_url ? "Migrate" : "Config"}
          onAction={() => project?.supabase_url ? deploy("supabase") : onNavigateIntegrations?.()}
          deploying={deploying === "supabase"}
          disabled={isDeploying}
        />

        <button
          className="gl xs"
          style={{ width: "100%", justifyContent: "center", fontSize: 11 }}
          onClick={onNavigateIntegrations}
        >
          ⚙ Gerenciar Integrações
        </button>

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

function DeployRow({ icon, name, badge, status, url, actionLabel, onAction, deploying, disabled, btnClass }: {
  icon: React.ReactNode; name: string; badge?: string; status: string;
  url?: string; actionLabel: string; onAction: () => void;
  deploying: boolean; disabled: boolean; btnClass?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: "var(--r3)", background: "var(--bg-2)", border: "1px solid var(--b0)" }}>
      {icon}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
          {name}
          {badge && <span style={{ fontSize: 9, background: "var(--green-l)", color: "#000", padding: "1px 5px", borderRadius: 4, fontWeight: 600 }}>{badge}</span>}
        </div>
        <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{status}</div>
      </div>
      {url ? (
        <>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={14} className="text-[var(--text-tertiary)]" />
          </a>
          <button className={btnClass || "gl xs blue"} onClick={onAction} disabled={disabled}>
            {deploying ? <Loader2 size={12} className="animate-spin" /> : actionLabel}
          </button>
        </>
      ) : (
        <button className={btnClass || "gl xs blue"} onClick={onAction} disabled={disabled}>
          {deploying ? <Loader2 size={12} className="animate-spin" /> : actionLabel}
        </button>
      )}
    </div>
  );
}
