import { useState, useCallback, useEffect } from "react";
import {
  FolderOpen, FileCode, Download, Loader2, GitBranch, GitCommit,
  RefreshCw, Plus, Trash2, Save, ArrowLeft, ChevronRight, AlertCircle,
} from "lucide-react";
import { ciriusApi } from "@/lib/cirius/api";
import type { GitRepo, GitBranch as GitBranchType, GitTreeFile } from "@/lib/cirius/api";
import { toast } from "sonner";

interface Props {
  visible: boolean;
  onClose: () => void;
  sourceFiles?: Record<string, string> | null;
  projectGithubRepo?: string | null; // "owner/repo"
}

// ─── Local Zip generator (no deps) ───
async function generateZip(files: Record<string, string>): Promise<Blob> {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const centralDir: Uint8Array[] = [];
  let offset = 0;
  const entries = Object.entries(files).filter(([, v]) => typeof v === "string");

  for (const [path, content] of entries) {
    const nameBytes = enc.encode(path);
    const dataBytes = enc.encode(content);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(8, 0, true);
    lv.setUint32(18, dataBytes.length, true);
    lv.setUint32(22, dataBytes.length, true);
    lv.setUint16(26, nameBytes.length, true);
    localHeader.set(nameBytes, 30);

    const cdEntry = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cdEntry.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint32(20, dataBytes.length, true);
    cv.setUint32(24, dataBytes.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    cdEntry.set(nameBytes, 46);

    parts.push(localHeader, dataBytes);
    centralDir.push(cdEntry);
    offset += localHeader.length + dataBytes.length;
  }

  const cdOffset = offset;
  let cdSize = 0;
  for (const cd of centralDir) cdSize += cd.length;
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, cdOffset, true);

  return new Blob(
    [...parts.map((p) => p.buffer as ArrayBuffer), ...centralDir.map((c) => c.buffer as ArrayBuffer), eocd.buffer as ArrayBuffer],
    { type: "application/zip" },
  );
}

type View = "local" | "repos" | "remote" | "editor";

export default function DrawerFiles({ visible, onClose, sourceFiles, projectGithubRepo }: Props) {
  // ─── Local view state ───
  const [activeFile, setActiveFile] = useState("");
  const [downloading, setDownloading] = useState(false);

  // ─── Git state ───
  const [view, setView] = useState<View>("local");
  const [gitConnected, setGitConnected] = useState<boolean | null>(null);
  const [loadingGit, setLoadingGit] = useState(false);

  // Repos
  const [repos, setRepos] = useState<GitRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<{ owner: string; repo: string } | null>(null);

  // Branches
  const [branches, setBranches] = useState<GitBranchType[]>([]);
  const [activeBranch, setActiveBranch] = useState("main");
  const [showNewBranch, setShowNewBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");

  // Remote tree
  const [remoteFiles, setRemoteFiles] = useState<GitTreeFile[]>([]);

  // File editor
  const [editingFile, setEditingFile] = useState<{ path: string; content: string; original: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [commitMsg, setCommitMsg] = useState("");

  // ─── Batch commit (push local → GitHub) ───
  const [pushing, setPushing] = useState(false);

  const tree = sourceFiles ? groupFilesByFolder(Object.keys(sourceFiles)) : [];
  const fileCount = sourceFiles ? Object.keys(sourceFiles).length : 0;

  // Check git status on mount
  useEffect(() => {
    if (!visible) return;
    ciriusApi.gitStatus().then(({ data }) => {
      setGitConnected(data?.connected ?? false);
      if (projectGithubRepo) {
        const [o, r] = projectGithubRepo.split("/");
        if (o && r) setSelectedRepo({ owner: o, repo: r });
      }
    });
  }, [visible, projectGithubRepo]);

  // Load repos
  const loadRepos = useCallback(async () => {
    setLoadingGit(true);
    const { data, error } = await ciriusApi.gitListRepos();
    if (error || data?.error) {
      toast.error(data?.message || "Falha ao listar repos");
    } else {
      setRepos(data?.repos || []);
    }
    setLoadingGit(false);
  }, []);

  // Load branches
  const loadBranches = useCallback(async () => {
    if (!selectedRepo) return;
    setLoadingGit(true);
    const { data } = await ciriusApi.gitListBranches(selectedRepo.owner, selectedRepo.repo);
    setBranches(data?.branches || []);
    setLoadingGit(false);
  }, [selectedRepo]);

  // Load remote tree
  const loadTree = useCallback(async () => {
    if (!selectedRepo) return;
    setLoadingGit(true);
    const { data } = await ciriusApi.gitGetTree(selectedRepo.owner, selectedRepo.repo, activeBranch);
    setRemoteFiles(data?.files || []);
    setLoadingGit(false);
  }, [selectedRepo, activeBranch]);

  // On repo select → load branches + tree
  useEffect(() => {
    if (selectedRepo && view === "remote") {
      loadBranches();
      loadTree();
    }
  }, [selectedRepo, view, loadBranches, loadTree]);

  // Open file for editing
  const openRemoteFile = useCallback(async (filePath: string) => {
    if (!selectedRepo) return;
    setLoadingGit(true);
    const { data } = await ciriusApi.gitReadFile(selectedRepo.owner, selectedRepo.repo, filePath, activeBranch);
    if (data?.content !== undefined) {
      setEditingFile({ path: filePath, content: data.content, original: data.content });
      setCommitMsg(`Update ${filePath}`);
      setView("editor");
    } else {
      toast.error("Não foi possível ler o arquivo");
    }
    setLoadingGit(false);
  }, [selectedRepo, activeBranch]);

  // Save file (commit)
  const saveFile = useCallback(async () => {
    if (!selectedRepo || !editingFile) return;
    setSaving(true);
    const { data, error } = await ciriusApi.gitWriteFile(
      selectedRepo.owner,
      selectedRepo.repo,
      editingFile.path,
      editingFile.content,
      commitMsg || `Update ${editingFile.path}`,
      activeBranch,
    );
    if (error || data?.error) {
      toast.error(data?.error || "Erro ao salvar");
    } else {
      toast.success(`Commit: ${data?.commit_sha?.slice(0, 7)}`);
      setEditingFile((prev) => prev ? { ...prev, original: prev.content } : null);
    }
    setSaving(false);
  }, [selectedRepo, editingFile, commitMsg, activeBranch]);

  // Create branch
  const createBranch = useCallback(async () => {
    if (!selectedRepo || !newBranchName.trim()) return;
    setLoadingGit(true);
    const { data, error } = await ciriusApi.gitCreateBranch(
      selectedRepo.owner,
      selectedRepo.repo,
      newBranchName.trim(),
      activeBranch,
    );
    if (error || data?.error) {
      toast.error(data?.error || "Erro ao criar branch");
    } else {
      toast.success(`Branch "${newBranchName}" criada`);
      setActiveBranch(newBranchName.trim());
      setNewBranchName("");
      setShowNewBranch(false);
      await loadBranches();
    }
    setLoadingGit(false);
  }, [selectedRepo, newBranchName, activeBranch, loadBranches]);

  // Push all local files to GitHub
  const pushLocalToGit = useCallback(async () => {
    if (!selectedRepo || !sourceFiles) return;
    const files = Object.entries(sourceFiles)
      .filter(([, v]) => typeof v === "string" && v.length > 0)
      .map(([path, content]) => ({ path, content }));
    if (files.length === 0) return;
    if (files.length > 50) {
      toast.error("Máximo 50 arquivos por commit. Reduza os arquivos.");
      return;
    }

    setPushing(true);
    const { data, error } = await ciriusApi.gitCommitFiles(
      selectedRepo.owner,
      selectedRepo.repo,
      files,
      `Cirius push: ${files.length} arquivo(s)`,
      activeBranch,
    );
    if (error || data?.error) {
      toast.error(data?.error || "Erro ao fazer push");
    } else {
      toast.success(`Push: ${data?.commit_sha?.slice(0, 7)} (${data?.files_committed} arquivos)`);
    }
    setPushing(false);
  }, [selectedRepo, sourceFiles, activeBranch]);

  // Download zip
  const handleDownload = useCallback(async () => {
    if (!sourceFiles || Object.keys(sourceFiles).length === 0) return;
    setDownloading(true);
    try {
      const blob = await generateZip(sourceFiles);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "project-source.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Download failed:", e);
    }
    setDownloading(false);
  }, [sourceFiles]);

  const remoteTree = groupFilesByFolder(remoteFiles.map((f) => f.path));

  return (
    <div
      className={`s-drawer ${visible ? "visible" : "hidden to-right"}`}
      style={{ bottom: 88, right: 18, width: 320, maxHeight: 520 }}
    >
      {/* Header */}
      <div className="sdh">
        <div className="sdh-title">
          {view !== "local" && view !== "repos" ? (
            <button
              className="sd-close mr-1"
              onClick={() => setView(view === "editor" ? "remote" : "local")}
              title="Voltar"
            >
              <ArrowLeft size={12} />
            </button>
          ) : null}
          <FolderOpen size={14} className="text-[var(--blue-l)]" />
          {view === "local" && <>Arquivos {fileCount > 0 && <span style={{ opacity: 0.5, fontSize: 11 }}>({fileCount})</span>}</>}
          {view === "repos" && "GitHub Repos"}
          {view === "remote" && (
            <span className="truncate text-xs">
              {selectedRepo?.owner}/{selectedRepo?.repo}
            </span>
          )}
          {view === "editor" && (
            <span className="truncate text-xs">{editingFile?.path}</span>
          )}
        </div>
        <button className="sd-close" onClick={onClose}>✕</button>
      </div>

      {/* ─── LOCAL VIEW ─── */}
      {view === "local" && (
        <>
          {/* Git status bar */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 text-xs">
            {gitConnected === null ? (
              <Loader2 size={12} className="animate-spin text-muted-foreground" />
            ) : gitConnected ? (
              <>
                <GitBranch size={12} className="text-green-400" />
                <span className="text-green-400">GitHub conectado</span>
                <button
                  className="ml-auto text-[10px] px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-muted-foreground"
                  onClick={() => { setView("repos"); loadRepos(); }}
                >
                  Repos
                </button>
                {selectedRepo && (
                  <button
                    className="text-[10px] px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-muted-foreground"
                    onClick={() => setView("remote")}
                  >
                    Remoto
                  </button>
                )}
              </>
            ) : (
              <>
                <AlertCircle size={12} className="text-yellow-400" />
                <span className="text-yellow-400">GitHub não conectado</span>
              </>
            )}
          </div>

          <div style={{ padding: "0 8px 10px", overflowY: "auto", maxHeight: 320 }}>
            {tree.map((group) => (
              <div key={group.folder}>
                <div className="fld">{group.folder}</div>
                {group.files.map((f) => (
                  <div
                    key={f}
                    className={`fi-row ${activeFile === f ? "on" : ""}`}
                    onClick={() => setActiveFile(f)}
                  >
                    <FileCode size={12} />
                    {f}
                  </div>
                ))}
              </div>
            ))}
            {!sourceFiles && (
              <div style={{ padding: "12px 8px", opacity: 0.5, fontSize: 12, textAlign: "center" }}>
                Arquivos serão exibidos após a geração
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 px-3 pb-3">
            {gitConnected && selectedRepo && sourceFiles && fileCount > 0 && (
              <button
                className="gl sm w-full justify-center"
                onClick={pushLocalToGit}
                disabled={pushing}
              >
                {pushing ? <Loader2 size={12} className="animate-spin" /> : <GitCommit size={12} />}
                {pushing ? "Enviando..." : `Push ${fileCount} arquivo(s) → GitHub`}
              </button>
            )}
            <button
              className="gl sm w-full justify-center"
              onClick={handleDownload}
              disabled={!sourceFiles || fileCount === 0 || downloading}
            >
              {downloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              {downloading ? "Baixando..." : "Baixar .zip"}
            </button>
          </div>
        </>
      )}

      {/* ─── REPOS VIEW ─── */}
      {view === "repos" && (
        <div style={{ overflowY: "auto", maxHeight: 420 }}>
          <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
            <button className="sd-close" onClick={() => setView("local")}>
              <ArrowLeft size={12} />
            </button>
            <span className="text-xs text-muted-foreground flex-1">Selecione um repositório</span>
            <button onClick={loadRepos} disabled={loadingGit} className="text-muted-foreground hover:text-foreground">
              <RefreshCw size={12} className={loadingGit ? "animate-spin" : ""} />
            </button>
          </div>
          {loadingGit && repos.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={16} className="animate-spin text-muted-foreground" />
            </div>
          ) : (
            repos.map((r) => (
              <button
                key={r.full_name}
                className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center gap-2 text-xs border-b border-white/[0.03]"
                onClick={() => {
                  setSelectedRepo({ owner: r.owner, repo: r.name });
                  setActiveBranch(r.default_branch || "main");
                  setView("remote");
                }}
              >
                <GitBranch size={12} className="text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{r.full_name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {r.language || "—"} · {r.private ? "Privado" : "Público"}
                  </div>
                </div>
                <ChevronRight size={12} className="text-muted-foreground shrink-0" />
              </button>
            ))
          )}
        </div>
      )}

      {/* ─── REMOTE VIEW ─── */}
      {view === "remote" && selectedRepo && (
        <>
          {/* Branch selector */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 text-xs">
            <GitBranch size={12} className="text-muted-foreground" />
            <select
              className="bg-transparent text-foreground text-xs flex-1 outline-none cursor-pointer"
              value={activeBranch}
              onChange={(e) => setActiveBranch(e.target.value)}
            >
              {branches.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name} {b.protected ? "🔒" : ""}
                </option>
              ))}
            </select>
            <button onClick={() => setShowNewBranch((p) => !p)} className="text-muted-foreground hover:text-foreground">
              <Plus size={12} />
            </button>
            <button onClick={loadTree} disabled={loadingGit} className="text-muted-foreground hover:text-foreground">
              <RefreshCw size={12} className={loadingGit ? "animate-spin" : ""} />
            </button>
          </div>

          {showNewBranch && (
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
              <input
                className="flex-1 bg-white/5 rounded px-2 py-1 text-xs text-foreground outline-none"
                placeholder="Nova branch..."
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createBranch()}
              />
              <button
                className="text-[10px] px-2 py-1 rounded bg-primary/20 text-primary hover:bg-primary/30"
                onClick={createBranch}
                disabled={loadingGit || !newBranchName.trim()}
              >
                Criar
              </button>
            </div>
          )}

          <div style={{ overflowY: "auto", maxHeight: 340, padding: "0 8px 10px" }}>
            {loadingGit && remoteFiles.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={16} className="animate-spin text-muted-foreground" />
              </div>
            ) : (
              remoteTree.map((group) => (
                <div key={group.folder}>
                  <div className="fld">{group.folder}</div>
                  {group.files.map((f) => {
                    const fullPath = group.folder === "/" ? f : `${group.folder}${f}`;
                    return (
                      <div
                        key={f}
                        className="fi-row cursor-pointer"
                        onClick={() => openRemoteFile(fullPath)}
                      >
                        <FileCode size={12} />
                        {f}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          <div className="px-3 pb-3">
            {sourceFiles && fileCount > 0 && (
              <button
                className="gl sm w-full justify-center"
                onClick={pushLocalToGit}
                disabled={pushing}
              >
                {pushing ? <Loader2 size={12} className="animate-spin" /> : <GitCommit size={12} />}
                {pushing ? "Enviando..." : `Push local → ${activeBranch}`}
              </button>
            )}
          </div>
        </>
      )}

      {/* ─── EDITOR VIEW ─── */}
      {view === "editor" && editingFile && (
        <>
          <div className="px-3 py-2 border-b border-white/5 text-[10px] text-muted-foreground">
            {selectedRepo?.owner}/{selectedRepo?.repo} · {activeBranch}
          </div>
          <textarea
            className="w-full flex-1 bg-black/30 text-foreground text-xs font-mono p-3 outline-none resize-none"
            style={{ minHeight: 260, maxHeight: 340 }}
            value={editingFile.content}
            onChange={(e) => setEditingFile((prev) => prev ? { ...prev, content: e.target.value } : null)}
            spellCheck={false}
          />
          <div className="px-3 py-2 space-y-2 border-t border-white/5">
            <input
              className="w-full bg-white/5 rounded px-2 py-1 text-xs text-foreground outline-none"
              placeholder="Mensagem do commit..."
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                className="gl sm flex-1 justify-center"
                onClick={saveFile}
                disabled={saving || editingFile.content === editingFile.original}
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                {saving ? "Commitando..." : "Commit & Push"}
              </button>
              <button
                className="gl sm justify-center text-red-400"
                onClick={() => {
                  setEditingFile(null);
                  setView("remote");
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function groupFilesByFolder(paths: string[]): { folder: string; files: string[] }[] {
  const groups: Record<string, string[]> = {};
  paths.forEach((p) => {
    const parts = p.split("/");
    const file = parts.pop() || p;
    const folder = parts.length ? parts.join("/") + "/" : "/";
    if (!groups[folder]) groups[folder] = [];
    groups[folder].push(file);
  });
  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([folder, files]) => ({ folder, files: files.sort() }));
}
