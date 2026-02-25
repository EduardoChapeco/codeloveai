import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useSEO } from "@/hooks/useSEO";
import { useTenant } from "@/contexts/TenantContext";
import { isDisposableEmail } from "@/lib/disposable-emails";
import MeshBackground from "@/components/MeshBackground";

export default function Register() {
  const { user, loading: authLoading } = useAuth();
  const { tenant } = useTenant();
  const brandName = tenant?.name || "Starble";
  useSEO({ title: "Criar conta" });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isAffiliate = searchParams.get("tipo") === "afiliado";
  const refCode = searchParams.get("ref");
  const [wantAffiliate, setWantAffiliate] = useState(isAffiliate);

  useEffect(() => {
    if (!authLoading && user) navigate("/dashboard", { replace: true });
  }, [user, authLoading, navigate]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDisposableEmail(email)) {
      toast.error("Emails temporários não são permitidos. Use um email permanente.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, want_affiliate: wantAffiliate, ref_code: refCode || undefined },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Conta criada! Redirecionando...");
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 relative">
      <MeshBackground />

      <div className="w-full max-w-sm animate-fade-in">
        <Link to="/" className="block text-center mb-10">
          {tenant?.logo_url ? (
            <img src={tenant.logo_url} alt={brandName} className="h-8 mx-auto" />
          ) : (
            <span className="text-lg font-semibold tracking-tight text-foreground">{brandName}</span>
          )}
        </Link>

        <div className="clf-liquid-glass p-8">
          <h1 className="lv-heading-md text-center mb-6">Criar conta</h1>
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="lv-caption mb-1.5 block">Nome</label>
              <input
                type="text"
                placeholder="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="lv-input"
                required
              />
            </div>
            <div>
              <label className="lv-caption mb-1.5 block">Email</label>
              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="lv-input"
                required
              />
            </div>
            <div>
              <label className="lv-caption mb-1.5 block">Senha</label>
              <input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="lv-input"
                minLength={6}
                required
              />
            </div>
            {/* Affiliate checkbox */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={wantAffiliate} onChange={(e) => setWantAffiliate(e.target.checked)} className="rounded border-border" />
              <span className="lv-body">Quero ser afiliado (ganhe 30% de comissão)</span>
            </label>
            {refCode && (
              <div className="lv-card-sm bg-accent/50">
                <p className="lv-caption">Indicado por: <strong className="text-foreground">{refCode}</strong></p>
              </div>
            )}
            <button type="submit" disabled={loading} className="lv-btn-primary w-full">
              {loading ? "Criando..." : "Criar conta"}
            </button>
          </form>

          <p className="mt-5 text-center lv-caption">
            Já tem conta?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">Entrar</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
