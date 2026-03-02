import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

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
import SplitModeEditor from "@/components/cirius-editor/SplitModeEditor";
import "@/styles/cirius-editor.css";

import type { FrameMode, ActiveMode, CmdMode, Bubble, EditorToast, ChatMessage } from "@/components/cirius-editor/types";
import type { EditorMode } from "@/components/cirius-editor/SplitTopBar";

/** Build a self-contained HTML preview from source_files_json */
function buildPreviewFromFiles(files: Record<string, string>): string | null {
  const html = files["index.html"] || files["dist/index.html"];
  if (!html) return null;

  // Collect CSS and JS to inline
  const cssFiles = Object.entries(files).filter(([k]) => k.endsWith(".css"));
  const jsFiles = Object.entries(files).filter(([k]) => k.endsWith(".js") || k.endsWith(".tsx") || k.endsWith(".ts"));

  let assembled = html;

  // Inline CSS before </head>
  if (cssFiles.length > 0) {
    const cssBlock = cssFiles.map(([, v]) => `<style>${v}</style>`).join("\n");
    assembled = assembled.includes("</head>")
      ? assembled.replace("</head>", `${cssBlock}\n</head>`)
      : `${cssBlock}\n${assembled}`;
  }

  // Inline JS before </body>
  const plainJs = jsFiles.filter(([k]) => k.endsWith(".js"));
  if (plainJs.length > 0) {
    const jsBlock = plainJs.map(([, v]) => `<script>${v}</script>`).join("\n");
    assembled = assembled.includes("</body>")
      ? assembled.replace("</body>", `${jsBlock}\n</body>`)
      : `${assembled}\n${jsBlock}`;
  }

  return assembled;
}

export default function CiriusEditor() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [livePreviewUrl, setLivePreviewUrl] = useState<string | null>(null);

  // Editor mode: full (floating islands) or split (side-by-side)
  const [editorMode, setEditorMode] = useState<EditorMode>("full");

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

  const upsertBubbleFromLog = useCallback((log: any) => {
    const stepId = String(log?.step || crypto.randomUUID());
    const isDone = log?.status === "completed";
    const isError = log?.status === "failed";
    const phase: Bubble["phase"] = isError ? "error" : isDone ? "done" : "running";
    const pct = isError || isDone ? 100 : 55;

    setBubbles(prev => {
      const found = prev.find(b => b.id === stepId);
      const nextStep = { s: isError ? "wait" as const : isDone ? "done" as const : "run" as const, t: log?.message || stepId };

      if (!found) {
        const created: Bubble = {
          id: stepId,
          title: stepId.split("_").join(" "),
          phase,
          steps: [nextStep],
          pct,
          startTime: Date.now(),
        };
        return [...prev, created];
      }

      return prev.map(b => b.id === stepId
        ? { ...b, phase, pct, steps: [nextStep] }
        : b);
    });

    if (isDone) {
      setTimeout(() => {
        setBubbles(prev => prev.filter(b => b.id !== stepId));
      }, 4000);
    }
  }, []);

  const loadProject = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.functions.invoke("cirius-status", {
      body: { action: "get", project_id: id },
    });
    if (data?.project) {
      setProject(data.project);
      const nextLogs = data.logs || [];
      setLogs(nextLogs);

      // Prime bubbles from latest real backend logs
      nextLogs
        .slice()
        .reverse()
        .forEach((log: any) => upsertBubbleFromLog(log));

      // Live preview URL: only use actual deployed URLs (Vercel/Netlify/custom), never Brain project URLs
      const deployedUrl = data.project.vercel_url || data.project.netlify_url || data.project.custom_domain;
      if (deployedUrl) {
        setLivePreviewUrl(deployedUrl.startsWith("http") ? deployedUrl : `https://${deployedUrl}`);
      } else if (data.project.preview_url && !data.project.preview_url.includes("lovable.app")) {
        setLivePreviewUrl(data.project.preview_url);
      } else {
        setLivePreviewUrl(null);
      }

      // Load source_files_json directly from DB for preview (cirius-status doesn't return it for security)
      if (data.project.has_files) {
        const { data: filesData } = await supabase
          .from("cirius_projects" as any)
          .select("source_files_json")
          .eq("id", id)
          .maybeSingle();
        const fd = filesData as any;
        if (fd?.source_files_json) {
          setPreviewHtml(buildPreviewFromFiles(fd.source_files_json as Record<string, string>));
          setProject((prev: any) => ({ ...prev, source_files_json: fd.source_files_json }));
        }
      } else {
        setPreviewHtml(null);
      }
    }
    setLoading(false);
  }, [id, upsertBubbleFromLog]);

  useEffect(() => { loadProject(); }, [loadProject]);

  // Load persisted chat messages
  useEffect(() => {
    if (!id || !user) return;
    supabase.from("cirius_chat_messages" as any)
      .select("id, role, content, created_at")
      .eq("project_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(100)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setChatMessages(data.map((m: any) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            timestamp: new Date(m.created_at).getTime(),
          })));
        }
      });
  }, [id, user]);

  // Realtime
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`cirius-editor:${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "cirius_generation_log", filter: `project_id=eq.${id}` },
        (payload) => {
          const nextLog = payload.new;
          setLogs(prev => [nextLog, ...prev].slice(0, 100));
          upsertBubbleFromLog(nextLog);
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "cirius_projects", filter: `id=eq.${id}` },
        (payload) => {
          const updated = payload.new as any;
          setProject(updated);

          // Only use real deployed URLs, never Brain project URLs
          const deployedUrl = updated.vercel_url || updated.netlify_url || updated.custom_domain;
          if (deployedUrl) {
            setLivePreviewUrl(deployedUrl.startsWith("http") ? deployedUrl : `https://${deployedUrl}`);
          } else if (updated.preview_url && !String(updated.preview_url).includes("lovable.app")) {
            setLivePreviewUrl(updated.preview_url);
          } else {
            setLivePreviewUrl(null);
          }

          if (updated.source_files_json) {
            setPreviewHtml(buildPreviewFromFiles(updated.source_files_json as Record<string, string>));
          } else {
            setPreviewHtml(null);
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, upsertBubbleFromLog]);

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

  useEffect(() => {
    setQueueCount(bubbles.filter(b => b.phase === "running").length);
  }, [bubbles]);

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

  const persistMsg = useCallback(async (msg: ChatMessage) => {
    if (!id || !user) return;
    await supabase.from("cirius_chat_messages" as any).insert({
      id: msg.id,
      project_id: id,
      user_id: user.id,
      role: msg.role,
      content: msg.content,
    });
  }, [id, user]);

  // ─── Unified vibecoding send: chat + build pipeline in one ───
  const sendMsg = useCallback(async (msg: string) => {
    if (!msg.trim() || !id) return;

    // 1. Add user message to chat immediately
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: msg, timestamp: Date.now() };
    setChatMessages(prev => [...prev, userMsg]);
    persistMsg(userMsg);
    setChatLoading(true);

    // 2. Create task bubble for visual progress
    const bubbleId = `prompt_${Date.now()}`;
    const bubble: Bubble = {
      id: bubbleId,
      title: msg.length > 36 ? msg.slice(0, 36) + "..." : msg,
      phase: "running",
      steps: [{ s: "run", t: "Processando comando..." }],
      pct: 20,
      startTime: Date.now(),
    };
    setBubbles(prev => [...prev, bubble]);

    try {
      // 3. Send to build pipeline
      const { data, error } = await supabase.functions.invoke("cirius-generate", {
        body: { action: "build_prompt", project_id: id, prompt: msg.trim() },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Falha na geração");
      }

      // 4. Show AI acknowledgment in chat
      const taskCount = data?.task_count || 0;
      const previewUrl = data?.preview_url || null;
      const aiReply = taskCount > 0
        ? `✅ Pipeline iniciado com ${taskCount} tarefa(s). ${previewUrl ? `Preview: ${previewUrl}` : "O preview será atualizado automaticamente."}`
        : "✅ Comando aceito, pipeline em execução.";

      const aiMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: aiReply, timestamp: Date.now() };
      setChatMessages(prev => [...prev, aiMsg]);
      persistMsg(aiMsg);

      setBubbles(prev => prev.map(b => b.id === bubbleId ? {
        ...b, phase: "done", pct: 100,
        steps: [{ s: "done", t: `Pipeline iniciado (${taskCount} tasks)` }],
      } : b));

      addToast("Pipeline iniciado", "success");
      await loadProject();
      setTimeout(() => setBubbles(prev => prev.filter(b => b.id !== bubbleId)), 4000);
    } catch (e) {
      // Show error in chat
      const errText = e instanceof Error ? e.message : "Erro ao processar";
      const errMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: `❌ ${errText}`, timestamp: Date.now() };
      setChatMessages(prev => [...prev, errMsg]);
      persistMsg(errMsg);

      setBubbles(prev => prev.map(b => b.id === bubbleId ? {
        ...b, phase: "error", pct: 100,
        steps: [{ s: "wait", t: errText }],
      } : b));
      addToast("Erro ao processar", "info");
    }
    setChatLoading(false);
  }, [id, loadProject, addToast, persistMsg]);
  const removeBubble = useCallback((bubbleId: string) => {
    setBubbles(prev => prev.filter(b => b.id !== bubbleId));
  }, []);

  // ─── Chat-only conversation (for non-build queries via CMD panel) ───
  const sendChatMsg = useCallback(async (msg: string) => {
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: msg, timestamp: Date.now() };
    setChatMessages(prev => [...prev, userMsg]);
    persistMsg(userMsg);
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
      persistMsg(aiMsg);
    } catch {
      const errMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: "Erro ao processar. Tente novamente.", timestamp: Date.now() };
      setChatMessages(prev => [...prev, errMsg]);
      persistMsg(errMsg);
    }
    setChatLoading(false);
  }, [project, chatMessages, persistMsg]);

  if (!user) { navigate("/login"); return null; }
  if (loading) return <div className="ce-root" />;

  const projectName = project?.name || "Novo Projeto";
  const isLive = project?.status === "live";
  const prd = project?.prd_json as { tasks?: any[] } | null;
  const tasks = prd?.tasks || [];

  // ─── SPLIT MODE ───
  if (editorMode === "split") {
    return (
      <SplitModeEditor
        project={project}
        previewHtml={previewHtml}
        livePreviewUrl={livePreviewUrl}
        chatMessages={chatMessages}
        chatLoading={chatLoading}
        onSendMsg={sendMsg}
        onSendChat={sendChatMsg}
        onEditorModeChange={setEditorMode}
        isLive={isLive}
        toasts={toasts}
      />
    );
  }

  // ─── FULL MODE (existing floating islands UI) ───
  return (
    <div className="ce-root dark">
      {/* Preview */}
      <PreviewArea frameMode={frameMode} previewHtml={previewHtml} livePreviewUrl={livePreviewUrl} />

      {/* Top Islands */}
      <div className="ce-top-bar">
        <IslandLeft
          projectName={projectName}
          onDomainClick={() => setDomainVisible(prev => !prev)}
          onSeoClick={() => toggleDrawer("seo")}
          editorMode={editorMode}
          onEditorModeChange={setEditorMode}
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
          initialDomain={project?.custom_domain || ""}
          onClose={() => setDomainVisible(false)}
          onSave={async (domain) => {
            if (!id) return;
            const { error } = await supabase.from("cirius_projects" as any).update({ custom_domain: domain || null }).eq("id", id);
            if (error) addToast("Erro ao salvar domínio", "info");
            else {
              setProject((prev: any) => ({ ...prev, custom_domain: domain || null }));
              addToast(`Domínio ${domain || "removido"} salvo`, "success");
              setDomainVisible(false);
            }
          }}
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
      <DrawerSEO visible={activeDrawers.has("seo")} onClose={() => toggleDrawer("seo")} projectId={id} project={project} />
      <DrawerBuild visible={activeDrawers.has("build")} onClose={() => toggleDrawer("build")} project={project} tasks={tasks} logs={logs} />
      <DrawerChain visible={activeDrawers.has("chain")} onClose={() => toggleDrawer("chain")} tasks={tasks} />

      {/* Toasts */}
      <EditorToasts toasts={toasts} />
    </div>
  );
}
