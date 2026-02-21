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
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link to="/" className="block text-center mb-10">
          <span className="text-lg font-semibold tracking-tight text-foreground">CodeLove AI</span>
        </Link>

        <div className="lv-card p-8">
          <h1 className="lv-heading-md text-center mb-6">Recuperar senha</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
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
            <button type="submit" disabled={loading} className="lv-btn-primary w-full">
              {loading ? "Enviando..." : "Enviar link de recuperação"}
            </button>
          </form>

          <p className="mt-5 text-center lv-caption">
            <Link to="/login" className="text-primary font-medium hover:underline">Voltar ao login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
