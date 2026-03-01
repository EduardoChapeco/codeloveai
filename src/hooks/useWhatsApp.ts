import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useWhatsApp(userId: string, tenantId: string) {
  const [instanceName, setInstanceName] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("disconnected");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load existing instance on mount
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("whatsapp_instances" as any)
        .select("*").eq("tenant_id", tenantId).eq("user_id", userId).maybeSingle();
      if (data) {
        const d = data as any;
        setInstanceName(d.instance_name);
        setStatus(d.status === "connected" ? "connected" : "disconnected");
        if (d.qr_code && d.status !== "connected") setQrCode(d.qr_code);
      }
    })();
  }, [userId, tenantId]);

  const createInstance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("create-whatsapp-instance", {
        body: { tenant_id: tenantId },
      });
      if (fnErr) throw new Error(fnErr.message);
      if (data?.error) throw new Error(data.error);
      if (data?.qr_code) setQrCode(data.qr_code);
      if (data?.instance_name) setInstanceName(data.instance_name);
      if (data?.status === "connected") setStatus("connected");
      else setStatus("connecting");
    } catch (err: any) {
      setError(err?.message || "Erro ao criar instância");
      setStatus("disconnected");
    }
    setLoading(false);
  }, [tenantId]);

  // Poll for connection status
  useEffect(() => {
    if (!instanceName || status === "connected") {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const poll = async () => {
      try {
        const { data, error: pollErr } = await supabase.functions.invoke("get-whatsapp-status", {
          body: { instance_name: instanceName },
        });

        if (pollErr) return;
        if (data?.status === "connected") {
          setStatus("connected");
          setQrCode(null);
          return;
        }

        if (data?.qr_code) {
          setQrCode(data.qr_code);
        }
      } catch {
        // ignore polling errors to keep retrying silently
      }
    };

    void poll();
    intervalRef.current = setInterval(poll, 6000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [instanceName, status]);

  return { qrCode, status, loading, error, instanceName, createInstance };
}
