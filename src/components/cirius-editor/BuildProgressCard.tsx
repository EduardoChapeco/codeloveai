import { useState, useEffect, useCallback } from "react";
import {
  Loader2, CheckCircle2, AlertCircle, Cpu, Clock,
  GitBranch, Rocket, Shield, Code, Paintbrush, Database,
  Zap, Package, Globe,
} from "lucide-react";

export interface BuildStage {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
  icon?: string;
  detail?: string;
  durationMs?: number;
}

interface Props {
  stages: BuildStage[];
  projectName?: string;
  /** Overall progress 0-100 */
  progress?: number;
  isComplete?: boolean;
  isError?: boolean;
  /** URLs to show after completion */
  deployUrls?: { github?: string; vercel?: string; netlify?: string };
}

const STAGE_ICONS: Record<string, typeof Code> = {
  prd: Zap,
  schema: Database,
  auth: Shield,
  code: Code,
  ui: Paintbrush,
  backend: Cpu,
  refine: Shield,
  deploy: Rocket,
  github: GitBranch,
  vercel: Globe,
  package: Package,
};

function ElapsedTimer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [startTime]);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return <span className="bpc-timer">{m > 0 ? `${m}m ${s}s` : `${s}s`}</span>;
}

export default function BuildProgressCard({ stages, projectName, progress = 0, isComplete, isError, deployUrls }: Props) {
  const [startTime] = useState(Date.now());
  const doneCount = stages.filter(s => s.status === "done").length;
  const totalCount = stages.length;

  return (
    <div className={`bpc-root ${isComplete ? "bpc-complete" : ""} ${isError ? "bpc-error" : ""}`}>
      {/* Header */}
      <div className="bpc-header">
        <div className="bpc-h-left">
          {!isComplete && !isError && (
            <div className="bpc-pulse-ring">
              <Loader2 size={14} className="animate-spin" style={{ color: "var(--indigo-l)" }} />
            </div>
          )}
          {isComplete && <CheckCircle2 size={14} style={{ color: "#34d399" }} />}
          {isError && <AlertCircle size={14} style={{ color: "#f87171" }} />}
          <span className="bpc-h-title">
            {isComplete ? "Projeto criado!" : isError ? "Erro na geração" : "Construindo projeto..."}
          </span>
        </div>
        <div className="bpc-h-right">
          {!isComplete && <ElapsedTimer startTime={startTime} />}
          <span className="bpc-h-count">{doneCount}/{totalCount}</span>
        </div>
      </div>

      {/* Project name */}
      {projectName && (
        <div className="bpc-project-name">{projectName}</div>
      )}

      {/* Stages list */}
      <div className="bpc-stages">
        {stages.map((stage, i) => {
          const Icon = STAGE_ICONS[stage.icon || "code"] || Code;
          const isRunning = stage.status === "running";
          const isDone = stage.status === "done";
          const isFailed = stage.status === "error";
          const isPending = stage.status === "pending";

          return (
            <div
              key={stage.id}
              className={`bpc-stage ${stage.status}`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className={`bpc-s-icon ${stage.status}`}>
                {isRunning && <Loader2 size={11} className="animate-spin" />}
                {isDone && <CheckCircle2 size={11} />}
                {isFailed && <AlertCircle size={11} />}
                {isPending && <Icon size={11} />}
              </div>
              <span className="bpc-s-label">{stage.label}</span>
              {stage.detail && <span className="bpc-s-detail">{stage.detail}</span>}
              {isDone && stage.durationMs && (
                <span className="bpc-s-dur">{(stage.durationMs / 1000).toFixed(1)}s</span>
              )}
              {isRunning && (
                <div className="bpc-s-shimmer" />
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="bpc-progress-wrap">
        <div className="bpc-progress-track">
          <div
            className={`bpc-progress-fill ${isComplete ? "complete" : ""} ${isError ? "error" : ""}`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <span className="bpc-progress-pct">{Math.round(progress)}%</span>
      </div>

      {/* Deploy URLs */}
      {isComplete && deployUrls && (
        <div className="bpc-deploy-urls">
          {deployUrls.github && (
            <a href={deployUrls.github} target="_blank" rel="noopener noreferrer" className="bpc-url-chip">
              <GitBranch size={10} /> GitHub
            </a>
          )}
          {deployUrls.vercel && (
            <a href={deployUrls.vercel} target="_blank" rel="noopener noreferrer" className="bpc-url-chip bpc-url-live">
              <Globe size={10} /> Ver site
            </a>
          )}
          {deployUrls.netlify && (
            <a href={deployUrls.netlify} target="_blank" rel="noopener noreferrer" className="bpc-url-chip bpc-url-live">
              <Globe size={10} /> Ver site
            </a>
          )}
        </div>
      )}
    </div>
  );
}
