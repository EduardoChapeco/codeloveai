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
  /** true = limit resets daily, false = monthly */
  isDailyReset: boolean;
}

// Daily limits (per day)
const DAILY_LIMITS: Record<EditorPlan, number> = {
  free: 10,
  daily: 9999, // unlimited
  pro: 9999,
  venus: 9999,
};

// Monthly limits
const MONTHLY_LIMITS: Record<EditorPlan, number> = {
  free: 300, // 10/day * 30 days
  daily: 9999,
  pro: 9999,
  venus: 9999,
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
      let detectedPlan: EditorPlan = "free";

      // 1. Check subscriptions for venus/pro
      const { data: subs } = await supabase
        .from("subscriptions")
        .select("plan, status")
        .eq("user_id", user!.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1);

      if (!cancelled && subs?.[0]) {
        const planName = (subs[0].plan || "").toLowerCase();
        if (planName.includes("venus")) detectedPlan = "venus";
        else if (planName.includes("pro")) detectedPlan = "pro";
      }

      // 2. Check licenses for daily token plans
      if (detectedPlan === "free") {
        const { data: licenses } = await supabase
          .from("licenses")
          .select("plan, type, active")
          .eq("user_id", user!.id)
          .eq("active", true)
          .order("created_at", { ascending: false })
          .limit(1);

        if (!cancelled && licenses?.[0]) {
          const lp = (licenses[0].plan || "").toLowerCase();
          const lt = (licenses[0].type || "").toLowerCase();
          if (lp.includes("venus")) detectedPlan = "venus";
          else if (lp.includes("pro")) detectedPlan = "pro";
          else if (lt === "daily_token" || lp.includes("dia") || lp.includes("daily")) detectedPlan = "daily";
        }
      }

      if (!cancelled) setPlan(detectedPlan);

      // 3. Count messages based on plan reset period
      const isDailyPlan = detectedPlan === "free" || detectedPlan === "daily";
      const today = new Date().toISOString().split("T")[0];

      if (isDailyPlan) {
        // Count today's messages
        const { count } = await supabase
          .from("loveai_conversations")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user!.id)
          .gte("created_at", today + "T00:00:00Z");

        if (!cancelled) setMessagesUsed(count || 0);
      } else {
        // Count this month's messages (from 1st of current month)
        const monthStart = today.slice(0, 7) + "-01";
        const { count } = await supabase
          .from("loveai_conversations")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user!.id)
          .gte("created_at", monthStart + "T00:00:00Z");

        if (!cancelled) setMessagesUsed(count || 0);
      }

      if (!cancelled) setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [user]);

  const isDailyReset = plan === "free" || plan === "daily";
  const limit = isDailyReset ? DAILY_LIMITS[plan] : MONTHLY_LIMITS[plan];
  const canSend = plan === "venus" || messagesUsed < limit;
  const percentUsed = plan === "venus" ? 0 : Math.min((messagesUsed / limit) * 100, 100);

  const increment = useCallback(() => {
    setMessagesUsed(prev => prev + 1);
  }, []);

  return { messagesUsed, messagesLimit: limit, plan, canSend, loading, increment, percentUsed, isDailyReset };
}
