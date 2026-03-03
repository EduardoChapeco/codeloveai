import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSEO } from "@/hooks/useSEO";
import AppLayout from "@/components/AppLayout";
import StarbleProjectsPage from "@/pages/redesign/StarbleProjectsPage";

export default function LovableProjects() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  useSEO({ title: "Projetos" });

  useEffect(() => {
    if (!authLoading && !user) navigate("/login?returnTo=/lovable/projects");
  }, [user, authLoading, navigate]);

  if (authLoading || !user) {
    return <div style={{ minHeight: "100vh", background: "var(--bg-0)" }} />;
  }

  return (
    <AppLayout>
      <StarbleProjectsPage />
    </AppLayout>
  );
}
