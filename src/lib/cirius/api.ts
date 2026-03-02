import { supabase } from "@/integrations/supabase/client";

export interface GenerateParams {
  user_prompt: string;
  project_name?: string;
  source_url?: string;
  template_id?: string;
  config?: {
    deploy_github?: boolean;
    deploy_vercel?: boolean;
    create_supabase?: boolean;
  };
}

export interface DeployConfig {
  github_token?: string;
  vercel_token?: string;
  repo_name?: string;
  repo_private?: boolean;
  custom_domain?: string;
}

export interface GitFile {
  path: string;
  content: string;
}

export interface GitRepo {
  full_name: string;
  name: string;
  owner: string;
  private: boolean;
  default_branch: string;
  language: string | null;
  updated_at: string;
  html_url: string;
}

export interface GitBranch {
  name: string;
  sha: string;
  protected: boolean;
}

export interface GitTreeFile {
  path: string;
  size: number;
  sha: string;
}

const gitOps = (body: Record<string, unknown>) =>
  supabase.functions.invoke("cirius-git-ops", { body });

export const ciriusApi = {
  generate: (params: GenerateParams) =>
    supabase.functions.invoke("cirius-generate", {
      body: { action: "start", ...params },
    }),

  getStatus: (projectId: string) =>
    supabase.functions.invoke("cirius-generate", {
      body: { action: "status", project_id: projectId },
    }),

  cancel: (projectId: string) =>
    supabase.functions.invoke("cirius-generate", {
      body: { action: "cancel", project_id: projectId },
    }),

  deploy: (projectId: string, config?: DeployConfig) =>
    supabase.functions.invoke("cirius-deploy", {
      body: { action: "deploy_all", project_id: projectId, config },
    }),

  deployGithub: (projectId: string, config?: DeployConfig) =>
    supabase.functions.invoke("cirius-deploy", {
      body: { action: "deploy_github", project_id: projectId, config },
    }),

  deployVercel: (projectId: string, config?: DeployConfig) =>
    supabase.functions.invoke("cirius-deploy", {
      body: { action: "deploy_vercel", project_id: projectId, config },
    }),

  deployStatus: (projectId: string) =>
    supabase.functions.invoke("cirius-deploy", {
      body: { action: "status", project_id: projectId },
    }),

  listProjects: () =>
    supabase
      .from("cirius_projects")
      .select("*")
      .order("created_at", { ascending: false }),

  getProject: (id: string) =>
    supabase
      .from("cirius_projects")
      .select("*")
      .eq("id", id)
      .single(),

  getLogs: (projectId: string) =>
    supabase
      .from("cirius_generation_log")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(50),

  getTemplates: () =>
    supabase
      .from("cirius_templates")
      .select("*")
      .order("usage_count", { ascending: false }),

  // ─── Git Operations ───

  gitStatus: () => gitOps({ action: "status" }),

  gitListRepos: (page = 1) => gitOps({ action: "list_repos", page }),

  gitListBranches: (owner: string, repo: string) =>
    gitOps({ action: "list_branches", owner, repo }),

  gitGetTree: (owner: string, repo: string, branch?: string) =>
    gitOps({ action: "get_tree", owner, repo, branch }),

  gitReadFile: (owner: string, repo: string, path: string, branch?: string) =>
    gitOps({ action: "read_file", owner, repo, path, branch }),

  gitWriteFile: (
    owner: string,
    repo: string,
    path: string,
    content: string,
    message?: string,
    branch?: string,
  ) => gitOps({ action: "write_file", owner, repo, path, content, message, branch }),

  gitDeleteFile: (
    owner: string,
    repo: string,
    path: string,
    message?: string,
    branch?: string,
  ) => gitOps({ action: "delete_file", owner, repo, path, message, branch }),

  gitCreateBranch: (
    owner: string,
    repo: string,
    newBranch: string,
    fromBranch?: string,
  ) => gitOps({ action: "create_branch", owner, repo, new_branch: newBranch, branch: fromBranch }),

  gitCommitFiles: (
    owner: string,
    repo: string,
    files: GitFile[],
    message?: string,
    branch?: string,
  ) => gitOps({ action: "commit_files", owner, repo, files, message, branch }),
};
