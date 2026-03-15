import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLovableProxy } from "@/hooks/useLovableProxy";
import AppLayout from "@/components/AppLayout";
import { toast } from "sonner";
import { Loader2, Upload, Check, Image as ImageIcon, Copy, Link2, AlertTriangle } from "lucide-react";

export default function LovableUploadTest() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { invoke, checkConnection } = useLovableProxy();

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"active" | "expired" | "none" | null>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login?returnTo=/lovable/upload-test");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    const check = async () => {
      const status = await checkConnection(user.id);
      setConnectionStatus(status);
    };
    check();
  }, [user, checkConnection]);

  const handleUpload = async () => {
    if (!file) return toast.error("Selecione um arquivo.");
    setUploading(true);
    setStep(1);

    try {
      const genData = await invoke({
        route: "/files/generate-upload-url",
        method: "POST",
        payload: { file_name: file.name, content_type: file.type },
      });

      const gd = genData as any;
      const signedUrl = gd?.signed_url || gd?.url || gd?.upload_url;
      const fileKey = gd?.file_key || gd?.key || gd?.path;

      if (!signedUrl) {
        toast.error("Não foi possível gerar URL de upload. Verifique sua conexão.");
        return;
      }

      setStep(2);

      const uploadRes = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) {
        toast.error(`Upload falhou com status ${uploadRes.status}. Tente novamente.`);
        return;
      }

      setUploadedUrl(signedUrl.split("?")[0]);
      setStep(3);

      if (fileKey) {
        const dlData = await invoke({
          route: "/files/generate-download-url",
          method: "POST",
          payload: { file_key: fileKey },
        });
        const dd = dlData as any;
        setDownloadUrl(dd?.url || dd?.download_url || null);
      }

      setStep(4);
      toast.success("Upload completo!");
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "Falha no upload. Tente novamente."));
    } finally {
      setUploading(false);
    }
  };

  if (authLoading || !user) return <div className="min-h-screen bg-background" />;

  if (connectionStatus === "none" || connectionStatus === "expired") {
    return (
      <AppLayout>
        <div className="max-w-xl mx-auto px-6 py-20 text-center">
          {connectionStatus === "expired" ? (
            <>
              <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
              <h2 className="text-[15px] font-bold text-foreground mb-2">Token expirado</h2>
              <p className="text-sm text-muted-foreground mb-6">Reconecte sua conta para fazer uploads.</p>
            </>
          ) : (
            <>
              <Link2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-[15px] font-bold text-foreground mb-2">Não conectado</h2>
              <p className="text-sm text-muted-foreground mb-6">Conecte sua conta Lovable primeiro.</p>
            </>
          )}
          <button onClick={() => navigate("/lovable/connect")} className="gl primary h-11 px-8 text-sm">
            {connectionStatus === "expired" ? "Reconectar" : "Conectar"}
          </button>
        </div>
      </AppLayout>
    );
  }

  const steps = [
    { label: "Selecionar arquivo", done: step >= 1 },
    { label: "Gerar URL", done: step >= 2 },
    { label: "Upload", done: step >= 3 },
    { label: "Download URL", done: step >= 4 },
  ];

  return (
    <AppLayout>
      <div className="max-w-xl mx-auto px-6 py-10">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Teste</p>
        <h1 className="text-[28px] font-extrabold text-foreground mb-2" style={{ letterSpacing: "-0.03em" }}>Upload de Arquivos</h1>
        <p className="text-xs text-muted-foreground mb-8">Teste o fluxo completo de upload via API Lovable</p>

        <div className="rd-card space-y-6">
          {/* Steps indicator */}
          <div className="flex gap-2">
            {steps.map((s, i) => (
              <div key={i} className="flex-1 text-center">
                <div className={`h-8 w-8 rounded-full mx-auto flex items-center justify-center text-xs font-bold mb-1 transition-colors ${
                  s.done ? "bg-green-500 text-white" : step === i ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  {s.done ? <Check className="h-3 w-3" /> : i + 1}
                </div>
                <p className="text-xs text-muted-foreground text-[10px]">{s.label}</p>
              </div>
            ))}
          </div>

          {/* File input */}
          <label className="block w-full border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/30 transition-colors">
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={(e) => { setFile(e.target.files?.[0] || null); setStep(0); setUploadedUrl(null); setDownloadUrl(null); }}
            />
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <ImageIcon className="h-5 w-5 text-foreground" />
                <span className="text-sm font-semibold text-foreground">{file.name}</span>
                <span className="text-xs text-muted-foreground">({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
            ) : (
              <div>
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Clique para selecionar uma imagem</p>
              </div>
            )}
          </label>

          <button
            onClick={handleUpload}
            disabled={uploading || !file}
            className="gl primary w-full h-11 flex items-center justify-center gap-2"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Iniciar Upload
          </button>

          {/* Results */}
          {uploadedUrl && (
            <div className="space-y-3">
              <div className="bg-muted/50 rounded-xl p-3">
                <p className="text-xs text-muted-foreground text-[10px] font-semibold tracking-wider mb-1">URL DE UPLOAD</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-foreground font-mono truncate flex-1">{uploadedUrl}</p>
                  <button onClick={() => { navigator.clipboard.writeText(uploadedUrl); toast.success("Copiado!"); }}>
                    <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground transition-colors" />
                  </button>
                </div>
              </div>

              {downloadUrl && (
                <div className="bg-muted/50 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground text-[10px] font-semibold tracking-wider mb-1">URL DE DOWNLOAD</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-foreground font-mono truncate flex-1">{downloadUrl}</p>
                    <button onClick={() => { navigator.clipboard.writeText(downloadUrl); toast.success("Copiado!"); }}>
                      <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground transition-colors" />
                    </button>
                  </div>
                  <img src={downloadUrl} alt="Preview" className="mt-3 rounded-lg max-h-48 object-contain" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
