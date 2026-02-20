import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, CheckCircle, XCircle, Gift } from "lucide-react";
import { toast } from "sonner";

export default function FreePlan() {
  const { user, loading: authLoading } = useAuth();
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
      toast.success("Plano gratuito ativado!");
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
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-20 bg-background border-b border-border px-8 py-5 flex items-center justify-between">
        <Link to="/" className="ep-label text-sm tracking-[0.3em]">CODELOVE AI</Link>
      </nav>

      <div className="max-w-lg mx-auto px-8 py-20 text-center">
        {status === "idle" && (
          <>
            <Gift className="h-16 w-16 text-foreground mx-auto mb-6" />
            <p className="ep-subtitle mb-2">PLANO GRATUITO</p>
            <h1 className="ep-section-title mb-4">1 DIA GRÁTIS</h1>
            <p className="text-sm text-muted-foreground font-medium mb-8">
              Ative seu plano gratuito de 1 dia para testar a extensão CodeLove AI. 
              Sem custos, sem compromisso.
            </p>
            {code ? (
              <button onClick={activateFreePlan} className="ep-btn-primary h-12 px-8 text-[9px]">
                ATIVAR PLANO GRATUITO
              </button>
            ) : (
              <p className="text-sm text-destructive font-medium">Link inválido. Solicite um novo link ao administrador.</p>
            )}
          </>
        )}

        {status === "loading" && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mx-auto mb-6" />
            <p className="ep-subtitle">ATIVANDO...</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
            <p className="ep-subtitle mb-2">ATIVADO!</p>
            <h2 className="ep-section-title mb-4">PLANO GRATUITO ATIVO</h2>
            <p className="text-sm text-muted-foreground font-medium mb-8">
              Seu plano de 1 dia foi ativado com sucesso. Acesse seu dashboard para ver seu token de ativação.
            </p>
            <Link to="/dashboard" className="ep-btn-primary h-12 px-8 text-[9px]">
              IR PARA DASHBOARD
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="h-16 w-16 text-destructive mx-auto mb-6" />
            <p className="ep-subtitle mb-2">ERRO</p>
            <h2 className="ep-section-title mb-4">NÃO FOI POSSÍVEL ATIVAR</h2>
            <p className="text-sm text-muted-foreground font-medium mb-8">{errorMsg}</p>
            <Link to="/dashboard" className="ep-btn-secondary h-12 px-8 text-[9px]">
              IR PARA DASHBOARD
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
