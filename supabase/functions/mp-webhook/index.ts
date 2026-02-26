// mp-webhook — DEPRECATED legacy endpoint
// All payment processing now goes through mercadopago-webhook with HMAC validation.
// This endpoint is kept as a no-op to prevent 404 errors from old MP configurations.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Always return 200 to MP so it stops retrying, but do NOT process anything.
  // Log for audit trail.
  try {
    const body = await req.text();
    console.warn("[mp-webhook] DEPRECATED endpoint called. Body preview:", body.substring(0, 200));
  } catch { /* ignore */ }

  return new Response(
    JSON.stringify({ received: true, deprecated: true, message: "Use mercadopago-webhook instead" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
