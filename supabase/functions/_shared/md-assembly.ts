export type LatestMessage = {
  id: string;
  role: string;
  content: string;
  is_streaming: boolean;
};

const FILE_HINT_RE = /(?:file|arquivo|path)\s*[:=]\s*([\w./-]+\.[\w.-]+)/i;
const INLINE_PATH_RE = /\b(src\/[\w./-]+|public\/[\w./-]+|supabase\/[\w./-]+|extensions?\/[\w./-]+|index\.html|package\.json|vite\.config\.[\w.-]+|tailwind\.config\.[\w.-]+|tsconfig\.[\w.-]+)\b/i;

function normalizePath(raw: string): string | null {
  const clean = raw.replace(/["'`]/g, "").replace(/^\.\//, "").trim();
  if (!clean) return null;
  if (clean.startsWith("/") || clean.includes("..") || clean.length > 180) return null;
  if (!/[a-z0-9]/i.test(clean)) return null;
  return clean;
}

function pathFromFenceInfo(info: string): string | null {
  const hint = info.match(FILE_HINT_RE)?.[1] || info.match(INLINE_PATH_RE)?.[1] || null;
  return hint ? normalizePath(hint) : null;
}

function pathFromCodeFirstLine(code: string): { path: string | null; stripped: string } {
  const lines = code.split("\n");
  const first = lines[0] || "";
  const m = first.match(/^\s*(?:\/\/|#|--|\/\*+|<!--)\s*(?:file|arquivo|path)\s*[:=]\s*([\w./-]+\.[\w.-]+)/i);
  if (!m) return { path: null, stripped: code };
  const path = normalizePath(m[1]);
  const stripped = lines.slice(1).join("\n");
  return { path, stripped };
}

function pathFromContext(md: string, fenceIndex: number): string | null {
  const context = md.slice(Math.max(0, fenceIndex - 220), fenceIndex);
  const m = context.match(/(?:^|\n)\s{0,3}(?:#{1,6}\s*(?:file|arquivo)\s*[:\-]?\s*([\w./-]+\.[\w.-]+)|([\w./-]+\.[\w.-]+)\s*$)/im);
  const raw = m?.[1] || m?.[2] || null;
  return raw ? normalizePath(raw) : null;
}

export function parseLatestMessage(rawText: string): LatestMessage | null {
  try {
    let msgText = rawText;
    if (rawText.includes("data:")) {
      const lines = rawText.split("\n").filter((l) => l.startsWith("data:"));
      if (lines.length > 0) msgText = lines[lines.length - 1].replace(/^data:\s*/, "");
    }
    const msg = JSON.parse(msgText);
    return {
      id: String(msg?.id || msg?.message_id || ""),
      role: String(msg?.role || ""),
      content: String(msg?.content || msg?.message || msg?.text || ""),
      is_streaming: !!msg?.is_streaming,
    };
  } catch {
    return null;
  }
}

export function extractMdBody(mdContent: string): string {
  const parts = mdContent.split("---");
  let body = parts.length >= 3 ? parts.slice(2).join("---").trim() : mdContent.trim();
  body = body.replace(/^```(?:markdown|md)?\s*/i, "").replace(/```\s*$/, "").trim();
  return body;
}

export function extractFilesFromMarkdown(markdown: string): Record<string, string> {
  const files: Record<string, string> = {};
  if (!markdown || markdown.length < 10) return files;

  const fenceRe = /```([^\n`]*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null = null;

  while ((match = fenceRe.exec(markdown)) !== null) {
    const info = (match[1] || "").trim();
    let code = match[2] || "";

    let path = pathFromFenceInfo(info);

    if (!path) {
      const firstLine = pathFromCodeFirstLine(code);
      path = firstLine.path;
      code = firstLine.stripped;
    }

    if (!path) path = pathFromContext(markdown, match.index);
    if (!path) continue;

    const normalizedContent = code.replace(/^\n+/, "").replace(/\s+$/, "") + "\n";
    if (normalizedContent.trim().length < 2) continue;
    files[path] = normalizedContent;
  }

  return files;
}

export function mergeFileMaps(base: Record<string, string>, patch: Record<string, string>): Record<string, string> {
  return { ...base, ...patch };
}

export function buildFilesFingerprint(files: Record<string, string>): string {
  return Object.entries(files)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, content]) => `${path}:${content.length}`)
    .join("|");
}
