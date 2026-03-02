import { Wrench, CheckCircle2, Loader2, Circle, Play, Pause } from "lucide-react";

interface Props {
  visible: boolean;
  onClose: () => void;
  project?: any;
  tasks: any[];
  logs: any[];
}

export default function DrawerBuild({ visible, onClose, project, tasks, logs }: Props) {
  const progress = project?.progress_pct || 0;

  const phases = [
    {
      label: "PRD gerado",
      detail: `${tasks.length} tasks`,
      status: project?.prd_json ? "done" : project?.status === "generating_prd" ? "run" : "wait",
    },
    {
      label: "Brainchain — Código",
      detail: tasks.length > 0 ? `Task ${Math.min(tasks.filter((t: any) => t.status === "done").length + 1, tasks.length)}/${tasks.length}` : "",
      status: project?.status === "generating_code" ? "run" : project?.status === "live" ? "done" : "wait",
    },
    {
      label: "Deploy",
      detail: "GitHub → Vercel",
      status: project?.status === "deploying" ? "run" : project?.status === "live" ? "done" : "wait",
    },
  ];

  return (
    <div
      className={`s-drawer ${visible ? "visible" : "hidden to-left"}`}
      style={{ bottom: 88, left: 18, width: 320 }}
    >
      <div className="sdh">
        <div className="sdh-title">
          <Wrench size={14} className="text-[var(--orange-l)]" /> Orquestrador
        </div>
        <button className="sd-close" onClick={onClose}>✕</button>
      </div>

      <div style={{ padding: "0 12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Global progress */}
        <div style={{ height: 2, borderRadius: 1, background: "var(--bg-4)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg, var(--indigo), var(--purple))", transition: "width 1s" }} />
        </div>

        {/* Phases */}
        {phases.map((phase, i) => (
          <div key={i} className={`bs-phase ${phase.status}`}>
            <div className={`bs-ico ${phase.status}`}>
              {phase.status === "done" && <CheckCircle2 size={13} />}
              {phase.status === "run" && <Loader2 size={13} className="animate-spin" />}
              {phase.status === "wait" && <Circle size={13} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500 }}>{phase.label}</div>
              <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{phase.detail}</div>
            </div>
            <span className={`ce-chip ${phase.status === "done" ? "green" : phase.status === "run" ? "blue" : "gray"}`}>
              {phase.status === "done" ? "done" : phase.status === "run" ? "run" : "wait"}
            </span>
          </div>
        ))}

        {/* Actions */}
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <button className="gl sm green" style={{ flex: 1, justifyContent: "center" }}>
            <Play size={12} /> Completar
          </button>
          <button className="gl sm" style={{ flex: 1, justifyContent: "center" }}>
            <Pause size={12} /> Pausar
          </button>
        </div>
      </div>
    </div>
  );
}
