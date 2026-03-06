import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

let tracked = false;

export function useAccessTracker(userId?: string, userEmail?: string, tenantId?: string) {
  const sent = useRef(false);

  useEffect(() => {
    if (tracked || sent.current) return;
    sent.current = true;
    tracked = true;

    const sessionId = sessionStorage.getItem("_sid") || crypto.randomUUID();
    sessionStorage.setItem("_sid", sessionId);

    supabase.functions.invoke("track-access", {
      body: {
        user_id: userId || null,
        user_email: userEmail || null,
        tenant_id: tenantId || null,
        screen_width: window.screen.width,
        screen_height: window.screen.height,
        language: navigator.language,
        referrer: document.referrer || null,
        page_url: window.location.href,
        user_agent: navigator.userAgent,
        session_id: sessionId,
      },
    }).catch(() => {});
  }, [userId, userEmail, tenantId]);
}
