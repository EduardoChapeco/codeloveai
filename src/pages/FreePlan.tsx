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
  const brandName = tenant?.name || "Engios";
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
    if (!code) { toast.error("Código inválido."); return; }
    setStatus("loading");
    try {
      const { data, error } = await supabase.functions.invoke("activate-free-plan", { body: { code } });
      if (error) throw error;
      if (data?.error) { setErrorMsg(data.error); setStatus("error"); return; }
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-0)' }}>
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="dark min-h-screen relative" style={{ background: 'var(--bg-0)' }}>
      <MeshBackground />
      <nav className="sticky top-0 z-20 px-6 py-3">
        <div className="lv-glass" style={{ borderRadius: 'var(--r4)', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link to="/" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', textDecoration: 'none' }}>{brandName}</Link>
          <Link to="/login" className="gl sm">Entrar</Link>
        </div>
      </nav>

      <div style={{ maxWidth: 420, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
        {status === "idle" && (
          <div className="rd-card" style={{ padding: 40 }}>
            <div className="rd-ico-box ib-blue" style={{ width: 64, height: 64, borderRadius: 'var(--r4)', margin: '0 auto 24px' }}>
              <Gift style={{ width: 28, height: 28 }} />
            </div>
            <div className="sec-label" style={{ marginBottom: 8 }}>Plano gratuito</div>
            <h1 className="title-xl" style={{ marginBottom: 12 }}>10 mensagens/dia</h1>
            <p className="body-text" style={{ marginBottom: 32 }}>
              Ative seu plano gratuito de 10 mensagens diárias para usar a extensão. Sem custos, sem compromisso.
            </p>
            {code ? (
              <button onClick={activateFreePlan} className="gl primary lg" style={{ width: '100%' }}>
                Ativar testdrive gratuito
              </button>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--red-l)' }}>Link inválido. Solicite um novo link ao administrador.</p>
            )}
          </div>
        )}

        {status === "loading" && (
          <div className="rd-card" style={{ padding: 40 }}>
            <Loader2 className="h-10 w-10 animate-spin" style={{ color: 'var(--blue)', margin: '0 auto 24px', display: 'block' }} />
            <div className="sec-label">Ativando...</div>
          </div>
        )}

        {status === "success" && (
          <div className="rd-card" style={{ padding: 40 }}>
            <div className="rd-ico-box ib-green" style={{ width: 64, height: 64, borderRadius: 'var(--r4)', margin: '0 auto 24px' }}>
              <CheckCircle style={{ width: 28, height: 28 }} />
            </div>
            <div className="sec-label" style={{ marginBottom: 8 }}>Ativado!</div>
            <h2 className="title-xl" style={{ marginBottom: 12 }}>Plano Grátis ativo</h2>
            <p className="body-text" style={{ marginBottom: 32 }}>
              Seu plano de 10 mensagens/dia foi ativado com sucesso. Acesse seu dashboard para começar.
            </p>
            <Link to="/home" className="gl primary lg" style={{ width: '100%', textDecoration: 'none' }}>
              Ir para dashboard
            </Link>
          </div>
        )}

        {status === "error" && (
          <div className="rd-card" style={{ padding: 40 }}>
            <div className="rd-ico-box ib-red" style={{ width: 64, height: 64, borderRadius: 'var(--r4)', margin: '0 auto 24px' }}>
              <XCircle style={{ width: 28, height: 28 }} />
            </div>
            <div className="sec-label" style={{ marginBottom: 8 }}>Erro</div>
            <h2 className="title-xl" style={{ marginBottom: 12 }}>Não foi possível ativar</h2>
            <p className="body-text" style={{ marginBottom: 32 }}>{errorMsg}</p>
            <Link to="/home" className="gl lg" style={{ width: '100%', textDecoration: 'none' }}>
              Ir para dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
