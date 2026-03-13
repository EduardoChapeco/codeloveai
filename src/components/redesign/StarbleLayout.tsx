import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import StarbleSidebar from "./StarbleSidebar";
import StarbleTopbar from "./StarbleTopbar";

export default function StarbleLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  // Ensure dark mode is default
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  // No layout for unauthenticated routes
  if (loading || !user) {
    return <>{children}</>;
  }

  return (
    <div id="app-shell">
      <StarbleSidebar />
      <div id="main">
        <StarbleTopbar />
        <div className="page" style={{ display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
