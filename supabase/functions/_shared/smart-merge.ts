/**
 * Server-side smart merge utilities for Cirius pipeline.
 * Mirrors the logic in src/lib/ai-file-parser.ts for use in Edge Functions.
 */

/**
 * Extract route paths from App.tsx content
 */
function extractRoutePaths(content: string): Map<string, string> {
  const routes = new Map<string, string>();
  const re = /<Route\s+[^>]*path=["']([^"']+)["'][^>]*\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    routes.set(m[1], m[0]);
  }
  return routes;
}

/**
 * Merge App.tsx: preserves existing routes and adds new ones
 */
export function mergeAppRoutes(existing: string, incoming: string): string {
  const existingRoutes = extractRoutePaths(existing);
  const incomingRoutes = extractRoutePaths(incoming);

  if (incomingRoutes.size === 0) return existing;
  if (existingRoutes.size === 0) return incoming;

  // Find routes in existing that are missing from incoming
  const missingRoutes: string[] = [];
  for (const [path, tag] of existingRoutes) {
    if (!incomingRoutes.has(path)) {
      missingRoutes.push(tag);
    }
  }

  if (missingRoutes.length === 0) return incoming;

  // Preserve missing import statements from existing
  const existingImports = new Set<string>();
  const importRe = /^import\s+.*from\s+['"][^'"]+['"]\s*;?\s*$/gm;
  let im: RegExpExecArray | null;
  while ((im = importRe.exec(existing)) !== null) {
    existingImports.add(im[0].trim());
  }
  const incomingImportSet = new Set<string>();
  while ((im = importRe.exec(incoming)) !== null) {
    incomingImportSet.add(im[0].trim());
  }
  const missingImports = [...existingImports].filter(i => !incomingImportSet.has(i));

  // Insert missing routes before </Routes>
  const closeTag = incoming.lastIndexOf("</Routes>");
  if (closeTag === -1) return incoming;

  const routeBlock = missingRoutes.map(r => `          ${r}`).join("\n");
  let result = incoming.slice(0, closeTag) +
    `\n          {/* Auto-preserved routes */}\n${routeBlock}\n        ` +
    incoming.slice(closeTag);

  // Add missing imports at the top
  if (missingImports.length > 0) {
    const firstImport = result.indexOf("import ");
    if (firstImport >= 0) {
      result = result.slice(0, firstImport) + missingImports.join("\n") + "\n" + result.slice(firstImport);
    }
  }

  return result;
}

/**
 * Merge package.json: combines dependencies
 */
export function mergePackageJson(existing: string, incoming: string): string {
  try {
    const e = JSON.parse(existing);
    const n = JSON.parse(incoming);
    const merged = { ...n };
    merged.dependencies = { ...(e.dependencies || {}), ...(n.dependencies || {}) };
    merged.devDependencies = { ...(e.devDependencies || {}), ...(n.devDependencies || {}) };
    merged.scripts = { ...(e.scripts || {}), ...(n.scripts || {}) };
    return JSON.stringify(merged, null, 2) + "\n";
  } catch {
    return incoming;
  }
}

/**
 * Merge CSS: appends missing custom properties and rules
 */
export function mergeCss(existing: string, incoming: string): string {
  if (existing.trim().split("\n").length < 10) return incoming;
  if (incoming.trim().split("\n").length < 10) return existing;

  // Extract custom properties from existing
  const existingVars = existing.match(/--[\w-]+:\s*[^;]+;/g) || [];
  const incomingVarNames = new Set((incoming.match(/--[\w-]+/g) || []));
  const missingVars = existingVars.filter(v => {
    const name = v.match(/--[\w-]+/)?.[0];
    return name && !incomingVarNames.has(name);
  });

  let result = incoming;
  if (missingVars.length > 0) {
    const rootIdx = result.indexOf(":root");
    if (rootIdx >= 0) {
      const braceEnd = result.indexOf("}", rootIdx);
      if (braceEnd >= 0) {
        result = result.slice(0, braceEnd) + "  " + missingVars.join("\n  ") + "\n" + result.slice(braceEnd);
      }
    }
  }

  return result;
}

/**
 * Smart merge for all file types
 */
export function smartMergeFiles(
  existing: Record<string, string>,
  incoming: Record<string, string>,
): Record<string, string> {
  const result = { ...existing };

  for (const [path, content] of Object.entries(incoming)) {
    const old = existing[path];
    if (!old) {
      result[path] = content;
      continue;
    }

    if (path === "src/App.tsx" || path.endsWith("/App.tsx")) {
      result[path] = mergeAppRoutes(old, content);
    } else if (path === "package.json") {
      result[path] = mergePackageJson(old, content);
    } else if (path.endsWith("index.css")) {
      result[path] = mergeCss(old, content);
    } else {
      result[path] = content;
    }
  }

  return result;
}
