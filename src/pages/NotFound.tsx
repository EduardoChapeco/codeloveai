import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <p className="lv-stat text-7xl mb-4">404</p>
        <h1 className="lv-heading-lg mb-2">Página não encontrada</h1>
        <p className="lv-body mb-8">A página que você procura não existe ou foi movida.</p>
        <Link to="/" className="lv-btn-primary">
          Voltar ao início
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
