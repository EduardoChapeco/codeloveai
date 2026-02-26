import { supabase } from "@/integrations/supabase/client";
import { useCallback, useState } from "react";

interface ProxyOptions {
  route: string;
  method?: string;
  payload?: unknown;
  action?: string;
}

interface ProxyError {
  message: string;
  status?: number;
  isTokenExpired?: boolean;
}

export function useLovableProxy() {
  const [isTokenExpired, setIsTokenExpired] = useState(false);

  const getAuthHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {};
  }, []);

  const invoke = useCallback(async <T = unknown>(options: ProxyOptions): Promise<T> => {
    const body: Record<string, unknown> = {
      route: options.route,
      method: options.method || "GET",
    };
    if (options.payload) body.payload = options.payload;
    if (options.action) body.action = options.action;

    const headers = await getAuthHeaders();
    const { data, error } = await supabase.functions.invoke("lovable-proxy", {
      body,
      headers,
    });

    if (error || (data as { error?: string })?.error) {
      const realMessage = (data as { error?: string })?.error || error?.message || "Erro na comunicação com o proxy";
      const isExpired = realMessage.includes("expirado") || realMessage.includes("expired");
      if (isExpired) setIsTokenExpired(true);
      const proxyError: ProxyError = { message: realMessage, isTokenExpired: isExpired };
      throw proxyError;
    }

    return data as T;
  }, [getAuthHeaders]);

  const saveToken = useCallback(async (token: string, refreshToken?: string | null) => {
    const headers = await getAuthHeaders();
    const { data, error } = await supabase.functions.invoke("lovable-proxy", {
      body: { action: "save-token", token, ...(refreshToken ? { refreshToken } : {}) },
      headers,
    });
    if (error || (data as { error?: string })?.error) throw { message: (data as { error?: string })?.error || error?.message || "Erro ao salvar token" };
    setIsTokenExpired(false);
    return data;
  }, [getAuthHeaders]);

  const deleteToken = useCallback(async () => {
    const headers = await getAuthHeaders();
    const { data, error } = await supabase.functions.invoke("lovable-proxy", {
      body: { action: "delete-token" },
      headers,
    });
    if (error || (data as { error?: string })?.error) throw { message: (data as { error?: string })?.error || error?.message || "Erro ao desconectar" };
    return data;
  }, [getAuthHeaders]);

  const refreshToken = useCallback(async () => {
    const headers = await getAuthHeaders();
    const { data, error } = await supabase.functions.invoke("lovable-proxy", {
      body: { action: "refresh-token" },
      headers,
    });
    if (error || (data as { error?: string })?.error) throw { message: (data as { error?: string })?.error || error?.message || "Erro ao renovar token" };
    setIsTokenExpired(false);
    return data;
  }, [getAuthHeaders]);

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

  return { invoke, saveToken, deleteToken, refreshToken, checkConnection, isTokenExpired };
}
