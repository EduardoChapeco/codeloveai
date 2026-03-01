import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useWhatsApp(userId: string, tenantId: string) {
  const [instanceName, setInstanceName] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("disconnected");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load existing instance on mount ──
  useEffect(() => {
    if (!userId || !tenantId) return;

    (async () => {
      try {
        const { data, error: loadErr } = await supabase
          .from("whatsapp_instances" as any)
          .select("instance_name, status, qr_code")
          .eq("tenant_id", tenantId)
          .eq("user_id", userId)
          .maybeSingle();

        if (loadErr) throw loadErr;
        if (!data) return;

        const d = data as any;
        setInstanceName(d.instance_name ?? null);

        if (d.status === "connected") {
          setStatus("connected");
          setQrCode(null);
        } else if (d.status === "connecting") {
          setStatus(d.qr_code ? "connecting" : "waiting");
          setQrCode(d.qr_code ?? null);
        } else {
          setStatus("disconnected");
          setQrCode(null);
        }
      } catch (err: any) {
        console.error("[useWhatsApp] load error:", err);
      }
    })();
  }, [userId, tenantId]);

  // ── Create instance ──
  const createInstance = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnErr } = await supabase.functions.invoke(
        "create-whatsapp-instance",
        { body: { tenant_id: tenantId } },
      );

      if (fnErr) {
        let msg = "Falha ao criar instância";
        try {
          const parsed = JSON.parse((fnErr as any)?.context?.body || "{}");
          if (parsed?.error) msg = parsed.error;
        } catch { /* use default */ }
        throw new Error(msg);
      }

      if (data?.error) throw new Error(data.error);

      setInstanceName(data?.instance_name ?? null);
      setQrCode(data?.qr_code ?? null);

      if (data?.status === "connected") {
        setStatus("connected");
      } else if (data?.status === "render_hibernating") {
        setStatus("waiting");
        setError(data.error);
      } else if (data?.qr_code) {
        setStatus("connecting");
      } else {
        setStatus("waiting");
      }
    } catch (err: any) {
      setError(err?.message || "Erro ao criar instância");
      setStatus("disconnected");
    }

    setLoading(false);
  }, [tenantId]);

  // ── Poll for status updates ──
  useEffect(() => {
    const shouldPoll =
      instanceName &&
      (status === "connecting" || status === "waiting");

    if (!shouldPoll) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const poll = async () => {
      try {
        const { data, error: pollErr } = await supabase.functions.invoke(
          "get-whatsapp-status",
          { body: { instance_name: instanceName } },
        );

        if (pollErr || !data) return;

        if (data.status === "connected") {
          setStatus("connected");
          setQrCode(null);
        } else if (data.status === "connecting" && data.qr_code) {
          setStatus("connecting");
          setQrCode(data.qr_code);
        } else if (data.status === "waiting") {
          setStatus("waiting");
          setQrCode(null);
        } else if (data.status === "disconnected") {
          setStatus("disconnected");
          setQrCode(null);
        }
      } catch { /* ignore polling errors */ }
    };

    void poll();
    intervalRef.current = setInterval(poll, 8000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [instanceName, status]);

  return { qrCode, status, loading, error, instanceName, createInstance };
}
