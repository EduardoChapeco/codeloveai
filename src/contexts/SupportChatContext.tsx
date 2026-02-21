import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";

interface SupportMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  tenant_id: string | null;
}

interface SupportChatContextType {
  messages: SupportMessage[];
  isOpen: boolean;
  isLoading: boolean;
  isSending: boolean;
  unreadCount: number;
  openSupport: () => void;
  closeSupport: () => void;
  toggleSupport: () => void;
  sendMessage: (text: string) => Promise<void>;
  markAsRead: () => Promise<void>;
}

const SupportChatContext = createContext<SupportChatContextType | undefined>(undefined);

export function SupportChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const openSupport = useCallback(() => setIsOpen(true), []);
  const closeSupport = useCallback(() => setIsOpen(false), []);
  const toggleSupport = useCallback(() => setIsOpen(p => !p), []);

  const fetchMessages = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: true })
        .limit(200);
      const msgs = (data as SupportMessage[]) || [];
      setMessages(msgs);
      setUnreadCount(msgs.filter(m => m.receiver_id === user.id && !m.is_read).length);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const markAsRead = useCallback(async () => {
    if (!user) return;
    const unread = messages.filter(m => m.receiver_id === user.id && !m.is_read);
    if (unread.length === 0) return;
    await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("receiver_id", user.id)
      .eq("is_read", false);
    setMessages(prev => prev.map(m =>
      m.receiver_id === user.id ? { ...m, is_read: true } : m
    ));
    setUnreadCount(0);
  }, [user, messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!user || !tenant || isSending) return;
    const content = text.trim();
    if (!content || content.length > 2000) return;

    setIsSending(true);
    try {
      // Get tenant owner as receiver
      const { data: ownerData } = await supabase
        .from("tenant_users")
        .select("user_id")
        .eq("tenant_id", tenant.id)
        .eq("role", "tenant_owner")
        .limit(1)
        .maybeSingle();

      const receiverId = ownerData?.user_id || tenant.id;

      const { data, error } = await supabase
        .from("messages")
        .insert({
          sender_id: user.id,
          receiver_id: receiverId,
          content,
          tenant_id: tenant.id,
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setMessages(prev => [...prev, data as SupportMessage]);
      }
    } catch (e) {
      console.error("Failed to send support message:", e);
    } finally {
      setIsSending(false);
    }
  }, [user, tenant, isSending]);

  // Fetch messages on mount
  useEffect(() => {
    if (user) fetchMessages();
    else {
      setMessages([]);
      setUnreadCount(0);
    }
  }, [user, fetchMessages]);

  // Mark as read when panel opens
  useEffect(() => {
    if (isOpen && unreadCount > 0) markAsRead();
  }, [isOpen, unreadCount, markAsRead]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    channelRef.current = supabase
      .channel("support-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${user.id}`,
        },
        (payload) => {
          const msg = payload.new as SupportMessage;
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          if (!isOpen) setUnreadCount(prev => prev + 1);
          else {
            // Auto mark as read
            supabase.from("messages").update({ is_read: true }).eq("id", msg.id).then();
          }
        }
      )
      .subscribe();

    return () => {
      channelRef.current?.unsubscribe();
    };
  }, [user, isOpen]);

  return (
    <SupportChatContext.Provider value={{
      messages, isOpen, isLoading, isSending, unreadCount,
      openSupport, closeSupport, toggleSupport,
      sendMessage, markAsRead,
    }}>
      {children}
    </SupportChatContext.Provider>
  );
}

export function useSupportChat() {
  const ctx = useContext(SupportChatContext);
  if (!ctx) throw new Error("useSupportChat must be used within SupportChatProvider");
  return ctx;
}
