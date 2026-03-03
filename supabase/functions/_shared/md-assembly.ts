export type LatestMessage = {
  id: string;
  role: string;
  content: string;
  is_streaming: boolean;
};

// ─── Path detection patterns ─────────────────────────────────
// Matches: file:path, arquivo:path, path:path, // file: path, <!-- file: path -->
const FILE_HINT_RE = /(?:file|arquivo|path)\s*[:=]\s*([\w./-]+\.[\w.-]+)/i;
const INLINE_PATH_RE = /\b(src\/[\w./-]+|public\/[\w./-]+|supabase\/[\w./-]+|extensions?\/[\w./-]+|pages\/[\w./-]+|components\/[\w./-]+|hooks\/[\w./-]+|lib\/[\w./-]+|styles\/[\w./-]+|assets\/[\w./-]+|index\.html|package\.json|vite\.config\.[\w.-]+|tailwind\.config\.[\w.-]+|tsconfig\.[\w.-]+|\.env[\w.-]*)\b/i;

// Additional patterns for code-first-line detection
const CODE_FILE_HINT_RE = /^\s*(?:\/\/|#|--|\/\*+|<!--)\s*(?:file|arquivo|path|filename)\s*[:=]?\s*([\w./-]+\.[\w.-]+)/i;

function normalizePath(raw: string): string | null {
  const clean = raw.replace(/["'`]/g, "").replace(/^\.\//, "").replace(/\s+$/, "").trim();
  if (!clean) return null;
  if (clean.startsWith("/") || clean.includes("..") || clean.length > 180) return null;
  if (!/[a-z0-9]/i.test(clean)) return null;
  // Reject obvious non-paths
  if (/^(https?:|data:|blob:)/i.test(clean)) return null;
  return clean;
}

function pathFromFenceInfo(info: string): string | null {
  // Try explicit file hint first
  const hintMatch = info.match(FILE_HINT_RE);
  if (hintMatch) return normalizePath(hintMatch[1]);

  // Try inline path detection
  const inlineMatch = info.match(INLINE_PATH_RE);
  if (inlineMatch) return normalizePath(inlineMatch[1]);

  // Try: ```tsx src/App.tsx or ```typescript src/utils.ts
  const langPathMatch = info.match(/^(?:tsx?|jsx?|css|html?|json|md|yaml|toml|sh)\s+([\w./-]+\.[\w.-]+)/i);
  if (langPathMatch) return normalizePath(langPathMatch[1]);

  return null;
}

function pathFromCodeFirstLine(code: string): { path: string | null; stripped: string } {
  const lines = code.split("\n");
  const first = lines[0] || "";
  const m = first.match(CODE_FILE_HINT_RE);
  if (!m) return { path: null, stripped: code };
  const path = normalizePath(m[1]);
  const stripped = lines.slice(1).join("\n");
  return { path, stripped };
}

function pathFromContext(md: string, fenceIndex: number): string | null {
  const context = md.slice(Math.max(0, fenceIndex - 300), fenceIndex);

  // Try heading with file path: ### src/App.tsx or ## file: src/App.tsx
  const headingMatch = context.match(/(?:^|\n)\s{0,3}(?:#{1,6}\s*(?:file|arquivo)\s*[:\-]?\s*([\w./-]+\.[\w.-]+)|([\w./-]+\.[\w.-]+)\s*$)/im);
  const headingPath = headingMatch?.[1] || headingMatch?.[2] || null;
  if (headingPath) return normalizePath(headingPath);

  // Try bold path: **src/App.tsx** or `src/App.tsx`
  const boldMatch = context.match(/(?:\*\*|`)((?:src|public|supabase|pages|components|hooks|lib|styles|assets)\/[\w./-]+\.[\w.-]+)(?:\*\*|`)\s*$/m);
  if (boldMatch) return normalizePath(boldMatch[1]);

  // Try bare inline path at end of context
  const bareMatch = context.match(/\b((?:src|public|supabase)\/[\w./-]+\.[\w.-]+)\s*[:]*\s*$/m);
  if (bareMatch) return normalizePath(bareMatch[1]);

  return null;
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

    // Skip non-code fences (e.g. ```json for PRD, ```markdown)
    const lang = info.split(/\s/)[0]?.toLowerCase() || "";
    if (lang === "markdown" || lang === "md") continue;

    let path = pathFromFenceInfo(info);

    if (!path) {
      const firstLine = pathFromCodeFirstLine(code);
      path = firstLine.path;
      if (path) code = firstLine.stripped;
    }

    if (!path) path = pathFromContext(markdown, match.index);
    if (!path) continue;

    // Strip any nested markdown code fences from content
    let cleanCode = code.replace(/^\n+/, "").replace(/\s+$/, "");
    if (/^```\w*\s*\n/.test(cleanCode)) cleanCode = cleanCode.replace(/^```\w*\s*\n/, "");
    if (/\n```\s*$/.test(cleanCode)) cleanCode = cleanCode.replace(/\n```\s*$/, "");

    const normalizedContent = cleanCode.replace(/^\n+/, "").replace(/\s+$/, "") + "\n";
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
