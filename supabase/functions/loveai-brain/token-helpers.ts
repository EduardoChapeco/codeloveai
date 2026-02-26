import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { obfuscate } from "../_shared/crypto.ts";

type SupabaseClient = ReturnType<typeof createClient>;

const API = "https://api.lovable.dev";
const GIT_SHA = "3d7a3673c6f02b606137a12ddc0ab88f6b775113";

export function lovFetch(url: string, token: string, opts: RequestInit = {}) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Origin: "https://lovable.dev",
    Referer: "https://lovable.dev/",
    "X-Client-Git-SHA": GIT_SHA,
    ...(opts.headers as Record<string, string> || {}),
  };
  if (opts.method === "POST" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  return fetch(url, { ...opts, headers });
}

export async function getUserToken(sc: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await sc.from("lovable_accounts")
    .select("token_encrypted")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  return data?.token_encrypted?.trim() || null;
}

export async function refreshToken(sc: SupabaseClient, userId: string): Promise<string | null> {
  try {
    const { data: acct } = await sc.from("lovable_accounts")
      .select("refresh_token_encrypted")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (!acct?.refresh_token_encrypted) return null;

    const fbKey = Deno.env.get("FIREBASE_API_KEY");
    if (!fbKey) return null;

    const res = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${fbKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(acct.refresh_token_encrypted)}`,
      }
    );
    if (!res.ok) return null;
    const d = await res.json();
    const newToken = d.id_token || d.access_token;
    if (!newToken) return null;

    await sc.from("lovable_accounts").update({
      token_encrypted: newToken,
      ...(d.refresh_token ? { refresh_token_encrypted: d.refresh_token } : {}),
    }).eq("user_id", userId).eq("status", "active");

    console.log(`[Brain] 🔄 Token refreshed for ${obfuscate(userId)}`);
    return newToken;
  } catch (e) {
    console.error(`[Brain] Token refresh failed:`, e);
    return null;
  }
}

export async function getValidToken(sc: SupabaseClient, userId: string): Promise<string | null> {
  let token = await getUserToken(sc, userId);
  if (!token) return null;

  const check = await lovFetch(`${API}/user/workspaces`, token, { method: "GET" });
  if (check.ok) return token;

  if (check.status === 401 || check.status === 403) {
    console.warn(`[Brain] Token expired (${check.status}), refreshing...`);
    return await refreshToken(sc, userId);
  }
  return token;
}

export async function getWorkspaceId(token: string): Promise<string | null> {
  const res = await lovFetch(`${API}/user/workspaces`, token, { method: "GET" });
  if (!res.ok) {
    console.error(`[Brain] Workspaces fetch failed: ${res.status}`);
    return null;
  }
  const body = await res.json();
  const list: any[] = Array.isArray(body) ? body : (body?.workspaces || body?.data || []);
  if (list.length === 0 && body?.id) return body.id;
  return list?.[0]?.id || null;
}
