/**
 * Client-side parser for AI responses that contain file blocks.
 * Extracts <file path="...">content</file> tags and merges into project file map.
 */

export function extractFileBlocks(response: string): Record<string, string> {
  const files: Record<string, string> = {};
  const re = /<file\s+path="([^"]+)">([\s\S]*?)<\/file>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(response)) !== null) {
    const path = m[1].trim().replace(/^\.\//, "");
    const content = m[2].replace(/^\n/, "").replace(/\s+$/, "") + "\n";
    if (path && content.trim().length > 1) files[path] = content;
  }
  // Fallback: ```lang path\ncontent```
  if (Object.keys(files).length === 0) {
    const cbRe = /```(?:\w+)?\s+((?:src|public|index|vite|tailwind|tsconfig|package)[^\n]*)\n([\s\S]*?)```/g;
    while ((m = cbRe.exec(response)) !== null) {
      const path = m[1].trim();
      const content = m[2].replace(/^\n/, "").replace(/\s+$/, "") + "\n";
      if (path.includes(".") && content.trim().length > 1) files[path] = content;
    }
  }
  return files;
}

export function mergeFileMaps(
  existing: Record<string, string>,
  incoming: Record<string, string>
): Record<string, string> {
  return { ...existing, ...incoming };
}

/** Strip <file> tags from AI response to show only the explanatory text */
export function stripFileBlocks(response: string): string {
  return response
    .replace(/<file\s+path="[^"]*">[\s\S]*?<\/file>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Build a tree structure from flat file paths for FileExplorer */
export interface FileTreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: FileTreeNode[];
}

export function buildFileTree(files: Record<string, string>): FileTreeNode[] {
  const root: FileTreeNode[] = [];
  const paths = Object.keys(files).sort();

  for (const filePath of paths) {
    const parts = filePath.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isLast = i === parts.length - 1;
      const partialPath = parts.slice(0, i + 1).join("/");

      let existing = current.find((n) => n.name === name);
      if (!existing) {
        existing = { name, path: partialPath, isDir: !isLast, children: [] };
        current.push(existing);
      }
      if (!isLast) {
        current = existing.children;
      }
    }
  }

  return root;
}
