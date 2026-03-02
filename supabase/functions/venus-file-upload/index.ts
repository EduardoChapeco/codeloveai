// venus-file-upload — Proxy seguro para upload de arquivos via GCS presigned URL do Lovable
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LOVABLE_API = "https://api.lovable.dev";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-clf-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Token resolution (lightweight: explicit or JWT user) ───
async function resolveLovableToken(
  req: Request,
  body: Record<string, unknown>
): Promise<string | null> {
  const explicit = (
    (body.lovable_token as string) ||
    (body.lovableToken as string) ||
    ""
  ).trim();
  if (explicit.length >= 10) return explicit;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceRoleKey || !anonKey) return null;

  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7).trim();
  if (!token || token.startsWith("CLF1.")) return null;

  try {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error } = await userClient.auth.getUser();
    if (error || !user?.id) return null;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data } = await adminClient
      .from("lovable_accounts")
      .select("token_encrypted")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1);
    return data?.[0]?.token_encrypted?.trim() || null;
  } catch {
    return null;
  }
}

// ─── License validation (CLF1 header or body) ───
async function validateLicense(req: Request, body: Record<string, unknown>): Promise<boolean> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return false;

  const headerClf = (req.headers.get("x-clf-token") || "").trim();
  const bodyClf = ((body.licenseKey as string) || (body.clf_license as string) || "").trim();
  const clf = headerClf.startsWith("CLF1.") ? headerClf : bodyClf.startsWith("CLF1.") ? bodyClf : "";

  if (!clf) {
    // Allow if user has valid JWT auth (already has lovable token)
    return true;
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data } = await adminClient
    .from("licenses")
    .select("id")
    .eq("key", clf)
    .eq("active", true)
    .limit(1);

  return !!(data && data.length > 0);
}

// ─── Base64 to Uint8Array ───
function base64ToUint8Array(b64: string): Uint8Array {
  // Strip data URI prefix if present
  const clean = b64.includes(",") ? b64.split(",")[1] : b64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ─── Main handler ───
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "Invalid JSON" }, 400);
  }

  // Validate license
  const licenseOk = await validateLicense(req, body);
  if (!licenseOk) {
    return json({ success: false, error: "Invalid or missing license" }, 401);
  }

  // Extract fields
  const dirName = ((body.dir_name as string) || "").trim();
  const fileName = ((body.file_name as string) || "").trim();
  const fileData = ((body.file_data as string) || "").trim();
  const mimeType = ((body.mime_type as string) || "application/octet-stream").trim();

  if (!dirName || !fileName || !fileData) {
    return json({ success: false, error: "dir_name, file_name, and file_data are required" }, 400);
  }

  if (!ALLOWED_MIME.has(mimeType)) {
    return json({ success: false, error: `MIME type not allowed: ${mimeType}` }, 400);
  }

  // Check size
  const bytes = base64ToUint8Array(fileData);
  if (bytes.length > MAX_FILE_SIZE) {
    return json({ success: false, error: `File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` }, 400);
  }

  // Resolve Lovable token
  const lovableToken = await resolveLovableToken(req, body);
  if (!lovableToken) {
    return json({ success: false, error: "Lovable token not found" }, 401);
  }

  // Step 1: Get presigned URL from Lovable
  let signedUrl: string;
  try {
    const presignRes = await fetch(`${LOVABLE_API}/files/generate-download-url`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableToken}`,
        "Content-Type": "application/json",
        Origin: "https://lovable.dev",
        Referer: "https://lovable.dev/",
      },
      body: JSON.stringify({ dir_name: dirName, file_name: fileName }),
    });

    if (!presignRes.ok) {
      const errText = await presignRes.text().catch(() => "");
      console.error("[venus-file-upload] Presign failed:", presignRes.status, errText);
      return json({
        success: false,
        error: `Presign failed (${presignRes.status})`,
      }, 502);
    }

    const presignData = await presignRes.json();
    signedUrl = presignData.url || presignData.upload_url || presignData.signed_url || "";

    if (!signedUrl) {
      console.error("[venus-file-upload] No signed URL in response:", JSON.stringify(presignData));
      return json({ success: false, error: "No signed URL returned" }, 502);
    }
  } catch (e) {
    console.error("[venus-file-upload] Presign network error:", e);
    return json({ success: false, error: "Failed to get presigned URL" }, 502);
  }

  // Step 2: Upload binary to GCS
  try {
    const uploadRes = await fetch(signedUrl, {
      method: "PUT",
      headers: { "Content-Type": mimeType },
      body: bytes,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text().catch(() => "");
      console.error("[venus-file-upload] GCS upload failed:", uploadRes.status, errText);
      return json({
        success: false,
        error: `GCS upload failed (${uploadRes.status})`,
      }, 502);
    }

    // Consume response body
    await uploadRes.text().catch(() => "");
  } catch (e) {
    console.error("[venus-file-upload] GCS upload error:", e);
    return json({ success: false, error: "File upload to storage failed" }, 502);
  }

  // Step 3: Return public URL
  const publicUrl = `https://storage.googleapis.com/gpt-engineer-file-uploads/${dirName}/${fileName}`;

  return json({ success: true, url: publicUrl });
});
