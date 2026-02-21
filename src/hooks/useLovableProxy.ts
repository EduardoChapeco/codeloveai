import { supabase } from "@/integrations/supabase/client";
import { useCallback, useState } from "react";

interface ProxyOptions {
  route: string;
  method?: string;
  payload?: any;
  action?: string;
}

interface ProxyError {
  message: string;
  status?: number;
  isTokenExpired?: boolean;
}

export function useLovableProxy() {
  const [isTokenExpired, setIsTokenExpired] = useState(false);

  const invoke = useCallback(async <T = any>(options: ProxyOptions): Promise<T> => {
    const body: Record<string, unknown> = {
      route: options.route,
      method: options.method || "GET",
    };
    if (options.payload) body.payload = options.payload;
    if (options.action) body.action = options.action;

    const { data, error } = await supabase.functions.invoke("lovable-proxy", {
      body,
    });

    if (error) {
      const proxyError: ProxyError = {
        message: error.message || "Erro na comunicação com o proxy",
      };
      throw proxyError;
    }

    // Check for error in response body
    if (data?.error) {
      const isExpired = data.error.includes("expirado") || data.error.includes("expired");
      if (isExpired) setIsTokenExpired(true);
      const proxyError: ProxyError = {
        message: data.error,
        isTokenExpired: isExpired,
      };
      throw proxyError;
    }

    return data as T;
  }, []);

  const saveToken = useCallback(async (token: string) => {
    const { data, error } = await supabase.functions.invoke("lovable-proxy", {
      body: { action: "save-token", token },
    });
    if (error) throw { message: error.message || "Erro ao salvar token" };
    if (data?.error) throw { message: data.error };
    setIsTokenExpired(false);
    return data;
  }, []);

  const deleteToken = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("lovable-proxy", {
      body: { action: "delete-token" },
    });
    if (error) throw { message: error.message || "Erro ao desconectar" };
    if (data?.error) throw { message: data.error };
    return data;
  }, []);

  const checkConnection = useCallback(async (userId: string): Promise<"active" | "expired" | "none"> => {
    const { data } = await supabase
      .from("lovable_accounts")
      .select("status")
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return "none";
    if (data.status === "active") return "active";
    return "expired";
  }, []);

  return { invoke, saveToken, deleteToken, checkConnection, isTokenExpired };
}
