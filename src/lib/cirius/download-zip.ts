import JSZip from "jszip";

/**
 * Generate a ZIP file from source_files_json and trigger browser download.
 */
export async function downloadProjectAsZip(
  files: Record<string, string>,
  projectName: string,
): Promise<void> {
  if (!files || Object.keys(files).length === 0) {
    throw new Error("No files to download");
  }

  const zip = new JSZip();
  const folderName = projectName
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "project";

  const root = zip.folder(folderName)!;

  for (const [path, content] of Object.entries(files)) {
    root.file(path, content);
  }

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${folderName}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
