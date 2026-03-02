/**
 * Client-side parser for AI responses that contain file blocks.
 * Extracts <file path="...">content</file> tags and merges into project file map.
 */

export function extractFileBlocks(response: string): Record<string, string> {
  const files: Record<string, string> = {};

  // 1. Try <file path="...">content</file> tags
  const re = /<file\s+path="([^"]+)">([\s\S]*?)<\/file>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(response)) !== null) {
    const path = m[1].trim().replace(/^\.\//, "");
    const content = m[2].replace(/^\n/, "").replace(/\s+$/, "") + "\n";
    if (path && content.trim().length > 1) files[path] = content;
  }

  // 2. Fallback: ```lang path\ncontent``` (gateway format)
  if (Object.keys(files).length === 0) {
    const cbRe = /```(?:\w+)?\s+((?:src|public|index|vite|tailwind|tsconfig|package)[^\n]*)\n([\s\S]*?)```/g;
    while ((m = cbRe.exec(response)) !== null) {
      const path = m[1].trim();
      const content = m[2].replace(/^\n/, "").replace(/\s+$/, "") + "\n";
      if (path.includes(".") && content.trim().length > 1) files[path] = content;
    }
  }

  // 3. Fallback: Brain .md format — code fences with path hints in context
  if (Object.keys(files).length === 0) {
    const INLINE_PATH_RE = /\b(src\/[\w./-]+|public\/[\w./-]+|supabase\/[\w./-]+|index\.html|package\.json|vite\.config\.[\w.-]+|tailwind\.config\.[\w.-]+|tsconfig\.[\w.-]+)\b/i;
    const CODE_FIRST_LINE_RE = /^\s*(?:\/\/|#|--|\/\*+|<!--)\s*(?:file|arquivo|path|filename)\s*[:=]?\s*([\w./-]+\.[\w.-]+)/i;
    const fenceRe = /```([^\n`]*)\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;

    while ((match = fenceRe.exec(response)) !== null) {
      const info = (match[1] || "").trim();
      let code = match[2] || "";
      const lang = info.split(/\s/)[0]?.toLowerCase() || "";
      if (lang === "markdown" || lang === "md") continue;

      let path: string | null = null;

      // Try path from fence info line
      const inlineMatch = info.match(INLINE_PATH_RE);
      if (inlineMatch) path = inlineMatch[1].replace(/^\.\//, "").trim();

      // Try lang + path: ```tsx src/App.tsx
      if (!path) {
        const langPathMatch = info.match(/^(?:tsx?|jsx?|css|html?|json|md|yaml|toml|sh)\s+([\w./-]+\.[\w.-]+)/i);
        if (langPathMatch) path = langPathMatch[1].replace(/^\.\//, "").trim();
      }

      // Try first line comment hint: // file: src/App.tsx
      if (!path) {
        const lines = code.split("\n");
        const firstLineMatch = lines[0]?.match(CODE_FIRST_LINE_RE);
        if (firstLineMatch) {
          path = firstLineMatch[1].replace(/^\.\//, "").trim();
          code = lines.slice(1).join("\n");
        }
      }

      // Try context before fence for path hints
      if (!path) {
        const ctx = response.slice(Math.max(0, match.index - 300), match.index);
        const boldMatch = ctx.match(/(?:\*\*|`)((?:src|public|supabase)\/[\w./-]+\.[\w.-]+)(?:\*\*|`)\s*$/m);
        if (boldMatch) path = boldMatch[1].replace(/^\.\//, "").trim();
        if (!path) {
          const bareMatch = ctx.match(/\b((?:src|public|supabase)\/[\w./-]+\.[\w.-]+)\s*[:]*\s*$/m);
          if (bareMatch) path = bareMatch[1].replace(/^\.\//, "").trim();
        }
      }

      if (!path) continue;
      const normalizedContent = code.replace(/^\n+/, "").replace(/\s+$/, "") + "\n";
      if (normalizedContent.trim().length < 2) continue;
      files[path] = normalizedContent;
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
