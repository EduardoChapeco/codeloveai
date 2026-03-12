import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft, Send, Smile, Gift, Heart, ThumbsUp, ThumbsDown,
  Star, Flame, PartyPopper, Sparkles, Loader2, Users, Clock, MessageCircle
} from "lucide-react";

const REACTIONS = [
  { key: "❤️", icon: Heart, label: "Love" },
  { key: "like", icon: ThumbsUp, label: "Like" },
  { key: "dislike", icon: ThumbsDown, label: "Dislike" },
  { key: "star", icon: Star, label: "Star" },
  { key: "fire", icon: Flame, label: "Fire" },
  { key: "party", icon: PartyPopper, label: "Party" },
  { key: "magic", icon: Sparkles, label: "Magic" },
  { key: "gift", icon: Gift, label: "Gift" },
];

interface FeedbackMsg {
  id: string;
  user_id: string;
  content: string;
  reaction_type: string | null;
  created_at: string;
}

export default function CommunityTestSession() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [session, setSession] = useState<any>(null);
  const [messages, setMessages] = useState<FeedbackMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Record<string, { name: string }>>({});

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase.from("community_test_sessions").select("*").eq("id", id).single();
      if (data) setSession(data);
      else toast({ title: "Sessão não encontrada", variant: "destructive" });
      setLoading(false);
    })();
  }, [id]);

  const fetchMessages = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("community_test_feedback")
      .select("*")
      .eq("session_id", id)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true })
      .limit(200);
    if (data) {
      setMessages(data as FeedbackMsg[]);
      const userIds = [...new Set(data.map((m: any) => m.user_id))];
      const newIds = userIds.filter(uid => !profiles[uid]);
      if (newIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("user_id, name").in("user_id", newIds);
        if (profs) {
          const map = { ...profiles };
          profs.forEach((p: any) => { map[p.user_id] = { name: p.name || "Anônimo" }; });
          setProfiles(map);
        }
      }
    }
  }, [id]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`test-feedback-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_test_feedback", filter: `session_id=eq.${id}` },
        (payload) => {
          const newMsg = payload.new as FeedbackMsg;
          setMessages(prev => [...prev, newMsg]);
          if (!profiles[newMsg.user_id]) {
            supabase.from("profiles").select("user_id, name").eq("user_id", newMsg.user_id).single()
              .then(({ data }) => {
                if (data) setProfiles(prev => ({ ...prev, [data.user_id]: { name: data.name || "Anônimo" } }));
              });
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (content: string, reactionType?: string) => {
    if (!user || !id) return;
    if (!content.trim() && !reactionType) return;
    setSending(true);
    try {
      await supabase.from("community_test_feedback").insert({
        session_id: id, user_id: user.id,
        content: content.trim(), reaction_type: reactionType || null,
      } as any);
      setInput("");
      setShowReactions(false);
    } catch {
      toast({ title: "Erro ao enviar", variant: "destructive" });
    } finally { setSending(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  if (loading) return (
    <AppLayout>
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </AppLayout>
  );

  if (!session) return (
    <AppLayout>
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="rd-body text-muted-foreground">Sessão não encontrada.</p>
          <button onClick={() => navigate("/community")} className="gl sm primary">VOLTAR</button>
        </div>
      </div>
    </AppLayout>
  );

  const isOwner = user?.id === session.user_id;
  const sessionProfile = profiles[session.user_id];

  return (
    <AppLayout>
      <div className="h-[calc(100vh-0px)] md:h-screen flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-background border-b border-border px-4 py-3 flex items-center gap-3 shrink-0">
          <button onClick={() => navigate("/community/tests")}
            className="h-8 w-8 rounded-[10px] bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="rd-body text-sm font-semibold truncate">{session.title || "Teste & Feedback"}</h1>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="rd-label text-xs flex items-center gap-1">
                <Users className="h-3 w-3" /> {sessionProfile?.name || "Criador"}
              </span>
              <span className="rd-label text-xs flex items-center gap-1">
                <Clock className="h-3 w-3" /> {new Date(session.created_at).toLocaleDateString("pt-BR")}
              </span>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                session.status === "active"
                  ? "bg-green-50 text-green-700"
                  : "bg-muted text-muted-foreground"
              }`}>
                {session.status === "active" ? "● AO VIVO" : "ENCERRADO"}
              </span>
            </div>
          </div>
          {isOwner && session.status === "active" && (
            <button
              onClick={async () => {
                await supabase.from("community_test_sessions").update({ status: "closed", closed_at: new Date().toISOString() } as any).eq("id", session.id);
                setSession((s: any) => ({ ...s, status: "closed" }));
                toast({ title: "Sessão encerrada" });
              }}
              className="gl sm ghost text-destructive"
            >
              ENCERRAR
            </button>
          )}
        </div>

        {/* Main split */}
        <div className="flex-1 flex overflow-hidden">
          {/* Chat Panel */}
          <div className="w-full md:w-[380px] lg:w-[420px] shrink-0 flex flex-col bg-background"
            style={{ borderRight: "1px solid var(--b1)" }}>
            {session.description && (
              <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--b1)" }}>
                <p className="rd-label leading-relaxed">{session.description}</p>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto no-scrollbar px-3 py-3 space-y-1">
              {messages.length === 0 && (
                <div className="text-center py-12">
                  <MessageCircle className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="rd-body text-muted-foreground">Seja o primeiro a dar feedback!</p>
                  <p className="rd-label mt-1">Teste o projeto e compartilhe sua opinião.</p>
                </div>
              )}
              {messages.map(msg => {
                const isReaction = !!msg.reaction_type;
                const prof = profiles[msg.user_id];
                const isMe = msg.user_id === user?.id;

                if (isReaction) {
                  return (
                    <div key={msg.id} className="flex items-center gap-2 py-1">
                      <div className="h-5 w-5 rounded-full bg-muted overflow-hidden shrink-0">
                        <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-muted-foreground">
                          {(prof?.name || "?")[0]}
                        </div>
                      </div>
                      <span className="rd-label text-xs">{prof?.name || "Anônimo"}</span>
                      {(() => { const R = REACTIONS.find(r => r.key === msg.reaction_type); return R ? <R.icon className="h-5 w-5 text-primary" /> : <span className="text-lg">{msg.reaction_type}</span>; })()}
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className={`flex gap-2 py-1.5 ${isMe ? "flex-row-reverse" : ""}`}>
                    <div className="h-7 w-7 rounded-full bg-muted overflow-hidden shrink-0 mt-0.5">
                      <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-muted-foreground">
                        {(prof?.name || "?")[0]}
                      </div>
                    </div>
                    <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
                      {!isMe && <p className="text-[9px] font-bold text-muted-foreground/60 mb-0.5">{prof?.name || "Anônimo"}</p>}
                      <div className={`rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                        isMe
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted border border-border rounded-bl-md"
                      }`}>
                        {msg.content}
                      </div>
                      <p className="text-[8px] text-muted-foreground/40 mt-0.5 px-1">
                        {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Reactions bar */}
            {showReactions && (
              <div className="px-3 py-2 animate-in slide-in-from-bottom duration-200"
                style={{ borderTop: "1px solid var(--b1)" }}>
                <div className="flex items-center gap-1 flex-wrap">
                  {REACTIONS.map(r => (
                    <button
                      key={r.key}
                      onClick={() => sendMessage(r.key, r.key)}
                      className="h-10 w-10 rounded-[12px] hover:bg-muted flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                      title={r.label}
                    >
                      <r.icon className="h-5 w-5" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            {session.status === "active" && user && (
              <div className="px-3 py-3 shrink-0" style={{ borderTop: "0.5px solid var(--clf-border)" }}>
                <div className="flex items-end gap-2">
                  <button
                    onClick={() => setShowReactions(!showReactions)}
                    className={`h-9 w-9 rounded-[12px] flex items-center justify-center shrink-0 transition-colors ${
                      showReactions ? "bg-primary/20 text-primary" : "bg-muted/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Smile className="h-4 w-4" />
                  </button>
                  <div className="flex-1 relative">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Escreva seu feedback..."
                      rows={1}
                      className="lv-input w-full min-h-[36px] max-h-[100px] resize-none text-xs pr-10"
                    />
                  </div>
                  <button
                    onClick={() => sendMessage(input)}
                    disabled={sending || !input.trim()}
                    className="h-9 w-9 rounded-[12px] bg-primary text-primary-foreground flex items-center justify-center shrink-0 disabled:opacity-30 hover:opacity-90 transition-all active:scale-95"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Preview Panel */}
          <div className="hidden md:flex flex-1 flex-col">
            <div className="px-4 py-2 flex items-center gap-2" style={{ borderBottom: "0.5px solid var(--clf-border)" }}>
              <div className="h-2 w-2 rounded-full animate-pulse" style={{ background: "var(--clf-ok)" }} />
              <span className="lv-overline">PREVIEW AO VIVO</span>
              <span className="lv-caption truncate flex-1">{session.preview_url}</span>
            </div>
            <iframe
              src={session.preview_url}
              className="flex-1 w-full border-0"
              title="Project Preview"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
