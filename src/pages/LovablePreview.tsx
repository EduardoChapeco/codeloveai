import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLovableProxy } from "@/hooks/useLovableProxy";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { toast } from "sonner";
import { Loader2, ExternalLink, RefreshCw, Copy, Monitor, Link2, AlertTriangle, ChevronDown } from "lucide-react";

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
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"active" | "expired" | "none" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);

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

  // Load saved projects for dropdown
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

  // Auto-load preview when projectId changes from URL
  useEffect(() => {
    const pid = searchParams.get("projectId");
    if (pid && pid !== projectId) {
      setProjectId(pid);
    }
  }, [searchParams]);

  useEffect(() => {
    if (projectId) loadPreview();
  }, [projectId]);

  const loadPreview = () => {
    if (!projectId.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    setPreviewUrl(null);

    try {
      // Construct the preview URL using the known pattern
      const url = `https://id-preview--${projectId.trim()}.lovable.app`;
      setPreviewUrl(url);
    } catch {
      setErrorMsg("ID de projeto inválido.");
    } finally {
      setLoading(false);
    }
  };

  const handleProjectSelect = (pid: string) => {
    setProjectId(pid);
    navigate(`/lovable/preview?projectId=${pid}`, { replace: true });
  };

  if (authLoading || !user) return <div className="min-h-screen bg-background" />;

  if (connectionStatus === "none" || connectionStatus === "expired") {
    return (
      <AppLayout>
        <div className="max-w-xl mx-auto px-6 py-20 text-center">
          {connectionStatus === "expired" ? (
            <>
              <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
              <h2 className="lv-heading-sm mb-2">Token expirado</h2>
              <p className="lv-body mb-6">Reconecte sua conta Lovable para visualizar previews.</p>
            </>
          ) : (
            <>
              <Link2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="lv-heading-sm mb-2">Não conectado</h2>
              <p className="lv-body mb-6">Conecte sua conta Lovable primeiro.</p>
            </>
          )}
          <button onClick={() => navigate("/lovable/connect")} className="lv-btn-primary h-11 px-8 text-sm">
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

          {/* Project selector dropdown */}
          {savedProjects.length > 0 && (
            <div className="relative">
              <select
                value={projectId}
                onChange={(e) => handleProjectSelect(e.target.value)}
                className="lv-input h-9 px-3 pr-8 text-xs appearance-none cursor-pointer min-w-[200px]"
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

          <input
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            placeholder="ID do projeto (UUID)"
            className="lv-input flex-1 h-9 font-mono text-sm min-w-[150px]"
            onKeyDown={(e) => e.key === "Enter" && loadPreview()}
          />

          <button
            onClick={loadPreview}
            disabled={loading || !projectId.trim()}
            className="lv-btn-primary h-9 px-4 text-xs flex items-center gap-1.5"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Carregar
          </button>

          {previewUrl && (
            <>
              <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="lv-btn-secondary h-9 px-3 text-xs flex items-center gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" /> Nova aba
              </a>
              <button onClick={() => { navigator.clipboard.writeText(previewUrl); toast.success("Link copiado!"); }} className="lv-btn-secondary h-9 px-3 text-xs flex items-center gap-1.5">
                <Copy className="h-3.5 w-3.5" /> Copiar
              </button>
            </>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="lv-caption mt-3">Carregando preview...</p>
            </div>
          </div>
        ) : errorMsg ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md px-4">
              <AlertTriangle className="h-10 w-10 mx-auto text-amber-500 mb-3" />
              <p className="lv-body-strong mb-2">Erro ao carregar</p>
              <p className="lv-caption">{errorMsg}</p>
              <button onClick={loadPreview} className="lv-btn-secondary h-9 px-4 text-xs mt-4">
                Tentar novamente
              </button>
            </div>
          </div>
        ) : previewUrl ? (
          <div className="flex-1 relative">
            <iframe
              src={previewUrl}
              className="w-full h-full border-0"
              title="Lovable Preview"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Monitor className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="lv-body-strong mb-1">Preview de Projetos</p>
              <p className="lv-caption">
                {savedProjects.length > 0
                  ? "Selecione um projeto acima ou insira o ID manualmente"
                  : "Insira o ID do projeto e clique em Carregar"}
              </p>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
