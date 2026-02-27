import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import {
  Loader2, CheckCircle2, Circle, ArrowLeft, Shield, MapPin,
  AlertTriangle, Copy, ExternalLink, Lock, Eye, Package, Handshake,
  DollarSign, FileText, Ban,
} from "lucide-react";
import { toast } from "sonner";

const STEPS = [
  {
    number: 1,
    title: "Início do Onboarding",
    description: "Vendedor inicia a apresentação guiada do projeto ao comprador.",
    actor: "seller",
  },
  {
    number: 2,
    title: "Demonstração & Dúvidas",
    description: "Vendedor demonstra funcionalidades. Comprador tira dúvidas.",
    actor: "seller",
  },
  {
    number: 3,
    title: "Acesso como Visualizador",
    description: "Vendedor duplica o projeto e adiciona comprador como Viewer para teste.",
    actor: "seller",
  },
  {
    number: 4,
    title: "Confirmação do Projeto",
    description: "Comprador confirma que o projeto é o mesmo do anúncio e aprova.",
    actor: "buyer",
  },
  {
    number: 5,
    title: "Liberação do Pagamento",
    description: "Comprador confirma entrega e libera o valor para o vendedor.",
    actor: "buyer",
  },
];

export default function MarketplaceOnboarding() {
  const { purchaseId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [onboarding, setOnboarding] = useState<any>(null);
  const [steps, setSteps] = useState<any[]>([]);
  const [purchase, setPurchase] = useState<any>(null);
  const [listing, setListing] = useState<any>(null);
  const [confirming, setConfirming] = useState(false);
  const [locationGranted, setLocationGranted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const isBuyer = user?.id === onboarding?.buyer_id;
  const isSeller = user?.id === onboarding?.seller_id;

  const load = useCallback(async () => {
    if (!purchaseId || !user) return;
    // Load purchase
    const { data: p } = await supabase
      .from("marketplace_purchases")
      .select("*")
      .eq("id", purchaseId)
      .single();
    if (!p) { navigate("/marketplace"); return; }
    setPurchase(p);

    // Load listing
    const { data: l } = await supabase
      .from("marketplace_listings")
      .select("*")
      .eq("id", p.listing_id)
      .single();
    setListing(l);

    // Load onboarding
    const { data: ob } = await supabase
      .from("marketplace_onboarding")
      .select("*")
      .eq("purchase_id", purchaseId)
      .maybeSingle();
    setOnboarding(ob);

    if (ob) {
      const { data: st } = await supabase
        .from("marketplace_onboarding_steps")
        .select("*")
        .eq("onboarding_id", ob.id)
        .order("step_number");
      setSteps(st || []);
    }
    setLoading(false);
  }, [purchaseId, user, navigate]);

  useEffect(() => { load(); }, [load]);

  const requestLocation = async () => {
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true })
      );
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };

      // Save location
      await supabase.from("marketplace_location_log").insert({
        user_id: user!.id,
        purchase_id: purchaseId,
        latitude: loc.lat,
        longitude: loc.lng,
        accuracy: loc.accuracy,
        consent_given: true,
      } as any);

      // Update onboarding
      if (onboarding) {
        const field = isBuyer ? "location_consent_buyer" : "location_consent_seller";
        const locField = isBuyer ? "buyer_location" : "seller_location";
        await supabase.from("marketplace_onboarding")
          .update({ [field]: true, [locField]: loc } as any)
          .eq("id", onboarding.id);
      }

      setLocationGranted(true);
      toast.success("Localização registrada com sucesso");
    } catch {
      toast.error("Você precisa permitir localização para continuar a transação.");
    }
  };

  const completeStep = async (stepNum: number) => {
    if (!onboarding) return;
    setConfirming(true);
    try {
      const step = steps.find(s => s.step_number === stepNum);
      if (step) {
        await supabase.from("marketplace_onboarding_steps")
          .update({ completed_at: new Date().toISOString(), completed_by: user!.id } as any)
          .eq("id", step.id);
      }

      const updates: any = { current_step: stepNum + 1 };
      if (stepNum === 4) {
        updates.buyer_confirmed_project_at = new Date().toISOString();
        updates.status = "buyer_review";
      }
      if (stepNum === 5) {
        updates.buyer_confirmed_delivery_at = new Date().toISOString();
        updates.status = "confirmed";
        updates.payout_released_at = new Date().toISOString();

        // Update invoice to ready
        await supabase.from("marketplace_seller_invoices")
          .update({ buyer_confirmed: true, status: "ready" } as any)
          .eq("purchase_id", purchaseId);

        // Update purchase to delivered
        await supabase.from("marketplace_purchases")
          .update({ status: "delivered" } as any)
          .eq("id", purchaseId);
      }

      await supabase.from("marketplace_onboarding")
        .update(updates)
        .eq("id", onboarding.id);

      toast.success(stepNum === 5 ? "Entrega confirmada! Pagamento será liberado ao vendedor." : "Etapa concluída!");
      await load();
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "tente novamente"));
    } finally {
      setConfirming(false);
    }
  };

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </AppLayout>
  );

  if (!onboarding) return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-6 py-12 text-center">
        <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
        <h2 className="text-lg font-bold mb-2">Onboarding não iniciado</h2>
        <p className="text-sm text-muted-foreground">O vendedor ainda não iniciou o onboarding deste projeto.</p>
      </div>
    </AppLayout>
  );

  const currentStep = onboarding.current_step || 1;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </button>

        <div className="clf-liquid-glass rounded-2xl p-6 mb-6">
          <h1 className="text-xl font-bold mb-1">Onboarding — {listing?.title}</h1>
          <p className="text-xs text-muted-foreground mb-4">
            {isSeller ? "Você é o vendedor. Guie o comprador pelo projeto." : "Você é o comprador. Acompanhe a demonstração."}
          </p>

          {/* Location consent */}
          {!locationGranted && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-amber-600">Localização Obrigatória</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Para segurança de ambas as partes, é obrigatório compartilhar sua localização ao vivo durante a transação.
                    Rastreamos todas as transações para garantir um ambiente seguro.
                  </p>
                  <button onClick={requestLocation} className="mt-3 px-4 py-2 rounded-xl bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition-colors flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5" /> Permitir Localização
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Legal warnings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3">
              <div className="flex items-start gap-2">
                <Ban className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-bold text-red-500">Não faça pagamentos por fora</p>
                  <p className="text-[10px] text-muted-foreground">A plataforma não se responsabiliza por pagamentos feitos fora do sistema.</p>
                </div>
              </div>
            </div>
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-bold text-blue-500">Transações monitoradas</p>
                  <p className="text-[10px] text-muted-foreground">Localização, IP e dispositivo são registrados para sua segurança.</p>
                </div>
              </div>
            </div>
            <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-bold text-orange-500">Produto digital — sem devoluções</p>
                  <p className="text-[10px] text-muted-foreground">Após confirmação de entrega, não será possível devolver valores. Art. 49 CDC não se aplica a produtos digitais após acesso.</p>
                </div>
              </div>
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
              <div className="flex items-start gap-2">
                <Eye className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-bold text-primary">Recomendação ao vendedor</p>
                  <p className="text-[10px] text-muted-foreground">Duplique o projeto e adicione o comprador como Viewer antes de liberar acesso total.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Buyer email for seller */}
          {isSeller && purchase && (
            <div className="clf-liquid-glass rounded-xl p-4 mb-6 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-muted-foreground">Email do comprador (para adicionar como Viewer):</p>
                <p className="text-sm font-mono font-bold">{purchase.buyer_id}</p>
              </div>
              <button onClick={() => { navigator.clipboard?.writeText(purchase.buyer_id); toast.success("Copiado!"); }}
                className="p-2 rounded-lg hover:bg-muted/30 transition-colors">
                <Copy className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          )}
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {STEPS.map((step) => {
            const dbStep = steps.find(s => s.step_number === step.number);
            const isCompleted = !!dbStep?.completed_at;
            const isCurrent = step.number === currentStep;
            const isLocked = step.number > currentStep;
            const canAct = isCurrent && !isCompleted && locationGranted &&
              ((step.actor === "seller" && isSeller) || (step.actor === "buyer" && isBuyer));

            return (
              <div key={step.number} className={`clf-liquid-glass rounded-2xl p-5 transition-all ${
                isCompleted ? "border-green-500/30 bg-green-500/5" :
                isCurrent ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20" :
                "opacity-50"
              }`}>
                <div className="flex items-start gap-4">
                  <div className="mt-0.5">
                    {isCompleted ? (
                      <CheckCircle2 className="h-6 w-6 text-green-500" />
                    ) : isLocked ? (
                      <Lock className="h-6 w-6 text-muted-foreground/30" />
                    ) : (
                      <Circle className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-muted-foreground">Etapa {step.number}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${
                        step.actor === "seller" ? "bg-purple-500/10 text-purple-500" : "bg-blue-500/10 text-blue-500"
                      }`}>
                        {step.actor === "seller" ? "Vendedor" : "Comprador"}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold">{step.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{step.description}</p>

                    {/* Step 4 — buyer confirms project match */}
                    {step.number === 4 && isCurrent && isBuyer && !isCompleted && (
                      <div className="mt-4 bg-muted/20 rounded-xl p-4">
                        <p className="text-xs text-muted-foreground mb-3">
                          Ao confirmar, você atesta que o projeto apresentado corresponde exatamente ao anúncio publicado na loja.
                          Verifique todas as funcionalidades antes de prosseguir.
                        </p>
                        <label className="flex items-start gap-2 text-xs cursor-pointer mb-3">
                          <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)}
                            className="mt-0.5 rounded border-border" />
                          <span className="text-muted-foreground">
                            Confirmo que o projeto é o mesmo do anúncio, testei as funcionalidades e estou satisfeito(a) com a entrega.
                          </span>
                        </label>
                      </div>
                    )}

                    {/* Step 5 — buyer releases payment */}
                    {step.number === 5 && isCurrent && isBuyer && !isCompleted && (
                      <div className="mt-4 bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                        <div className="flex items-start gap-2 mb-3">
                          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                          <p className="text-xs text-red-600 font-semibold">
                            ATENÇÃO: Ao liberar o pagamento, o valor será transferido ao vendedor após 7 dias.
                            Esta ação é IRREVERSÍVEL. Não será possível solicitar reembolso após a confirmação.
                          </p>
                        </div>
                        <p className="text-[10px] text-muted-foreground mb-3">
                          Art. 49 do CDC: O direito de arrependimento não se aplica a produtos digitais após acesso integral ao conteúdo.
                          Ao confirmar, você declara que recebeu o produto digital conforme acordado e que a prestação de serviço foi concluída.
                        </p>
                        <label className="flex items-start gap-2 text-xs cursor-pointer">
                          <input type="checkbox" checked={showTerms} onChange={e => setShowTerms(e.target.checked)}
                            className="mt-0.5 rounded border-border" />
                          <span className="text-muted-foreground">
                            Li e aceito os termos. Autorizo a liberação do valor de R$ {purchase?.price?.toFixed(2)} ao vendedor.
                            Entendo que não haverá devolução após esta confirmação.
                          </span>
                        </label>
                      </div>
                    )}

                    {canAct && (
                      <button
                        onClick={() => completeStep(step.number)}
                        disabled={confirming || (step.number === 4 && !termsAccepted) || (step.number === 5 && !showTerms)}
                        className="mt-4 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-40"
                      >
                        {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> :
                         step.number === 5 ? <DollarSign className="h-4 w-4" /> :
                         step.number === 4 ? <Handshake className="h-4 w-4" /> :
                         <CheckCircle2 className="h-4 w-4" />}
                        {step.number === 5 ? "Liberar Pagamento" :
                         step.number === 4 ? "Confirmar Projeto" :
                         "Concluir Etapa"}
                      </button>
                    )}

                    {isCompleted && dbStep && (
                      <p className="text-[10px] text-green-600 mt-2">
                        Concluída em {new Date(dbStep.completed_at).toLocaleString("pt-BR")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Invoice info for seller */}
        {isSeller && onboarding.status === "confirmed" && (
          <div className="clf-liquid-glass rounded-2xl p-6 mt-6 bg-green-500/5 border-green-500/30">
            <div className="flex items-center gap-3 mb-3">
              <FileText className="h-5 w-5 text-green-500" />
              <h3 className="text-sm font-bold text-green-600">Pagamento Confirmado</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              O comprador confirmou a entrega. Seu pagamento de <strong>R$ {purchase?.seller_amount?.toFixed(2) || "—"}</strong> será
              processado em até 7 dias úteis após a confirmação. Você receberá uma fatura detalhada.
            </p>
          </div>
        )}

        {/* CDC and legal notice */}
        <div className="mt-8 clf-liquid-glass rounded-2xl p-6">
          <h3 className="text-xs font-bold mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" /> Avisos Legais e Regras CDC
          </h3>
          <div className="space-y-2 text-[10px] text-muted-foreground/80 leading-relaxed">
            <p>• <strong>Produto Digital:</strong> Conforme Art. 49 do CDC, o direito de arrependimento de 7 dias aplica-se a compras fora do estabelecimento. Porém, para produtos digitais com acesso imediato ao conteúdo, o consumidor pode renunciar a esse direito mediante aceite expresso antes do acesso, conforme Art. 49 §único e interpretação jurisprudencial.</p>
            <p>• <strong>Prestação de Serviço:</strong> O onboarding guiado configura prestação de serviço digital. Considera-se concluída após o comprador confirmar o recebimento e aprovar o projeto.</p>
            <p>• <strong>Pagamentos Externos:</strong> A plataforma NÃO se responsabiliza por pagamentos realizados fora do sistema. Toda transação deve ocorrer exclusivamente pela plataforma.</p>
            <p>• <strong>Segurança:</strong> Todas as transações são monitoradas. Registramos localização (com consentimento), IP e dispositivo para prevenir fraudes. Denúncias podem ser feitas ao suporte.</p>
            <p>• <strong>Vendedores:</strong> Recomendamos duplicar o projeto antes do onboarding. Adicione o comprador como "Viewer/Visualizador" para que ele teste sem acesso de edição. O acesso de edição só deve ser liberado na penúltima etapa.</p>
            <p>• <strong>Prazo de Pagamento:</strong> O valor é retido por 7 dias após a confirmação de entrega antes do repasse ao vendedor, como medida de segurança contra chargebacks.</p>
            <p>• <strong>Comissão:</strong> A plataforma retém 30% do valor como taxa de intermediação. O vendedor recebe 70%.</p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
