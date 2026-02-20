import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
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
      toast.success("Conta criada! Verifique seu email para confirmar.");
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-8">
      <div className="w-full max-w-md">
        <Link to="/" className="ep-label text-sm tracking-[0.3em] block text-center mb-12">
          CODELOVE AI
        </Link>
        <h1 className="ep-section-title text-center mb-12">CRIAR CONTA</h1>
        <form onSubmit={handleRegister} className="space-y-4">
          <input
            type="text"
            placeholder="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="ep-input w-full border border-border px-6"
            required
          />
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
            minLength={6}
            required
          />
          <button type="submit" disabled={loading} className="ep-btn-primary w-full">
            {loading ? "CRIANDO..." : "CRIAR CONTA"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground font-medium">
          Já tem conta?{" "}
          <Link to="/login" className="text-foreground font-bold hover:underline">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
