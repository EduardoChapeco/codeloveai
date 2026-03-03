import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLovableProxy } from "@/hooks/useLovableProxy";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { toast } from "sonner";
import { Loader2, ExternalLink, RefreshCw, Copy, Monitor, Link2, AlertTriangle, ChevronDown, Globe } from "lucide-react";

interface SavedProject {
  lovable_project_id: string;
  display_name: string | null;
  name: string | null;
  published_url: string | null;
}

export default function LovablePreview() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { checkConnection } = useLovableProxy();

  const [projectId, setProjectId] = useState(searchParams.get("projectId") || "");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"active" | "expired" | "none" | null>(null);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [iframeError, setIframeError] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login?returnTo=/lovable/preview");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    const check = async () => {
      const status = await checkConnection(user.id);
      setConnectionStatus(status);
    };
    check();
  }, [user, checkConnection]);

  useEffect(() => {
    if (!user) return;
    const loadSaved = async () => {
      const { data } = await supabase
        .from("lovable_projects")
        .select("lovable_project_id, display_name, name, published_url")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (data) setSavedProjects(data);
    };
    loadSaved();
  }, [user]);

  useEffect(() => {
    const pid = searchParams.get("projectId");
    if (pid && pid !== projectId) {
      setProjectId(pid);
    }
  }, [searchParams]);

  useEffect(() => {
    if (projectId) loadPreview();
  }, [projectId]);

  const getPreviewUrl = (pid: string): string => {
    const saved = savedProjects.find(p => p.lovable_project_id === pid);
    if (saved?.published_url) return saved.published_url;
    return `https://id-preview--${pid}.lovable.app`;
  };

  const loadPreview = () => {
    if (!projectId.trim()) return;
    setIframeError(false);
    setPreviewUrl(getPreviewUrl(projectId.trim()));
  };

  const handleProjectSelect = (pid: string) => {
    setProjectId(pid);
    navigate(`/lovable/preview?projectId=${pid}`, { replace: true });
  };

  const handleIframeError = () => {
    const saved = savedProjects.find(p => p.lovable_project_id === projectId);
    const altUrl = `https://id-preview--${projectId}.lovable.app`;
    if (previewUrl !== altUrl) {
      setPreviewUrl(altUrl);
    } else if (saved?.published_url && previewUrl !== saved.published_url) {
      setPreviewUrl(saved.published_url);
    } else {
      setIframeError(true);
    }
  };

  if (authLoading || !user) return <div className="min-h-screen bg-background" />;

  if (connectionStatus === "none" || connectionStatus === "expired") {
    return (
      <AppLayout>
        <div className="rd-page-content text-center" style={{ maxWidth: 480, paddingTop: "5rem" }}>
          {connectionStatus === "expired" ? (
            <>
              <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
              <h2 className="rd-heading mb-2">Token expirado</h2>
              <p className="rd-body mb-6">Reconecte sua conta para visualizar previews.</p>
            </>
          ) : (
            <>
              <Link2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="rd-heading mb-2">Não conectado</h2>
              <p className="rd-body mb-6">Conecte sua conta primeiro.</p>
            </>
          )}
          <button onClick={() => navigate("/lovable/connect")} className="gl primary">
            {connectionStatus === "expired" ? "Reconectar" : "Conectar"}
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col" style={{ height: "calc(100vh - 3rem)" }}>
        {/* Toolbar */}
        <div className="border-b border-border/60 px-6 py-3 flex items-center gap-3 flex-wrap shrink-0">
          <Monitor className="h-4 w-4 text-muted-foreground shrink-0" />

          {savedProjects.length > 0 && (
            <div className="relative">
              <select
                value={projectId}
                onChange={(e) => handleProjectSelect(e.target.value)}
                className="rd-input"
                style={{ height: 36, paddingRight: 28, minWidth: 200, fontSize: 12 }}
              >
                <option value="">Selecionar projeto...</option>
                {savedProjects.map((p) => (
                  <option key={p.lovable_project_id} value={p.lovable_project_id}>
                    {p.display_name || p.name || p.lovable_project_id.slice(0, 8)}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none text-muted-foreground" />
            </div>
          )}

          {previewUrl && (
            <div className="flex items-center gap-2 ml-auto">
              <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="gl sm ghost">
                <ExternalLink className="h-3.5 w-3.5" /> Nova aba
              </a>
              <button onClick={() => {
                const editorUrl = `${window.location.origin}/projeto/${projectId}/editar`;
                navigator.clipboard.writeText(editorUrl);
                toast.success("Link copiado!");
              }} className="gl sm ghost">
                <Copy className="h-3.5 w-3.5" /> Copiar
              </button>
              <button onClick={loadPreview} className="gl sm ghost">
                <RefreshCw className="h-3.5 w-3.5" /> Recarregar
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        {iframeError ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md px-4">
              <AlertTriangle className="h-10 w-10 mx-auto text-amber-500 mb-3" />
              <p className="rd-body mb-2" style={{ fontWeight: 600 }}>Preview indisponível</p>
              <p className="rd-label mb-4">O projeto pode não estar publicado ainda ou o preview expirou.</p>
              <div className="flex gap-3 justify-center">
                <button onClick={loadPreview} className="gl sm ghost">Tentar novamente</button>
                <a href={previewUrl || ""} target="_blank" rel="noopener noreferrer" className="gl sm primary">
                  <ExternalLink className="h-3.5 w-3.5" /> Abrir direto
                </a>
              </div>
            </div>
          </div>
        ) : previewUrl ? (
          <div className="flex-1 relative">
            <iframe
              src={previewUrl}
              className="w-full h-full border-0"
              title="Lovable Preview"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              onError={handleIframeError}
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Monitor className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="rd-body mb-1" style={{ fontWeight: 600 }}>Preview de Projetos</p>
              <p className="rd-label">
                {savedProjects.length > 0
                  ? "Selecione um projeto acima para visualizar"
                  : "Sincronize seus projetos primeiro em Meus Projetos"}
              </p>
              {savedProjects.length === 0 && (
                <button onClick={() => navigate("/lovable/projects")} className="gl sm primary mt-4">
                  <Globe className="h-3.5 w-3.5" /> Ir para Meus Projetos
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
