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
  id: string; user_id: string; title: string; description: string;
  preview_url: string; project_name: string; cover_url: string | null;
  status: string; feedbacks_count: number; reactions_count: number; created_at: string;
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
      const { data } = await supabase.from("community_test_sessions").select("*").eq("status", "active").order("created_at", { ascending: false }).limit(50);
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
      const { data, error } = await supabase.from("community_test_sessions").insert({ user_id: user.id, title: title.trim(), description: description.trim(), preview_url: previewUrl.trim(), project_name: projectName.trim() } as any).select("*").single();
      if (error) throw error;
      toast({ title: "Sessão criada!" });
      navigate(`/community/test/${data.id}`);
    } catch (err: any) { toast({ title: "Erro: " + (err.message || ""), variant: "destructive" }); }
    finally { setCreating(false); }
  };

  return (
    <AppLayout>
      <div className="rd-page-content">
        {/* Header */}
        <div className="rd-page-head">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate("/community")} className="gl ico xs ghost"><ArrowLeft className="h-4 w-4" /></button>
              <div>
                <div className="sec-label">COMUNIDADE</div>
                <h1>Teste & Feedback</h1>
              </div>
            </div>
            <button onClick={() => setShowCreate(true)} className="gl sm orange"><Plus className="h-4 w-4" /> CRIAR SESSÃO</button>
          </div>
        </div>

        <p style={{ fontSize: 13, color: "var(--text-tertiary)", maxWidth: 560, marginBottom: 16 }}>
          Compartilhe seu projeto para receber feedback em tempo real da comunidade. Outros membros podem testar e opinar diretamente no chat ao vivo.
        </p>

        <TopProjectsBanner />

        {/* Sessions Grid */}
        {loading ? (
          <div className="flex justify-center" style={{ padding: "60px 0" }}>
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--text-tertiary)" }} />
          </div>
        ) : sessions.length === 0 ? (
          <div className="rd-card" style={{ textAlign: "center", padding: "48px 20px" }}>
            <Sparkles className="h-10 w-10 mx-auto" style={{ color: "var(--text-tertiary)", opacity: 0.2, marginBottom: 12 }} />
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Nenhuma sessão ativa no momento.</p>
            <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>Seja o primeiro a compartilhar seu projeto!</p>
          </div>
        ) : (
          <div className="rd-grid-3" style={{ marginTop: 16 }}>
            {sessions.map(s => {
              const prof = profiles[s.user_id];
              return (
                <button key={s.id} onClick={() => navigate(`/community/test/${s.id}`)}
                  className="rd-card interactive" style={{ padding: 0, textAlign: "left" }}>
                  <div style={{ height: 160, background: "var(--bg-3)", position: "relative", overflow: "hidden" }}>
                    <iframe src={s.preview_url} className="w-[200%] h-[200%] origin-top-left scale-50 pointer-events-none border-0" title={s.title} tabIndex={-1} sandbox="allow-scripts allow-same-origin" loading="lazy" />
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, var(--bg-1) 0%, transparent 60%)" }} />
                    <div style={{ position: "absolute", top: 8, right: 8 }}>
                      <span className="chip green" style={{ fontSize: 8 }}>AO VIVO</span>
                    </div>
                  </div>
                  <div style={{ padding: 14 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }} className="truncate">{s.title}</h3>
                    {s.description && <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }} className="line-clamp-2">{s.description}</p>}
                    <div className="flex items-center justify-between" style={{ marginTop: 8 }}>
                      <div className="flex items-center gap-2">
                        <div style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--bg-4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 700, color: "var(--text-tertiary)" }}>
                          {(prof?.name || "?")[0]}
                        </div>
                        <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{prof?.name || "Anônimo"}</span>
                      </div>
                      <div className="flex items-center gap-2" style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                        <span className="flex items-center gap-0.5"><MessageCircle className="h-3 w-3" /> {s.feedbacks_count}</span>
                        <span className="flex items-center gap-0.5"><Flame className="h-3 w-3" /> {s.reactions_count}</span>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }} onClick={() => setShowCreate(false)}>
            <div className="rd-card w-full max-w-md" onClick={e => e.stopPropagation()} style={{ padding: 24 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>Nova Sessão de Teste</p>
                <button onClick={() => setShowCreate(false)} className="gl ico xs ghost"><X className="h-4 w-4" /></button>
              </div>
              {[
                { label: "TÍTULO *", value: title, set: setTitle, placeholder: "Ex: Meu app de finanças — preciso de feedback!", max: 100 },
                { label: "URL DE PREVIEW *", value: previewUrl, set: setPreviewUrl, placeholder: "https://id-preview--xxx.lovable.app" },
                { label: "NOME DO PROJETO", value: projectName, set: setProjectName, placeholder: "Opcional", max: 60 },
              ].map(f => (
                <div key={f.label} style={{ marginBottom: 12 }}>
                  <label className="sec-label" style={{ display: "block", marginBottom: 6 }}>{f.label}</label>
                  <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder} maxLength={f.max}
                    style={{ width: "100%", height: 36, padding: "0 12px", borderRadius: "var(--r2)", background: "var(--bg-3)", border: "1px solid var(--b1)", color: "var(--text-primary)", fontSize: 13 }} />
                </div>
              ))}
              <div style={{ marginBottom: 12 }}>
                <label className="sec-label" style={{ display: "block", marginBottom: 6 }}>DESCRIÇÃO</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="O que você gostaria que testassem?" rows={3} maxLength={500}
                  style={{ width: "100%", padding: 12, borderRadius: "var(--r2)", background: "var(--bg-3)", border: "1px solid var(--b1)", color: "var(--text-primary)", fontSize: 13, resize: "none" }} />
              </div>
              <div className="flex justify-end gap-2" style={{ paddingTop: 8 }}>
                <button onClick={() => setShowCreate(false)} className="gl sm ghost">CANCELAR</button>
                <button onClick={handleCreate} disabled={creating || !title.trim() || !previewUrl.trim()} className="gl sm orange">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "CRIAR SESSÃO"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
