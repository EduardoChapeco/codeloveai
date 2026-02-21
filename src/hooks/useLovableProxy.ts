import { supabase } from "@/integrations/supabase/client";
import { useCallback } from "react";

interface ProxyOptions {
  route: string;
  method?: string;
  payload?: any;
  action?: string;
}

export function useLovableProxy() {
  const invoke = useCallback(async (options: ProxyOptions) => {
    const body: any = {
      route: options.route,
      method: options.method || "GET",
    };
    if (options.payload) body.payload = options.payload;
    if (options.action) body.action = options.action;

    const { data, error } = await supabase.functions.invoke("lovable-proxy", {
      body,
    });

    if (error) throw error;
    return data;
  }, []);

  const saveToken = useCallback(async (token: string) => {
    const { data, error } = await supabase.functions.invoke("lovable-proxy", {
      body: { action: "save-token", token },
    });
    if (error) throw error;
    return data;
  }, []);

  const deleteToken = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("lovable-proxy", {
      body: { action: "delete-token" },
    });
    if (error) throw error;
    return data;
  }, []);

  return { invoke, saveToken, deleteToken };
}
