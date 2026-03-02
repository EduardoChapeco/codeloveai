import { useRef, useEffect } from "react";
import { CheckCircle, XCircle, AlertTriangle, Loader2, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type ConvoStatus = "pending" | "processing" | "completed" | "timeout" | "failed";

interface Conversation {
  id: string;
  user_message: string;
  ai_response: string | null;
  brain_type: string;
  status: ConvoStatus;
  created_at: string;
  target_project_id: string | null;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function TerminalCursor() {
  return <span className="inline-block w-2 h-4 bg-green-400 animate-pulse ml-0.5 align-middle" />;
}

function ProcessingLine({ startTime }: { startTime: number }) {
  const phases = ["THINKING", "GENERATING", "PROCESSING", "FINALIZING"];
  const elapsed = Date.now() - startTime;
  const phaseIdx = Math.min(Math.floor(elapsed / 5000), phases.length - 1);
  const dots = ".".repeat((Math.floor(elapsed / 500) % 3) + 1);

  return (
    <div className="flex items-center gap-2 text-yellow-400/80 font-mono text-xs">
      <Loader2 className="h-3 w-3 animate-spin" />
      <span>[{formatTime(new Date().toISOString())}] {phases[phaseIdx]}{dots}</span>
      <span className="text-green-400/40 ml-auto">{Math.floor(elapsed / 1000)}s</span>
    </div>
  );
}

export default function BrainTerminalChat({
  conversations,
  processingIds,
  messagesEndRef,
  chatContainerRef,
  onRetry,
}: {
  conversations: Conversation[];
  processingIds: Set<string>;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  chatContainerRef: React.RefObject<HTMLDivElement>;
  onRetry?: (convo: Conversation) => void;
}) {
  return (
    <div
      ref={chatContainerRef}
      className="flex-1 overflow-y-auto font-mono text-xs leading-relaxed no-scrollbar"
      style={{
        background: "hsl(220 20% 4%)",
        padding: "1rem 1.25rem",
      }}
    >
      {/* Terminal header */}
      <div className="text-green-500/60 mb-4 select-none">
        <p>╔══════════════════════════════════════════════════════════╗</p>
        <p>║  STAR AI BRAIN — Terminal v6.0                          ║</p>
        <p>║  Type your message below. Responses rendered in-line.   ║</p>
        <p>╚══════════════════════════════════════════════════════════╝</p>
      </div>

      {conversations.length === 0 && (
        <div className="text-green-400/40">
          <p>[system] Awaiting input... <TerminalCursor /></p>
        </div>
      )}

      {conversations.map((convo) => {
        const time = formatTime(convo.created_at);

        return (
          <div key={convo.id} className="mb-4">
            {/* User input line */}
            <div className="text-cyan-400">
              <span className="text-cyan-400/50">[{time}]</span>{" "}
              <span className="text-cyan-300/70">$</span>{" "}
              <span className="text-cyan-100 break-words whitespace-pre-wrap">{convo.user_message}</span>
            </div>

            {/* AI response */}
            <div className="mt-1.5 pl-0">
              {convo.status === "processing" && (
                <ProcessingLine startTime={new Date(convo.created_at).getTime()} />
              )}

              {convo.status === "timeout" && (
                <div className="text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3" />
                  <span>[{time}] TIMEOUT — Response not captured.</span>
                  {onRetry && (
                    <button onClick={() => onRetry(convo)} className="ml-2 text-cyan-400 hover:text-cyan-300 flex items-center gap-1 underline underline-offset-2">
                      <RefreshCw className="h-3 w-3" /> retry
                    </button>
                  )}
                </div>
              )}

              {convo.status === "failed" && (
                <div className="text-red-400 flex items-center gap-1.5">
                  <XCircle className="h-3 w-3" />
                  <span>[{time}] ERROR — {convo.ai_response || "Failed to process."}</span>
                  {onRetry && (
                    <button onClick={() => onRetry(convo)} className="ml-2 text-cyan-400 hover:text-cyan-300 flex items-center gap-1 underline underline-offset-2">
                      <RefreshCw className="h-3 w-3" /> retry
                    </button>
                  )}
                </div>
              )}

              {convo.status === "completed" && convo.ai_response && (() => {
                let cleaned = convo.ai_response;
                cleaned = cleaned.replace(/^---[\s\S]*?---\s*/m, "").trim();
                cleaned = cleaned.replace(/^```(?:markdown|md)?\s*/i, "").replace(/```\s*$/, "").trim();
                cleaned = cleaned.replace(/^#\s*Resposta do Star AI\s*—[^\n]*\n\s*/i, "").trim();
                cleaned = cleaned.replace(/Sistema operacional\.\s*Aguardando instruções\.?\s*$/im, "").trim();
                cleaned = cleaned.replace(/Aguardando instruções do usuário\.?\s*$/im, "").trim();
                cleaned = cleaned.replace(/Aguardando instruções\.?\s*$/im, "").trim();
                cleaned = cleaned.replace(/\|\s*Item\s*\|\s*Resultado\s*\|[\s\S]*?\|\s*Ação necessária\s*\|[^\n]*/gi, "").trim();
                cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

                return (
                  <div className="group relative">
                    <pre className="text-green-300/90 whitespace-pre-wrap break-words leading-5 mt-1">
                      <span className="text-green-500/40">[{time}] </span>
                      {cleaned}
                    </pre>
                    <div className="flex items-center gap-3 mt-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(convo.ai_response!);
                          toast.success("Copiado!");
                        }}
                        className="text-green-500/40 hover:text-green-400 transition-colors flex items-center gap-1"
                      >
                        <Copy className="h-3 w-3" /> copy
                      </button>
                      {onRetry && (
                        <button
                          onClick={() => onRetry(convo)}
                          className="text-green-500/40 hover:text-cyan-400 transition-colors flex items-center gap-1"
                        >
                          <RefreshCw className="h-3 w-3" /> resend
                        </button>
                      )}
                      <CheckCircle className="h-3 w-3 text-green-500/40" />
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Separator */}
            <div className="text-green-500/15 mt-2 select-none">
              ─────────────────────────────────────────────────────────
            </div>
          </div>
        );
      })}

      <div ref={messagesEndRef} />
    </div>
  );
}
