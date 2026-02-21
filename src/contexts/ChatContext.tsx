import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

interface ChatContextType {
  conversations: Conversation[];
  currentConversationId: string | null;
  messages: Message[];
  isChatOpen: boolean;
  isStreaming: boolean;
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
  newConversation: () => Promise<string | null>;
  selectConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  fetchConversations: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(() => {
    try { return localStorage.getItem("clf_chat_open") === "true"; } catch { return false; }
  });
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const openChat = useCallback(() => {
    setIsChatOpen(true);
    localStorage.setItem("clf_chat_open", "true");
  }, []);

  const closeChat = useCallback(() => {
    setIsChatOpen(false);
    localStorage.setItem("clf_chat_open", "false");
  }, []);

  const toggleChat = useCallback(() => {
    setIsChatOpen(prev => {
      const next = !prev;
      localStorage.setItem("clf_chat_open", String(next));
      return next;
    });
  }, []);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    setIsLoadingConversations(true);
    try {
      const { data } = await supabase
        .from("chat_conversations")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      setConversations((data as Conversation[]) || []);
    } finally {
      setIsLoadingConversations(false);
    }
  }, [user]);

  const fetchMessages = useCallback(async (convId: string) => {
    setIsLoadingMessages(true);
    try {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });
      setMessages((data as Message[]) || []);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  const selectConversation = useCallback((id: string) => {
    setCurrentConversationId(id);
    fetchMessages(id);
  }, [fetchMessages]);

  const newConversation = useCallback(async () => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("chat_conversations")
      .insert({ user_id: user.id, title: "Nova Conversa" })
      .select()
      .single();
    if (error || !data) return null;
    const conv = data as Conversation;
    setConversations(prev => [conv, ...prev]);
    setCurrentConversationId(conv.id);
    setMessages([]);
    return conv.id;
  }, [user]);

  const renameConversation = useCallback(async (id: string, title: string) => {
    await supabase.from("chat_conversations").update({ title }).eq("id", id);
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c));
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    await supabase.from("chat_conversations").delete().eq("id", id);
    setConversations(prev => prev.filter(c => c.id !== id));
    if (currentConversationId === id) {
      setCurrentConversationId(null);
      setMessages([]);
    }
  }, [currentConversationId]);

  const sendMessage = useCallback(async (text: string) => {
    if (!user || isStreaming) return;
    let convId = currentConversationId;
    if (!convId) {
      convId = await newConversation();
      if (!convId) return;
    }

    const userMsg: Message = {
      id: crypto.randomUUID(),
      conversation_id: convId,
      role: "user",
      content: text.trim(),
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-relay`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ conversation_id: convId, message: text.trim() }),
          signal: controller.signal,
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                }
                return [...prev, {
                  id: crypto.randomUUID(),
                  conversation_id: convId!,
                  role: "assistant" as const,
                  content: assistantContent,
                  created_at: new Date().toISOString(),
                }];
              });
            }
          } catch {
            // partial JSON
          }
        }
      }

      // Refresh conversations to get updated title
      fetchConversations();
    } catch (e: any) {
      if (e.name !== "AbortError") {
        console.error("Chat error:", e);
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          conversation_id: convId!,
          role: "assistant",
          content: `❌ Erro: ${e.message || "Falha ao enviar mensagem"}`,
          created_at: new Date().toISOString(),
        }]);
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [user, isStreaming, currentConversationId, newConversation, fetchConversations]);

  // Load conversations when user changes
  useEffect(() => {
    if (user) fetchConversations();
    else {
      setConversations([]);
      setMessages([]);
      setCurrentConversationId(null);
    }
  }, [user, fetchConversations]);

  return (
    <ChatContext.Provider value={{
      conversations, currentConversationId, messages,
      isChatOpen, isStreaming, isLoadingConversations, isLoadingMessages,
      openChat, closeChat, toggleChat,
      newConversation, selectConversation, renameConversation, deleteConversation,
      sendMessage, fetchConversations,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used within ChatProvider");
  return ctx;
}
