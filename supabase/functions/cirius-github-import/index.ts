/**
 * cirius-github-import — Import a GitHub repo into a Cirius project
 *
 * Fetches the file tree from a public GitHub repo (or private with user's GitHub token)
 * and creates a cirius_project with source_files_json populated.
 *
 * Actions:
 *  - list_repos: List user's GitHub repos (requires integration)
 *  - import: Import a repo by owner/repo into a new cirius project
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const GITHUB_API = "https://api.github.com";

// File extensions to import (web project files)
const IMPORTABLE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".css", ".html", ".json", ".md",
  ".svg", ".toml", ".yml", ".yaml", ".env.example", ".gitignore",
  ".mjs", ".cjs", ".vue", ".svelte", ".astro", ".graphql", ".gql",
  ".prisma", ".sql", ".sh", ".txt", ".xml",
]);

// Folders to skip
const SKIP_FOLDERS = new Set([
  "node_modules", ".git", "dist", "build", ".next", ".nuxt",
  ".svelte-kit", "coverage", ".turbo", ".vercel", "__pycache__",
  ".cache", ".output", "vendor",
]);

// Max file size in bytes (100KB)
const MAX_FILE_SIZE = 100_000;
// Max total files
const MAX_FILES = 200;

function shouldImportFile(path: string): boolean {
  // Skip hidden folders (except .env.example etc)
  const parts = path.split("/");
  for (const part of parts.slice(0, -1)) {
    if (SKIP_FOLDERS.has(part)) return false;
  }
  const fileName = parts[parts.length - 1];
  // Skip lock files
  if (fileName === "package-lock.json" || fileName === "bun.lockb" || fileName === "yarn.lock" || fileName === "pnpm-lock.yaml") return false;
  // Check extension
  const dotIdx = fileName.lastIndexOf(".");
  if (dotIdx < 0) {
    // Files without extension: Dockerfile, Makefile, Procfile etc
    return ["Dockerfile", "Makefile", "Procfile", "Caddyfile"].includes(fileName);
  }
  const ext = fileName.slice(dotIdx).toLowerCase();
  return IMPORTABLE_EXTENSIONS.has(ext);
}

async function getGitHubToken(sc: ReturnType<typeof createClient>, userId: string): Promise<string | null> {
  // Check cirius_integrations for GitHub token
  const { data: integration } = await sc
    .from("cirius_integrations")
    .select("access_token_enc")
    .eq("user_id", userId)
    .eq("provider", "github")
    .eq("is_active", true)
    .maybeSingle();

  if (integration?.access_token_enc) return integration.access_token_enc;

  // Check api_key_vault for admin GitHub PAT
  const { data: vault } = await sc
    .from("api_key_vault")
    .select("api_key_encrypted")
    .eq("provider", "github")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  return vault?.api_key_encrypted || null;
}

function ghHeaders(token?: string | null): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "Cirius-Import/1.0",
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/** Recursively fetch repo tree */
async function fetchRepoTree(
  owner: string,
  repo: string,
  branch: string,
  token?: string | null
): Promise<{ path: string; size: number; sha: string }[]> {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  const res = await fetch(url, { headers: ghHeaders(token) });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub tree API: ${res.status} — ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  if (!data.tree) throw new Error("No tree in response");

  return (data.tree as any[])
    .filter((item: any) => item.type === "blob" && shouldImportFile(item.path) && (item.size || 0) <= MAX_FILE_SIZE)
    .slice(0, MAX_FILES)
    .map((item: any) => ({ path: item.path, size: item.size || 0, sha: item.sha }));
}

/** Fetch file content from GitHub */
async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  branch: string,
  token?: string | null
): Promise<string | null> {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`;
  const res = await fetch(url, {
    headers: { ...ghHeaders(token), Accept: "application/vnd.github.v3.raw" },
  });
  if (!res.ok) return null;
  return res.text();
}

/** Get default branch */
async function getDefaultBranch(owner: string, repo: string, token?: string | null): Promise<string> {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, { headers: ghHeaders(token) });
  if (!res.ok) throw new Error(`Repo not found: ${res.status}`);
  const data = await res.json();
  return data.default_branch || "main";
}

/** List user repos */
async function listUserRepos(token: string): Promise<any[]> {
  const res = await fetch(`${GITHUB_API}/user/repos?sort=updated&per_page=30&type=all`, {
    headers: ghHeaders(token),
  });
  if (!res.ok) throw new Error(`GitHub repos: ${res.status}`);
  const repos = await res.json();
  return (repos as any[]).map((r: any) => ({
    full_name: r.full_name,
    name: r.name,
    owner: r.owner?.login,
    description: r.description,
    language: r.language,
    private: r.private,
    default_branch: r.default_branch,
    updated_at: r.updated_at,
    html_url: r.html_url,
    stargazers_count: r.stargazers_count,
  }));
}

/** Parse owner/repo from various GitHub URL formats */
function parseGitHubUrl(input: string): { owner: string; repo: string } | null {
  // Try URL format: https://github.com/owner/repo
  const urlMatch = input.match(/github\.com\/([^\/]+)\/([^\/\s#?]+)/);
  if (urlMatch) return { owner: urlMatch[1], repo: urlMatch[2].replace(/\.git$/, "") };
  // Try owner/repo format
  const slashMatch = input.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (slashMatch) return { owner: slashMatch[1], repo: slashMatch[2] };
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const sc = createClient(supabaseUrl, serviceKey);
  const anonSc = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
  });

  try {
    const { data: { user } } = await anonSc.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const action = body.action as string;

    // ─── LIST REPOS ───────────────────────────────
    if (action === "list_repos") {
      const token = await getGitHubToken(sc, user.id);
      if (!token) return json({ error: "no_github_token", message: "Conecte o GitHub nas integrações primeiro" }, 400);
      const repos = await listUserRepos(token);
      return json({ repos });
    }

    // ─── IMPORT ───────────────────────────────────
    if (action === "import") {
      const repoInput = (body.repo as string || "").trim();
      const projectName = (body.name as string || "").trim();
      const branch = (body.branch as string || "").trim();

      if (!repoInput) return json({ error: "repo is required (owner/repo or GitHub URL)" }, 400);

      const parsed = parseGitHubUrl(repoInput);
      if (!parsed) return json({ error: "Invalid format. Use owner/repo or a GitHub URL" }, 400);

      const { owner, repo } = parsed;
      const token = await getGitHubToken(sc, user.id);

      // Get default branch
      const targetBranch = branch || await getDefaultBranch(owner, repo, token);

      // Fetch tree
      const tree = await fetchRepoTree(owner, repo, targetBranch, token);
      if (tree.length === 0) return json({ error: "No importable files found in repository" }, 400);

      // Fetch file contents in batches (10 concurrent)
      const sourceFiles: Record<string, string> = {};
      const batchSize = 10;

      for (let i = 0; i < tree.length; i += batchSize) {
        const batch = tree.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map(async (f) => {
            const content = await fetchFileContent(owner, repo, f.path, targetBranch, token);
            if (content !== null) sourceFiles[f.path] = content;
          })
        );
      }

      // Detect tech stack
      const hasPackageJson = "package.json" in sourceFiles;
      const hasTsConfig = "tsconfig.json" in sourceFiles;
      const hasViteConfig = Object.keys(sourceFiles).some(k => k.includes("vite.config"));
      const hasNextConfig = Object.keys(sourceFiles).some(k => k.includes("next.config"));

      const techStack: Record<string, unknown> = {};
      if (hasPackageJson) {
        try {
          const pkg = JSON.parse(sourceFiles["package.json"]);
          techStack.dependencies = Object.keys(pkg.dependencies || {});
          techStack.devDependencies = Object.keys(pkg.devDependencies || {});
          techStack.name = pkg.name;
        } catch { /* ignore */ }
      }
      if (hasTsConfig) techStack.typescript = true;
      if (hasViteConfig) techStack.bundler = "vite";
      if (hasNextConfig) techStack.framework = "nextjs";

      // Create cirius project
      const finalName = projectName || `${repo} (import)`;
      const { data: project, error: projErr } = await sc
        .from("cirius_projects")
        .insert({
          user_id: user.id,
          name: finalName,
          description: `Imported from github.com/${owner}/${repo} (${targetBranch})`,
          status: "live",
          source_url: `https://github.com/${owner}/${repo}`,
          source_files_json: sourceFiles,
          github_repo: `${owner}/${repo}`,
          github_branch: targetBranch,
          github_url: `https://github.com/${owner}/${repo}`,
          tech_stack: techStack,
          template_type: "custom",
          progress_pct: 100,
          generation_engine: "github_import",
        })
        .select("id")
        .single();

      if (projErr) return json({ error: "Failed to create project", details: projErr.message }, 500);

      // Create initial snapshot
      await sc.from("code_snapshots").insert({
        project_id: project.id,
        files_json: sourceFiles,
        file_count: Object.keys(sourceFiles).length,
        phase: 0,
      });

      return json({
        project_id: project.id,
        name: finalName,
        files_imported: Object.keys(sourceFiles).length,
        files_skipped: tree.length - Object.keys(sourceFiles).length,
        branch: targetBranch,
        tech_stack: techStack,
      });
    }

    return json({ error: "Unknown action. Use list_repos or import" }, 400);
  } catch (e) {
    console.error("[cirius-github-import]", e);
    return json({ error: (e as Error).message }, 500);
  }
});
