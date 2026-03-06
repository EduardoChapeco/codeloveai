import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
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
import { extractFileBlocks, mergeFileMaps, stripFileBlocks } from "@/lib/ai-file-parser";
import type { BuildStage } from "@/components/cirius-editor/BuildProgressCard";
import type { TerminalLine } from "@/components/cirius-editor/TerminalPanel";
import { REACT_VITE_TEMPLATE } from "@/lib/project-template";
import { buildPreviewFromFiles } from "@/lib/cirius/preview-engine";
import { downloadProjectAsZip } from "@/lib/cirius/download-zip";
import "@/styles/cirius-editor.css";

import type { FrameMode, ActiveMode, CmdMode, Bubble, EditorToast, ChatMessage } from "@/components/cirius-editor/types";
import type { EditorMode } from "@/components/cirius-editor/SplitTopBar";

export default function CiriusEditor() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const navigate = useNavigate();

  const [project, setProject] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [livePreviewUrl, setLivePreviewUrl] = useState<string | null>(null);

  const [editorMode, setEditorMode] = useState<EditorMode>("split");
  const [chatMode, setChatMode] = useState<"build" | "ai-chat">("ai-chat");

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
  const [approvingPrd, setApprovingPrd] = useState(false);
  const [approvedPrdId, setApprovedPrdId] = useState<string | null>(null);
  const [sourceFiles, setSourceFiles] = useState<Record<string, string>>({});
  const [buildStages, setBuildStages] = useState<BuildStage[]>([]);
  const [buildProgress, setBuildProgress] = useState(0);
  const [buildComplete, setBuildComplete] = useState(false);
  const [buildError, setBuildError] = useState(false);
  const [deployUrls, setDeployUrls] = useState<{ github?: string; vercel?: string; netlify?: string }>({});
  const [streamingText, setStreamingText] = useState<string>("");
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
  const [updatedFiles, setUpdatedFiles] = useState<string[]>([]);

  const sourceFilesRef = useRef<Record<string, string>>({});

  const drawerPositions: Record<string, "left" | "right"> = {
    deploy: "right", files: "right", seo: "left", build: "left", chain: "left",
  };

  // ─── Helpers ───
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
        return [...prev, { id: stepId, title: stepId.split("_").join(" "), phase, steps: [nextStep], pct, startTime: Date.now() }];
      }
      return prev.map(b => b.id === stepId ? { ...b, phase, pct, steps: [nextStep] } : b);
    });

    if (isDone) {
      setTimeout(() => setBubbles(prev => prev.filter(b => b.id !== stepId)), 4000);
    }

    // Update build progress card stages
    const stageStatus: BuildStage["status"] = isError ? "error" : isDone ? "done" : "running";
    setBuildStages(prev => {
      const existing = prev.find(s => s.id === stepId);
      let next: BuildStage[];
      if (existing) {
        next = prev.map(s => s.id === stepId ? { ...s, status: stageStatus, detail: log?.message } : s);
      } else {
        next = [...prev, { id: stepId, label: stepId.split("_").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "), status: stageStatus, icon: stepId.includes("deploy") ? "deploy" : stepId.includes("refine") ? "refine" : stepId.includes("prd") ? "prd" : "code", detail: log?.message }];
      }

      // Compute progress inline — avoids cascading state updates
      const done = next.filter(s => s.status === "done").length;
      const total = Math.max(next.length, 1);
      const pctVal = Math.round((done / total) * 100);
      const allDone = next.length > 0 && next.every(s => s.status === "done");
      const anyError = next.some(s => s.status === "error");

      // Use queueMicrotask to batch these updates after render
      queueMicrotask(() => {
        setBuildProgress(pctVal);
        setBuildComplete(allDone);
        setBuildError(anyError && !allDone);
      });

      return next;
    });
  }, []);

  // ─── Load project ───
  const loadProject = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.functions.invoke("cirius-status", {
      body: { action: "get", project_id: id },
    });
    if (data?.project) {
      setProject(data.project);
      setLogs(data.logs || []);
      // Process only the latest 5 logs to avoid flooding state updates on initial load
      const recentLogs = (data.logs || []).slice(0, 5);
      recentLogs.reverse().forEach((log: any) => upsertBubbleFromLog(log));

      // Priority: vercel > netlify > custom_domain > any non-lovable preview_url
      const deployedUrl = data.project.vercel_url || data.project.netlify_url || data.project.custom_domain;
      if (deployedUrl) {
        const url = deployedUrl.startsWith("http") ? deployedUrl : `https://${deployedUrl}`;
        setLivePreviewUrl(url);
      } else if (data.project.preview_url && !data.project.preview_url.includes("lovable.app")) {
        setLivePreviewUrl(data.project.preview_url);
      } else {
        setLivePreviewUrl(null);
      }
      // Track deploy URLs for the build card
      setDeployUrls({
        github: data.project.github_url || undefined,
        vercel: data.project.vercel_url ? (data.project.vercel_url.startsWith("http") ? data.project.vercel_url : `https://${data.project.vercel_url}`) : undefined,
        netlify: data.project.netlify_url ? (data.project.netlify_url.startsWith("http") ? data.project.netlify_url : `https://${data.project.netlify_url}`) : undefined,
      });

      // Load source files
      const { data: filesData } = await supabase
        .from("cirius_projects" as any)
        .select("source_files_json")
        .eq("id", id)
        .maybeSingle();
      const fd = filesData as any;
      let files: Record<string, string> = {};
      if (fd?.source_files_json && typeof fd.source_files_json === "object" && Object.keys(fd.source_files_json).length > 0) {
        files = fd.source_files_json;
      }

      // Initialize with template if empty
      if (Object.keys(files).length === 0) {
        files = { ...REACT_VITE_TEMPLATE };
        // Save template to DB
        await supabase.from("cirius_projects" as any).update({ source_files_json: files }).eq("id", id);
      }

      setSourceFiles(files);
      sourceFilesRef.current = files;
      setPreviewHtml(buildPreviewFromFiles(files));
      setProject((prev: any) => ({ ...prev, source_files_json: files }));
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
            id: m.id, role: m.role as "user" | "assistant", content: m.content, timestamp: new Date(m.created_at).getTime(),
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
        (payload) => { const nl = payload.new; setLogs(prev => [nl, ...prev].slice(0, 100)); upsertBubbleFromLog(nl); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "cirius_projects", filter: `id=eq.${id}` },
        (payload) => {
          const updated = payload.new as any;
          setProject(updated);
          const deployedUrl = updated.vercel_url || updated.netlify_url || updated.custom_domain;
          if (deployedUrl) setLivePreviewUrl(deployedUrl.startsWith("http") ? deployedUrl : `https://${deployedUrl}`);
          else if (updated.preview_url && !String(updated.preview_url).includes("lovable.app")) setLivePreviewUrl(updated.preview_url);
          else setLivePreviewUrl(null);

          if (updated.source_files_json && typeof updated.source_files_json === "object") {
            setSourceFiles(updated.source_files_json);
            sourceFilesRef.current = updated.source_files_json;
            setPreviewHtml(buildPreviewFromFiles(updated.source_files_json));
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, upsertBubbleFromLog]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setCmdOpen(prev => !prev); }
      if (e.key === "Escape") { if (cmdOpen) setCmdOpen(false); else setModesOpen(false); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [cmdOpen]);

  const addToast = useCallback((msg: string, type: "success" | "info" = "info") => {
    const t: EditorToast = { id: crypto.randomUUID(), msg, type };
    setToasts(prev => [...prev, t]);
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), 3100);
  }, []);

  const addTerminalLine = useCallback((text: string, type: TerminalLine["type"] = "info") => {
    setTerminalLines(prev => [...prev.slice(-200), { id: crypto.randomUUID(), text, type, timestamp: Date.now() }]);
  }, []);

  const clearTerminal = useCallback(() => setTerminalLines([]), []);

  useEffect(() => { setQueueCount(bubbles.filter(b => b.phase === "running").length); }, [bubbles]);

  const toggleDrawer = useCallback((name: string) => {
    setActiveDrawers(prev => {
      const next = new Set(prev);
      if (next.has(name)) { next.delete(name); } else {
        const side = drawerPositions[name];
        for (const d of next) { if (drawerPositions[d] === side) next.delete(d); }
        next.add(name);
      }
      return next;
    });
  }, []);

  const persistMsg = useCallback(async (msg: ChatMessage) => {
    if (!id || !user) return;
    await supabase.from("cirius_chat_messages" as any).insert({
      id: msg.id, project_id: id, user_id: user.id, role: msg.role, content: msg.content,
    });
  }, [id, user]);

  // ─── AI CHAT MODE: Unified pipeline via cirius-ai-chat ───
  // Supports commands: build (PRD→Orchestrator), fix, improve, refine, chat
  // Routes through: OpenRouter (Claude) → Brainchain → AI Gateway
  const sendAiChat = useCallback(async (msg: string) => {
    if (!msg.trim() || !id || !user) return;

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: msg, timestamp: Date.now() };
    setChatMessages(prev => [...prev, userMsg]);
    persistMsg(userMsg);
    setChatLoading(true);
    setStreamingText("");
    setUpdatedFiles([]);
    addTerminalLine(`➜ ${msg.slice(0, 80)}${msg.length > 80 ? "..." : ""}`, "cmd");

    try {
      await supabase.from("cirius_chat_messages" as any).upsert({
        id: userMsg.id, project_id: id, user_id: user.id, role: "user", content: msg,
      });

      const historyMsgs = chatMessages.slice(-20).map(m => ({ role: m.role, content: m.content }));
      historyMsgs.push({ role: "user", content: msg });

      addTerminalLine("Enviando para Cirius AI (Claude Direct)...", "system");

      // Brain-First: always JSON (no streaming needed — Brain mines .md internally)
      const { data, error } = await supabase.functions.invoke("cirius-ai-chat", {
        body: { messages: historyMsgs, project_id: id, stream: false },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Erro no Cirius Brain");
      }

      const summaryContent = String(data?.content || "Resposta recebida.");
      const providerUsed = data?.provider || "unknown";

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: summaryContent,
        timestamp: Date.now(),
      };
      setChatMessages(prev => [...prev, assistantMsg]);

      addTerminalLine(`Provedor: ${providerUsed}`, "info");

      const filesUpdated = data?.files_updated || 0;
      if (filesUpdated > 0 && data?.raw_content) {
        const newFiles = extractFileBlocks(data.raw_content);
        if (Object.keys(newFiles).length > 0) {
          const fileNames = Object.keys(newFiles);
          setUpdatedFiles(fileNames);
          const merged = mergeFileMaps(sourceFilesRef.current, newFiles);
          setSourceFiles(merged);
          sourceFilesRef.current = merged;
          setPreviewHtml(buildPreviewFromFiles(merged));
          setProject((prev: any) => ({ ...prev, source_files_json: merged }));
          await supabase.from("cirius_projects" as any).update({ source_files_json: merged }).eq("id", id);
          addTerminalLine(`${filesUpdated} arquivo(s) atualizado(s): ${fileNames.join(", ")}`, "success");
          addToast(`✅ ${filesUpdated} arquivo(s) atualizado(s)`, "success");
        }
      } else if (filesUpdated > 0) {
        // Files were updated server-side, reload
        await loadProject();
        addToast(`✅ ${filesUpdated} arquivo(s) atualizado(s)`, "success");
      } else {
        addTerminalLine("Resposta recebida (sem alterações de arquivo)", "info");
      }

      if (data?.command_type === "build" && data?.orchestrator) {
        addTerminalLine(`Pipeline: ${data.pipeline?.task_count || 0} tarefas disparadas`, "system");
        const bubbleId = `orch_${Date.now()}`;
        setBubbles(prev => [...prev, {
          id: bubbleId,
          title: `Pipeline (${data.pipeline?.task_count || 0} tasks)`,
          phase: "running",
          steps: [{ s: "run", t: "Tarefas em execução via Claude..." }],
          pct: 25,
          startTime: Date.now(),
        }]);
        addToast(`🚀 Pipeline: ${data.pipeline?.task_count || 0} tarefas em execução`, "success");
        setTimeout(() => setBubbles(prev => prev.filter(b => b.id !== bubbleId)), 120000);
      }
    } catch (e) {
      const errText = e instanceof Error ? e.message : "Erro";
      const errMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: `❌ ${errText}`, timestamp: Date.now() };
      setChatMessages(prev => [...prev, errMsg]);
      setStreamingText("");
      addTerminalLine(errText, "error");
    }

    setChatLoading(false);
  }, [id, user, chatMessages, persistMsg, addToast, loadProject, addTerminalLine]);

  // ─── BUILD MODE: pipeline PRD ───
  const sendMsg = useCallback(async (msg: string) => {
    if (!msg.trim() || !id) return;
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: msg, timestamp: Date.now() };
    setChatMessages(prev => [...prev, userMsg]);
    persistMsg(userMsg);
    setChatLoading(true);

    const bubbleId = `prompt_${Date.now()}`;
    setBubbles(prev => [...prev, { id: bubbleId, title: msg.length > 36 ? msg.slice(0, 36) + "..." : msg, phase: "running", steps: [{ s: "run", t: "Gerando blueprint..." }], pct: 20, startTime: Date.now() }]);

    try {
      const { data, error } = await supabase.functions.invoke("cirius-generate", {
        body: { action: "build_prompt", project_id: id, prompt: msg.trim() },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Falha na geração");

      if (data?.status === "awaiting_approval" && data?.prd_json) {
        const prdMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: `Blueprint gerado com ${data.task_count} tarefa(s).`, timestamp: Date.now(), prdData: data.prd_json };
        setChatMessages(prev => [...prev, prdMsg]);
        persistMsg({ ...prdMsg, content: JSON.stringify({ prd: true, ...data.prd_json }) });
        setBubbles(prev => prev.map(b => b.id === bubbleId ? { ...b, phase: "done", pct: 100, steps: [{ s: "done", t: `Blueprint (${data.task_count} tasks)` }] } : b));
        addToast("Blueprint pronto", "success");
      } else {
        const tc = data?.task_count || 0;
        const aiMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: `✅ Pipeline iniciado com ${tc} tarefa(s).`, timestamp: Date.now() };
        setChatMessages(prev => [...prev, aiMsg]);
        persistMsg(aiMsg);
        setBubbles(prev => prev.map(b => b.id === bubbleId ? { ...b, phase: "done", pct: 100, steps: [{ s: "done", t: `Pipeline (${tc} tasks)` }] } : b));
        addToast("Pipeline iniciado", "success");
      }
      await loadProject();
      setTimeout(() => setBubbles(prev => prev.filter(b => b.id !== bubbleId)), 4000);
    } catch (e) {
      const errText = e instanceof Error ? e.message : "Erro";
      const errMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: `❌ ${errText}`, timestamp: Date.now() };
      setChatMessages(prev => [...prev, errMsg]);
      persistMsg(errMsg);
      setBubbles(prev => prev.map(b => b.id === bubbleId ? { ...b, phase: "error", pct: 100, steps: [{ s: "wait", t: errText }] } : b));
    }
    setChatLoading(false);
  }, [id, loadProject, addToast, persistMsg]);

  // ─── Approve PRD ───
  const approvePrd = useCallback(async (_prd: any) => {
    if (!id) return;
    setApprovingPrd(true);
    const bubbleId = `approve_${Date.now()}`;
    setBubbles(prev => [...prev, { id: bubbleId, title: "Iniciando construção...", phase: "running" as const, steps: [{ s: "run" as const, t: "Aprovando PRD..." }], pct: 30, startTime: Date.now() }]);

    try {
      const { data, error } = await supabase.functions.invoke("cirius-generate", { body: { action: "approve_prd", project_id: id } });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Falha ao aprovar");

      setChatMessages(prev => {
        const prdMsgIdx = [...prev].reverse().findIndex(m => m.prdData);
        if (prdMsgIdx >= 0) setApprovedPrdId(prev[prev.length - 1 - prdMsgIdx].id);
        return prev;
      });

      const aiMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: `🚀 Construção iniciada! ${data?.task_count || 0} tarefas em paralelo.`, timestamp: Date.now() };
      setChatMessages(prev => [...prev, aiMsg]);
      persistMsg(aiMsg);
      setBubbles(prev => prev.map(b => b.id === bubbleId ? { ...b, phase: "done" as const, pct: 100, steps: [{ s: "done" as const, t: `${data?.task_count || 0} tarefas disparadas` }] } : b));
      addToast("Pipeline Claude em execução!", "success");
      await loadProject();
      setTimeout(() => setBubbles(prev => prev.filter(b => b.id !== bubbleId)), 4000);
    } catch (e) {
      const errText = e instanceof Error ? e.message : "Erro";
      setBubbles(prev => prev.map(b => b.id === bubbleId ? { ...b, phase: "error" as const, pct: 100, steps: [{ s: "wait" as const, t: errText }] } : b));
    }
    setApprovingPrd(false);
  }, [id, loadProject, addToast, persistMsg]);

  const removeBubble = useCallback((bubbleId: string) => {
    setBubbles(prev => prev.filter(b => b.id !== bubbleId));
  }, []);

  const handleDownload = useCallback(async () => {
    const files = sourceFilesRef.current;
    if (!files || Object.keys(files).length === 0) {
      addToast("Nenhum arquivo para download", "info");
      return;
    }
    try {
      await downloadProjectAsZip(files, project?.name || "projeto");
      addToast("Download iniciado!", "success");
    } catch (e) {
      addToast("Erro ao gerar ZIP", "info");
    }
  }, [project, addToast]);

  const sendChatMsg = useCallback(async (msg: string) => {
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: msg, timestamp: Date.now() };
    setChatMessages(prev => [...prev, userMsg]);
    persistMsg(userMsg);
    setChatLoading(true);
    try {
      const history = chatMessages.slice(-10).map(m => ({ role: m.role === "assistant" ? "ai" : "user", content: m.content }));
      const contextPrefix = project?.name ? `[Projeto: ${project.name}] ` : "";
      const { data } = await supabase.functions.invoke("gemini-chat", { body: { message: contextPrefix + msg, history } });
      const reply = data?.reply || data?.response || data?.text || "Desculpe, não consegui processar.";
      const aiMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: reply, timestamp: Date.now() };
      setChatMessages(prev => [...prev, aiMsg]);
      persistMsg(aiMsg);
    } catch {
      const errMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: "Erro ao processar.", timestamp: Date.now() };
      setChatMessages(prev => [...prev, errMsg]);
      persistMsg(errMsg);
    }
    setChatLoading(false);
  }, [project, chatMessages, persistMsg]);

  if (!user) { navigate("/login"); return null; }
  if (loading || adminLoading) return <div className="ce-root" />;

  // Block non-admins
  if (!isAdmin) {
    return (
      <div className="ce-root" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", maxWidth: 420, padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚀</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--ts)", marginBottom: 8 }}>Em breve!</h2>
          <p style={{ fontSize: 14, color: "var(--tt)", lineHeight: 1.6 }}>
            Seu novo criador de vibecoding favorito!<br />
            Estamos finalizando os últimos detalhes para trazer a melhor experiência.
          </p>
          <button className="gl md primary" onClick={() => navigate("/home")} style={{ marginTop: 16 }}>
            Voltar ao início
          </button>
        </div>
      </div>
    );
  }

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
        onSendChat={chatMode === "ai-chat" ? sendAiChat : sendChatMsg}
        onEditorModeChange={setEditorMode}
        isLive={isLive}
        toasts={toasts}
        onApprovePrd={approvePrd}
        approvingPrd={approvingPrd}
        approvedPrdId={approvedPrdId}
        chatMode={chatMode}
        onChatModeChange={setChatMode}
        sourceFiles={sourceFiles}
        buildStages={buildStages}
        buildProgress={buildProgress}
        buildComplete={buildComplete}
        buildError={buildError}
        deployUrls={deployUrls}
        bubbles={bubbles}
        onRemoveBubble={removeBubble}
        streamingText={streamingText}
        updatedFiles={updatedFiles}
        terminalLines={terminalLines}
        onClearTerminal={clearTerminal}
        onDownload={handleDownload}
        onChatSend={sendChatMsg}
        onAttach={() => addToast("Anexar: em breve", "info")}
        onVoice={() => addToast("Voz: em breve", "info")}
        onDraw={() => addToast("Desenho: em breve", "info")}
        onReview={() => { setActiveMode("debug"); addToast("Review mode ativo", "info"); }}
        queueCount={queueCount}
        onClearQueue={() => setQueueCount(0)}
      />
    );
  }

  // ─── FULL MODE ───
  return (
    <div className="ce-root dark">
      <PreviewArea frameMode={frameMode} previewHtml={previewHtml} livePreviewUrl={livePreviewUrl} />

      <div className="ce-top-bar">
        <IslandLeft projectName={projectName} onDomainClick={() => setDomainVisible(prev => !prev)} onSeoClick={() => toggleDrawer("seo")} editorMode={editorMode} onEditorModeChange={setEditorMode} />
        <IslandCenter frameMode={frameMode} onFrameChange={setFrameMode} />
        <IslandRight isLive={isLive} onHistoryClick={() => addToast("Histórico de versões", "info")} onBuildClick={() => toggleDrawer("build")} onFilesClick={() => toggleDrawer("files")} onDeployClick={() => toggleDrawer("deploy")} onPublishClick={() => toggleDrawer("deploy")} />
      </div>

      {domainVisible && (
        <DomainIsland
          initialDomain={project?.custom_domain || ""}
          onClose={() => setDomainVisible(false)}
          onSave={async (domain) => {
            if (!id) return;
            const { error } = await supabase.from("cirius_projects" as any).update({ custom_domain: domain || null }).eq("id", id);
            if (error) addToast("Erro ao salvar domínio", "info");
            else { setProject((prev: any) => ({ ...prev, custom_domain: domain || null })); addToast(`Domínio ${domain || "removido"} salvo`, "success"); setDomainVisible(false); }
          }}
        />
      )}

      <BottomIsland
        modesOpen={modesOpen} setModesOpen={setModesOpen} activeMode={activeMode} setActiveMode={setActiveMode}
        queueCount={queueCount} onClearQueue={() => setQueueCount(0)} onSend={sendMsg}
        onCmdOpen={() => setCmdOpen(true)} onChainOpen={() => toggleDrawer("chain")}
        onAttach={() => addToast("Anexar: em breve", "info")}
        onVoice={() => addToast("Voz: em breve", "info")}
        onDraw={() => addToast("Desenho: em breve", "info")}
        onReview={() => { setActiveMode("debug"); addToast("Review mode ativo", "info"); }}
      />

      {/* TaskBubbles moved inline into chat panel */}

      {cmdOpen && (
        <CmdPanel mode={cmdMode} onModeChange={setCmdMode} onClose={() => setCmdOpen(false)}
          sourceFiles={project?.source_files_json} chatMessages={chatMessages} onChatSend={sendChatMsg} chatLoading={chatLoading} />
      )}

      <DrawerDeploy visible={activeDrawers.has("deploy")} onClose={() => toggleDrawer("deploy")} project={project} onNavigateIntegrations={() => navigate("/cirius/integrations")} />
      <DrawerFiles visible={activeDrawers.has("files")} onClose={() => toggleDrawer("files")} sourceFiles={project?.source_files_json} projectGithubRepo={project?.github_repo} />
      <DrawerSEO visible={activeDrawers.has("seo")} onClose={() => toggleDrawer("seo")} projectId={id} project={project} />
      <DrawerBuild visible={activeDrawers.has("build")} onClose={() => toggleDrawer("build")} project={project} tasks={tasks} logs={logs} />
      <DrawerChain visible={activeDrawers.has("chain")} onClose={() => toggleDrawer("chain")} tasks={tasks} />

      <EditorToasts toasts={toasts} />
    </div>
  );
}
