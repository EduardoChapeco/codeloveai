import { useState } from "react";
import { FolderOpen, FileCode, Download } from "lucide-react";

interface Props {
  visible: boolean;
  onClose: () => void;
  sourceFiles?: Record<string, string> | null;
}

const defaultTree = [
  { folder: "src/", files: ["App.tsx", "main.tsx", "index.css"] },
  { folder: "src/components/", files: ["Hero.tsx", "Navbar.tsx", "Features.tsx"] },
  { folder: "supabase/migrations/", files: ["001_schema.sql"] },
];

export default function DrawerFiles({ visible, onClose, sourceFiles }: Props) {
  const [activeFile, setActiveFile] = useState("App.tsx");

  const tree = sourceFiles
    ? groupFilesByFolder(Object.keys(sourceFiles))
    : defaultTree;

  return (
    <div
      className={`s-drawer ${visible ? "visible" : "hidden to-right"}`}
      style={{ bottom: 88, right: 18, width: 260, maxHeight: 440 }}
    >
      <div className="sdh">
        <div className="sdh-title">
          <FolderOpen size={14} className="text-[var(--blue-l)]" /> Arquivos
        </div>
        <button className="sd-close" onClick={onClose}>✕</button>
      </div>

      <div style={{ padding: "0 8px 10px", overflowY: "auto", maxHeight: 360 }}>
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
      </div>

      <div style={{ padding: "8px 12px 12px" }}>
        <button className="gl sm" style={{ width: "100%", justifyContent: "center" }}>
          <Download size={12} /> Baixar todos
        </button>
      </div>
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
  return Object.entries(groups).map(([folder, files]) => ({ folder, files }));
}
