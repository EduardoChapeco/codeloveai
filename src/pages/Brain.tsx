import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSEO } from "@/hooks/useSEO";
import AppLayout from "@/components/AppLayout";
import StarbleStarAIPage from "@/pages/redesign/StarbleStarAIPage";

export default function Brain() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  useSEO({ title: "AI" });

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  if (authLoading || !user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-0)" }}>
        <p style={{ color: "var(--text-tertiary)", fontSize: 12 }}>Carregando...</p>
      </div>
    );
  }

  return (
    <AppLayout>
      <StarbleStarAIPage />
    </AppLayout>
  );
}
