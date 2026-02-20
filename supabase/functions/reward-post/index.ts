import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Try getClaims first, fallback to getUser
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
        console.error("Auth failed:", userError);
        return new Response(JSON.stringify({ error: "Não autenticado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
    }

    const body = await req.json();
    const postId = body.post_id;

    if (!postId || typeof postId !== "string" || postId.length > 50) {
      return new Response(JSON.stringify({ error: "post_id inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the post exists and belongs to this user
    const { data: post } = await serviceClient
      .from("community_posts")
      .select("id, user_id, rewarded")
      .eq("id", postId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!post) {
      return new Response(JSON.stringify({ error: "Post não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Already rewarded — skip
    if (post.rewarded) {
      console.log(`Post ${postId} already rewarded, skipping`);
      return new Response(JSON.stringify({ rewarded: false, reason: "already_rewarded" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit: max 5 rewards per day per user (count rewarded posts today)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count } = await serviceClient
      .from("community_posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("rewarded", true)
      .gte("created_at", todayStart.toISOString());

    if ((count || 0) >= 5) {
      console.log(`User ${userId} hit daily reward limit (${count} rewarded posts today)`);
      return new Response(JSON.stringify({ error: "Limite diário de recompensas atingido (5 posts/dia)", rewarded: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find active subscription and extend by 1 hour
    const { data: activeSub } = await serviceClient
      .from("subscriptions")
      .select("id, expires_at")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!activeSub) {
      console.log(`User ${userId} has no active subscription for reward`);
      return new Response(JSON.stringify({ error: "Sem assinatura ativa", rewarded: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extend by 1 hour
    const currentExpiry = new Date(activeSub.expires_at);
    const newExpiry = new Date(currentExpiry.getTime() + 60 * 60 * 1000); // +1 hour

    const { error: updateError } = await serviceClient
      .from("subscriptions")
      .update({ expires_at: newExpiry.toISOString() })
      .eq("id", activeSub.id);

    if (updateError) {
      console.error("Failed to extend subscription:", updateError);
      return new Response(JSON.stringify({ error: "Erro ao estender plano", rewarded: false }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark the post as rewarded so it can't be deleted
    await serviceClient
      .from("community_posts")
      .update({ rewarded: true })
      .eq("id", postId);

    console.log(`Rewarded user ${userId}: post ${postId}, extended ${currentExpiry.toISOString()} → ${newExpiry.toISOString()}`);

    return new Response(JSON.stringify({
      rewarded: true,
      bonus_hours: 1,
      new_expires_at: newExpiry.toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Reward post error:", error);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
