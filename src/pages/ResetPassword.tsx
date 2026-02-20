import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check for recovery token in URL
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    if (hashParams.get("type") !== "recovery") {
      // Still allow the page to render for manual access
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Senha atualizada com sucesso!");
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-8">
      <div className="w-full max-w-md">
        <Link to="/" className="ep-label text-sm tracking-[0.3em] block text-center mb-12">
          CODELOVE AI
        </Link>
        <h1 className="ep-section-title text-center mb-12">NOVA SENHA</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="Nova senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="ep-input w-full border border-border px-6"
            minLength={6}
            required
          />
          <button type="submit" disabled={loading} className="ep-btn-primary w-full">
            {loading ? "SALVANDO..." : "SALVAR NOVA SENHA"}
          </button>
        </form>
      </div>
    </div>
  );
}
