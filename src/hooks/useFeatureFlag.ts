import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface FeatureFlagResult {
  enabled: boolean;
  loading: boolean;
  reason?: string;
}

// Cache flags for the session to avoid repeated DB calls
const flagCache = new Map<string, { enabled: boolean; ts: number }>();
const CACHE_TTL_MS = 60_000; // 1 minute

export function useFeatureFlag(feature: string): FeatureFlagResult {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<FeatureFlagResult>({ enabled: false, loading: true });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState({ enabled: false, loading: false, reason: "Not authenticated" });
      return;
    }

    const cacheKey = `${user.id}:${feature}`;
    const cached = flagCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      setState({ enabled: cached.enabled, loading: false });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        // Call the DB function — admin returns true automatically
        const { data, error } = await (supabase as any).rpc("check_feature_access", {
          p_feature: feature,
        });
        if (cancelled) return;
        const enabled = !error && data === true;
        flagCache.set(cacheKey, { enabled, ts: Date.now() });
        setState({ enabled, loading: false, reason: error?.message });
      } catch {
        if (!cancelled) setState({ enabled: false, loading: false, reason: "Error checking access" });
      }
    })();
    return () => { cancelled = true; };
  }, [user, authLoading, feature]);

  return state;
}
