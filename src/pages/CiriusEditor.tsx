import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast as sonnerToast } from "sonner";
import IslandLeft from "@/components/cirius-editor/IslandLeft";
import IslandCenter from "@/components/cirius-editor/IslandCenter";
import IslandRight from "@/components/cirius-editor/IslandRight";
import BottomIsland from "@/components/cirius-editor/BottomIsland";
import DomainIsland from "@/components/cirius-editor/DomainIsland";
import PreviewArea from "@/components/cirius-editor/PreviewArea";
import TaskBubbles from "@/components/cirius-editor/TaskBubbles";
import CmdPanel from "@/components/cirius-editor/CmdPanel";
import DrawerDeploy from "@/components/cirius-editor/DrawerDeploy";
import DrawerFiles from "@/components/cirius-editor/DrawerFiles";
import DrawerSEO from "@/components/cirius-editor/DrawerSEO";
import DrawerBuild from "@/components/cirius-editor/DrawerBuild";
import DrawerChain from "@/components/cirius-editor/DrawerChain";
import EditorToasts from "@/components/cirius-editor/EditorToasts";
import "@/styles/cirius-editor.css";

import type { FrameMode, ActiveMode, CmdMode, Bubble, EditorToast, ChatMessage } from "@/components/cirius-editor/types";

export default function CiriusEditor() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Editor state
  const [frameMode, setFrameMode] = useState<FrameMode>("desktop");
  const [activeMode, setActiveMode] = useState<ActiveMode>("build");
  const [modesOpen, setModesOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdMode, setCmdMode] = useState<CmdMode>("code");
  const [activeDrawers, setActiveDrawers] = useState<Set<string>>(new Set());
  const [domainVisible, setDomainVisible] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [toasts, setToasts] = useState<EditorToast[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const drawerPositions: Record<string, "left" | "right"> = {
    deploy: "right", files: "right", seo: "left", build: "left", chain: "left",
  };

  const loadProject = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.functions.invoke("cirius-status", {
      body: { action: "get", project_id: id },
    });
    if (data?.project) {
      setProject(data.project);
      setLogs(data.logs || []);
      // If project has source files, load preview
      if (data.project.source_files_json) {
        const files = data.project.source_files_json as any;
        const indexHtml = files?.["index.html"] || files?.["dist/index.html"];
        if (indexHtml) setPreviewHtml(indexHtml);
      }
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { loadProject(); }, [loadProject]);

  // Realtime
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`cirius-editor:${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "cirius_generation_log", filter: `project_id=eq.${id}` },
        (payload) => { setLogs(prev => [payload.new, ...prev].slice(0, 50)); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "cirius_projects", filter: `id=eq.${id}` },
        (payload) => {
          const updated = payload.new as any;
          setProject(updated);
          // Extract preview HTML from updated source files in realtime
          if (updated.source_files_json) {
            const files = updated.source_files_json;
            const indexHtml = files?.["index.html"] || files?.["dist/index.html"];
            if (indexHtml) setPreviewHtml(indexHtml);
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen(prev => !prev);
      }
      if (e.key === "Escape") {
        if (cmdOpen) setCmdOpen(false);
        else setModesOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [cmdOpen]);

  const addToast = useCallback((msg: string, type: "success" | "info" = "info") => {
    const t: EditorToast = { id: crypto.randomUUID(), msg, type };
    setToasts(prev => [...prev, t]);
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), 3100);
  }, []);

  const toggleDrawer = useCallback((name: string) => {
    setActiveDrawers(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        // Close drawers on the same side
        const side = drawerPositions[name];
        for (const d of next) {
          if (drawerPositions[d] === side) next.delete(d);
        }
        next.add(name);
      }
      return next;
    });
  }, []);

  const sendMsg = useCallback(async (msg: string) => {
    if (!msg.trim()) return;

    // Create bubble
    const bubble: Bubble = {
      id: crypto.randomUUID(),
      title: msg.length > 32 ? msg.slice(0, 32) + "..." : msg,
      phase: "running",
      steps: [
        { s: "run", t: "Brain → analisando prompt" },
        { s: "wait", t: "Geração de código" },
        { s: "wait", t: "Captura source-code" },
      ],
      pct: 8,
      startTime: Date.now(),
    };
    setBubbles(prev => [...prev, bubble]);
    setQueueCount(prev => prev + 1);

    // Simulate progress
    let p = 8;
    const iv = setInterval(() => {
      p = Math.min(p + 15 + Math.random() * 12, 98);
      setBubbles(prev => prev.map(b => b.id === bubble.id ? { ...b, pct: p } : b));
      if (p >= 95) {
        clearInterval(iv);
      }
    }, 900);

    // Actually send to backend
    try {
      const { data } = await supabase.functions.invoke("cirius-generate", {
        body: { action: "build_prompt", project_id: id, prompt: msg },
      });
      clearInterval(iv);
      setBubbles(prev => prev.map(b => b.id === bubble.id ? {
        ...b,
        phase: "done",
        pct: 100,
        steps: b.steps.map(s => ({ ...s, s: "done" as const })),
      } : b));
      setQueueCount(prev => Math.max(0, prev - 1));
      addToast("Task concluída!", "success");
      await loadProject();
      // Auto-dismiss after 4s
      setTimeout(() => setBubbles(prev => prev.filter(b => b.id !== bubble.id)), 4000);
    } catch {
      clearInterval(iv);
      setBubbles(prev => prev.map(b => b.id === bubble.id ? {
        ...b, phase: "error", steps: b.steps.map(s => ({ ...s, s: s.s === "run" ? "done" as const : s.s })),
      } : b));
      setQueueCount(prev => Math.max(0, prev - 1));
      addToast("Erro ao processar", "info");
    }
  }, [id, loadProject, addToast]);

  const removeBubble = useCallback((bubbleId: string) => {
    setBubbles(prev => prev.filter(b => b.id !== bubbleId));
  }, []);

  const sendChatMsg = useCallback(async (msg: string) => {
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: msg, timestamp: Date.now() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatLoading(true);
    try {
      const history = chatMessages.slice(-10).map(m => ({ role: m.role === "assistant" ? "ai" : "user", content: m.content }));
      const contextPrefix = project?.name ? `[Projeto: ${project.name}] ` : "";
      const { data } = await supabase.functions.invoke("gemini-chat", {
        body: { message: contextPrefix + msg, history },
      });
      const reply = data?.reply || data?.response || data?.text || "Desculpe, não consegui processar.";
      const aiMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: reply, timestamp: Date.now() };
      setChatMessages(prev => [...prev, aiMsg]);
    } catch {
      const errMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: "Erro ao processar. Tente novamente.", timestamp: Date.now() };
      setChatMessages(prev => [...prev, errMsg]);
    }
    setChatLoading(false);
  }, [project, chatMessages]);

  if (!user) { navigate("/login"); return null; }
  if (loading) return <div className="ce-root" />;

  const projectName = project?.name || "Novo Projeto";
  const isLive = project?.status === "live";
  const prd = project?.prd_json as { tasks?: any[] } | null;
  const tasks = prd?.tasks || [];

  return (
    <div className="ce-root dark">
      {/* Preview */}
      <PreviewArea frameMode={frameMode} previewHtml={previewHtml} />

      {/* Top Islands */}
      <div className="ce-top-bar">
        <IslandLeft
          projectName={projectName}
          onDomainClick={() => setDomainVisible(prev => !prev)}
          onSeoClick={() => toggleDrawer("seo")}
        />
        <IslandCenter frameMode={frameMode} onFrameChange={setFrameMode} />
        <IslandRight
          isLive={isLive}
          onHistoryClick={() => addToast("Histórico de versões", "info")}
          onBuildClick={() => toggleDrawer("build")}
          onFilesClick={() => toggleDrawer("files")}
          onDeployClick={() => toggleDrawer("deploy")}
          onPublishClick={() => toggleDrawer("deploy")}
        />
      </div>

      {/* Domain Island */}
      {domainVisible && (
        <DomainIsland
          onClose={() => setDomainVisible(false)}
          onSave={(domain) => { addToast(`Domínio ${domain} salvo`, "success"); setDomainVisible(false); }}
        />
      )}

      {/* Bottom Island */}
      <BottomIsland
        modesOpen={modesOpen}
        setModesOpen={setModesOpen}
        activeMode={activeMode}
        setActiveMode={setActiveMode}
        queueCount={queueCount}
        onClearQueue={() => setQueueCount(0)}
        onSend={sendMsg}
        onCmdOpen={() => setCmdOpen(true)}
        onChainOpen={() => toggleDrawer("chain")}
      />

      {/* Task Bubbles */}
      <TaskBubbles bubbles={bubbles} onRemove={removeBubble} />

      {/* CMD Panel */}
      {cmdOpen && (
        <CmdPanel
          mode={cmdMode}
          onModeChange={setCmdMode}
          onClose={() => setCmdOpen(false)}
          sourceFiles={project?.source_files_json}
          chatMessages={chatMessages}
          onChatSend={sendChatMsg}
          chatLoading={chatLoading}
        />
      )}

      {/* Drawers */}
      <DrawerDeploy visible={activeDrawers.has("deploy")} onClose={() => toggleDrawer("deploy")} project={project} onNavigateIntegrations={() => navigate("/cirius/integrations")} />
      <DrawerFiles visible={activeDrawers.has("files")} onClose={() => toggleDrawer("files")} sourceFiles={project?.source_files_json} />
      <DrawerSEO visible={activeDrawers.has("seo")} onClose={() => toggleDrawer("seo")} />
      <DrawerBuild visible={activeDrawers.has("build")} onClose={() => toggleDrawer("build")} project={project} tasks={tasks} logs={logs} />
      <DrawerChain visible={activeDrawers.has("chain")} onClose={() => toggleDrawer("chain")} tasks={tasks} />

      {/* Toasts */}
      <EditorToasts toasts={toasts} />
    </div>
  );
}
