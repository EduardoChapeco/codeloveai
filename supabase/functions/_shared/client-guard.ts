/**
 * Client Fingerprint Guard
 * Validates that requests come from authorized Starble clients (extensions, web app).
 * Uses HMAC-SHA256 signature of timestamp + app identifier.
 *
 * Header format: X-Starble-Sig: {appId}.{timestamp}.{signature}
 * - appId: "ext" (extension), "spd" (speed), "web" (dashboard)
 * - timestamp: unix ms
 * - signature: HMAC-SHA256(appId + "." + timestamp, CLIENT_SIG_KEY) base64url
 *
 * Window: ±5 minutes (accounts for clock drift)
 */

// Client fingerprint key — NOT a security secret (embedded in browser bundle + extensions).
// This is a fingerprinting mechanism to filter non-app traffic, not authentication.
// Real auth is handled via JWT Bearer tokens validated per-function.
const CLIENT_SIG_KEY = Deno.env.get("CLIENT_SIG_KEY") || "stbl_c8f2a91d4e7b3c6a0f5e8d2b1a9c7f4e";
const ALLOWED_APPS = new Set(["ext", "spd", "web", "venus"]);
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes

async function computeHmac(message: string, key: string): Promise<string> {
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

export async function validateClientSignature(req: Request): Promise<{
  valid: boolean;
  appId?: string;
  error?: string;
}> {
  const sig = req.headers.get("x-starble-sig");
  if (!sig) {
    return { valid: false, error: "Missing client signature" };
  }

  const parts = sig.split(".");
  if (parts.length !== 3) {
    return { valid: false, error: "Malformed signature" };
  }

  const [appId, tsStr, clientSig] = parts;

  if (!ALLOWED_APPS.has(appId)) {
    return { valid: false, error: "Unknown client" };
  }

  const ts = parseInt(tsStr, 10);
  if (isNaN(ts)) {
    return { valid: false, error: "Invalid timestamp" };
  }

  const now = Date.now();
  if (Math.abs(now - ts) > WINDOW_MS) {
    return { valid: false, error: "Signature expired" };
  }

  const expected = await computeHmac(`${appId}.${tsStr}`, CLIENT_SIG_KEY);
  if (expected !== clientSig) {
    return { valid: false, error: "Invalid signature" };
  }

  return { valid: true, appId };
}

/**
 * Quick reject helper — returns a 403 Response if invalid, or null if valid
 */
export async function guardClient(req: Request): Promise<Response | null> {
  const result = await validateClientSignature(req);
  if (!result.valid) {
    return new Response(
      JSON.stringify({ error: "Unauthorized client", detail: result.error }),
      {
        status: 403,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
  return null;
}
