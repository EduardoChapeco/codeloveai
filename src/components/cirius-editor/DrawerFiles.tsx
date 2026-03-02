import { useState, useCallback } from "react";
import { FolderOpen, FileCode, Download, Loader2 } from "lucide-react";

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

/** Generate a simple zip file from a flat file map (no external deps) */
async function generateZip(files: Record<string, string>): Promise<Blob> {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const centralDir: Uint8Array[] = [];
  let offset = 0;

  const entries = Object.entries(files).filter(([, v]) => typeof v === "string");

  for (const [path, content] of entries) {
    const nameBytes = enc.encode(path);
    const dataBytes = enc.encode(content);

    // Local file header (30 + name + data)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true); // sig
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(8, 0, true); // method: store
    lv.setUint32(18, dataBytes.length, true); // compressed
    lv.setUint32(22, dataBytes.length, true); // uncompressed
    lv.setUint16(26, nameBytes.length, true);
    localHeader.set(nameBytes, 30);

    // Central directory entry
    const cdEntry = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cdEntry.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(12, 0, true);
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

  // End of central directory
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, cdOffset, true);

  return new Blob([...parts.map(p => p.buffer as ArrayBuffer), ...centralDir.map(c => c.buffer as ArrayBuffer), eocd.buffer as ArrayBuffer], { type: "application/zip" });
}

export default function DrawerFiles({ visible, onClose, sourceFiles }: Props) {
  const [activeFile, setActiveFile] = useState("");
  const [downloading, setDownloading] = useState(false);

  const tree = sourceFiles
    ? groupFilesByFolder(Object.keys(sourceFiles))
    : defaultTree;

  const fileCount = sourceFiles ? Object.keys(sourceFiles).length : 0;

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

  return (
    <div
      className={`s-drawer ${visible ? "visible" : "hidden to-right"}`}
      style={{ bottom: 88, right: 18, width: 260, maxHeight: 440 }}
    >
      <div className="sdh">
        <div className="sdh-title">
          <FolderOpen size={14} className="text-[var(--blue-l)]" /> Arquivos {fileCount > 0 && <span style={{ opacity: 0.5, fontSize: 11 }}>({fileCount})</span>}
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
        {!sourceFiles && (
          <div style={{ padding: "12px 8px", opacity: 0.5, fontSize: 12, textAlign: "center" }}>
            Arquivos serão exibidos após a geração
          </div>
        )}
      </div>

      <div style={{ padding: "8px 12px 12px" }}>
        <button
          className="gl sm"
          style={{ width: "100%", justifyContent: "center" }}
          onClick={handleDownload}
          disabled={!sourceFiles || fileCount === 0 || downloading}
        >
          {downloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
          {downloading ? "Baixando..." : "Baixar todos"}
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
  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([folder, files]) => ({ folder, files: files.sort() }));
}
