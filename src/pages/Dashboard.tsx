import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSEO } from "@/hooks/useSEO";
import AppLayout from "@/components/AppLayout";
import StarbleChatPage from "@/pages/redesign/StarbleChatPage";
import { MessageCircle, Plug } from "lucide-react";
import { lazy, Suspense } from "react";

const LovableConnect = lazy(() => import("@/pages/LovableConnect"));

type DashTab = "chat" | "painel";

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  useSEO({ title: "Home" });

  // Determine initial tab from route
  const isPainelRoute = location.pathname === "/painel" || location.pathname === "/lovable/connect";
  const [tab, setTab] = useState<DashTab>(isPainelRoute ? "painel" : "chat");

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  // Sync tab when route changes
  useEffect(() => {
    if (isPainelRoute) setTab("painel");
  }, [isPainelRoute]);

  if (authLoading || !user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-0)" }}>
        <p style={{ color: "var(--text-tertiary)", fontSize: 12 }}>Carregando...</p>
      </div>
    );
  }

  return (
    <AppLayout>
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Tab strip */}
        <div style={{
          display: "flex", gap: 2, padding: "8px 24px 0",
          borderBottom: "1px solid var(--b0)", flexShrink: 0,
        }}>
          <button
            onClick={() => setTab("chat")}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 16px", fontSize: 12, fontWeight: 600,
              color: tab === "chat" ? "var(--tp)" : "var(--tq)",
              borderBottom: tab === "chat" ? "2px solid var(--orange)" : "2px solid transparent",
              background: "transparent", border: "none", borderBottomStyle: "solid",
              cursor: "pointer", fontFamily: "var(--sans)",
              transition: "color 0.15s",
            }}
          >
            <MessageCircle size={13} /> Chat IA
          </button>
          <button
            onClick={() => setTab("painel")}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 16px", fontSize: 12, fontWeight: 600,
              color: tab === "painel" ? "var(--tp)" : "var(--tq)",
              borderBottom: tab === "painel" ? "2px solid var(--blue-l)" : "2px solid transparent",
              background: "transparent", border: "none", borderBottomStyle: "solid",
              cursor: "pointer", fontFamily: "var(--sans)",
              transition: "color 0.15s",
            }}
          >
            <Plug size={13} /> Painel
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {tab === "chat" ? (
            <StarbleChatPage />
          ) : (
            <Suspense fallback={
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p style={{ color: "var(--tq)", fontSize: 12 }}>Carregando...</p>
              </div>
            }>
              <LovableConnect embedded />
            </Suspense>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
