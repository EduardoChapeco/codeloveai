/**
 * Client-side parser for AI responses that contain file blocks.
 * Extracts <file path="...">content</file> tags and merges into project file map.
 * Includes SMART MERGE utilities for App.tsx routes, package.json deps, and CSS.
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

      const inlineMatch = info.match(INLINE_PATH_RE);
      if (inlineMatch) path = inlineMatch[1].replace(/^\.\//, "").trim();

      if (!path) {
        const langPathMatch = info.match(/^(?:tsx?|jsx?|css|html?|json|md|yaml|toml|sh)\s+([\w./-]+\.[\w.-]+)/i);
        if (langPathMatch) path = langPathMatch[1].replace(/^\.\//, "").trim();
      }

      if (!path) {
        const lines = code.split("\n");
        const firstLineMatch = lines[0]?.match(CODE_FIRST_LINE_RE);
        if (firstLineMatch) {
          path = firstLineMatch[1].replace(/^\.\//, "").trim();
          code = lines.slice(1).join("\n");
        }
      }

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

// ═══════════════════════════════════════════════════════════════
// SMART MERGE UTILITIES
// ═══════════════════════════════════════════════════════════════

/**
 * Extract all <Route> elements from a React Router App.tsx file.
 */
function extractRoutes(appContent: string): string[] {
  const routeRe = /<Route\s+[^>]*\/?\s*>/g;
  const routes: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = routeRe.exec(appContent)) !== null) {
    routes.push(m[0]);
  }
  return routes;
}

/**
 * Extract the path attribute from a <Route> tag.
 */
function getRoutePath(routeTag: string): string | null {
  const m = routeTag.match(/path=["']([^"']+)["']/);
  return m ? m[1] : null;
}

/**
 * Merge App.tsx routes: keeps existing routes and adds new ones without duplication.
 * If the new App.tsx has routes not in the old one, they are added.
 * If a route exists in both, the new version wins.
 */
export function mergeAppRoutes(existingApp: string, newApp: string): string {
  const existingRoutes = extractRoutes(existingApp);
  const newRoutes = extractRoutes(newApp);

  if (newRoutes.length === 0) return existingApp; // No routes in new — keep existing
  if (existingRoutes.length === 0) return newApp; // No routes in existing — use new

  // Extract existing import statements
  const existingImports = new Set<string>();
  const importRe = /^import\s+.*from\s+['"]([^'"]+)['"]/gm;
  let im: RegExpExecArray | null;
  while ((im = importRe.exec(existingApp)) !== null) {
    existingImports.add(im[0]);
  }

  // Extract new import statements
  const newImports: string[] = [];
  while ((im = importRe.exec(newApp)) !== null) {
    if (!existingImports.has(im[0])) {
      newImports.push(im[0]);
    }
  }

  // Build set of existing route paths
  const existingPaths = new Set(existingRoutes.map(getRoutePath).filter(Boolean));

  // Find routes in new that don't exist in old
  const newOnlyRoutes = newRoutes.filter(r => {
    const path = getRoutePath(r);
    return path && !existingPaths.has(path);
  });

  if (newOnlyRoutes.length === 0 && newImports.length === 0) {
    return newApp; // All routes already exist, use new version entirely
  }

  // Use new App.tsx as base (it should have all its own routes),
  // and inject any missing routes from old
  const oldOnlyRoutes = existingRoutes.filter(r => {
    const path = getRoutePath(r);
    const newPaths = new Set(newRoutes.map(getRoutePath).filter(Boolean));
    return path && !newPaths.has(path);
  });

  if (oldOnlyRoutes.length === 0) return newApp;

  // Insert old-only routes into new App's <Routes> block
  const routesBlockEnd = newApp.lastIndexOf("</Routes>");
  if (routesBlockEnd === -1) return newApp;

  const routeLines = oldOnlyRoutes.map(r => `          ${r}`).join("\n");
  const merged = newApp.slice(0, routesBlockEnd) +
    `\n          {/* Preserved routes */}\n${routeLines}\n        ` +
    newApp.slice(routesBlockEnd);

  // Add missing imports at the top
  if (newImports.length > 0) {
    const firstImportIdx = merged.indexOf("import ");
    if (firstImportIdx >= 0) {
      return merged.slice(0, firstImportIdx) + newImports.join("\n") + "\n" + merged.slice(firstImportIdx);
    }
  }

  return merged;
}

/**
 * Merge package.json: combines dependencies from both versions.
 * New version's dependencies take priority for version conflicts.
 */
export function mergePackageJson(existingPkg: string, newPkg: string): string {
  try {
    const existing = JSON.parse(existingPkg);
    const incoming = JSON.parse(newPkg);

    // Merge dependencies
    const merged = { ...incoming };
    merged.dependencies = { ...(existing.dependencies || {}), ...(incoming.dependencies || {}) };
    merged.devDependencies = { ...(existing.devDependencies || {}), ...(incoming.devDependencies || {}) };

    // Keep scripts from new but preserve custom scripts from old
    merged.scripts = { ...(existing.scripts || {}), ...(incoming.scripts || {}) };

    return JSON.stringify(merged, null, 2) + "\n";
  } catch {
    // If parsing fails, use new version
    return newPkg;
  }
}

/**
 * Merge index.css: appends new custom CSS rules that don't exist in the old version.
 * Always keeps @tailwind directives and :root/:dark theme variables.
 */
export function mergeCss(existingCss: string, newCss: string): string {
  // If existing is minimal (just tailwind directives), use new
  if (existingCss.trim().split("\n").length < 10) return newCss;
  // If new is minimal, keep existing
  if (newCss.trim().split("\n").length < 10) return existingCss;

  // Extract CSS custom property blocks from both
  const extractVarBlock = (css: string, selector: string): string | null => {
    const re = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]+)\\}`, 'g');
    const m = re.exec(css);
    return m ? m[1] : null;
  };

  // Merge :root vars
  const existingRoot = extractVarBlock(existingCss, ":root");
  const newRoot = extractVarBlock(newCss, ":root");

  let result = newCss;

  // If existing has custom vars not in new, append them
  if (existingRoot && newRoot) {
    const existingVars = existingRoot.match(/--[\w-]+:\s*[^;]+;/g) || [];
    const newVarNames = new Set((newRoot.match(/--[\w-]+/g) || []));
    const missingVars = existingVars.filter(v => {
      const name = v.match(/--[\w-]+/)?.[0];
      return name && !newVarNames.has(name);
    });

    if (missingVars.length > 0) {
      const rootEnd = result.indexOf(":root");
      if (rootEnd >= 0) {
        const braceEnd = result.indexOf("}", rootEnd);
        if (braceEnd >= 0) {
          result = result.slice(0, braceEnd) + "  " + missingVars.join("\n  ") + "\n" + result.slice(braceEnd);
        }
      }
    }
  }

  // Append any custom class/component rules from existing that aren't in new
  const existingClasses = existingCss.match(/\.[a-zA-Z][\w-]*\s*\{[^}]+\}/g) || [];
  const newClassNames = new Set((newCss.match(/\.([a-zA-Z][\w-]*)\s*\{/g) || []).map(s => s.replace(/\s*\{/, "")));
  const missingClasses = existingClasses.filter(cls => {
    const name = cls.match(/\.([a-zA-Z][\w-]*)/)?.[0];
    return name && !newClassNames.has(name);
  });

  if (missingClasses.length > 0) {
    result += "\n\n/* Preserved custom styles */\n" + missingClasses.join("\n\n") + "\n";
  }

  return result;
}

/**
 * Smart merge: applies intelligent merging strategy based on file type.
 * - App.tsx → route merge
 * - package.json → dependency merge
 * - index.css → CSS append merge
 * - Other files → simple overwrite (new wins)
 */
export function smartMergeFiles(
  existing: Record<string, string>,
  incoming: Record<string, string>
): Record<string, string> {
  const result = { ...existing };

  for (const [path, content] of Object.entries(incoming)) {
    const existingContent = existing[path];

    if (!existingContent) {
      // New file — just add it
      result[path] = content;
      continue;
    }

    // Smart merge based on file type
    if (path === "src/App.tsx" || path.endsWith("/App.tsx")) {
      result[path] = mergeAppRoutes(existingContent, content);
    } else if (path === "package.json") {
      result[path] = mergePackageJson(existingContent, content);
    } else if (path === "src/index.css" || path.endsWith("/index.css")) {
      result[path] = mergeCss(existingContent, content);
    } else {
      // Default: new version wins
      result[path] = content;
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
// ORIGINAL UTILITIES (unchanged)
// ═══════════════════════════════════════════════════════════════

export function mergeFileMaps(
  existing: Record<string, string>,
  incoming: Record<string, string>
): Record<string, string> {
  return smartMergeFiles(existing, incoming);
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
