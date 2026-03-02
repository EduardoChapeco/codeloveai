import { useState } from "react";
import {
  Rocket, Code, Palette, Database, Layout, CheckCircle2,
  Loader2, ChevronDown, ChevronUp
} from "lucide-react";

interface PRDTask {
  title: string;
  skill?: string;
  brain_type?: string;
  prompt?: string;
}

interface PRDDesign {
  primary_color?: string;
  font?: string;
  style?: string;
  pages?: string[];
  tables?: string[];
}

interface PRDData {
  tasks: PRDTask[];
  design?: PRDDesign | null;
}

interface Props {
  prd: PRDData;
  onApprove: () => void;
  isApproving: boolean;
  isApproved: boolean;
}

const SKILL_ICONS: Record<string, typeof Code> = {
  code: Code,
  design: Palette,
  prd: Layout,
  database: Database,
};

export default function PRDCard({ prd, onApprove, isApproving, isApproved }: Props) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="prd-card">
      {/* Header */}
      <div className="prd-header" onClick={() => setExpanded(!expanded)}>
        <div className="prd-header-left">
          <Rocket size={14} />
          <span className="prd-title">Blueprint do Projeto</span>
          <span className="prd-badge">{prd.tasks.length} tarefas</span>
        </div>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </div>

      {expanded && (
        <>
          {/* Design section */}
          {prd.design && (
            <div className="prd-design">
              <div className="prd-design-row">
                {prd.design.primary_color && (
                  <div className="prd-design-chip">
                    <span
                      className="prd-color-dot"
                      style={{ background: prd.design.primary_color }}
                    />
                    {prd.design.primary_color}
                  </div>
                )}
                {prd.design.font && (
                  <div className="prd-design-chip">
                    <span style={{ fontFamily: prd.design.font }}>Aa</span>
                    {prd.design.font}
                  </div>
                )}
                {prd.design.style && (
                  <div className="prd-design-chip">{prd.design.style}</div>
                )}
              </div>
              {prd.design.pages && prd.design.pages.length > 0 && (
                <div className="prd-pages">
                  <span className="prd-label">Páginas:</span>
                  {prd.design.pages.map((p, i) => (
                    <span key={i} className="prd-page-chip">{p}</span>
                  ))}
                </div>
              )}
              {prd.design.tables && prd.design.tables.length > 0 && (
                <div className="prd-pages">
                  <span className="prd-label">Tabelas:</span>
                  {prd.design.tables.map((t, i) => (
                    <span key={i} className="prd-page-chip">
                      <Database size={9} /> {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tasks list */}
          <div className="prd-tasks">
            {prd.tasks.map((task, i) => {
              const Icon = SKILL_ICONS[task.skill || task.brain_type || "code"] || Code;
              return (
                <div key={i} className="prd-task-row">
                  <span className="prd-task-idx">{i + 1}</span>
                  <Icon size={12} className="prd-task-icon" />
                  <span className="prd-task-title">{task.title}</span>
                  {task.brain_type && task.brain_type !== "code" && (
                    <span className="prd-brain-chip">{task.brain_type}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Approve button */}
          <div className="prd-footer">
            {isApproved ? (
              <div className="prd-approved">
                <CheckCircle2 size={14} />
                Pipeline em execução
              </div>
            ) : (
              <button
                className="prd-approve-btn"
                onClick={onApprove}
                disabled={isApproving}
              >
                {isApproving ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Iniciando...
                  </>
                ) : (
                  <>
                    <Rocket size={13} />
                    Iniciar Construção
                  </>
                )}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
