// DEPRECATED: Use validate-license instead. This endpoint redirects all calls.
// Kept as a stub to avoid 404s from old extension versions.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      valid: false,
      error: "Deprecated. Use validate-license endpoint instead.",
      redirect: "validate-license",
    }),
    {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
