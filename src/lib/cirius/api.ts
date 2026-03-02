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
};
