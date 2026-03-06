import { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  adminLoading: boolean;
  isAffiliate: boolean;
  affiliateData: {
    id: string;
    affiliate_code: string;
    display_name: string;
    discount_percent: number;
  } | null;
  affiliateLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);
  const [isAffiliate, setIsAffiliate] = useState(false);
  const [affiliateData, setAffiliateData] = useState<AuthContextType["affiliateData"]>(null);
  const [affiliateLoading, setAffiliateLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const checkRoles = async (userId: string) => {
      try {
        const [adminResult, affiliateResult] = await Promise.all([
          supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin"),
          supabase.from("affiliates").select("id, affiliate_code, display_name, discount_percent").eq("user_id", userId).maybeSingle(),
        ]);
        if (!mountedRef.current) return;
        setIsAdmin(!!adminResult.data && adminResult.data.length > 0);
        setIsAffiliate(!!affiliateResult.data);
        setAffiliateData(affiliateResult.data);
      } catch {
        if (!mountedRef.current) return;
        setIsAdmin(false);
        setIsAffiliate(false);
        setAffiliateData(null);
      } finally {
        if (mountedRef.current) {
          setAdminLoading(false);
          setAffiliateLoading(false);
        }
      }
    };

    // Set up listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mountedRef.current) return;
        setSession(session);
        setUser(session?.user ?? null);

        // SSO bridge: sync token to extension via localStorage + postMessage
        if (session?.access_token) {
          try {
            localStorage.setItem('clf_token', session.access_token);
            localStorage.setItem('clf_email', session.user?.email || '');
            localStorage.setItem('clf_name', session.user?.user_metadata?.name || '');
            window.postMessage({
              type: 'clf_sso_login',
              token: session.access_token,
              email: session.user?.email || '',
              name: session.user?.user_metadata?.name || '',
            }, window.location.origin);
          } catch { /* silent */ }
        }

        if (session?.user) {
          // Dispatch role check after callback to avoid deadlock
          setTimeout(() => checkRoles(session.user.id), 0);

          // Auto-onboard: provision free CLF1 token for new users
          if (_event === 'SIGNED_IN') {
            supabase.functions.invoke('auto-onboard', {}).catch(() => {/* silent */});
          }
        } else {
          setIsAdmin(false);
          setAdminLoading(false);
          setIsAffiliate(false);
          setAffiliateData(null);
          setAffiliateLoading(false);
        }
      }
    );

    // INITIAL load
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mountedRef.current) return;
        setSession(session);
        setUser(session?.user ?? null);

        // SSO bridge: set token on initial load too
        if (session?.access_token) {
          try {
            localStorage.setItem('clf_token', session.access_token);
            localStorage.setItem('clf_email', session.user?.email || '');
            localStorage.setItem('clf_name', session.user?.user_metadata?.name || '');
          } catch { /* silent */ }
        }

        if (session?.user) {
          await checkRoles(session.user.id);
        } else {
          setAdminLoading(false);
          setAffiliateLoading(false);
        }
      } catch {
        if (mountedRef.current) {
          setAdminLoading(false);
          setAffiliateLoading(false);
        }
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    localStorage.removeItem('clf_token');
    localStorage.removeItem('clf_email');
    localStorage.removeItem('clf_name');
    window.postMessage({ type: 'clf_sso_logout' }, window.location.origin);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      user, session, loading,
      isAdmin, adminLoading,
      isAffiliate, affiliateData, affiliateLoading,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
}
