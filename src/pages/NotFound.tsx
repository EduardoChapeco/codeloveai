import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import MeshBackground from "@/components/MeshBackground";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center relative">
      <MeshBackground />
      <div className="text-center animate-fade-in">
        <p className="text-7xl font-extrabold text-foreground mb-4" style={{ letterSpacing: "-0.03em" }}>404</p>
        <h1 className="text-[28px] font-extrabold text-foreground mb-2" style={{ letterSpacing: "-0.03em" }}>Página não encontrada</h1>
        <p className="text-sm text-muted-foreground mb-8">A página que você procura não existe ou foi movida.</p>
        <Link to="/" className="gl primary">
          Voltar ao início
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
