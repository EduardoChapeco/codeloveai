import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    // SSO Bridge: clear extension data on logout
    localStorage.removeItem('clf_token');
    localStorage.removeItem('clf_email');
    localStorage.removeItem('clf_name');
    window.postMessage({ type: 'clf_sso_logout' }, '*');
    await supabase.auth.signOut();
  };

  return { user, loading, signOut };
}

export function useIsAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .then(({ data }) => {
        setIsAdmin(!!data && data.length > 0);
        setLoading(false);
      });
  }, [user, authLoading]);

  return { isAdmin, loading };
}

export function useIsAffiliate() {
  const { user, loading: authLoading } = useAuth();
  const [isAffiliate, setIsAffiliate] = useState(false);
  const [affiliateData, setAffiliateData] = useState<{
    id: string;
    affiliate_code: string;
    display_name: string;
    discount_percent: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user) {
      setIsAffiliate(false);
      setAffiliateData(null);
      setLoading(false);
      return;
    }

    supabase
      .from("affiliates")
      .select("id, affiliate_code, display_name, discount_percent")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setIsAffiliate(!!data);
        setAffiliateData(data);
        setLoading(false);
      });
  }, [user, authLoading]);

  return { isAffiliate, affiliateData, loading };
}
