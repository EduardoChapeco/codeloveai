import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, FileCode, Folder, FolderOpen } from "lucide-react";
import { buildFileTree, type FileTreeNode } from "@/lib/ai-file-parser";

interface Props {
  files: Record<string, string>;
  selectedFile?: string | null;
  onSelectFile: (path: string) => void;
}

function TreeNode({ node, depth, selectedFile, onSelectFile }: {
  node: FileTreeNode; depth: number; selectedFile?: string | null; onSelectFile: (p: string) => void;
}) {
  const [open, setOpen] = useState(depth < 2);

  if (node.isDir) {
    return (
      <div>
        <button
          className="fe-row"
          style={{ paddingLeft: 8 + depth * 12 }}
          onClick={() => setOpen(!open)}
        >
          {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          {open ? <FolderOpen size={12} className="fe-icon-dir" /> : <Folder size={12} className="fe-icon-dir" />}
          <span className="fe-name">{node.name}</span>
        </button>
        {open && node.children.map((c) => (
          <TreeNode key={c.path} node={c} depth={depth + 1} selectedFile={selectedFile} onSelectFile={onSelectFile} />
        ))}
      </div>
    );
  }

  const isActive = selectedFile === node.path;
  return (
    <button
      className={`fe-row fe-file ${isActive ? "fe-active" : ""}`}
      style={{ paddingLeft: 8 + depth * 12 }}
      onClick={() => onSelectFile(node.path)}
    >
      <FileCode size={11} className="fe-icon-file" />
      <span className="fe-name">{node.name}</span>
    </button>
  );
}

export default function FileExplorer({ files, selectedFile, onSelectFile }: Props) {
  const tree = useMemo(() => buildFileTree(files), [files]);
  const fileCount = Object.keys(files).length;

  return (
    <div className="fe-panel">
      <div className="fe-header">
        <Folder size={12} />
        <span>Arquivos</span>
        <span className="fe-count">{fileCount}</span>
      </div>
      <div className="fe-tree">
        {tree.map((node) => (
          <TreeNode key={node.path} node={node} depth={0} selectedFile={selectedFile} onSelectFile={onSelectFile} />
        ))}
        {fileCount === 0 && (
          <div className="fe-empty">Nenhum arquivo ainda</div>
        )}
      </div>
    </div>
  );
}
