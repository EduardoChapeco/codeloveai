import { useState, useRef, useCallback } from "react";
import { Send } from "lucide-react";
import { useChatContext } from "@/contexts/ChatContext";

export default function ChatInput() {
  const { sendMessage, isStreaming } = useChatContext();
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    if (!text.trim() || isStreaming) return;
    sendMessage(text);
    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [text, isStreaming, sendMessage]);

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
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  };

  const suggestions = ["O que posso fazer aqui?", "Me ajude com um projeto", "Quais são os planos?"];

  return (
    <div className="border-t border-border p-3 space-y-2">
      {text.length === 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {suggestions.map(s => (
            <button
              key={s}
              onClick={() => { setText(s); textareaRef.current?.focus(); }}
              className="text-[10px] px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:bg-muted transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => { setText(e.target.value.slice(0, 4000)); handleInput(); }}
          onKeyDown={handleKeyDown}
          placeholder="Digite sua mensagem..."
          rows={1}
          className="flex-1 resize-none bg-muted/50 border border-border rounded-xl px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring min-h-[40px] max-h-[200px]"
          disabled={isStreaming}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || isStreaming}
          className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 transition-opacity shrink-0"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
      <div className="text-[9px] text-muted-foreground text-right">{text.length}/4000 · Ctrl+Enter</div>
    </div>
  );
}
