import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useSEO } from "@/hooks/useSEO";
import { isDisposableEmail } from "@/lib/disposable-emails";

export default function Register() {
  const { user, loading: authLoading } = useAuth();
  useSEO({ title: "Criar conta" });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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
        data: { name },
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
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link to="/" className="block text-center mb-10">
          <span className="text-lg font-semibold tracking-tight text-foreground">CodeLove AI</span>
        </Link>

        <div className="lv-card p-8">
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
