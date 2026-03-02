import { Link2, Plus, Play, CheckCircle2, Loader2, Circle } from "lucide-react";

interface Props {
  visible: boolean;
  onClose: () => void;
  tasks: any[];
}

export default function DrawerChain({ visible, onClose, tasks }: Props) {
  const chainTasks = tasks.length > 0 ? tasks : [
    { title: "Bootstrap projeto", detail: "Ghost create · 0 créditos", status: "done" },
    { title: "Gerar Hero + Navbar", detail: "Brainchain · skill: design", status: "running" },
    { title: "Features grid", detail: "Brainchain · skill: code", status: "pending" },
    { title: "Pricing + Footer", detail: "Brainchain · skill: design", status: "pending" },
    { title: "Deploy GitHub → Vercel", detail: "cirius-deploy · auto", status: "pending" },
  ];

  return (
    <div
      className={`s-drawer ${visible ? "visible" : "hidden to-left"}`}
      style={{ bottom: 88, left: 18, width: 340, maxHeight: 460 }}
    >
      <div className="sdh">
        <div className="sdh-title">
          <Link2 size={14} className="text-[var(--orange-l)]" /> Encadeado
          <span className="ce-chip orange">{chainTasks.length} tasks</span>
        </div>
        <button className="sd-close" onClick={onClose}>✕</button>
      </div>

      <div style={{ padding: "0 10px 10px", display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", maxHeight: 340 }}>
        {chainTasks.map((task: any, i: number) => {
          const status = task.status === "done" ? "done" : task.status === "running" ? "run" : "wait";
          return (
            <div key={i} className="chain-item">
              <div className={`chain-num ${status}`}>
                {status === "done" ? <CheckCircle2 size={10} /> : status === "run" ? <Loader2 size={10} className="animate-spin" /> : i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{task.title}</div>
                <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{task.detail || task.prompt?.slice(0, 40)}</div>
              </div>
              <span className={`ce-chip ${status === "done" ? "green" : status === "run" ? "blue" : "gray"}`}>
                {status}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ padding: "8px 12px 12px", display: "flex", gap: 6 }}>
        <button className="gl sm orange" style={{ flex: 1, justifyContent: "center" }}>
          <Plus size={12} /> Task
        </button>
        <button className="gl sm" style={{ flex: 1, justifyContent: "center" }}>
          <Play size={12} /> Run All
        </button>
      </div>
    </div>
  );
}
