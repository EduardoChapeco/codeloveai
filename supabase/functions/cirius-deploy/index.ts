/**
 * Cirius Deploy v4 — Multi-platform deploy orchestrator
 * Actions: deploy_github, deploy_vercel, deploy_supabase, deploy_all, status
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function getUser(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const sc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: { user } } = await sc.auth.getUser();
  return user;
}

function adminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

const BASE = () => Deno.env.get("SUPABASE_URL")!;
const SVC = () => Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function logDeploy(
  sc: ReturnType<typeof createClient>,
  projectId: string,
  step: string,
  status: string,
  message: string,
  metadata?: Record<string, unknown>,
) {
  await sc.from("cirius_generation_log").insert({
    project_id: projectId,
    step,
    status,
    message,
    level: status === "failed" ? "error" : "info",
    ...(metadata ? { metadata } : {}),
  });
}

async function getProject(sc: ReturnType<typeof createClient>, projectId: string, userId?: string) {
  let q = sc.from("cirius_projects").select("*").eq("id", projectId);
  if (userId) q = q.eq("user_id", userId);
  const { data } = await q.single();
  return data;
}

async function getTokenFromVault(provider: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE()}/functions/v1/api-key-router`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SVC()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "get", provider }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.api_key || data?.key || data?.token || null;
  } catch {
    return null;
  }
}

async function getIntegrationToken(sc: ReturnType<typeof createClient>, userId: string, provider: string): Promise<string | null> {
  const { data } = await sc
    .from("cirius_integrations")
    .select("access_token_enc")
    .eq("user_id", userId)
    .eq("provider", provider)
    .eq("is_active", true)
    .maybeSingle();
  return data?.access_token_enc || null;
}

function normalizeRepoName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

async function sha1Hex(content: string): Promise<string> {
  const data = new TextEncoder().encode(content);
  const buf = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─────────────────────────────────────────────
// DEPLOY GITHUB
// ─────────────────────────────────────────────
async function deployGitHub(
  sc: ReturnType<typeof createClient>,
  project: Record<string, unknown>,
  config: Record<string, unknown>,
) {
  const projectId = project.id as string;
  const userId = project.user_id as string;

  await logDeploy(sc, projectId, "deploy_github", "started", "Iniciando deploy GitHub...");
  await sc.from("cirius_projects").update({ status: "deploying", current_step: "deploy_github" }).eq("id", projectId);

  // 1. Get GitHub token: config > integration > vault
  let ghToken = (config.github_token as string) || null;
  if (!ghToken) ghToken = await getIntegrationToken(sc, userId, "github");
  if (!ghToken) ghToken = await getTokenFromVault("github");
  if (!ghToken) {
    await logDeploy(sc, projectId, "deploy_github", "failed", "GitHub token not found");
    return { success: false, error: "GitHub not connected. Add token via integrations." };
  }

  // 2. Get source files
  const filesJson = (project.source_files_json || {}) as Record<string, string>;
  if (Object.keys(filesJson).length === 0) {
    await logDeploy(sc, projectId, "deploy_github", "failed", "No source files");
    return { success: false, error: "No source files to deploy" };
  }

  // 3. Repo name
  const repoName = (config.repo_name as string) || normalizeRepoName(project.name as string);
  const isPrivate = config.repo_private === true;

  try {
    // Try venus-github first for repo creation + push
    const venusRes = await fetch(`${BASE()}/functions/v1/venus-github`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SVC()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "create_and_push",
        token: ghToken,
        repo_name: repoName,
        is_private: isPrivate,
        files: filesJson,
        commit_message: `feat: Cirius initial build — ${project.name}`,
        description: `Generated by Cirius — ${(project.description as string) || ""}`,
      }),
    });

    let result: Record<string, unknown> | null = null;

    if (venusRes.ok) {
      result = await venusRes.json();
    } else {
      // Fallback: direct GitHub API
      await venusRes.text().catch(() => {});
      result = await deployGitHubDirect(ghToken, repoName, isPrivate, filesJson, project);
    }

    if (!result || result.error) {
      await logDeploy(sc, projectId, "deploy_github", "failed", String(result?.error || "Unknown error"));
      return { success: false, error: result?.error || "GitHub deploy failed" };
    }

    const repoUrl = (result.repo_url as string) || `https://github.com/${result.owner}/${repoName}`;
    const fullName = (result.full_name as string) || `${result.owner}/${repoName}`;

    await sc.from("cirius_projects").update({
      github_url: repoUrl,
      github_repo: fullName,
      github_branch: "main",
      updated_at: new Date().toISOString(),
    }).eq("id", projectId);

    await logDeploy(sc, projectId, "deploy_github", "completed", `Repo: ${repoUrl}`, {
      files_pushed: result.files_pushed || Object.keys(filesJson).length,
      repo_url: repoUrl,
    });

    return { success: true, repo_url: repoUrl, full_name: fullName, files_pushed: result.files_pushed };
  } catch (e) {
    const msg = (e as Error).message?.slice(0, 200) || "Unknown error";
    await logDeploy(sc, projectId, "deploy_github", "failed", msg);
    return { success: false, error: msg };
  }
}

async function deployGitHubDirect(
  ghToken: string,
  repoName: string,
  isPrivate: boolean,
  filesJson: Record<string, string>,
  project: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const headers = {
    Authorization: `Bearer ${ghToken}`,
    "Content-Type": "application/json",
    "User-Agent": "Cirius-Starble",
  };

  // Create or get repo
  const createRes = await fetch("https://api.github.com/user/repos", {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: repoName,
      private: isPrivate,
      auto_init: true,
      description: `Generated by Cirius — ${(project.description as string) || ""}`,
    }),
  });

  let owner: string;
  let repo: string;

  if (createRes.status === 422) {
    await createRes.text().catch(() => {});
    const userRes = await fetch("https://api.github.com/user", { headers });
    const userData = await userRes.json();
    owner = userData.login;
    repo = repoName;
    const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (!getRes.ok) {
      await getRes.text().catch(() => {});
      return { error: "Repository not found and creation failed" };
    }
    await getRes.json();
  } else if (!createRes.ok) {
    await createRes.text().catch(() => {});
    return { error: "Repository creation failed" };
  } else {
    const repoData = await createRes.json();
    owner = repoData.owner?.login;
    repo = repoData.name;
  }

  // Push files
  let pushed = 0;
  for (const [path, content] of Object.entries(filesJson)) {
    if (typeof content !== "string") continue;

    const existRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=main`,
      { headers },
    );
    let sha: string | undefined;
    if (existRes.ok) {
      const existing = await existRes.json();
      sha = existing.sha;
    } else {
      await existRes.text().catch(() => {});
    }

    const putRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({
          message: `feat: ${path}`,
          content: btoa(unescape(encodeURIComponent(content))),
          branch: "main",
          ...(sha ? { sha } : {}),
        }),
      },
    );

    if (putRes.ok) pushed++;
    else await putRes.text().catch(() => {});
  }

  return {
    owner,
    repo_url: `https://github.com/${owner}/${repo}`,
    full_name: `${owner}/${repo}`,
    files_pushed: pushed,
  };
}

// ─────────────────────────────────────────────
// DEPLOY VERCEL
// ─────────────────────────────────────────────
async function deployVercel(
  sc: ReturnType<typeof createClient>,
  project: Record<string, unknown>,
  config: Record<string, unknown>,
) {
  const projectId = project.id as string;
  const userId = project.user_id as string;

  await logDeploy(sc, projectId, "deploy_vercel", "started", "Iniciando deploy Vercel...");
  await sc.from("cirius_projects").update({ current_step: "deploy_vercel" }).eq("id", projectId);

  // 1. Get Vercel token
  let vToken = (config.vercel_token as string) || null;
  if (!vToken) vToken = await getIntegrationToken(sc, userId, "vercel");
  if (!vToken) vToken = await getTokenFromVault("vercel");
  if (!vToken) {
    await logDeploy(sc, projectId, "deploy_vercel", "failed", "Vercel token not found");
    return { success: false, error: "Vercel not connected" };
  }

  const githubRepo = project.github_repo as string | null;
  const filesJson = (project.source_files_json || {}) as Record<string, string>;
  const projectSlug = normalizeRepoName(project.name as string);

  try {
    // If GitHub repo exists, use git-based deploy
    if (githubRepo) {
      return await deployVercelFromGit(sc, projectId, vToken, projectSlug, githubRepo, config);
    }

    // Otherwise, use file upload deploy
    return await deployVercelFromFiles(sc, projectId, vToken, projectSlug, filesJson, config);
  } catch (e) {
    const msg = (e as Error).message?.slice(0, 200) || "Unknown error";
    await logDeploy(sc, projectId, "deploy_vercel", "failed", msg);
    return { success: false, error: msg };
  }
}

async function deployVercelFromGit(
  sc: ReturnType<typeof createClient>,
  projectId: string,
  vToken: string,
  projectSlug: string,
  githubRepo: string,
  config: Record<string, unknown>,
) {
  const teamId = (config.team_id as string) || undefined;
  const teamQuery = teamId ? `?teamId=${teamId}` : "";
  const vHeaders = { Authorization: `Bearer ${vToken}`, "Content-Type": "application/json" };

  // Ensure Vercel project exists
  let vercelProjectId: string | null = null;
  const cpRes = await fetch(`https://api.vercel.com/v9/projects${teamQuery}`, {
    method: "POST",
    headers: vHeaders,
    body: JSON.stringify({ name: projectSlug, framework: "vite", gitRepository: { type: "github", repo: githubRepo } }),
  });
  const cpData = await cpRes.json();
  if (cpRes.ok || cpData?.id) {
    vercelProjectId = cpData.id;
  } else if (cpRes.status === 409 || cpData?.error?.code === "project_already_exists") {
    const gpRes = await fetch(`https://api.vercel.com/v9/projects/${projectSlug}${teamQuery}`, { headers: vHeaders });
    const gpData = await gpRes.json();
    vercelProjectId = gpData?.id;
  }

  if (!vercelProjectId) {
    await logDeploy(sc, projectId, "deploy_vercel", "failed", "Could not create Vercel project");
    return { success: false, error: "Vercel project creation failed" };
  }

  // Create deployment via git source
  const deployRes = await fetch(`https://api.vercel.com/v13/deployments${teamQuery}`, {
    method: "POST",
    headers: vHeaders,
    body: JSON.stringify({
      name: projectSlug,
      project: vercelProjectId,
      gitSource: { type: "github", repo: githubRepo, ref: "main" },
      target: "production",
    }),
  });
  const deployData = await deployRes.json();

  if (!deployRes.ok) {
    const errMsg = deployData?.error?.message || JSON.stringify(deployData).slice(0, 300);
    await logDeploy(sc, projectId, "deploy_vercel", "failed", errMsg.slice(0, 200));
    return { success: false, error: errMsg };
  }

  // Poll for deployment readiness (up to 120s)
  const deploymentId = deployData.id;
  let deployUrl = deployData.url ? (deployData.url.startsWith("http") ? deployData.url : `https://${deployData.url}`) : null;
  let state = deployData.readyState || deployData.state || "BUILDING";

  for (let i = 0; i < 24 && !["READY", "ERROR", "CANCELED"].includes(state); i++) {
    await new Promise((r) => setTimeout(r, 5000));
    try {
      const statusRes = await fetch(`https://api.vercel.com/v13/deployments/${deploymentId}${teamQuery}`, { headers: vHeaders });
      if (statusRes.ok) {
        const sd = await statusRes.json();
        state = sd.readyState || sd.state || state;
        if (sd.url) deployUrl = sd.url.startsWith("http") ? sd.url : `https://${sd.url}`;
      }
    } catch { /* continue polling */ }
  }

  const aliasUrl = deployData.alias?.[0] ? `https://${deployData.alias[0]}` : `https://${projectSlug}.vercel.app`;
  const finalUrl = deployUrl || aliasUrl;

  await sc.from("cirius_projects").update({
    vercel_project_id: vercelProjectId,
    vercel_url: finalUrl,
    preview_url: finalUrl,
    updated_at: new Date().toISOString(),
  }).eq("id", projectId);

  await logDeploy(sc, projectId, "deploy_vercel", state === "READY" ? "completed" : "failed", `Deploy: ${finalUrl} (state: ${state})`, {
    deployment_id: deploymentId,
    deploy_url: finalUrl,
    state,
  });

  return { success: state === "READY", deploy_url: finalUrl, deployment_id: deploymentId, state };
}

async function deployVercelFromFiles(
  sc: ReturnType<typeof createClient>,
  projectId: string,
  vToken: string,
  projectSlug: string,
  filesJson: Record<string, string>,
  config: Record<string, unknown>,
) {
  const teamId = (config.team_id as string) || undefined;
  const teamQuery = teamId ? `?teamId=${teamId}` : "";
  const vHeaders = { Authorization: `Bearer ${vToken}`, "Content-Type": "application/json" };
  const encoder = new TextEncoder();

  // Upload files
  const fileEntries: { file: string; sha: string; size: number }[] = [];
  for (const [path, content] of Object.entries(filesJson)) {
    if (typeof content !== "string") continue;
    const sha = await sha1Hex(content);
    const size = encoder.encode(content).length;
    fileEntries.push({ file: path, sha, size });

    await fetch(`https://api.vercel.com/v2/files${teamQuery}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${vToken}`,
        "Content-Type": "application/octet-stream",
        "x-vercel-digest": sha,
        "x-vercel-size": String(size),
      },
      body: encoder.encode(content),
    }).catch(() => {});
  }

  // Create deployment
  const deployRes = await fetch(`https://api.vercel.com/v13/deployments${teamQuery}`, {
    method: "POST",
    headers: vHeaders,
    body: JSON.stringify({
      name: projectSlug,
      files: fileEntries,
      projectSettings: { framework: "vite", buildCommand: "npm run build", installCommand: "npm install", outputDirectory: "dist" },
      target: "production",
    }),
  });
  const deployData = await deployRes.json();

  if (!deployRes.ok) {
    const errMsg = deployData?.error?.message || JSON.stringify(deployData).slice(0, 300);
    await logDeploy(sc, projectId, "deploy_vercel", "failed", errMsg.slice(0, 200));
    return { success: false, error: errMsg };
  }

  const deployUrl = deployData.url ? (deployData.url.startsWith("http") ? deployData.url : `https://${deployData.url}`) : null;
  const aliasUrl = deployData.alias?.[0] ? `https://${deployData.alias[0]}` : `https://${projectSlug}.vercel.app`;
  const finalUrl = deployUrl || aliasUrl;

  await sc.from("cirius_projects").update({
    vercel_url: finalUrl,
    preview_url: finalUrl,
    updated_at: new Date().toISOString(),
  }).eq("id", projectId);

  await logDeploy(sc, projectId, "deploy_vercel", "completed", `Deploy: ${finalUrl}`, {
    deployment_id: deployData.id,
    deploy_url: finalUrl,
  });

  return { success: true, deploy_url: finalUrl, deployment_id: deployData.id };
}

// ─────────────────────────────────────────────
// DEPLOY SUPABASE
// ─────────────────────────────────────────────
async function deploySupabase(
  sc: ReturnType<typeof createClient>,
  project: Record<string, unknown>,
  _config: Record<string, unknown>,
) {
  const projectId = project.id as string;

  await logDeploy(sc, projectId, "deploy_supabase", "started", "Applying migrations...");
  await sc.from("cirius_projects").update({ current_step: "deploy_supabase" }).eq("id", projectId);

  try {
    // Extract SQL from PRD or source files
    const prdJson = project.prd_json as Record<string, unknown> | null;
    const filesJson = (project.source_files_json || {}) as Record<string, string>;

    const sqlStatements: string[] = [];

    // From PRD schema
    if (prdJson?.schema_sql) {
      sqlStatements.push(prdJson.schema_sql as string);
    }

    // From migration files in source
    for (const [path, content] of Object.entries(filesJson)) {
      if (path.startsWith("supabase/migrations/") && path.endsWith(".sql") && typeof content === "string") {
        sqlStatements.push(content);
      }
    }

    if (sqlStatements.length === 0) {
      await logDeploy(sc, projectId, "deploy_supabase", "completed", "No migrations found");
      return { success: true, migrations_applied: 0 };
    }

    // Call supabase-migrate-start
    const migrateRes = await fetch(`${BASE()}/functions/v1/supabase-migrate-start`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SVC()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "apply_sql",
        sql_statements: sqlStatements,
        project_id: projectId,
      }),
    });

    const migrateData = await migrateRes.json().catch(() => ({}));
    const applied = (migrateData as Record<string, unknown>).applied || sqlStatements.length;

    await sc.from("cirius_projects").update({
      supabase_project_id: projectId,
      updated_at: new Date().toISOString(),
    }).eq("id", projectId);

    await logDeploy(sc, projectId, "deploy_supabase", "completed", `${applied} migrations applied`, {
      migrations_count: sqlStatements.length,
    });

    return { success: true, migrations_applied: applied };
  } catch (e) {
    const msg = (e as Error).message?.slice(0, 200) || "Unknown error";
    await logDeploy(sc, projectId, "deploy_supabase", "failed", msg);
    return { success: false, error: msg };
  }
}

// ─────────────────────────────────────────────
// DEPLOY ALL
// ─────────────────────────────────────────────
async function deployAll(
  sc: ReturnType<typeof createClient>,
  project: Record<string, unknown>,
  config: Record<string, unknown>,
) {
  const projectId = project.id as string;
  await sc.from("cirius_projects").update({ status: "deploying", current_step: "deploy_all" }).eq("id", projectId);

  const results: Record<string, unknown> = {};

  // Step 1: GitHub
  const ghResult = await deployGitHub(sc, project, config);
  results.github = ghResult;

  // Refresh project data after GitHub deploy
  const updatedProject = await getProject(sc, projectId) || project;

  // Step 2: Vercel (only if GitHub succeeded)
  if (ghResult.success) {
    const vResult = await deployVercel(sc, updatedProject, config);
    results.vercel = vResult;
  } else {
    results.vercel = { success: false, error: "Skipped — GitHub deploy failed" };
  }

  // Step 3: Supabase (independent)
  const sbResult = await deploySupabase(sc, updatedProject, config);
  results.supabase = sbResult;

  // Final status
  const allSuccess = ghResult.success && (results.vercel as Record<string, unknown>)?.success !== false;
  const finalStatus = allSuccess ? "live" : "failed";

  await sc.from("cirius_projects").update({
    status: finalStatus,
    deployed_at: allSuccess ? new Date().toISOString() : undefined,
    current_step: "done",
    progress_pct: allSuccess ? 100 : undefined,
    generation_ended_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", projectId);

  await logDeploy(sc, projectId, "deploy_all", allSuccess ? "completed" : "failed", `Deploy all: ${finalStatus}`, results);

  return {
    success: allSuccess,
    status: finalStatus,
    results,
    urls: {
      github: (results.github as Record<string, unknown>)?.repo_url || null,
      vercel: (results.vercel as Record<string, unknown>)?.deploy_url || null,
    },
  };
}

// ─────────────────────────────────────────────
// STATUS
// ─────────────────────────────────────────────
async function getDeployStatus(sc: ReturnType<typeof createClient>, projectId: string) {
  const project = await getProject(sc, projectId);
  if (!project) return { success: false, error: "Project not found" };

  const { data: logs } = await sc
    .from("cirius_generation_log")
    .select("step, status, message, created_at, metadata")
    .eq("project_id", projectId)
    .like("step", "deploy_%")
    .order("created_at", { ascending: false })
    .limit(20);

  return {
    success: true,
    project_id: projectId,
    status: project.status,
    current_step: project.current_step,
    urls: {
      github: project.github_url,
      vercel: project.vercel_url,
      netlify: project.netlify_url,
      supabase: project.supabase_url,
      preview: project.preview_url,
    },
    deployed_at: project.deployed_at,
    logs: logs || [],
  };
}

// ─────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const user = await getUser(req);
  const authHeader = req.headers.get("Authorization") || "";
  const isServiceKey = authHeader === `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
  if (!user && !isServiceKey) return json({ success: false, error: "Unauthorized" }, 401);

  const sc = adminClient();
  const body = await req.json().catch(() => ({}));
  const action = (body.action as string) || "";
  const projectId = (body.project_id as string) || "";
  const config = (body.config as Record<string, unknown>) || {};

  if (!projectId) return json({ success: false, error: "project_id required" }, 400);

  // Status doesn't require ownership check for service key
  if (action === "status") {
    const result = await getDeployStatus(sc, projectId);
    return json(result);
  }

  const project = await getProject(sc, projectId, isServiceKey ? undefined : user?.id);
  if (!project) return json({ success: false, error: "Project not found" }, 404);

  let result: Record<string, unknown>;

  switch (action) {
    case "deploy_github":
      result = await deployGitHub(sc, project, config);
      break;
    case "deploy_vercel":
      result = await deployVercel(sc, project, config);
      break;
    case "deploy_supabase":
      result = await deploySupabase(sc, project, config);
      break;
    case "deploy_all":
      result = await deployAll(sc, project, config);
      break;
    // Legacy compat
    case "github":
      result = await deployGitHub(sc, project, config);
      break;
    case "vercel":
      result = await deployVercel(sc, project, config);
      break;
    case "netlify":
      result = await deployGitHub(sc, project, config); // fallback
      break;
    case "supabase":
      result = await deploySupabase(sc, project, config);
      break;
    default:
      return json({ success: false, error: "unknown_action" }, 400);
  }

  return json(result);
});
