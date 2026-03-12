import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useSEO } from "@/hooks/useSEO";
import { useTenant } from "@/contexts/TenantContext";

export default function Login() {
  const { user, loading: authLoading } = useAuth();
  const { tenant } = useTenant();
  const brandName = tenant?.name || "Starble";
  useSEO({ title: "Entrar" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const getSafeReturnTo = () => {
    const returnTo = searchParams.get("returnTo");
    if (!returnTo || !returnTo.startsWith("/") || returnTo.startsWith("//")) return "/home";
    return returnTo;
  };

  useEffect(() => {
    if (!authLoading && user) {
      navigate(getSafeReturnTo(), { replace: true });
    }
  }, [user, authLoading, navigate, searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      navigate(getSafeReturnTo());
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 relative bg-background">
      <div className="w-full max-w-sm animate-fade-in">
        <Link to="/" className="block text-center mb-10">
          {tenant?.logo_url ? (
            <img src={tenant.logo_url} alt={brandName} className="h-8 mx-auto" />
          ) : (
            <span className="text-lg font-semibold tracking-tight text-foreground">{brandName}</span>
          )}
        </Link>

        <div className="rd-card" style={{ padding: "2rem" }}>
          <h1 className="rd-heading text-center mb-6">Entrar na sua conta</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="rd-label mb-1.5 block">Email</label>
              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rd-input"
                required
              />
            </div>
            <div>
              <label className="rd-label mb-1.5 block">Senha</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rd-input"
                required
              />
            </div>
            <button type="submit" disabled={loading} className="gl primary w-full">
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <div className="mt-5 text-center space-y-2">
            <Link to="/forgot-password" className="rd-label hover:text-foreground transition-colors block">
              Esqueceu a senha?
            </Link>
            <p className="rd-label">
              Não tem conta?{" "}
              <Link to="/register" className="text-primary font-medium hover:underline">Criar conta</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
