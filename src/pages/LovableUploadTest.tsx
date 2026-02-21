import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLovableProxy } from "@/hooks/useLovableProxy";
import { supabase } from "@/integrations/supabase/client";
import AppNav from "@/components/AppNav";
import { toast } from "sonner";
import { Loader2, Upload, Download, Check, Image as ImageIcon, Copy } from "lucide-react";

export default function LovableUploadTest() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { invoke } = useLovableProxy();

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);

  // Step tracking
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login?returnTo=/lovable/upload-test");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    const check = async () => {
      const { data } = await supabase
        .from("lovable_accounts")
        .select("status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      setConnected(!!data);
    };
    check();
  }, [user]);

  const handleUpload = async () => {
    if (!file) return toast.error("Selecione um arquivo.");
    setUploading(true);
    setStep(1);

    try {
      // Step 1: Generate upload URL
      const uploadData = await invoke({
        route: "",
        method: "POST",
        action: "proxy",
        payload: { route: "/files/generate-upload-url", method: "POST", payload: { file_name: file.name, content_type: file.type } },
      });
      // Fallback: try direct invoke
      const genData = await invoke({
        route: "/files/generate-upload-url",
        method: "POST",
        payload: { file_name: file.name, content_type: file.type },
      });

      const signedUrl = genData?.signed_url || genData?.url || genData?.upload_url;
      const fileKey = genData?.file_key || genData?.key || genData?.path;

      if (!signedUrl) {
        toast.error("Não foi possível gerar URL de upload.");
        return;
      }

      setStep(2);

      // Step 2: Upload directly to signed URL
      const uploadRes = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) {
        toast.error(`Upload falhou: ${uploadRes.status}`);
        return;
      }

      setUploadedUrl(signedUrl.split("?")[0]);
      setStep(3);

      // Step 3: Generate download URL
      if (fileKey) {
        const dlData = await invoke({
          route: "/files/generate-download-url",
          method: "POST",
          payload: { file_key: fileKey },
        });
        setDownloadUrl(dlData?.url || dlData?.download_url || null);
      }

      setStep(4);
      toast.success("Upload completo!");
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "Falha no upload"));
    } finally {
      setUploading(false);
    }
  };

  if (authLoading || !user) return <div className="min-h-screen bg-background" />;

  if (connected === false) {
    return (
      <div className="min-h-screen bg-background">
        <AppNav />
        <div className="max-w-xl mx-auto px-8 py-20 text-center">
          <p className="ep-subtitle mb-2">NÃO CONECTADO</p>
          <button onClick={() => navigate("/lovable/connect")} className="ep-btn-primary h-11 px-8">CONECTAR</button>
        </div>
      </div>
    );
  }

  const steps = [
    { label: "Selecionar arquivo", done: step >= 1 },
    { label: "Gerar URL de upload", done: step >= 2 },
    { label: "Fazer upload", done: step >= 3 },
    { label: "Gerar URL de download", done: step >= 4 },
  ];

  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      <div className="max-w-xl mx-auto px-8 py-12">
        <p className="ep-subtitle mb-1">TESTE</p>
        <h1 className="ep-section-title text-2xl mb-8">UPLOAD DE ARQUIVOS</h1>

        <div className="ep-card space-y-6">
          {/* Steps indicator */}
          <div className="flex gap-2">
            {steps.map((s, i) => (
              <div key={i} className="flex-1 text-center">
                <div className={`h-8 w-8 rounded-full mx-auto flex items-center justify-center text-xs font-bold mb-1 ${
                  s.done ? "bg-green-500 text-white" : step === i ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                }`}>
                  {s.done ? <Check className="h-3 w-3" /> : i + 1}
                </div>
                <p className="text-[8px] font-bold text-muted-foreground">{s.label.toUpperCase()}</p>
              </div>
            ))}
          </div>

          {/* File input */}
          <div>
            <label className="block w-full border-2 border-dashed border-border rounded-[12px] p-8 text-center cursor-pointer hover:border-foreground/30 transition-colors">
              <input type="file" className="hidden" accept="image/*" onChange={(e) => { setFile(e.target.files?.[0] || null); setStep(0); setUploadedUrl(null); setDownloadUrl(null); }} />
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <ImageIcon className="h-5 w-5 text-foreground" />
                  <span className="text-sm font-bold text-foreground">{file.name}</span>
                  <span className="text-xs text-muted-foreground">({(file.size / 1024).toFixed(1)} KB)</span>
                </div>
              ) : (
                <div>
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Selecione uma imagem</p>
                </div>
              )}
            </label>
          </div>

          <button
            onClick={handleUpload}
            disabled={uploading || !file}
            className="ep-btn-primary w-full h-11 flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            INICIAR UPLOAD
          </button>

          {/* Results */}
          {uploadedUrl && (
            <div className="space-y-3">
              <div className="bg-muted/50 rounded-[10px] p-3">
                <p className="text-[9px] font-bold text-muted-foreground tracking-widest mb-1">URL DE UPLOAD</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-foreground font-mono truncate flex-1">{uploadedUrl}</p>
                  <button onClick={() => { navigator.clipboard.writeText(uploadedUrl); toast.success("Copiado!"); }}>
                    <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  </button>
                </div>
              </div>

              {downloadUrl && (
                <div className="bg-muted/50 rounded-[10px] p-3">
                  <p className="text-[9px] font-bold text-muted-foreground tracking-widest mb-1">URL DE DOWNLOAD</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-foreground font-mono truncate flex-1">{downloadUrl}</p>
                    <button onClick={() => { navigator.clipboard.writeText(downloadUrl); toast.success("Copiado!"); }}>
                      <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                  <img src={downloadUrl} alt="Preview" className="mt-3 rounded-[8px] max-h-48 object-contain" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
