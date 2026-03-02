/**
 * Starble Client Fingerprint
 * Generates X-Starble-Sig header for authenticated requests to Edge Functions.
 * NOTE: This is a client-fingerprinting mechanism, NOT a security secret.
 * Real authentication is enforced via JWT Bearer tokens on every edge function.
 * Must match the fallback in supabase/functions/_shared/client-guard.ts
 */

const CLIENT_SIG_KEY = "stbl_c8f2a91d4e7b3c6a0f5e8d2b1a9c7f4e";

async function hmacSign(message: string, key: string): Promise<string> {
  const k = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function generateClientSig(appId: "web" | "ext" | "spd" | "venus" = "web"): Promise<string> {
  const ts = Date.now().toString();
  const sig = await hmacSign(`${appId}.${ts}`, CLIENT_SIG_KEY);
  return `${appId}.${ts}.${sig}`;
}
