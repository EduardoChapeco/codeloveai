import { useState } from "react";
import { Plus, Trash2, Pencil, MessageCircle } from "lucide-react";
import { useChatContext } from "@/contexts/ChatContext";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ChatConversationList({ onBack }: { onBack: () => void }) {
  const {
    conversations, currentConversationId, isLoadingConversations,
    newConversation, selectConversation, renameConversation, deleteConversation,
  } = useChatContext();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const handleNew = async () => {
    const id = await newConversation();
    if (id) onBack();
  };

  const handleSelect = (id: string) => {
    selectConversation(id);
    onBack();
  };

  const startRename = (id: string, title: string) => {
    setEditingId(id);
    setEditTitle(title);
  };

  const confirmRename = async () => {
    if (editingId && editTitle.trim()) {
      await renameConversation(editingId, editTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <span className="text-sm font-semibold">Conversas</span>
        <button onClick={handleNew} className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors">
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoadingConversations ? (
          <div className="p-4 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : conversations.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">Nenhuma conversa ainda</div>
        ) : (
          conversations.map(c => (
            <div
              key={c.id}
              className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors ${
                currentConversationId === c.id ? "bg-muted" : ""
              }`}
              onClick={() => handleSelect(c.id)}
            >
              <MessageCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                {editingId === c.id ? (
                  <input
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    onBlur={confirmRename}
                    onKeyDown={e => e.key === "Enter" && confirmRename()}
                    className="w-full bg-background border border-border rounded px-1.5 py-0.5 text-xs focus:outline-none"
                    autoFocus
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <p className="text-xs font-medium truncate">{c.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(c.updated_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </>
                )}
              </div>
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={e => { e.stopPropagation(); startRename(c.id, c.title); }}
                  className="h-6 w-6 rounded flex items-center justify-center hover:bg-background"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); deleteConversation(c.id); }}
                  className="h-6 w-6 rounded flex items-center justify-center hover:bg-destructive/10 text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
