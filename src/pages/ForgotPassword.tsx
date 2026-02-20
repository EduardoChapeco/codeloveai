import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Email de recuperação enviado!");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-8">
      <div className="w-full max-w-md">
        <Link to="/" className="ep-label text-sm tracking-[0.3em] block text-center mb-12">
          CODELOVE AI
        </Link>
        <h1 className="ep-section-title text-center mb-12">RECUPERAR SENHA</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="ep-input w-full border border-border px-6"
            required
          />
          <button type="submit" disabled={loading} className="ep-btn-primary w-full">
            {loading ? "ENVIANDO..." : "ENVIAR LINK"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground font-medium">
          <Link to="/login" className="text-foreground font-bold hover:underline">Voltar ao login</Link>
        </p>
      </div>
    </div>
  );
}
