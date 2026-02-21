import { useState, useRef, useCallback, useEffect } from "react";
import { X, Send, Headphones } from "lucide-react";
import { useSupportChat } from "@/contexts/SupportChatContext";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/hooks/useAuth";

export default function SupportChatPanel() {
  const { messages, isOpen, isLoading, isSending, closeSupport, sendMessage } = useSupportChat();
  const { tenant } = useTenant();
  const { user } = useAuth();
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(() => {
    if (!text.trim() || isSending) return;
    sendMessage(text);
    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [text, isSending, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  };

  if (!isOpen) return null;

  const brandName = tenant?.name || "Suporte";

  return (
    <div className="fixed top-0 right-0 h-full w-full sm:w-[380px] bg-background border-l border-border z-30 flex flex-col shadow-xl animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Headphones className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-semibold truncate">{brandName} — Suporte</span>
        </div>
        <button
          onClick={closeSupport}
          className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center h-full">
            <div className="flex gap-1">
              <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
              <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
              <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center h-full">
            <div className="text-center space-y-2 py-12">
              <Headphones className="h-8 w-8 mx-auto text-muted-foreground/40" />
              <p className="text-sm font-semibold">Suporte {brandName}</p>
              <p className="text-xs text-muted-foreground">Envie uma mensagem para iniciar</p>
            </div>
          </div>
        ) : (
          messages.map(msg => {
            const isMe = msg.sender_id === user?.id;
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    isMe
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p className={`text-[9px] mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => { setText(e.target.value.slice(0, 2000)); handleInput(); }}
            onKeyDown={handleKeyDown}
            placeholder="Escreva para o suporte..."
            rows={1}
            className="flex-1 resize-none bg-muted/50 border border-border rounded-xl px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring min-h-[40px] max-h-[160px]"
            disabled={isSending}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || isSending}
            className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 transition-opacity shrink-0"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <div className="text-[9px] text-muted-foreground text-right mt-1">{text.length}/2000 · Ctrl+Enter</div>
      </div>
    </div>
  );
}
