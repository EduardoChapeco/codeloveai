import { useWhatsApp } from "@/hooks/useWhatsApp";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, MessageSquare, QrCode, AlertCircle, Wifi } from "lucide-react";

interface Props {
  userId: string;
  tenantId: string;
}

export default function WhatsAppConnect({ userId, tenantId }: Props) {
  const { qrCode, status, loading, error, createInstance } = useWhatsApp(userId, tenantId);

  if (status === "connected") {
    return (
      <div className="rounded-2xl border border-emerald-500/20 p-6 text-center"
        style={{ background: "rgba(16,185,129,0.05)" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-emerald-400" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">WhatsApp Conectado!</h3>
          <p className="text-xs text-muted-foreground">Sua instância está ativa e pronta para enviar mensagens.</p>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold">
            <Wifi className="h-3 w-3" /> Online
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.06] p-6 space-y-5"
      style={{ background: "rgba(255,255,255,0.02)", backdropFilter: "blur(40px)" }}>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <MessageSquare className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Conectar WhatsApp</h3>
          <p className="text-[11px] text-muted-foreground">
            Crie uma instância e escaneie o QR Code para conectar
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-xs">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {status === "waiting" && (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Inicializando conexão, aguarde até 30 segundos...
        </div>
      )}

      {status === "disconnected" && !qrCode && (
        <Button onClick={createInstance} disabled={loading} className="w-full">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Criando instância... (pode levar até 50s)
            </>
          ) : (
            <>
              <QrCode className="h-4 w-4" />
              Criar Instância WhatsApp
            </>
          )}
        </Button>
      )}

      {status === "connecting" && !qrCode && (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Aguardando QR Code...
        </div>
      )}

      {qrCode && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-xs text-muted-foreground text-center">
            Abra o WhatsApp → <strong>Aparelhos conectados</strong> → Escaneie o QR Code abaixo
          </p>
          <div className="rounded-xl border border-white/[0.08] p-3 bg-white">
            <img
              src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
              alt="QR Code WhatsApp"
              className="w-56 h-56 object-contain"
            />
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Verificando conexão automaticamente...
          </div>
        </div>
      )}
    </div>
  );
}
