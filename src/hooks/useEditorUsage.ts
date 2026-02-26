import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type EditorPlan = "free" | "venus" | "pro" | "daily";

interface EditorUsage {
  messagesUsed: number;
  messagesLimit: number;
  plan: EditorPlan;
  canSend: boolean;
  loading: boolean;
  increment: () => void;
  percentUsed: number;
}

const PLAN_LIMITS: Record<EditorPlan, number> = {
  free: 10,
  daily: 20,
  pro: 50,
  venus: 9999, // unlimited
};

export function useEditorUsage(): EditorUsage {
  const { user } = useAuth();
  const [messagesUsed, setMessagesUsed] = useState(0);
  const [plan, setPlan] = useState<EditorPlan>("free");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    let cancelled = false;

    async function load() {
      // Check subscriptions for plan type
      const { data: subs } = await supabase
        .from("subscriptions")
        .select("plan, status")
        .eq("user_id", user!.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1);

      if (!cancelled) {
        const planName = (subs?.[0]?.plan || "").toLowerCase();
        if (planName.includes("venus")) setPlan("venus");
        else if (planName.includes("pro")) setPlan("pro");
        else if (planName.includes("dia") || planName.includes("daily")) setPlan("daily");
        else setPlan("free");
      }

      // Count today's editor messages
      const today = new Date().toISOString().split("T")[0];
      const { count } = await supabase
        .from("loveai_conversations")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .gte("created_at", today + "T00:00:00Z");

      if (!cancelled) {
        setMessagesUsed(count || 0);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [user]);

  const limit = PLAN_LIMITS[plan];
  const canSend = messagesUsed < limit;
  const percentUsed = Math.min((messagesUsed / limit) * 100, 100);

  const increment = useCallback(() => {
    setMessagesUsed(prev => prev + 1);
  }, []);

  return { messagesUsed, messagesLimit: limit, plan, canSend, loading, increment, percentUsed };
}
