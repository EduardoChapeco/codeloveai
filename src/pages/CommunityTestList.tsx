import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import TopProjectsBanner from "@/components/community/TopProjectsBanner";
import { toast } from "@/hooks/use-toast";
import {
  Plus, Loader2, X, Clock, MessageCircle, ArrowLeft,
  Sparkles, Flame, ExternalLink
} from "lucide-react";

interface TestSession {
  id: string;
  user_id: string;
  title: string;
  description: string;
  preview_url: string;
  project_name: string;
  cover_url: string | null;
  status: string;
  feedbacks_count: number;
  reactions_count: number;
  created_at: string;
}

export default function CommunityTestList() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [sessions, setSessions] = useState<TestSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, { name: string }>>({});

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [projectName, setProjectName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("community_test_sessions")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(50);

      if (data) {
        setSessions(data as TestSession[]);
        const uids = [...new Set(data.map((s: any) => s.user_id))];
        const { data: profs } = await supabase.from("profiles").select("user_id, name").in("user_id", uids);
        if (profs) {
          const map: Record<string, any> = {};
          profs.forEach((p: any) => { map[p.user_id] = { name: p.name || "Anônimo" }; });
          setProfiles(map);
        }
      }
      setLoading(false);
    })();
  }, []);

  const handleCreate = async () => {
    if (!user) return;
    if (!title.trim() || !previewUrl.trim()) return toast({ title: "Título e URL são obrigatórios", variant: "destructive" });
    setCreating(true);
    try {
      const { data, error } = await supabase.from("community_test_sessions").insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim(),
        preview_url: previewUrl.trim(),
        project_name: projectName.trim(),
      } as any).select("*").single();
      if (error) throw error;
      toast({ title: "Sessão criada! 🎉" });
      navigate(`/community/test/${data.id}`);
    } catch (err: any) {
      toast({ title: "Erro: " + (err.message || ""), variant: "destructive" });
    } finally { setCreating(false); }
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/community")}
              className="h-9 w-9 rounded-[12px] clf-liquid-glass flex items-center justify-center hover:bg-muted/80 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <p className="lv-overline mb-0.5">COMUNIDADE</p>
              <h1 className="lv-heading-lg">Teste & Feedback</h1>
            </div>
          </div>
          <button onClick={() => setShowCreate(true)} className="lv-btn-primary h-10 px-5 text-xs">
            <Plus className="h-4 w-4" /> CRIAR SESSÃO
          </button>
        </div>

        <p className="lv-body text-muted-foreground max-w-xl">
          Compartilhe seu projeto para receber feedback em tempo real da comunidade. Outros membros podem testar e opinar diretamente no chat ao vivo.
        </p>

        {/* Top Projects Banner */}
        <TopProjectsBanner />

        {/* Sessions Grid */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="clf-liquid-glass p-12 text-center rounded-2xl">
            <Sparkles className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="lv-body-strong text-muted-foreground">Nenhuma sessão ativa no momento.</p>
            <p className="lv-caption mt-1">Seja o primeiro a compartilhar seu projeto!</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sessions.map(s => {
              const prof = profiles[s.user_id];
              return (
                <button
                  key={s.id}
                  onClick={() => navigate(`/community/test/${s.id}`)}
                  className="clf-liquid-glass p-0 overflow-hidden text-left rounded-2xl hover:ring-1 hover:ring-primary/20 transition-all group"
                >
                  {/* Preview thumbnail */}
                  <div className="h-40 bg-muted relative overflow-hidden">
                    <iframe
                      src={s.preview_url}
                      className="w-[200%] h-[200%] origin-top-left scale-50 pointer-events-none border-0"
                      title={s.title}
                      tabIndex={-1}
                      sandbox="allow-scripts allow-same-origin"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                    <div className="absolute top-2 right-2 flex items-center gap-1">
                      <span className="text-[8px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                        style={{ background: "rgba(48,209,88,0.15)", color: "var(--clf-ok)" }}>
                        <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "var(--clf-ok)" }} /> AO VIVO
                      </span>
                    </div>
                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ExternalLink className="h-4 w-4 text-foreground/80" />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4 space-y-2">
                    <h3 className="lv-body-strong text-sm truncate">{s.title}</h3>
                    {s.description && <p className="lv-caption line-clamp-2">{s.description}</p>}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded-full bg-muted overflow-hidden">
                          <div className="w-full h-full flex items-center justify-center text-[7px] font-bold text-muted-foreground">
                            {(prof?.name || "?")[0]}
                          </div>
                        </div>
                        <span className="lv-caption">{prof?.name || "Anônimo"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="lv-caption flex items-center gap-0.5">
                          <MessageCircle className="h-3 w-3" /> {s.feedbacks_count}
                        </span>
                        <span className="lv-caption flex items-center gap-0.5">
                          <Flame className="h-3 w-3" /> {s.reactions_count}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Create Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
            <div className="clf-liquid-glass w-full max-w-md rounded-2xl" onClick={e => e.stopPropagation()}>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="lv-heading-md">Nova Sessão de Teste</h2>
                  <button onClick={() => setShowCreate(false)}
                    className="h-8 w-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div>
                  <label className="lv-overline block mb-1.5">TÍTULO *</label>
                  <input value={title} onChange={e => setTitle(e.target.value)}
                    placeholder="Ex: Meu app de finanças — preciso de feedback!"
                    className="lv-input w-full" maxLength={100} />
                </div>

                <div>
                  <label className="lv-overline block mb-1.5">URL DE PREVIEW *</label>
                  <input value={previewUrl} onChange={e => setPreviewUrl(e.target.value)}
                    placeholder="https://id-preview--xxx.lovable.app"
                    className="lv-input w-full" />
                </div>

                <div>
                  <label className="lv-overline block mb-1.5">NOME DO PROJETO</label>
                  <input value={projectName} onChange={e => setProjectName(e.target.value)}
                    placeholder="Opcional"
                    className="lv-input w-full" maxLength={60} />
                </div>

                <div>
                  <label className="lv-overline block mb-1.5">DESCRIÇÃO</label>
                  <textarea value={description} onChange={e => setDescription(e.target.value)}
                    placeholder="O que você gostaria que testassem?"
                    rows={3} className="lv-input w-full resize-none" maxLength={500} />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setShowCreate(false)} className="lv-btn-secondary h-10 px-5 text-xs">CANCELAR</button>
                  <button onClick={handleCreate} disabled={creating || !title.trim() || !previewUrl.trim()}
                    className="lv-btn-primary h-10 px-5 text-xs">
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "CRIAR SESSÃO"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
