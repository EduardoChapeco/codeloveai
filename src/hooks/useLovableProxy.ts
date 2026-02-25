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

  const invoke = useCallback(async <T = unknown>(options: ProxyOptions): Promise<T> => {
    const body: Record<string, unknown> = {
      route: options.route,
      method: options.method || "GET",
    };
    if (options.payload) body.payload = options.payload;
    if (options.action) body.action = options.action;

    const { data, error } = await supabase.functions.invoke("lovable-proxy", {
      body,
    });

    // When the Edge Function returns a non-2xx status, supabase-js puts the
    // parsed response body in `data` and sets a generic `error.message`.
    // We read the real message from `data.error` (set by lovable-proxy).
    if (error) {
      const realMessage = (data as { error?: string })?.error || error.message || "Erro na comunicação com o proxy";
      const isExpired = realMessage.includes("expirado") || realMessage.includes("expired");
      if (isExpired) setIsTokenExpired(true);
      const proxyError: ProxyError = {
        message: realMessage,
        isTokenExpired: isExpired,
      };
      throw proxyError;
    }

    // Check for error in response body (Edge Function returned 200 but with error field)
    if ((data as { error?: string })?.error) {
      const msg = (data as { error: string }).error;
      const isExpired = msg.includes("expirado") || msg.includes("expired");
      if (isExpired) setIsTokenExpired(true);
      const proxyError: ProxyError = {
        message: msg,
        isTokenExpired: isExpired,
      };
      throw proxyError;
    }

    return data as T;
  }, []);

  const saveToken = useCallback(async (token: string, refreshToken?: string | null) => {
    const { data, error } = await supabase.functions.invoke("lovable-proxy", {
      body: { action: "save-token", token, ...(refreshToken ? { refreshToken } : {}) },
    });
    if (error) throw { message: error.message || "Erro ao salvar token" };
    if ((data as { error?: string })?.error) throw { message: (data as { error: string }).error };
    setIsTokenExpired(false);
    return data;
  }, []);

  const deleteToken = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("lovable-proxy", {
      body: { action: "delete-token" },
    });
    if (error) throw { message: error.message || "Erro ao desconectar" };
    if ((data as { error?: string })?.error) throw { message: (data as { error: string }).error };
    return data;
  }, []);

  /** Trigger a server-side Firebase token refresh using the stored refreshToken */
  const refreshToken = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("lovable-proxy", {
      body: { action: "refresh-token" },
    });
    if (error) throw { message: error.message || "Erro ao renovar token" };
    if ((data as { error?: string })?.error) throw { message: (data as { error: string }).error };
    setIsTokenExpired(false);
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

  return { invoke, saveToken, deleteToken, refreshToken, checkConnection, isTokenExpired };
}
