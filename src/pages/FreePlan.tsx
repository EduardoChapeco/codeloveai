import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";
import { Loader2, CheckCircle, XCircle, Gift } from "lucide-react";
import MeshBackground from "@/components/MeshBackground";
import { toast } from "sonner";

export default function FreePlan() {
  const { user, loading: authLoading } = useAuth();
  const { tenant } = useTenant();
  const brandName = tenant?.name || "Starble";
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code");

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      const returnPath = `/free?code=${code || ""}`;
      navigate(`/login?returnTo=${encodeURIComponent(returnPath)}`);
    }
  }, [user, authLoading, navigate, code]);

  const activateFreePlan = async () => {
    if (!code) {
      toast.error("Código inválido.");
      return;
    }
    setStatus("loading");
    try {
      const { data, error } = await supabase.functions.invoke("activate-free-plan", {
        body: { code },
      });
      if (error) throw error;
      if (data?.error) {
        setErrorMsg(data.error);
        setStatus("error");
        return;
      }
      setStatus("success");
      toast.success("Plano Grátis ativado — 10 mensagens/dia!");
    } catch (err: any) {
      console.error("Free plan error:", err);
      setErrorMsg(err?.message || "Erro ao ativar plano.");
      setStatus("error");
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen relative">
      <MeshBackground />
      <nav className="sticky top-0 z-20 px-6 py-3">
        <div className="lv-glass rounded-2xl px-5 py-2.5 flex items-center justify-between">
          <Link to="/" className="text-base font-semibold tracking-tight text-foreground">{brandName}</Link>
          <Link to="/login" className="lv-btn-secondary h-9 px-4 text-xs">Entrar</Link>
        </div>
      </nav>

      <div className="max-w-md mx-auto px-6 py-20 text-center">
        {status === "idle" && (
          <div className="clf-liquid-glass p-10">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Gift className="h-7 w-7 text-primary" />
            </div>
            <p className="lv-overline mb-2">Plano gratuito</p>
            <h1 className="lv-heading-lg mb-3">10 mensagens/dia</h1>
            <p className="lv-body mb-8">
              Ative seu plano gratuito de 10 mensagens diárias para usar a extensão.
              Sem custos, sem compromisso.
            </p>
            {code ? (
              <button onClick={activateFreePlan} className="lv-btn-primary lv-btn-lg w-full">
                Ativar testdrive gratuito
              </button>
            ) : (
              <p className="text-sm text-destructive">Link inválido. Solicite um novo link ao administrador.</p>
            )}
          </div>
        )}

        {status === "loading" && (
          <div className="clf-liquid-glass p-10">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-6" />
            <p className="lv-overline">Ativando...</p>
          </div>
        )}

        {status === "success" && (
          <div className="clf-liquid-glass p-10">
            <div className="h-16 w-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-7 w-7 text-green-500" />
            </div>
            <p className="lv-overline mb-2">Ativado!</p>
            <h2 className="lv-heading-lg mb-3">Plano Grátis ativo</h2>
            <p className="lv-body mb-8">
              Seu plano de 10 mensagens/dia foi ativado com sucesso. Acesse seu dashboard para começar.
            </p>
            <Link to="/dashboard" className="lv-btn-primary lv-btn-lg w-full">
              Ir para dashboard
            </Link>
          </div>
        )}

        {status === "error" && (
          <div className="clf-liquid-glass p-10">
            <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-6">
              <XCircle className="h-7 w-7 text-destructive" />
            </div>
            <p className="lv-overline mb-2">Erro</p>
            <h2 className="lv-heading-lg mb-3">Não foi possível ativar</h2>
            <p className="lv-body mb-8">{errorMsg}</p>
            <Link to="/dashboard" className="lv-btn-secondary lv-btn-lg w-full">
              Ir para dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}