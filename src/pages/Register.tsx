import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useSEO } from "@/hooks/useSEO";
import { useTenant } from "@/contexts/TenantContext";
import { isDisposableEmail } from "@/lib/disposable-emails";

export default function Register() {
  const { user, loading: authLoading } = useAuth();
  const { tenant } = useTenant();
  const brandName = tenant?.name || "OrbIOS";
...
              <span className="rd-body">Ativar OrbIOS AI Brain (assistente IA dedicado)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={wantAffiliate} onChange={(e) => setWantAffiliate(e.target.checked)} className="rounded border-border" />
              <span className="rd-body">Quero ser afiliado (ganhe 30% de comissão)</span>
            </label>
            {refCode && (
              <div className="rd-card" style={{ padding: "0.75rem 1rem", opacity: 0.8 }}>
                <p className="rd-label">Indicado por: <strong className="text-foreground">{refCode}</strong></p>
              </div>
            )}
            <button type="submit" disabled={loading} className="gl primary w-full">
              {loading ? "Criando..." : "Criar conta"}
            </button>
          </form>

          <p className="mt-5 text-center rd-label">
            Já tem conta?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">Entrar</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
