// consume-token v2 — uses shared license-guard with admin bypass & auto-deactivation
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { guardLicense, incrementUsage } from "../_shared/license-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-clf-token",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const body = await req.json();
    const licenseKey = body.licenseKey || req.headers.get("x-clf-token") || "";

    if (!licenseKey || typeof licenseKey !== "string") {
      return new Response(
        JSON.stringify({ allowed: false, error: "Missing licenseKey" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Smart validation with auto-deactivation
    const guard = await guardLicense(supabase, licenseKey);

    if (!guard.allowed) {
      return new Response(
        JSON.stringify({ allowed: false, error: guard.error, usedToday: guard.usedToday, limit: guard.dailyLimit }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Admin master = unlimited, still track usage for analytics
    const licenseId = (guard.license as any)?.id;
    if (!licenseId) {
      return new Response(
        JSON.stringify({ allowed: false, error: "License ID not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const usedToday = await incrementUsage(supabase, licenseId);

    return new Response(
      JSON.stringify({
        allowed: true,
        isAdmin: guard.isAdmin,
        usedToday,
        limit: guard.isAdmin ? null : guard.dailyLimit,
        usedThisMonth: usedToday,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[consume-token] error:", err);
    return new Response(
      JSON.stringify({ allowed: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
