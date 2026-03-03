import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, FileCode, Folder, FolderOpen, CheckCircle2 } from "lucide-react";
import { buildFileTree, type FileTreeNode } from "@/lib/ai-file-parser";

interface Props {
  files: Record<string, string>;
  selectedFile?: string | null;
  onSelectFile: (path: string) => void;
  updatedFiles?: string[];
}

function isAncestorOf(dirPath: string, filePath: string): boolean {
  return filePath.startsWith(dirPath + "/");
}

function hasUpdatedChild(node: FileTreeNode, updatedSet: Set<string>): boolean {
  if (!node.isDir) return updatedSet.has(node.path);
  return node.children.some(c => hasUpdatedChild(c, updatedSet));
}

function TreeNode({ node, depth, selectedFile, onSelectFile, updatedSet }: {
  node: FileTreeNode; depth: number; selectedFile?: string | null; onSelectFile: (p: string) => void; updatedSet: Set<string>;
}) {
  const [open, setOpen] = useState(depth < 2);
  const isMined = node.isDir ? hasUpdatedChild(node, updatedSet) : updatedSet.has(node.path);

  if (node.isDir) {
    return (
      <div>
        <button
          className={`fe-row ${isMined ? "fe-mined" : ""}`}
          style={{ paddingLeft: 8 + depth * 12 }}
          onClick={() => setOpen(!open)}
        >
          {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          {open ? <FolderOpen size={12} className="fe-icon-dir" /> : <Folder size={12} className="fe-icon-dir" />}
          <span className="fe-name">{node.name}</span>
          {isMined && <CheckCircle2 size={10} className="fe-check" />}
        </button>
        {open && node.children.map((c) => (
          <TreeNode key={c.path} node={c} depth={depth + 1} selectedFile={selectedFile} onSelectFile={onSelectFile} updatedSet={updatedSet} />
        ))}
      </div>
    );
  }

  const isActive = selectedFile === node.path;
  return (
    <button
      className={`fe-row fe-file ${isActive ? "fe-active" : ""} ${isMined ? "fe-mined" : ""}`}
      style={{ paddingLeft: 8 + depth * 12 }}
      onClick={() => onSelectFile(node.path)}
    >
      <FileCode size={11} className="fe-icon-file" />
      <span className="fe-name">{node.name}</span>
      {isMined && <CheckCircle2 size={10} className="fe-check" />}
    </button>
  );
}

export default function FileExplorer({ files, selectedFile, onSelectFile, updatedFiles = [] }: Props) {
  const tree = useMemo(() => buildFileTree(files), [files]);
  const fileCount = Object.keys(files).length;
  const updatedSet = useMemo(() => new Set(updatedFiles), [updatedFiles]);

  return (
    <div className="fe-panel">
      <div className="fe-header">
        <Folder size={12} />
        <span>Arquivos</span>
        <span className="fe-count">{fileCount}</span>
        {updatedFiles.length > 0 && (
          <span className="fe-mined-count">{updatedFiles.length} novo(s)</span>
        )}
      </div>
      <div className="fe-tree">
        {tree.map((node) => (
          <TreeNode key={node.path} node={node} depth={0} selectedFile={selectedFile} onSelectFile={onSelectFile} updatedSet={updatedSet} />
        ))}
        {fileCount === 0 && (
          <div className="fe-empty">Nenhum arquivo ainda</div>
        )}
      </div>
    </div>
  );
}
