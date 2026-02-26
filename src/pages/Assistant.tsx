import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useSEO } from "@/hooks/useSEO";
import AppLayout from "@/components/AppLayout";
import {
  Send, Loader2, Stars, Volume2, VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AssistantMessage {
  role: "user" | "ai";
  content: string;
  audioUrl?: string;
  loading?: boolean;
}

export default function AssistantPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  useSEO({ title: "Assistente Starble" });

  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<HTMLAudioElement | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: text }, { role: "ai", content: "", loading: true }]);
    setLoading(true);
    try {
      const history = messages.filter(m => !m.loading).slice(-10).map(m => ({ role: m.role, content: m.content }));
      const { data, error } = await supabase.functions.invoke("gemini-chat", { body: { message: text, history } });
      if (error) throw error;
      const reply = (data as any).reply || "Não consegui processar sua pergunta.";
      setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: reply, loading: false } : m));
    } catch (e: any) {
      setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: "Erro ao conectar.", loading: false } : m));
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  const playVoice = useCallback(async (text: string) => {
    if (playingAudio) { playingAudio.pause(); setPlayingAudio(null); return; }
    try {
      const { data, error } = await supabase.functions.invoke("voice-response", { body: { text } });
      if (error || !(data as any).url) throw new Error("Sem URL de áudio");
      const audio = new Audio((data as any).url);
      setPlayingAudio(audio);
      audio.onended = () => setPlayingAudio(null);
      audio.play();
    } catch { toast.error("Não foi possível gerar o áudio."); }
  }, [playingAudio]);

  if (authLoading || !user) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-3rem)]">
        {/* Header */}
        <div className="border-b border-border/40 px-4 sm:px-6 py-3 flex items-center gap-3 shrink-0">
          <div className="h-9 w-9 rounded-2xl bg-blue-500/10 flex items-center justify-center">
            <Stars className="h-5 w-5 text-blue-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">Assistente Starble</p>
            <p className="text-[11px] text-muted-foreground">Tire dúvidas sobre a plataforma</p>
          </div>
          {messages.length > 0 && (
            <button onClick={() => setMessages([])} className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-xl hover:bg-muted/40">
              Limpar
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12 sm:py-20">
              <div className="h-16 w-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
                <Stars className="h-8 w-8 text-blue-500" />
              </div>
              <p className="font-medium mb-1">Como posso ajudar?</p>
              <p className="text-sm text-muted-foreground mb-6">Tire dúvidas sobre a plataforma Starble</p>
              <div className="flex flex-col gap-2 max-w-sm mx-auto">
                {["Como funciona o Orquestrador?", "O que é o StarCrawl?", "Como conectar minha conta Lovable?", "Diferença entre os planos?"].map(q => (
                  <button key={q} onClick={() => setInput(q)} className="text-left px-4 py-2.5 rounded-2xl clf-liquid-glass text-sm text-muted-foreground transition-colors hover:text-foreground">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "ai" && (
                <div className="h-7 w-7 rounded-full bg-blue-500/15 flex items-center justify-center shrink-0 mr-2 mt-1">
                  <Stars className="h-3.5 w-3.5 text-blue-500" />
                </div>
              )}
              <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "clf-liquid-glass rounded-bl-md"
              }`}>
                {msg.loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span className="text-xs text-muted-foreground">Pensando...</span>
                  </div>
                ) : (
                  <>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                    {msg.role === "ai" && msg.content && (
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/30">
                        <button onClick={() => playVoice(msg.content)} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                          {playingAudio ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                          {playingAudio ? "Parar" : "Ouvir"}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border/40 px-4 sm:px-6 py-3 shrink-0">
          <div className="max-w-3xl mx-auto flex items-end gap-2 sm:gap-3">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Pergunte sobre a plataforma..."
              rows={1}
              className="flex-1 resize-none rounded-2xl px-4 py-3 text-sm clf-liquid-glass focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[44px] max-h-[120px]"
              style={{ scrollbarWidth: "none" }}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="h-11 w-11 flex items-center justify-center rounded-2xl bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 transition-colors shrink-0"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
