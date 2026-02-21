import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    const { conversation_id, message } = await req.json();

    if (!conversation_id || !message || typeof message !== "string" || message.trim().length === 0) {
      return new Response(JSON.stringify({ error: "conversation_id and message are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (message.length > 4000) {
      return new Response(JSON.stringify({ error: "Message too long (max 4000 chars)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify conversation ownership
    const { data: conv, error: convError } = await supabase
      .from("chat_conversations")
      .select("id")
      .eq("id", conversation_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (convError || !conv) {
      return new Response(JSON.stringify({ error: "Conversation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert user message
    const { error: insertError } = await supabase.from("chat_messages").insert({
      conversation_id,
      user_id: userId,
      role: "user",
      content: message.trim(),
    });

    if (insertError) {
      console.error("Insert user message error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to save message" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get conversation history (last 50 messages)
    const { data: history } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: true })
      .limit(50);

    const messages = (history || []).map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    }));

    // Call Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "Você é o CodeLove AI, assistente inteligente da plataforma CodeLove. Responda de forma clara, útil e em português brasileiro. Use markdown para formatação quando apropriado. Seja conciso mas completo.",
          },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const body = await aiResponse.text();
      console.error("AI gateway error:", status, body);

      if (status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Erro ao conectar com AI" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream response + collect full content for saving
    const reader = aiResponse.body!.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            controller.enqueue(new TextEncoder().encode(chunk));

            // Extract content from SSE for saving
            for (const line of chunk.split("\n")) {
              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6).trim();
              if (jsonStr === "[DONE]") continue;
              try {
                const parsed = JSON.parse(jsonStr);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) fullContent += content;
              } catch {
                // partial JSON, skip
              }
            }
          }

          // Save assistant message using service role
          const serviceClient = createClient(
            supabaseUrl,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
          );

          if (fullContent.trim()) {
            await serviceClient.from("chat_messages").insert({
              conversation_id,
              user_id: userId,
              role: "assistant",
              content: fullContent.trim(),
            });

            // Auto-title conversation if it's the default title
            const { data: convData } = await serviceClient
              .from("chat_conversations")
              .select("title")
              .eq("id", conversation_id)
              .single();

            if (convData?.title === "Nova Conversa") {
              const shortTitle = message.trim().slice(0, 60) + (message.trim().length > 60 ? "..." : "");
              await serviceClient
                .from("chat_conversations")
                .update({ title: shortTitle })
                .eq("id", conversation_id);
            }
          }

          controller.close();
        } catch (e) {
          console.error("Stream error:", e);
          controller.error(e);
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    console.error("chat-relay error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
