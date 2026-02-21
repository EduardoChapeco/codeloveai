import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveTenant } from "../_shared/tenant-resolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-tenant-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    let userId: string;
    try {
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
      if (!claimsError && claimsData?.claims) {
        userId = claimsData.claims.sub;
      } else {
        throw new Error("getClaims failed");
      }
    } catch {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Não autenticado" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
    }

    const body = await req.json();
    const postId = body.post_id;

    if (!postId || typeof postId !== "string" || postId.length > 50) {
      return new Response(JSON.stringify({ error: "post_id inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Resolve tenant
    const tenantInfo = await resolveTenant(serviceClient, req, userId);
    const tenantId = tenantInfo.id || tenantInfo.tenant_id;

    // Verify the post exists and belongs to this user in this tenant
    const { data: post } = await serviceClient
      .from("community_posts")
      .select("id, user_id, rewarded")
      .eq("id", postId)
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!post) {
      return new Response(JSON.stringify({ error: "Post não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (post.rewarded) {
      return new Response(JSON.stringify({ rewarded: false, reason: "already_rewarded" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit per tenant
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count } = await serviceClient
      .from("community_posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("rewarded", true)
      .eq("tenant_id", tenantId)
      .gte("created_at", todayStart.toISOString());

    if ((count || 0) >= 5) {
      return new Response(JSON.stringify({ error: "Limite diário de recompensas atingido (5 posts/dia)", rewarded: false }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find active subscription in this tenant
    const { data: activeSub } = await serviceClient
      .from("subscriptions")
      .select("id, expires_at")
      .eq("user_id", userId)
      .eq("status", "active")
      .eq("tenant_id", tenantId)
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!activeSub) {
      return new Response(JSON.stringify({ error: "Sem assinatura ativa", rewarded: false }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currentExpiry = new Date(activeSub.expires_at);
    const newExpiry = new Date(currentExpiry.getTime() + 60 * 60 * 1000);

    const { error: updateError } = await serviceClient
      .from("subscriptions")
      .update({ expires_at: newExpiry.toISOString() })
      .eq("id", activeSub.id);

    if (updateError) {
      return new Response(JSON.stringify({ error: "Erro ao estender plano", rewarded: false }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await serviceClient.from("community_posts").update({ rewarded: true }).eq("id", postId);

    return new Response(JSON.stringify({
      rewarded: true, bonus_hours: 1, new_expires_at: newExpiry.toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Reward post error:", error);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
