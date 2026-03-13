import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSEO } from "@/hooks/useSEO";
import { useTenant } from "@/contexts/TenantContext";
import MeshBackground from "@/components/MeshBackground";

export default function ForgotPassword() {
  const { tenant } = useTenant();
  const brandName = tenant?.name || "OrbIOS";
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  useSEO({ title: "Esqueci a senha" });

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

        <div className="rd-card" style={{ padding: "2rem" }}>
          <h1 className="rd-heading text-center mb-6">Recuperar senha</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
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
            <button type="submit" disabled={loading} className="gl primary w-full">
              {loading ? "Enviando..." : "Enviar link de recuperação"}
            </button>
          </form>

          <p className="mt-5 text-center rd-label">
            <Link to="/login" className="text-primary font-medium hover:underline">Voltar ao login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
