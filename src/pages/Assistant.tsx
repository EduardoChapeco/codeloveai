import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useSEO } from "@/hooks/useSEO";
import AppLayout from "@/components/AppLayout";
import {
  Send, Loader2, Stars, Volume2, VolumeX, Headphones, X, CheckCircle,
  RotateCcw, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AssistantMessage {
  role: "user" | "ai";
  content: string;
  loading?: boolean;
}

const QUICK_QUESTIONS = [
  "Como funciona o Star AI?",
  "Como conectar minha conta Lovable?",
  "O que é o Orquestrador?",
  "Diferença entre os planos?",
  "Como abrir um ticket de suporte?",
  "O que são CodeCoins?",
];

export default function AssistantPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  useSEO({ title: "Assistente Starble" });

  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<HTMLAudioElement | null>(null);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketDesc, setTicketDesc] = useState("");
  const [ticketLoading, setTicketLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText || input).trim();
    if (!text || loading) return;
    if (!overrideText) setInput("");
    setMessages(prev => [...prev, { role: "user", content: text }, { role: "ai", content: "", loading: true }]);
    setLoading(true);
    try {
      const history = messages.filter(m => !m.loading).slice(-10).map(m => ({ role: m.role, content: m.content }));
      
      // Use support-brain-chat (knowledge-aware) with fallback to gemini-chat
      let data: any;
      let error: any;
      
      try {
        const result = await supabase.functions.invoke("support-brain-chat", { body: { message: text, history } });
        data = result.data;
        error = result.error;
      } catch {
        // Fallback to gemini-chat if support-brain-chat is unavailable
        const result = await supabase.functions.invoke("gemini-chat", { body: { message: text, history } });
        data = result.data;
        error = result.error;
      }

      const payload = data as any;

      if (error) {
        const status = (error as any)?.context?.status;
        if (status === 429) throw new Error("Muitas requisições. Aguarde alguns segundos.");
        if (status === 503) {
          // Fallback to gemini-chat
          const fallback = await supabase.functions.invoke("gemini-chat", { body: { message: text, history } });
          if (fallback.error) throw new Error("IA temporariamente indisponível");
          const reply = (fallback.data as any)?.reply || "Não consegui processar sua pergunta.";
          setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: reply, loading: false } : m));
          return;
        }
        throw new Error(payload?.error || error.message || "Erro ao conectar com IA");
      }
      if (payload?.error) throw new Error(payload.error);

      const reply = typeof payload?.reply === "string" && payload.reply.trim().length > 0
        ? payload.reply : "Não consegui processar sua pergunta. Tente reformular ou abra um ticket de suporte.";

      setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: reply, loading: false } : m));
    } catch (e: any) {
      setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: "Erro ao conectar. Tente novamente ou abra um ticket de suporte.", loading: false } : m));
      toast.error(e.message || "Falha ao obter resposta");
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

  const submitTicket = async () => {
    if (!ticketSubject.trim()) { toast.error("Informe o assunto"); return; }
    setTicketLoading(true);
    try {
      const { error } = await supabase.from("support_tickets").insert({
        user_id: user!.id,
        title: ticketSubject.trim(),
        body: ticketDesc.trim() || "",
        status: "open",
        priority: "medium",
      });
      if (error) throw error;
      toast.success("Ticket #criado com sucesso! Responderemos em breve.");
      setShowTicketForm(false);
      setTicketSubject("");
      setTicketDesc("");
    } catch (e: any) {
      toast.error("Erro ao criar ticket: " + (e.message || "Tente novamente"));
    } finally {
      setTicketLoading(false);
    }
  };

  if (authLoading || !user) {
    return <AppLayout><div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="flex flex-col" style={{ height: 'calc(100vh - 48px)', background: 'var(--bg-0)' }}>
        {/* Messages */}

        {/* Ticket form modal */}
        {showTicketForm && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowTicketForm(false)}>
            <div className="w-full max-w-md rounded-2xl p-6 shadow-2xl bg-card border border-border" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Headphones className="h-5 w-5 text-primary" />
                  <h2 className="text-sm font-bold">Novo Ticket de Suporte</h2>
                </div>
                <button onClick={() => setShowTicketForm(false)} className="h-7 w-7 rounded-lg hover:bg-accent flex items-center justify-center">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Assunto</label>
                  <input value={ticketSubject} onChange={e => setTicketSubject(e.target.value)}
                    placeholder="Resumo do problema..."
                    className="w-full h-10 px-3.5 rounded-xl text-sm bg-muted/30 border border-border focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Descrição (opcional)</label>
                  <textarea value={ticketDesc} onChange={e => setTicketDesc(e.target.value)}
                    placeholder="Descreva em detalhes..."
                    rows={4}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-muted/30 border border-border focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    style={{ scrollbarWidth: "none" }} />
                </div>
                <button onClick={submitTicket} disabled={ticketLoading || !ticketSubject.trim()}
                  className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-40 transition-opacity">
                  {ticketLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  {ticketLoading ? "Enviando..." : "Criar Ticket"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-8 py-6" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--bg-5) transparent' }}>
          {messages.length === 0 && (
            <div className="chat-hero" style={{ paddingTop: 48 }}>
              <div className="chat-hero-badge">
                <Sparkles className="h-3 w-3" /> Starble IA
              </div>
              <div className="chat-hero-title">
                O que você quer <span>criar</span> hoje?
              </div>
              <div className="chat-hero-sub">
                IA poderosa para criar sites, apps e muito mais. Conheço todos os detalhes da plataforma.
              </div>
              <div className="chat-mode-row" style={{ maxWidth: 520 }}>
                <div className="mode-card active">
                  <div className="mc-ico ib-orange"><Sparkles /></div>
                  <div className="mc-title">Chat IA</div>
                  <div className="mc-desc">Converse e obtenha respostas instantâneas</div>
                </div>
                <div className="mode-card mode-build">
                  <div className="mc-ico ib-blue"><Stars /></div>
                  <div className="mc-title">Construtor</div>
                  <div className="mc-desc">Crie sites e apps completos com IA</div>
                  <div className="mc-badge ch-blue">Novo</div>
                </div>
              </div>
              <div className="suggestions" style={{ justifyContent: 'center' }}>
                {QUICK_QUESTIONS.map(q => (
                  <button key={q} onClick={() => sendMessage(q)} className="sug-btn">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "ai" && (
                <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mr-2 mt-1">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
              <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-muted/50 border border-border/40 rounded-bl-md"
              }`}>
                {msg.loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span className="text-xs text-muted-foreground">Consultando base de conhecimento...</span>
                  </div>
                ) : (
                  <>
                    <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:mb-2 [&_ul]:mb-2 [&_ol]:mb-2 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                    {msg.role === "ai" && msg.content && (
                      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/30">
                        <button onClick={() => playVoice(msg.content)} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                          {playingAudio ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                          {playingAudio ? "Parar" : "Ouvir"}
                        </button>
                        <button onClick={() => { navigator.clipboard.writeText(msg.content); toast.success("Copiado!"); }}
                          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                          Copiar
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
        <div style={{ flexShrink: 0, padding: '12px 32px 18px' }}>
          <div className="chat-input-box">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Descreva o que você quer criar ou perguntar..."
              rows={1}
              className="cib-ta"
            />
            <div className="cib-toolbar">
              <div className="cib-tl">
                <button className="cib-tbtn" onClick={() => setShowTicketForm(true)}>
                  <Headphones className="h-3 w-3" /> Ticket
                </button>
                {messages.length > 0 && (
                  <button className="cib-tbtn" onClick={() => setMessages([])}>
                    <RotateCcw className="h-3 w-3" /> Limpar
                  </button>
                )}
              </div>
              <div className="cib-tr">
                <span style={{ fontSize: 10, color: 'var(--text-quaternary)', fontFamily: 'var(--mono)' }}>⌘↵</span>
                <button className="cib-send" onClick={() => sendMessage()} disabled={loading || !input.trim()}>
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
