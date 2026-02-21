import { useState } from "react";
import { X, List, Plus } from "lucide-react";
import { useChatContext } from "@/contexts/ChatContext";
import ChatMessages from "./ChatMessages";
import ChatInput from "./ChatInput";
import ChatConversationList from "./ChatConversationList";

export default function ChatPanel() {
  const { isChatOpen, closeChat, currentConversationId, newConversation, conversations } = useChatContext();
  const [showList, setShowList] = useState(false);

  if (!isChatOpen) return null;

  const currentTitle = conversations.find(c => c.id === currentConversationId)?.title || "CodeLove AI";

  return (
    <div className="fixed top-0 right-0 h-full w-full sm:w-[380px] bg-background border-l border-border z-30 flex flex-col shadow-xl animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setShowList(!showList)}
            className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors shrink-0"
          >
            <List className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold truncate">{showList ? "Conversas" : currentTitle}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!showList && (
            <button
              onClick={async () => { await newConversation(); }}
              className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={closeChat}
            className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      {showList ? (
        <ChatConversationList onBack={() => setShowList(false)} />
      ) : (
        <>
          <ChatMessages />
          <ChatInput />
        </>
      )}
    </div>
  );
}
