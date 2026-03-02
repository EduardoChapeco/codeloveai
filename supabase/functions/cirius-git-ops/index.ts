/**
 * cirius-git-ops — GitHub proxy for Cirius Editor
 *
 * All Git operations go through this edge function so tokens stay server-side.
 *
 * Actions:
 *   status          → check if user has GitHub connected
 *   list_repos      → list user repos
 *   list_branches   → list branches for a repo
 *   get_tree        → get file tree for repo/branch
 *   read_file       → read a single file content
 *   write_file      → create or update a single file (commit)
 *   delete_file     → delete a file (commit)
 *   create_branch   → create a new branch from ref
 *   commit_files    → batch commit multiple files at once
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const GH = "https://api.github.com";

function gh(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "Cirius-GitOps/1.0",
  };
}

/** Resolve GitHub token for user (user integration → vault fallback) */
async function resolveToken(
  sc: ReturnType<typeof createClient>,
  userId: string,
): Promise<string | null> {
  const { data: integration } = await sc
    .from("cirius_integrations")
    .select("access_token_enc")
    .eq("user_id", userId)
    .eq("provider", "github")
    .eq("is_active", true)
    .maybeSingle();
  if (integration?.access_token_enc) return integration.access_token_enc;

  // Admin vault fallback
  const { data: vault } = await sc
    .from("api_key_vault")
    .select("api_key_encrypted")
    .eq("provider", "github")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  return vault?.api_key_encrypted || null;
}

/** Fetch helper with error handling */
async function ghFetch(
  url: string,
  token: string,
  init?: RequestInit,
): Promise<any> {
  const res = await fetch(url, {
    ...init,
    headers: { ...gh(token), ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

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

    const token = await resolveToken(sc, user.id);

    // ─── STATUS ───
    if (action === "status") {
      return json({
        connected: !!token,
        provider: "github",
      });
    }

    if (!token) {
      return json(
        { error: "no_github_token", message: "Conecte o GitHub em Integrações primeiro." },
        400,
      );
    }

    const owner = (body.owner as string) || "";
    const repo = (body.repo as string) || "";
    const branch = (body.branch as string) || "";
    const path = (body.path as string) || "";

    // ─── LIST REPOS ───
    if (action === "list_repos") {
      const page = body.page || 1;
      const data = await ghFetch(
        `${GH}/user/repos?sort=updated&per_page=30&page=${page}&type=all`,
        token,
      );
      return json({
        repos: (data as any[]).map((r: any) => ({
          full_name: r.full_name,
          name: r.name,
          owner: r.owner?.login,
          private: r.private,
          default_branch: r.default_branch,
          language: r.language,
          updated_at: r.updated_at,
          html_url: r.html_url,
        })),
      });
    }

    // ─── LIST BRANCHES ───
    if (action === "list_branches") {
      if (!owner || !repo) return json({ error: "owner and repo required" }, 400);
      const data = await ghFetch(
        `${GH}/repos/${owner}/${repo}/branches?per_page=100`,
        token,
      );
      return json({
        branches: (data as any[]).map((b: any) => ({
          name: b.name,
          sha: b.commit?.sha,
          protected: b.protected,
        })),
      });
    }

    // ─── GET TREE ───
    if (action === "get_tree") {
      if (!owner || !repo) return json({ error: "owner and repo required" }, 400);
      const ref = branch || "main";
      const data = await ghFetch(
        `${GH}/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`,
        token,
      );
      const files = ((data.tree || []) as any[])
        .filter((t: any) => t.type === "blob")
        .map((t: any) => ({
          path: t.path,
          size: t.size,
          sha: t.sha,
        }));
      return json({ files, truncated: data.truncated || false });
    }

    // ─── READ FILE ───
    if (action === "read_file") {
      if (!owner || !repo || !path) return json({ error: "owner, repo, path required" }, 400);
      const ref = branch || "main";
      const res = await fetch(
        `${GH}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${ref}`,
        { headers: { ...gh(token), Accept: "application/vnd.github.v3.raw" } },
      );
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        return json({ error: `GitHub ${res.status}: ${msg.slice(0, 200)}` }, res.status);
      }
      const content = await res.text();
      return json({ path, content, branch: ref });
    }

    // ─── WRITE FILE (single file commit) ───
    if (action === "write_file") {
      if (!owner || !repo || !path) return json({ error: "owner, repo, path required" }, 400);
      const content = body.content as string;
      const message = (body.message as string) || `Update ${path}`;
      const targetBranch = branch || "main";

      if (content === undefined || content === null) {
        return json({ error: "content required" }, 400);
      }

      // Check if file exists to get its sha
      let existingSha: string | undefined;
      try {
        const existing = await ghFetch(
          `${GH}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${targetBranch}`,
          token,
        );
        existingSha = existing.sha;
      } catch {
        // File doesn't exist, creating new
      }

      const payload: Record<string, unknown> = {
        message,
        content: btoa(unescape(encodeURIComponent(content))),
        branch: targetBranch,
      };
      if (existingSha) payload.sha = existingSha;

      const result = await ghFetch(
        `${GH}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
        token,
        { method: "PUT", body: JSON.stringify(payload) },
      );

      return json({
        path,
        sha: result.content?.sha,
        commit_sha: result.commit?.sha,
        message,
      });
    }

    // ─── DELETE FILE ───
    if (action === "delete_file") {
      if (!owner || !repo || !path) return json({ error: "owner, repo, path required" }, 400);
      const message = (body.message as string) || `Delete ${path}`;
      const targetBranch = branch || "main";

      // Get file sha
      const existing = await ghFetch(
        `${GH}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${targetBranch}`,
        token,
      );

      const result = await ghFetch(
        `${GH}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
        token,
        {
          method: "DELETE",
          body: JSON.stringify({
            message,
            sha: existing.sha,
            branch: targetBranch,
          }),
        },
      );

      return json({ deleted: path, commit_sha: result.commit?.sha });
    }

    // ─── CREATE BRANCH ───
    if (action === "create_branch") {
      if (!owner || !repo) return json({ error: "owner and repo required" }, 400);
      const newBranch = (body.new_branch as string) || "";
      const fromRef = branch || "main";
      if (!newBranch) return json({ error: "new_branch required" }, 400);

      // Get SHA of source branch
      const refData = await ghFetch(
        `${GH}/repos/${owner}/${repo}/git/ref/heads/${fromRef}`,
        token,
      );
      const sha = refData.object?.sha;
      if (!sha) return json({ error: "Could not resolve source branch" }, 400);

      const result = await ghFetch(
        `${GH}/repos/${owner}/${repo}/git/refs`,
        token,
        {
          method: "POST",
          body: JSON.stringify({ ref: `refs/heads/${newBranch}`, sha }),
        },
      );

      return json({ branch: newBranch, sha, ref: result.ref });
    }

    // ─── COMMIT FILES (batch) ───
    if (action === "commit_files") {
      if (!owner || !repo) return json({ error: "owner and repo required" }, 400);
      const files = body.files as { path: string; content: string }[];
      const message = (body.message as string) || "Batch update from Cirius";
      const targetBranch = branch || "main";

      if (!files || !Array.isArray(files) || files.length === 0) {
        return json({ error: "files array required" }, 400);
      }
      if (files.length > 50) {
        return json({ error: "Max 50 files per commit" }, 400);
      }

      // 1. Get latest commit SHA for branch
      const refData = await ghFetch(
        `${GH}/repos/${owner}/${repo}/git/ref/heads/${targetBranch}`,
        token,
      );
      const latestCommitSha = refData.object?.sha;

      // 2. Get the tree of that commit
      const commitData = await ghFetch(
        `${GH}/repos/${owner}/${repo}/git/commits/${latestCommitSha}`,
        token,
      );
      const baseTreeSha = commitData.tree?.sha;

      // 3. Create blobs for each file
      const treeEntries = await Promise.all(
        files.map(async (f) => {
          const blobRes = await ghFetch(
            `${GH}/repos/${owner}/${repo}/git/blobs`,
            token,
            {
              method: "POST",
              body: JSON.stringify({ content: f.content, encoding: "utf-8" }),
            },
          );
          return {
            path: f.path,
            mode: "100644" as const,
            type: "blob" as const,
            sha: blobRes.sha,
          };
        }),
      );

      // 4. Create new tree
      const newTree = await ghFetch(
        `${GH}/repos/${owner}/${repo}/git/trees`,
        token,
        {
          method: "POST",
          body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries }),
        },
      );

      // 5. Create commit
      const newCommit = await ghFetch(
        `${GH}/repos/${owner}/${repo}/git/commits`,
        token,
        {
          method: "POST",
          body: JSON.stringify({
            message,
            tree: newTree.sha,
            parents: [latestCommitSha],
          }),
        },
      );

      // 6. Update branch ref
      await ghFetch(
        `${GH}/repos/${owner}/${repo}/git/refs/heads/${targetBranch}`,
        token,
        {
          method: "PATCH",
          body: JSON.stringify({ sha: newCommit.sha }),
        },
      );

      return json({
        commit_sha: newCommit.sha,
        files_committed: files.length,
        branch: targetBranch,
        message,
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("[cirius-git-ops]", e);
    return json({ error: (e as Error).message || "Internal server error" }, 500);
  }
});
