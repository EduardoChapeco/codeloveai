import { useState } from "react";
import { Wrench, CheckCircle2, Loader2, Circle, Play, Pause, ChevronDown, ChevronRight, Eye, FileCode } from "lucide-react";

interface Props {
  visible: boolean;
  onClose: () => void;
  project?: any;
  tasks: any[];
  logs: any[];
}

export default function DrawerBuild({ visible, onClose, project, tasks, logs }: Props) {
  const progress = project?.progress_pct || 0;
  const [expandedTask, setExpandedTask] = useState<number | null>(null);

  // Categorize tasks
  const doneTasks = tasks.filter((t: any) => t.status === "done");
  const runningTasks = tasks.filter((t: any) => t.status === "running" || t.status === "in_progress");
  const pendingTasks = tasks.filter((t: any) => !["done", "running", "in_progress"].includes(t.status));

  // Tool count from logs
  const toolCount = logs.filter((l: any) => l.step && l.status === "done").length;

  // Files fixed from logs
  const filesFixed = logs
    .filter((l: any) => l.step === "code_gen" && l.status === "done" && l.output_json)
    .slice(0, 8)
    .map((l: any) => ({
      file: l.output_json?.file || l.message?.slice(0, 30) || "arquivo",
      issue: l.input_json?.issue || "gerado",
      fix: l.output_json?.summary || "concluído",
    }));

  const phases = [
    {
      label: "PRD gerado",
      detail: `${tasks.length} tasks`,
      status: project?.prd_json ? "done" : project?.status === "generating_prd" ? "run" : "wait",
    },
    {
      label: "Brainchain — Código",
      detail: tasks.length > 0 ? `Task ${Math.min(doneTasks.length + 1, tasks.length)}/${tasks.length}` : "",
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
      style={{ bottom: 88, left: 18, width: 360, maxHeight: 520 }}
    >
      <div className="sdh">
        <div className="sdh-title">
          <Wrench size={14} className="text-[var(--orange-l)]" /> Orquestrador
          {toolCount > 0 && <span className="ce-chip blue">{toolCount} tools</span>}
        </div>
        <button className="sd-close" onClick={onClose}>✕</button>
      </div>

      <div style={{ padding: "0 12px 14px", display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", maxHeight: 420 }}>
        {/* Thinking indicator */}
        {project?.status === "generating_code" && (
          <div className="bs-thinking">
            <Loader2 size={11} className="animate-spin" />
            <span>Pensando...</span>
            {project?.generation_started_at && (
              <span style={{ fontFamily: "var(--mono)", fontSize: 10 }}>
                {Math.floor((Date.now() - new Date(project.generation_started_at).getTime()) / 1000)}s
              </span>
            )}
          </div>
        )}

        {/* Global progress */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
          <div style={{ flex: 1, height: 3, borderRadius: 2, background: "var(--bg-4)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg, var(--indigo), var(--purple))", transition: "width 1s" }} />
          </div>
          <span style={{ color: "var(--text-tertiary)", fontFamily: "var(--mono)", fontWeight: 600, minWidth: 32, textAlign: "right" }}>{progress}%</span>
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

        {/* DONE section */}
        {doneTasks.length > 0 && (
          <div>
            <div className="bs-section-label green">
              <CheckCircle2 size={10} /> DONE — {doneTasks.length}
            </div>
            {doneTasks.map((task: any, i: number) => (
              <TaskCard
                key={i}
                task={task}
                index={i}
                expanded={expandedTask === i}
                onToggle={() => setExpandedTask(expandedTask === i ? null : i)}
              />
            ))}
          </div>
        )}

        {/* IN PROGRESS / MORE WORK NEEDED */}
        {runningTasks.length > 0 && (
          <div>
            <div className="bs-section-label blue">
              <Loader2 size={10} className="animate-spin" /> EM ANDAMENTO — {runningTasks.length}
            </div>
            {runningTasks.map((task: any, i: number) => {
              const idx = doneTasks.length + i;
              return (
                <TaskCard
                  key={idx}
                  task={task}
                  index={idx}
                  expanded={expandedTask === idx}
                  onToggle={() => setExpandedTask(expandedTask === idx ? null : idx)}
                />
              );
            })}
          </div>
        )}

        {/* NEXT */}
        {pendingTasks.length > 0 && (
          <div>
            <div className="bs-section-label gray">
              <Circle size={10} /> PRÓXIMO — {pendingTasks.length}
            </div>
            {pendingTasks.map((task: any, i: number) => {
              const idx = doneTasks.length + runningTasks.length + i;
              return (
                <TaskCard
                  key={idx}
                  task={task}
                  index={idx}
                  expanded={expandedTask === idx}
                  onToggle={() => setExpandedTask(expandedTask === idx ? null : idx)}
                />
              );
            })}
          </div>
        )}

        {/* Files fixed table */}
        {filesFixed.length > 0 && (
          <div>
            <div className="bs-section-label purple">
              <FileCode size={10} /> Files fixed — {filesFixed.length}
            </div>
            <div className="bs-files-table">
              <div className="bs-ft-header">
                <span>Arquivo</span><span>Issue</span><span>Fix</span>
              </div>
              {filesFixed.map((f, i) => (
                <div key={i} className="bs-ft-row">
                  <span className="bs-ft-file">{f.file}</span>
                  <span>{f.issue}</span>
                  <span>{f.fix}</span>
                </div>
              ))}
            </div>
          </div>
        )}

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

function TaskCard({ task, index, expanded, onToggle }: { task: any; index: number; expanded: boolean; onToggle: () => void }) {
  const status = task.status === "done" ? "done" : task.status === "running" || task.status === "in_progress" ? "run" : "wait";

  return (
    <div className={`bs-task-card ${status}`}>
      <div className="bs-task-header" onClick={onToggle}>
        {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        <div className={`chain-num ${status}`} style={{ width: 16, height: 16, fontSize: 9 }}>
          {status === "done" ? <CheckCircle2 size={8} /> : status === "run" ? <Loader2 size={8} className="animate-spin" /> : index + 1}
        </div>
        <span style={{ flex: 1, fontSize: 11.5, fontWeight: 500 }}>{task.title || task.prompt?.slice(0, 40) || `Task ${index + 1}`}</span>
        <span className={`ce-chip ${status === "done" ? "green" : status === "run" ? "blue" : "gray"}`} style={{ fontSize: 9, padding: "1px 6px" }}>
          {status}
        </span>
      </div>
      {expanded && (
        <div className="bs-task-detail">
          {task.detail && <p style={{ fontSize: 10.5, color: "var(--text-tertiary)", margin: "0 0 6px" }}>{task.detail}</p>}
          {task.prompt && <p style={{ fontSize: 10.5, color: "var(--text-tertiary)", margin: "0 0 6px" }}>{task.prompt}</p>}
          <div style={{ display: "flex", gap: 4 }}>
            <button className="gl xs blue">
              <FileCode size={10} /> Details
            </button>
            <button className="gl xs">
              <Eye size={10} /> Preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
