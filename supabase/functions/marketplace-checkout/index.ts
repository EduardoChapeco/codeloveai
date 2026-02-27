import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-tenant-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLATFORM_COMMISSION = 0.30; // 30% platform fee

const ONBOARDING_STEPS = [
  { step_number: 1, title: "Início do Onboarding", description: "Vendedor inicia a apresentação guiada." },
  { step_number: 2, title: "Demonstração & Dúvidas", description: "Vendedor demonstra funcionalidades." },
  { step_number: 3, title: "Acesso como Visualizador", description: "Vendedor adiciona comprador como Viewer." },
  { step_number: 4, title: "Confirmação do Projeto", description: "Comprador confirma que é o projeto anunciado." },
  { step_number: 5, title: "Liberação do Pagamento", description: "Comprador libera valor ao vendedor." },
];

async function createOnboardingAndInvoice(
  client: any,
  { purchaseId, listingId, buyerId, sellerId, grossAmount, commissionAmount, netAmount }: {
    purchaseId: string; listingId: string; buyerId: string; sellerId: string;
    grossAmount: number; commissionAmount: number; netAmount: number;
  }
) {
  // Create onboarding session
  const { data: ob } = await client.from("marketplace_onboarding").insert({
    purchase_id: purchaseId, listing_id: listingId, buyer_id: buyerId,
    seller_id: sellerId, status: "pending", current_step: 1, total_steps: 5,
  }).select("id").single();

  if (ob) {
    // Create steps
    await client.from("marketplace_onboarding_steps").insert(
      ONBOARDING_STEPS.map(s => ({ onboarding_id: ob.id, ...s }))
    );
  }

  // Create seller invoice with 7-day hold
  await client.from("marketplace_seller_invoices").insert({
    seller_id: sellerId, purchase_id: purchaseId, listing_id: listingId,
    buyer_id: buyerId, gross_amount: grossAmount, commission_amount: commissionAmount,
    net_amount: netAmount, status: "held",
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { listing_id, payment_method } = await req.json();

    if (!listing_id || typeof listing_id !== "string") {
      return new Response(JSON.stringify({ error: "listing_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch listing
    const { data: listing } = await serviceClient
      .from("marketplace_listings")
      .select("id, title, price, seller_id, commission_rate, status")
      .eq("id", listing_id)
      .eq("status", "published")
      .maybeSingle();

    if (!listing) {
      return new Response(JSON.stringify({ error: "Listing não encontrado ou inativo" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (listing.price === 0) {
      // Free listing — auto-complete purchase
      const { data: freePurchase, error: insertErr } = await serviceClient.from("marketplace_purchases").insert({
        listing_id: listing.id,
        buyer_id: user.id,
        seller_id: listing.seller_id,
        price: 0,
        commission_amount: 0,
        seller_amount: 0,
        status: "paid",
      }).select("id").single();
      if (insertErr) throw insertErr;

      // Create onboarding + steps + invoice for free purchases too
      await createOnboardingAndInvoice(serviceClient, {
        purchaseId: freePurchase.id, listingId: listing.id,
        buyerId: user.id, sellerId: listing.seller_id,
        grossAmount: 0, commissionAmount: 0, netAmount: 0,
      });

      return new Response(JSON.stringify({ success: true, free: true, purchase_id: freePurchase.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Can't buy own listing
    if (listing.seller_id === user.id) {
      return new Response(JSON.stringify({ error: "Não é possível comprar seu próprio projeto" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check already purchased
    const { data: existing } = await serviceClient
      .from("marketplace_purchases")
      .select("id")
      .eq("listing_id", listing.id)
      .eq("buyer_id", user.id)
      .eq("status", "paid")
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ error: "Você já possui este projeto" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Gateway de pagamento não configurado" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate amounts — buyer pays card/processing fees on top
    const commissionAmount = Math.round(listing.price * PLATFORM_COMMISSION * 100) / 100;
    const sellerAmount = Math.round((listing.price - commissionAmount) * 100) / 100;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const webhookUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`;

    const rawOrigin = req.headers.get("origin");
    const allowedOrigins = ["https://Starbleai.lovable.app", "https://starble.lovable.app", "https://id-preview--804f123e-068a-44af-90b4-2843ed8e7d2a.lovable.app"];
    const origin = rawOrigin && allowedOrigins.some(o => rawOrigin.startsWith(o)) ? rawOrigin : "https://starble.lovable.app";

    const externalReference = JSON.stringify({
      type: "marketplace",
      listing_id: listing.id,
      buyer_id: user.id,
      seller_id: listing.seller_id,
      commission_amount: commissionAmount,
      seller_amount: sellerAmount,
    });

    // Create pending purchase record
    const { data: purchase, error: purchaseErr } = await serviceClient
      .from("marketplace_purchases")
      .insert({
        listing_id: listing.id,
        buyer_id: user.id,
        seller_id: listing.seller_id,
        price: listing.price,
        commission_amount: commissionAmount,
        seller_amount: sellerAmount,
        status: "pending",
      })
      .select("id")
      .single();

    if (purchaseErr) throw purchaseErr;

    // Create onboarding + invoice for the purchase
    await createOnboardingAndInvoice(serviceClient, {
      purchaseId: purchase.id, listingId: listing.id,
      buyerId: user.id, sellerId: listing.seller_id,
      grossAmount: listing.price, commissionAmount, netAmount: sellerAmount,
    });

    // ===== PIX PAYMENT =====
    if (payment_method === "pix") {
      const pixPayload = {
        transaction_amount: listing.price,
        description: `Marketplace: ${listing.title}`,
        payment_method_id: "pix",
        payer: { email: user.email || `user-${user.id.substring(0, 8)}@starble.ai` },
        external_reference: externalReference,
        notification_url: webhookUrl,
      };

      const pixRes = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "X-Idempotency-Key": `mkt-${purchase.id}-${Date.now()}`,
        },
        body: JSON.stringify(pixPayload),
        signal: AbortSignal.timeout(90000),
      });

      const ct = pixRes.headers.get("content-type");
      if (!ct?.includes("application/json")) {
        console.error("MP PIX non-JSON:", (await pixRes.text()).substring(0, 200));
        return new Response(JSON.stringify({ error: "Erro ao gerar PIX" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const pixData = await pixRes.json();
      if (!pixRes.ok) {
        console.error("MP PIX error:", pixRes.status, JSON.stringify(pixData).substring(0, 500));
        return new Response(JSON.stringify({ error: "Erro ao criar pagamento PIX" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const td = pixData.point_of_interaction?.transaction_data;
      const pixCode = td?.qr_code || pixData.pix_copy_paste || "";
      const pixQrBase64 = td?.qr_code_base64 || null;
      const ticketUrl = td?.ticket_url || pixData.ticket_url || null;

      // Update purchase with payment_id
      await serviceClient.from("marketplace_purchases")
        .update({ payment_id: String(pixData.id) } as any)
        .eq("id", purchase.id);

      return new Response(JSON.stringify({
        payment_method: "pix",
        pix_code: pixCode,
        pix_qr_base64: pixQrBase64,
        ticket_url: ticketUrl,
        payment_id: pixData.id,
        purchase_id: purchase.id,
        price: listing.price,
        commission: commissionAmount,
        seller_receives: sellerAmount,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===== STANDARD CHECKOUT (card/boleto via redirect) =====
    const preference = {
      items: [{
        title: `Marketplace: ${listing.title}`,
        quantity: 1,
        unit_price: listing.price,
        currency_id: "BRL",
      }],
      external_reference: externalReference,
      back_urls: {
        success: `${origin}/marketplace/${listing.id}?payment=success`,
        failure: `${origin}/marketplace/${listing.id}?payment=failure`,
        pending: `${origin}/marketplace/${listing.id}?payment=pending`,
      },
      auto_return: "approved",
      notification_url: webhookUrl,
      statement_descriptor: "STARBLE STORE",
    };

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(preference),
    });

    if (!mpRes.ok) {
      console.error("MP preference error:", await mpRes.text());
      return new Response(JSON.stringify({ error: "Erro ao criar checkout" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mpData = await mpRes.json();

    // Update purchase with preference id
    await serviceClient.from("marketplace_purchases")
      .update({ payment_id: mpData.id } as any)
      .eq("id", purchase.id);

    return new Response(JSON.stringify({
      init_point: mpData.init_point,
      purchase_id: purchase.id,
      price: listing.price,
      commission: commissionAmount,
      seller_receives: sellerAmount,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("marketplace-checkout error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
