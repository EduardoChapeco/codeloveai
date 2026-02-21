import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Returns true if the current user has at least one active token
 * OR at least one active (non-expired) subscription.
 */
export function useHasActiveAccess() {
  const { user } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setHasAccess(false);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function check() {
      const [tokensRes, subsRes] = await Promise.all([
        supabase
          .from("tokens")
          .select("id")
          .eq("user_id", user!.id)
          .eq("is_active", true)
          .limit(1),
        supabase
          .from("subscriptions")
          .select("id")
          .eq("user_id", user!.id)
          .eq("status", "active")
          .gte("expires_at", new Date().toISOString())
          .limit(1),
      ]);

      if (cancelled) return;

      const hasToken = (tokensRes.data?.length ?? 0) > 0;
      const hasSub = (subsRes.data?.length ?? 0) > 0;
      setHasAccess(hasToken || hasSub);
      setLoading(false);
    }

    check();
    return () => { cancelled = true; };
  }, [user]);

  return { hasAccess, loading };
}
