import { useAuth } from "@/hooks/useAuth";
import StarbleSidebar from "./StarbleSidebar";
import StarbleTopbar from "./StarbleTopbar";

export default function StarbleLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  // No layout for unauthenticated routes
  if (loading || !user) {
    return <>{children}</>;
  }

  return (
    <div className="dark">
      <StarbleSidebar />
      <div id="main">
        <StarbleTopbar />
        <div className="page">
          {children}
        </div>
      </div>
    </div>
  );
}
