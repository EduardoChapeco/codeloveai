import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowUp, Loader2, CheckCircle2, Sparkles, Cpu,
  Code2, Eye, Rocket, Github, FolderDown, X,
} from "lucide-react";
import "@/styles/cirius-editor.css";

/* ─── Phases for the creation timeline ─── */
type Phase = "idle" | "creating" | "prd" | "dispatching" | "generating" | "done";

const PHASE_META: Record<Phase, { label: string; sub: string }> = {
  idle: { label: "", sub: "" },
  creating: { label: "Criando projeto", sub: "Inicializando ambiente..." },
  prd: { label: "Gerando PRD", sub: "Analisando requisitos e planejando tarefas..." },
  dispatching: { label: "Distribuindo tarefas", sub: "Enviando para Brains especializados..." },
  generating: { label: "Gerando código", sub: "Brains trabalhando em paralelo..." },
  done: { label: "Projeto criado!", sub: "Redirecionando para o editor..." },
};

const SUGGESTIONS = [
  "Um SaaS de gestão de projetos com Kanban, auth, dashboard e dark mode",
  "Landing page para startup de IA com hero animado, pricing e CTA",
  "CRM completo com login OAuth, CRUD de contatos, pipeline de vendas e relatórios",
  "E-commerce com catálogo, carrinho, checkout e painel admin",
];

export default function CiriusNew() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [prompt, setPrompt] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [projectName, setProjectName] = useState("");
  const [taskCount, setTaskCount] = useState(0);
  const [prdData, setPrdData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [phaseHistory, setPhaseHistory] = useState<Phase[]>([]);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const isRunning = phase !== "idle" && phase !== "done";

  const advancePhase = useCallback((p: Phase) => {
    setPhase(p);
    setPhaseHistory(prev => [...prev, p]);
  }, []);

  /* ─── Auto-resize textarea ─── */
  const handleInput = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, []);

  /* ─── Full auto pipeline ─── */
  const handleCreate = useCallback(async (text: string) => {
    if (!text.trim() || !user) return;
    const msg = text.trim();
    setPrompt(msg);
    setError(null);
    setPhaseHistory([]);

    // Derive name from prompt
    const name = msg.length > 40 ? msg.slice(0, 40).replace(/\s+\S*$/, "") + "..." : msg;
    setProjectName(name);

    try {
      // Phase 1: Create project
      advancePhase("creating");

      const { data: initData, error: initErr } = await supabase.functions.invoke("cirius-generate", {
        body: {
          action: "init",
          config: {
            name: name.slice(0, 60),
            description: msg,
            template_type: "app",
            features: [],
          },
        },
      });

      if (initErr || !initData?.project_id) {
        throw new Error(initData?.error || "Erro ao criar projeto");
      }

      const projectId = initData.project_id;

      // Phase 2: Generate PRD
      advancePhase("prd");

      const { data: prdResult } = await supabase.functions.invoke("cirius-generate", {
        body: { action: "generate_prd", project_id: projectId },
      });

      if (prdResult?.prd_json) {
        const tc = prdResult.task_count || prdResult.prd_json?.tasks?.length || 0;
        setTaskCount(tc);
        setPrdData(prdResult.prd_json);

        // Phase 3: Dispatch tasks
        advancePhase("dispatching");
        await new Promise(r => setTimeout(r, 800));

        // Phase 4: Start code generation
        advancePhase("generating");

        const { data: codeData } = await supabase.functions.invoke("cirius-generate", {
          body: { action: "generate_code", project_id: projectId },
        });

        if (codeData?.started) {
          toast.success(`${tc} tarefas distribuídas para ${codeData.engine || "Brainchain"}`);
        }

        // Phase 5: Done — redirect
        advancePhase("done");
        await new Promise(r => setTimeout(r, 1200));
        navigate(`/cirius/editor/${projectId}`);
      } else {
        // PRD failed, go to editor anyway
        advancePhase("done");
        toast.info("PRD pendente — continue no editor");
        await new Promise(r => setTimeout(r, 600));
        navigate(`/cirius/editor/${projectId}`);
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Erro inesperado";
      setError(errMsg);
      setPhase("idle");
      toast.error(errMsg);
    }
  }, [user, navigate, advancePhase]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleCreate(prompt);
    }
  }, [prompt, handleCreate]);

  if (!user) { navigate("/login"); return null; }

  const allPhases: Phase[] = ["creating", "prd", "dispatching", "generating", "done"];

  return (
    <div className="cn-root">
      {/* Ambient background */}
      <div className="cn-bg">
        <div className="cn-bg-glow" />
      </div>

      {/* Centered content */}
      <div className="cn-center">
        {/* Logo/brand */}
        <div className="cn-logo">
          <div className="cn-logo-icon">
            <Sparkles size={20} />
          </div>
          <h1 className="cn-title">Cirius</h1>
          <p className="cn-subtitle">Descreva o que quer construir</p>
        </div>

        {/* Running state: timeline */}
        {phase !== "idle" && (
          <div className="cn-timeline">
            <div className="cn-tl-header">
              {phase === "done" ? (
                <CheckCircle2 size={14} className="cn-tl-ico-done" />
              ) : (
                <Loader2 size={14} className="animate-spin cn-tl-ico-active" />
              )}
              <span className="cn-tl-name">{projectName}</span>
              {taskCount > 0 && (
                <span className="cn-tl-badge">{taskCount} tarefas</span>
              )}
            </div>

            <div className="cn-tl-steps">
              {allPhases.map((p, i) => {
                const meta = PHASE_META[p];
                const isCurrent = p === phase;
                const isPast = phaseHistory.includes(p) && !isCurrent;
                const isFuture = !phaseHistory.includes(p) && !isCurrent;

                return (
                  <div key={p} className={`cn-tl-step ${isCurrent ? "active" : ""} ${isPast ? "past" : ""} ${isFuture ? "future" : ""}`}>
                    <div className={`cn-tl-step-ico ${isPast ? "past" : isCurrent ? "active" : ""}`}>
                      {isPast ? (
                        <CheckCircle2 size={10} />
                      ) : isCurrent ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : (
                        <div className="cn-tl-step-dot" />
                      )}
                    </div>
                    <div className="cn-tl-step-text">
                      <span className="cn-tl-step-label">{meta.label}</span>
                      {isCurrent && <span className="cn-tl-step-sub">{meta.sub}</span>}
                    </div>
                    {isPast && <span className="cn-tl-check">✓</span>}
                  </div>
                );
              })}
            </div>

            {/* PRD summary */}
            {prdData?.design && (
              <div className="cn-tl-prd">
                {prdData.design.pages?.length > 0 && (
                  <span className="cn-tl-prd-item">📄 {prdData.design.pages.length} páginas</span>
                )}
                {prdData.design.tables?.length > 0 && (
                  <span className="cn-tl-prd-item">🗃️ {prdData.design.tables.length} tabelas</span>
                )}
              </div>
            )}

            {/* Progress */}
            <div className="cn-tl-progress">
              <div
                className={`cn-tl-progress-fill ${phase === "done" ? "done" : ""}`}
                style={{
                  width: `${phase === "creating" ? 15 : phase === "prd" ? 35 : phase === "dispatching" ? 55 : phase === "generating" ? 75 : 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="cn-error">
            <X size={12} /> {error}
          </div>
        )}

        {/* Chat input */}
        <div className={`cn-input-card ${isRunning ? "disabled" : ""}`}>
          <textarea
            ref={taRef}
            className="cn-textarea"
            placeholder="Descreva seu projeto completo... ex: Um sistema de gestão com login, CRUD, dashboard e dark mode"
            value={prompt}
            onChange={e => { setPrompt(e.target.value); handleInput(); }}
            onKeyDown={handleKey}
            rows={1}
            disabled={isRunning}
          />
          <div className="cn-input-footer">
            <div className="cn-input-hints">
              <span className="cn-hint">⌘↵ para criar</span>
            </div>
            <button
              className="cn-send-btn"
              onClick={() => handleCreate(prompt)}
              disabled={isRunning || !prompt.trim()}
            >
              {isRunning ? <Loader2 size={14} className="animate-spin" /> : <ArrowUp size={14} />}
            </button>
          </div>
        </div>

        {/* Suggestions */}
        {phase === "idle" && (
          <div className="cn-suggestions">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                className="cn-sug-btn"
                onClick={() => {
                  setPrompt(s);
                  taRef.current?.focus();
                  setTimeout(handleInput, 10);
                }}
              >
                <Sparkles size={10} className="cn-sug-ico" />
                <span>{s.length > 70 ? s.slice(0, 70) + "..." : s}</span>
              </button>
            ))}
          </div>
        )}

        {/* GitHub import link */}
        {phase === "idle" && (
          <button className="cn-gh-link" onClick={() => navigate("/cirius/new?mode=github")}>
            <Github size={12} /> Importar do GitHub
          </button>
        )}
      </div>
    </div>
  );
}
