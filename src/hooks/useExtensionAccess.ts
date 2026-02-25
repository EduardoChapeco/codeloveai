import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ExtensionAccess {
  extensionId: string;
  extensionSlug: string;
  hasAccess: boolean;
}

/**
 * Check if the current user has access to specific extensions based on their active plan/license.
 */
export function useExtensionAccess() {
  const { user } = useAuth();
  const [access, setAccess] = useState<ExtensionAccess[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setAccess([]);
      setLoading(false);
      return;
    }

    const check = async () => {
      try {
        // Get user's active license plan_id
        const { data: license } = await supabase
          .from("licenses")
          .select("plan_id, plan, status")
          .eq("user_id", user.id)
          .in("status", ["active", "trial"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!license?.plan_id) {
          // Free tier: check if there's a free plan with extensions
          const { data: freePlan } = await supabase
            .from("plans")
            .select("id")
            .eq("price", 0)
            .eq("is_active", true)
            .maybeSingle();

          if (freePlan) {
            const { data: freeExts } = await supabase
              .from("plan_extensions")
              .select("extension_id, extension_catalog(id, slug)")
              .eq("plan_id", freePlan.id);

            setAccess(
              (freeExts || []).map((pe: any) => ({
                extensionId: pe.extension_catalog?.id || pe.extension_id,
                extensionSlug: pe.extension_catalog?.slug || "",
                hasAccess: true,
              }))
            );
          } else {
            setAccess([]);
          }
          setLoading(false);
          return;
        }

        // Get extensions linked to user's plan
        const { data: planExts } = await supabase
          .from("plan_extensions")
          .select("extension_id, extension_catalog(id, slug)")
          .eq("plan_id", license.plan_id);

        setAccess(
          (planExts || []).map((pe: any) => ({
            extensionId: pe.extension_catalog?.id || pe.extension_id,
            extensionSlug: pe.extension_catalog?.slug || "",
            hasAccess: true,
          }))
        );
      } catch (err) {
        console.error("Error checking extension access:", err);
        setAccess([]);
      } finally {
        setLoading(false);
      }
    };

    check();
  }, [user]);

  const hasAccessTo = (slug: string) => access.some((a) => a.extensionSlug === slug && a.hasAccess);

  return { access, loading, hasAccessTo };
}
