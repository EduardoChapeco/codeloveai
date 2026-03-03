import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTenant } from "@/contexts/TenantContext";
import MeshBackground from "@/components/MeshBackground";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const brandName = tenant?.name || "Starble";

  useEffect(() => {
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
    <div className="min-h-screen flex items-center justify-center px-6 relative">
      <MeshBackground />
      <div className="w-full max-w-sm animate-fade-in">
        <Link to="/" className="block text-center mb-10">
          <span className="text-lg font-semibold tracking-tight text-foreground">{brandName}</span>
        </Link>

        <div className="rd-card" style={{ padding: "2rem" }}>
          <h1 className="rd-heading text-center mb-6">Nova senha</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="rd-label mb-1.5 block">Nova senha</label>
              <input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rd-input"
                minLength={6}
                required
              />
            </div>
            <button type="submit" disabled={loading} className="gl primary w-full">
              {loading ? "Salvando..." : "Salvar nova senha"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
