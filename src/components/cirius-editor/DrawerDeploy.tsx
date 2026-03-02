import { useState } from "react";
import { Layers, Github, Globe, Database, CheckCircle2 } from "lucide-react";

interface Props {
  visible: boolean;
  onClose: () => void;
  project?: any;
}

export default function DrawerDeploy({ visible, onClose, project }: Props) {
  const [githubOn, setGithubOn] = useState(!!project?.github_url);

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
            <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{project?.github_repo || "user/my-project"}</div>
          </div>
          <button className={`ce-toggle ${githubOn ? "on" : ""}`} onClick={() => setGithubOn(!githubOn)} />
        </div>

        {/* Vercel */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: "var(--r3)", background: "var(--bg-2)", border: "1px solid var(--b0)" }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>▲</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 500 }}>Vercel</div>
            <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{project?.vercel_url ? "Online" : "Não conectado"}</div>
          </div>
          {project?.vercel_url ? <CheckCircle2 size={14} className="text-[var(--green-l)]" /> : <button className="gl xs blue">Conectar</button>}
        </div>

        {/* Netlify */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: "var(--r3)", background: "var(--bg-2)", border: "1px solid var(--b0)" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--teal-l)" }}>NF</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 500 }}>Netlify</div>
            <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{project?.netlify_url ? "Online" : "Não conectado"}</div>
          </div>
          <button className="gl xs green">Conectar</button>
        </div>

        {/* Supabase */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: "var(--r3)", background: "var(--bg-2)", border: "1px solid var(--b0)" }}>
          <Database size={14} className="text-[var(--green-l)]" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 500 }}>Supabase</div>
            <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>Service key manual</div>
          </div>
          <button className="gl xs">Config</button>
        </div>

        <button className="gl primary" style={{ width: "100%", justifyContent: "center", marginTop: 4 }}>
          Deploy Agora
        </button>
      </div>
    </div>
  );
}
