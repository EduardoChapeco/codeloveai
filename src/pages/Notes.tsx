import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSEO } from "@/hooks/useSEO";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import {
  StickyNote, FolderOpen, Plus, Search, Pin, PinOff, Trash2,
  Palette, FolderPlus, ChevronRight, CheckCircle, Loader2, X,
  Edit3, MoreHorizontal,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";

// ── Types ──
interface Note {
  id: string;
  user_id?: string;
  title: string;
  text: string;
  folder: string;
  color: string;
  pinned: boolean;
  ts: number;
  updated: number;
}

interface NoteFolder {
  id: string;
  user_id?: string;
  name: string;
}

// ── Constants ──
const NOTE_COLORS = [
  { hex: "#ffffff", name: "Branco" },
  { hex: "#fff9c4", name: "Amarelo" },
  { hex: "#f8bbd0", name: "Rosa" },
  { hex: "#c5e1a5", name: "Verde" },
  { hex: "#b3e5fc", name: "Azul" },
  { hex: "#d1c4e9", name: "Roxo" },
  { hex: "#ffe0b2", name: "Laranja" },
];

function generateNoteId(): string {
  return "n" + crypto.randomUUID().replace(/-/g, "").substring(0, 12);
}

export default function Notes() {
  const { user, loading: authLoading } = useAuth();
  const { tenant } = useTenant();
  useSEO({ title: "Notas" });
  const navigate = useNavigate();

  // ── State ──
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<NoteFolder[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [syncStatus, setSyncStatus] = useState<"saved" | "saving" | "idle">("idle");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameFolderName, setRenameFolderName] = useState("");
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // ── Auth guard ──
  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  // ── Load data ──
  useEffect(() => {
    if (!user) return;
    loadNotes();
    loadFolders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadNotes = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .eq("user_id", user.id)
      .order("pinned", { ascending: false })
      .order("updated", { ascending: false });
    if (!error && data) {
      setNotes(data.map((n: Record<string, unknown>) => ({
        id: n.id as string,
        title: (n.title as string) || "",
        text: (n.text as string) || "",
        folder: (n.folder as string) || "Geral",
        color: (n.color as string) || "#ffffff",
        pinned: (n.pinned as boolean) || false,
        ts: Number(n.ts) || Date.now(),
        updated: Number(n.updated) || Date.now(),
      })));
    }
  };

  const loadFolders = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("note_folders")
      .select("*")
      .eq("user_id", user.id)
      .order("name");
    if (!error && data) {
      setFolders(data);
    }
    // Ensure "Geral" folder exists
    if (!error && data && !data.some((f: NoteFolder) => f.name === "Geral")) {
      await supabase.from("note_folders").insert({ user_id: user.id, name: "Geral" });
      loadFolders();
    }
  };

  // ── Realtime subscription ──
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notes-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "notes", filter: `user_id=eq.${user.id}` }, () => {
        loadNotes();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ── Selected note ──
  const selectedNote = notes.find((n) => n.id === selectedNoteId) || null;

  // ── Filtered notes ──
  const filteredNotes = notes.filter((n) => {
    if (activeFolder && n.folder !== activeFolder) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return n.title.toLowerCase().includes(q) || n.text.toLowerCase().includes(q);
    }
    return true;
  });

  // ── Auto-save with debounce ──
  const saveNote = useCallback(async (note: Note) => {
    if (!user) return;
    setSyncStatus("saving");
    const now = Date.now();
    const updatedNote = { ...note, updated: now };

    const { error } = await supabase
      .from("notes")
      .upsert({
        id: updatedNote.id,
        user_id: user.id,
        title: updatedNote.title,
        text: updatedNote.text,
        folder: updatedNote.folder,
        color: updatedNote.color,
        pinned: updatedNote.pinned,
        ts: updatedNote.ts,
        updated: updatedNote.updated,
      }, { onConflict: "id" });

    if (error) {
      toast.error("Erro ao salvar nota.");
      setSyncStatus("idle");
    } else {
      setSyncStatus("saved");
      setTimeout(() => setSyncStatus("idle"), 2000);
    }
  }, [user]);

  const debouncedSave = useCallback((note: Note) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSyncStatus("saving");
    saveTimerRef.current = setTimeout(() => {
      saveNote(note);
    }, 1200);
  }, [saveNote]);

  // ── Update note field locally + schedule save ──
  const updateNoteField = (noteId: string, field: keyof Note, value: string | boolean | number) => {
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id !== noteId) return n;
        const updated = { ...n, [field]: value, updated: Date.now() };
        debouncedSave(updated);
        return updated;
      })
    );
  };

  // ── Create note ──
  const createNote = async () => {
    if (!user) return;
    const newNote: Note = {
      id: generateNoteId(),
      title: "",
      text: "",
      folder: activeFolder || "Geral",
      color: "#ffffff",
      pinned: false,
      ts: Date.now(),
      updated: Date.now(),
    };
    setNotes((prev) => [newNote, ...prev]);
    setSelectedNoteId(newNote.id);

    const { error } = await supabase.from("notes").insert({
      id: newNote.id,
      user_id: user.id,
      title: newNote.title,
      text: newNote.text,
      folder: newNote.folder,
      color: newNote.color,
      pinned: newNote.pinned,
      ts: newNote.ts,
      updated: newNote.updated,
    });
    if (error) toast.error("Erro ao criar nota.");
    // Focus editor
    setTimeout(() => editorRef.current?.focus(), 100);
  };

  // ── Delete note ──
  const deleteNote = async (noteId: string) => {
    if (!confirm("Excluir esta nota?")) return;
    const { error } = await supabase.from("notes").delete().eq("id", noteId);
    if (error) toast.error("Erro ao excluir.");
    else {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      if (selectedNoteId === noteId) setSelectedNoteId(null);
      toast.success("Nota excluída.");
    }
  };

  // ── Toggle pin ──
  const togglePin = async (noteId: string) => {
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;
    const newPinned = !note.pinned;
    updateNoteField(noteId, "pinned", newPinned);
  };

  // ── Folder management ──
  const createFolder = async () => {
    if (!newFolderName.trim() || !user) return;
    const { error } = await supabase.from("note_folders").insert({ user_id: user.id, name: newFolderName.trim() });
    if (error) {
      if (error.code === "23505") toast.error("Pasta já existe.");
      else toast.error("Erro ao criar pasta.");
    } else {
      toast.success("Pasta criada!");
      setNewFolderName("");
      setShowNewFolder(false);
      loadFolders();
    }
  };

  const renameFolder = async (oldName: string) => {
    if (!renameFolderName.trim() || !user) return;
    // Update folder record
    const { error: folderError } = await supabase
      .from("note_folders")
      .update({ name: renameFolderName.trim() })
      .eq("user_id", user.id)
      .eq("name", oldName);
    if (folderError) return toast.error("Erro ao renomear pasta.");
    // Update notes that reference this folder
    await supabase
      .from("notes")
      .update({ folder: renameFolderName.trim() })
      .eq("user_id", user.id)
      .eq("folder", oldName);
    setRenamingFolder(null);
    setRenameFolderName("");
    loadFolders();
    loadNotes();
    toast.success("Pasta renomeada!");
  };

  const deleteFolder = async (folderName: string) => {
    if (folderName === "Geral") return toast.error("A pasta Geral não pode ser excluída.");
    if (!confirm(`Excluir a pasta "${folderName}"? As notas serão movidas para Geral.`)) return;
    // Move notes to Geral
    await supabase.from("notes").update({ folder: "Geral" }).eq("user_id", user!.id).eq("folder", folderName);
    // Delete folder
    await supabase.from("note_folders").delete().eq("user_id", user!.id).eq("name", folderName);
    if (activeFolder === folderName) setActiveFolder(null);
    loadFolders();
    loadNotes();
    toast.success("Pasta excluída.");
  };

  // ── Loading ──
  if (authLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="lv-overline">Carregando...</p>
    </div>;
  }

  return (
    <AppLayout>
      <div className="min-h-full flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border/50">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div>
              <p className="lv-overline mb-1">Produtividade</p>
              <h1 className="lv-heading-lg">Notas</h1>
            </div>
            <div className="flex items-center gap-2">
              {/* Sync status */}
              {syncStatus === "saving" && (
                <span className="lv-badge lv-badge-warning flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Salvando...
                </span>
              )}
              {syncStatus === "saved" && (
                <span className="lv-badge lv-badge-success flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" /> Salvo
                </span>
              )}
              <button onClick={createNote} className="lv-btn-primary h-9 px-4 text-xs">
                <Plus className="h-3.5 w-3.5" /> Nova nota
              </button>
            </div>
          </div>
        </div>

        {/* Main content — split view */}
        <div className="flex flex-1 min-h-0 max-w-7xl mx-auto w-full">

          {/* ── Left panel: Folders + Note list ── */}
          <div className="w-80 border-r border-border/50 flex flex-col shrink-0">
            {/* Search */}
            <div className="p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar notas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="lv-input h-9 pl-9 text-xs"
                />
              </div>
            </div>

            {/* Folders */}
            <div className="px-3 pb-2">
              <div className="flex items-center justify-between mb-1.5">
                <p className="lv-caption font-medium uppercase tracking-wider">Pastas</p>
                <button
                  onClick={() => setShowNewFolder(!showNewFolder)}
                  className="lv-btn-icon h-6 w-6 text-muted-foreground"
                >
                  <FolderPlus className="h-3 w-3" />
                </button>
              </div>

              {showNewFolder && (
                <div className="flex items-center gap-1.5 mb-2">
                  <input
                    type="text"
                    placeholder="Nome da pasta"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createFolder()}
                    className="lv-input h-7 text-xs flex-1"
                    autoFocus
                  />
                  <button onClick={createFolder} className="lv-btn-primary h-7 px-2 text-[10px]">OK</button>
                  <button onClick={() => { setShowNewFolder(false); setNewFolderName(""); }} className="lv-btn-icon h-7 w-7">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              <div className="space-y-0.5">
                <button
                  onClick={() => setActiveFolder(null)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeFolder === null ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <FolderOpen className="h-3 w-3 inline mr-1.5" />
                  Todas ({notes.length})
                </button>
                {folders.map((folder) => (
                  <div key={folder.id} className="group flex items-center">
                    {renamingFolder === folder.name ? (
                      <div className="flex items-center gap-1 flex-1 px-1">
                        <input
                          value={renameFolderName}
                          onChange={(e) => setRenameFolderName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && renameFolder(folder.name)}
                          className="lv-input h-6 text-[10px] flex-1"
                          autoFocus
                        />
                        <button onClick={() => renameFolder(folder.name)} className="text-primary"><CheckCircle className="h-3 w-3" /></button>
                        <button onClick={() => setRenamingFolder(null)} className="text-muted-foreground"><X className="h-3 w-3" /></button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => setActiveFolder(folder.name)}
                          className={`flex-1 text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            activeFolder === folder.name ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"
                          }`}
                        >
                          <FolderOpen className="h-3 w-3 inline mr-1.5" />
                          {folder.name} ({notes.filter((n) => n.folder === folder.name).length})
                        </button>
                        <div className="hidden group-hover:flex items-center gap-0.5 pr-1">
                          <button
                            onClick={() => { setRenamingFolder(folder.name); setRenameFolderName(folder.name); }}
                            className="text-muted-foreground hover:text-foreground"
                          ><Edit3 className="h-2.5 w-2.5" /></button>
                          {folder.name !== "Geral" && (
                            <button
                              onClick={() => deleteFolder(folder.name)}
                              className="text-muted-foreground hover:text-destructive"
                            ><Trash2 className="h-2.5 w-2.5" /></button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Note list */}
            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
              <p className="lv-caption font-medium uppercase tracking-wider mb-1.5 pt-2">
                Notas ({filteredNotes.length})
              </p>
              {filteredNotes.length === 0 ? (
                <div className="text-center py-10">
                  <StickyNote className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="lv-caption">Nenhuma nota encontrada.</p>
                  <button onClick={createNote} className="lv-btn-primary h-8 px-3 text-[10px] mt-3">
                    <Plus className="h-3 w-3" /> Criar nota
                  </button>
                </div>
              ) : (
                filteredNotes.map((note) => (
                  <button
                    key={note.id}
                    onClick={() => setSelectedNoteId(note.id)}
                    className={`w-full text-left rounded-xl p-3 transition-all duration-200 group relative ${
                      selectedNoteId === note.id
                        ? "lv-card-active bg-primary/5 border border-primary/20"
                        : "hover:bg-muted/40"
                    }`}
                    style={{ borderLeft: `3px solid ${note.color === "#ffffff" ? "transparent" : note.color}` }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="lv-body-strong text-xs truncate">
                          {note.pinned && <Pin className="h-2.5 w-2.5 inline mr-1 text-primary" />}
                          {note.title || "Sem título"}
                        </p>
                        <p className="lv-caption truncate mt-0.5">{note.text.substring(0, 60) || "Nota vazia"}</p>
                        <p className="lv-caption text-[9px] mt-1 text-muted-foreground/60">
                          {new Date(note.updated).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* ── Right panel: Editor ── */}
          <div className="flex-1 flex flex-col min-w-0">
            {selectedNote ? (
              <>
                {/* Editor toolbar */}
                <div className="px-5 py-3 border-b border-border/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/* Color picker */}
                    <div className="relative">
                      <button
                        onClick={() => setShowColorPicker(!showColorPicker)}
                        className="lv-btn-icon h-8 w-8"
                        title="Cor da nota"
                      >
                        <Palette className="h-4 w-4" />
                      </button>
                      {showColorPicker && (
                        <div className="absolute top-full left-0 mt-1 lv-card-sm flex gap-1.5 z-10 p-2">
                          {NOTE_COLORS.map((c) => (
                            <button
                              key={c.hex}
                              onClick={() => { updateNoteField(selectedNote.id, "color", c.hex); setShowColorPicker(false); }}
                              className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
                                selectedNote.color === c.hex ? "border-primary" : "border-border/30"
                              }`}
                              style={{ backgroundColor: c.hex }}
                              title={c.name}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Pin toggle */}
                    <button
                      onClick={() => togglePin(selectedNote.id)}
                      className={`lv-btn-icon h-8 w-8 ${selectedNote.pinned ? "text-primary" : ""}`}
                      title={selectedNote.pinned ? "Desafixar" : "Fixar"}
                    >
                      {selectedNote.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                    </button>

                    {/* Folder selector */}
                    <select
                      value={selectedNote.folder}
                      onChange={(e) => updateNoteField(selectedNote.id, "folder", e.target.value)}
                      className="lv-input h-8 text-xs w-32"
                    >
                      {folders.map((f) => (
                        <option key={f.id} value={f.name}>{f.name}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => deleteNote(selectedNote.id)}
                    className="lv-btn-icon h-8 w-8 text-muted-foreground hover:text-destructive"
                    title="Excluir nota"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Editor body */}
                <div className="flex-1 flex flex-col p-5 overflow-y-auto" style={{ backgroundColor: selectedNote.color === "#ffffff" ? "transparent" : selectedNote.color + "20" }}>
                  {/* Title input */}
                  <input
                    type="text"
                    value={selectedNote.title}
                    onChange={(e) => updateNoteField(selectedNote.id, "title", e.target.value)}
                    placeholder="Título da nota"
                    className="w-full bg-transparent border-none outline-none text-xl font-semibold text-foreground placeholder:text-muted-foreground/40 mb-4"
                    style={{ letterSpacing: "-0.02em" }}
                  />

                  {/* Text editor */}
                  <textarea
                    ref={editorRef}
                    value={selectedNote.text}
                    onChange={(e) => updateNoteField(selectedNote.id, "text", e.target.value)}
                    placeholder="Comece a escrever..."
                    className="flex-1 w-full bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground/40 resize-none leading-relaxed"
                    style={{ minHeight: "300px" }}
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="lv-empty-icon mx-auto mb-4">
                    <StickyNote className="h-7 w-7" />
                  </div>
                  <p className="lv-heading-sm mb-2">Selecione uma nota</p>
                  <p className="lv-body mb-5">Escolha uma nota na lista à esquerda ou crie uma nova.</p>
                  <button onClick={createNote} className="lv-btn-primary h-10 px-5 text-sm">
                    <Plus className="h-4 w-4" /> Nova nota
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
