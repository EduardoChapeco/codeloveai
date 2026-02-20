import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-8">
      <div className="w-full max-w-md">
        <Link to="/" className="ep-label text-sm tracking-[0.3em] block text-center mb-12">
          CODELOVE AI
        </Link>
        <h1 className="ep-section-title text-center mb-12">ENTRAR</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="ep-input w-full border border-border px-6"
            required
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="ep-input w-full border border-border px-6"
            required
          />
          <button type="submit" disabled={loading} className="ep-btn-primary w-full">
            {loading ? "ENTRANDO..." : "ENTRAR"}
          </button>
        </form>
        <div className="mt-6 text-center space-y-2">
          <Link to="/forgot-password" className="text-sm text-muted-foreground font-medium hover:text-foreground transition-colors">
            Esqueceu a senha?
          </Link>
          <p className="text-sm text-muted-foreground font-medium">
            Não tem conta?{" "}
            <Link to="/register" className="text-foreground font-bold hover:underline">Criar conta</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
