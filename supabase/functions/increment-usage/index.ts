// increment-usage v2 — supports both header and body auth, uses shared guard
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { guardLicense, incrementUsage } from "../_shared/license-guard.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-clf-token, x-clf-extension",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  // Accept license key from header OR body
  const clfToken = req.headers.get("x-clf-token") || "";
  let bodyKey = "";
  let body: Record<string, unknown> = {};

  try {
    body = await req.json();
    bodyKey = (body.licenseKey as string) || "";
  } catch { /* no body */ }

  const licenseKey = clfToken.startsWith("CLF1.") ? clfToken : bodyKey;

  if (!licenseKey || !licenseKey.startsWith("CLF1.")) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Validate license (auto-deactivates expired ones)
  const guard = await guardLicense(supabase, licenseKey);
  if (!guard.allowed) {
    return new Response(JSON.stringify({ ok: false, error: guard.error }), {
      status: 403, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const licenseId = (guard.license as any)?.id;
  if (!licenseId) {
    return new Response(JSON.stringify({ ok: false, error: "Invalid license" }), {
      status: 403, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const usedToday = await incrementUsage(supabase, licenseId);

  return new Response(JSON.stringify({ ok: true, usedToday, isAdmin: guard.isAdmin }), {
    status: 200, headers: { ...CORS, "Content-Type": "application/json" },
  });
});
