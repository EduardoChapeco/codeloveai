import { useAuthContext } from "@/contexts/AuthContext";

export function useAuth() {
  const { user, loading, signOut } = useAuthContext();
  return { user, loading, signOut };
}

export function useIsAdmin() {
  const { isAdmin, adminLoading } = useAuthContext();
  return { isAdmin, loading: adminLoading };
}

export function useIsAffiliate() {
  const { isAffiliate, affiliateData, affiliateLoading } = useAuthContext();
  return { isAffiliate, affiliateData, loading: affiliateLoading };
}
