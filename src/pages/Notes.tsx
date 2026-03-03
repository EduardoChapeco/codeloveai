import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSEO } from "@/hooks/useSEO";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import {
  StickyNote, FolderOpen, Plus, Search, Pin, PinOff, Trash2,
  Palette, FolderPlus, CheckCircle, Loader2, X,
  Edit3,
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

  const selectedNote = notes.find((n) => n.id === selectedNoteId) || null;

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
    setTimeout(() => editorRef.current?.focus(), 100);
  };

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

  const togglePin = async (noteId: string) => {
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;
    updateNoteField(noteId, "pinned", !note.pinned);
  };

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
    const { error: folderError } = await supabase
      .from("note_folders")
      .update({ name: renameFolderName.trim() })
      .eq("user_id", user.id)
      .eq("name", oldName);
    if (folderError) return toast.error("Erro ao renomear pasta.");
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
    await supabase.from("notes").update({ folder: "Geral" }).eq("user_id", user!.id).eq("folder", folderName);
    await supabase.from("note_folders").delete().eq("user_id", user!.id).eq("name", folderName);
    if (activeFolder === folderName) setActiveFolder(null);
    loadFolders();
    loadNotes();
    toast.success("Pasta excluída.");
  };

  if (authLoading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-0)" }}>
      <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--text-tertiary)" }} />
    </div>;
  }

  return (
    <AppLayout>
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Header */}
        <div className="page-header">
          <div className="ph-top">
            <div>
              <div className="ph-title">Notas</div>
              <div className="ph-sub">Organize suas ideias e anotações</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {syncStatus === "saving" && (
                <span className="chip ch-orange" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Loader2 size={10} className="animate-spin" /> Salvando...
                </span>
              )}
              {syncStatus === "saved" && (
                <span className="chip ch-green" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <CheckCircle size={10} /> Salvo
                </span>
              )}
              <button onClick={createNote} className="gl sm orange">
                <Plus size={13} /> Nova nota
              </button>
            </div>
          </div>
        </div>

        {/* Split view */}
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>

          {/* Left panel: Folders + Note list */}
          <div style={{ width: 280, flexShrink: 0, borderRight: "1px solid var(--b1)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Search */}
            <div style={{ padding: 12 }}>
              <div style={{ position: "relative" }}>
                <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-quaternary)" }} />
                <input
                  type="text"
                  placeholder="Buscar notas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="rd-input"
                  style={{ height: 32, paddingLeft: 30, fontSize: 12 }}
                />
              </div>
            </div>

            {/* Folders */}
            <div style={{ padding: "0 12px 8px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span className="sb-section" style={{ padding: 0 }}>Pastas</span>
                <button onClick={() => setShowNewFolder(!showNewFolder)} className="gl ico xs ghost">
                  <FolderPlus size={11} />
                </button>
              </div>

              {showNewFolder && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
                  <input
                    type="text"
                    placeholder="Nome da pasta"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createFolder()}
                    className="rd-input"
                    style={{ height: 28, fontSize: 11, flex: 1 }}
                    autoFocus
                  />
                  <button onClick={createFolder} className="gl xs orange">OK</button>
                  <button onClick={() => { setShowNewFolder(false); setNewFolderName(""); }} className="gl ico xs ghost">
                    <X size={11} />
                  </button>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <button
                  onClick={() => setActiveFolder(null)}
                  className={`group-btn ${activeFolder === null ? "active" : ""}`}
                >
                  <FolderOpen size={13} />
                  Todas ({notes.length})
                </button>
                {folders.map((folder) => (
                  <div key={folder.id} className="group" style={{ display: "flex", alignItems: "center" }}>
                    {renamingFolder === folder.name ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, padding: "0 4px" }}>
                        <input
                          value={renameFolderName}
                          onChange={(e) => setRenameFolderName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && renameFolder(folder.name)}
                          className="rd-input"
                          style={{ height: 24, fontSize: 10, flex: 1 }}
                          autoFocus
                        />
                        <button onClick={() => renameFolder(folder.name)} style={{ color: "var(--green-l)" }}><CheckCircle size={12} /></button>
                        <button onClick={() => setRenamingFolder(null)} style={{ color: "var(--text-tertiary)" }}><X size={12} /></button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => setActiveFolder(folder.name)}
                          className={`group-btn ${activeFolder === folder.name ? "active" : ""}`}
                          style={{ flex: 1 }}
                        >
                          <FolderOpen size={13} />
                          {folder.name} ({notes.filter((n) => n.folder === folder.name).length})
                        </button>
                        <div className="hidden group-hover:flex" style={{ alignItems: "center", gap: 2, paddingRight: 4 }}>
                          <button
                            onClick={() => { setRenamingFolder(folder.name); setRenameFolderName(folder.name); }}
                            style={{ color: "var(--text-tertiary)" }}
                          ><Edit3 size={10} /></button>
                          {folder.name !== "Geral" && (
                            <button
                              onClick={() => deleteFolder(folder.name)}
                              style={{ color: "var(--red-l)" }}
                            ><Trash2 size={10} /></button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Note list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 12px", scrollbarWidth: "thin", scrollbarColor: "var(--bg-5) transparent" }}>
              <div className="sb-section" style={{ paddingTop: 8 }}>
                Notas ({filteredNotes.length})
              </div>
              {filteredNotes.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 12px" }}>
                  <StickyNote size={28} style={{ color: "var(--text-quaternary)", margin: "0 auto 8px", opacity: 0.3 }} />
                  <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Nenhuma nota encontrada.</p>
                  <button onClick={createNote} className="gl sm orange" style={{ marginTop: 12 }}>
                    <Plus size={12} /> Criar nota
                  </button>
                </div>
              ) : (
                filteredNotes.map((note) => (
                  <button
                    key={note.id}
                    onClick={() => setSelectedNoteId(note.id)}
                    className={`brain-item ${selectedNoteId === note.id ? "active" : ""}`}
                    style={{ borderLeft: `3px solid ${note.color === "#ffffff" ? "transparent" : note.color}`, textAlign: "left", width: "100%" }}
                  >
                    <div className="bi-name" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                      {note.pinned && <Pin size={10} style={{ color: "var(--orange)" }} />}
                      {note.title || "Sem título"}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {note.text.substring(0, 60) || "Nota vazia"}
                    </div>
                    <div className="bi-date">
                      {new Date(note.updated).toLocaleDateString("pt-BR")}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right panel: Editor */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            {selectedNote ? (
              <>
                {/* Editor toolbar */}
                <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--b1)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {/* Color picker */}
                    <div style={{ position: "relative" }}>
                      <button onClick={() => setShowColorPicker(!showColorPicker)} className="gl ico xs ghost" title="Cor da nota">
                        <Palette size={13} />
                      </button>
                      {showColorPicker && (
                        <div style={{
                          position: "absolute", top: "100%", left: 0, marginTop: 4, zIndex: 10,
                          background: "var(--bg-2)", border: "1px solid var(--b2)", borderRadius: "var(--r3)",
                          padding: 8, display: "flex", gap: 6,
                        }}>
                          {NOTE_COLORS.map((c) => (
                            <button
                              key={c.hex}
                              onClick={() => { updateNoteField(selectedNote.id, "color", c.hex); setShowColorPicker(false); }}
                              style={{
                                width: 22, height: 22, borderRadius: "50%", backgroundColor: c.hex,
                                border: selectedNote.color === c.hex ? "2px solid var(--orange)" : "2px solid var(--b1)",
                                cursor: "pointer", transition: "transform .12s",
                              }}
                              title={c.name}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Pin toggle */}
                    <button
                      onClick={() => togglePin(selectedNote.id)}
                      className="gl ico xs ghost"
                      style={{ color: selectedNote.pinned ? "var(--orange-l)" : undefined }}
                      title={selectedNote.pinned ? "Desafixar" : "Fixar"}
                    >
                      {selectedNote.pinned ? <PinOff size={13} /> : <Pin size={13} />}
                    </button>

                    {/* Folder selector */}
                    <select
                      value={selectedNote.folder}
                      onChange={(e) => updateNoteField(selectedNote.id, "folder", e.target.value)}
                      className="rd-input"
                      style={{ height: 28, fontSize: 11, width: 120 }}
                    >
                      {folders.map((f) => (
                        <option key={f.id} value={f.name}>{f.name}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => deleteNote(selectedNote.id)}
                    className="gl ico xs ghost"
                    style={{ color: "var(--red-l)" }}
                    title="Excluir nota"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Editor body */}
                <div style={{
                  flex: 1, display: "flex", flexDirection: "column", padding: 20, overflowY: "auto",
                  backgroundColor: selectedNote.color === "#ffffff" ? "transparent" : selectedNote.color + "12",
                }}>
                  <input
                    type="text"
                    value={selectedNote.title}
                    onChange={(e) => updateNoteField(selectedNote.id, "title", e.target.value)}
                    placeholder="Título da nota"
                    style={{
                      width: "100%", background: "transparent", border: "none", outline: "none",
                      fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em",
                      color: "var(--text-primary)", marginBottom: 16,
                    }}
                  />
                  <textarea
                    ref={editorRef}
                    value={selectedNote.text}
                    onChange={(e) => updateNoteField(selectedNote.id, "text", e.target.value)}
                    placeholder="Comece a escrever..."
                    style={{
                      flex: 1, width: "100%", background: "transparent", border: "none", outline: "none",
                      fontSize: 13, color: "var(--text-secondary)", resize: "none",
                      lineHeight: 1.7, minHeight: 300, fontFamily: "var(--font)",
                    }}
                  />
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ textAlign: "center" }}>
                  <StickyNote size={36} style={{ color: "var(--text-quaternary)", margin: "0 auto 12px", opacity: 0.3 }} />
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Selecione uma nota</p>
                  <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 16 }}>Escolha uma nota na lista à esquerda ou crie uma nova.</p>
                  <button onClick={createNote} className="gl sm orange">
                    <Plus size={13} /> Nova nota
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
