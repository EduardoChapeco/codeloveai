import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { toast } from "sonner";
import {
  Package, Save, Eye, Loader2, Plus, Trash2, ArrowLeft,
  ImagePlus, Tag, Code2, Upload, Video, Key, X,
  Pencil, Globe, Play, FileText, Sparkles,
} from "lucide-react";

interface DemoCredential { label: string; email: string; password: string; }

export default function MarketplaceSell() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [sellerProfile, setSellerProfile] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    title: "", description: "", long_description: "", category: "webapp",
    price: "", tags: "", tech_stack: "", preview_image_url: "", demo_url: "",
    lovable_project_id: "", video_url: "", setup_instructions: "", highlights: "",
  });
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [demoCredentials, setDemoCredentials] = useState<DemoCredential[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login?returnTo=/marketplace/vender");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      let { data: sp } = await supabase.from("seller_profiles").select("*").eq("user_id", user.id).maybeSingle();
      if (!sp) {
        const { data: profile } = await supabase.from("profiles").select("name, email").eq("user_id", user.id).maybeSingle();
        const { data: newSp } = await supabase.from("seller_profiles")
          .insert({ user_id: user.id, display_name: profile?.name || user.email?.split("@")[0] || "Vendedor" }).select().single();
        sp = newSp;
      }
      setSellerProfile(sp);
      const { data: myListings } = await supabase.from("marketplace_listings").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      setListings(myListings || []);
      setLoading(false);
    };
    load();
  }, [user, authLoading, navigate]);

  const generateSlug = (title: string) =>
    title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Date.now().toString(36);

  const uploadFile = async (file: File, folder: string): Promise<string | null> => {
    if (!user) return null;
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const path = `${user.id}/${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("marketplace-media").upload(path, file, { upsert: true });
    if (error) { toast.error("Erro no upload: " + error.message); return null; }
    const { data } = supabase.storage.from("marketplace-media").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) { toast.error("Apenas imagens"); continue; }
      if (file.size > 10 * 1024 * 1024) { toast.error("Max 10MB por imagem"); continue; }
      const url = await uploadFile(file, "screenshots");
      if (url) urls.push(url);
    }
    setScreenshots(prev => [...prev, ...urls]);
    setUploading(false);
    e.target.value = "";
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 20 * 1024 * 1024) { toast.error("Max 20MB por arquivo"); continue; }
      const url = await uploadFile(file, "media");
      if (url) urls.push(url);
    }
    setMediaUrls(prev => [...prev, ...urls]);
    setUploading(false);
    e.target.value = "";
  };

  const addDemoCredential = () => setDemoCredentials(prev => [...prev, { label: "Admin", email: "", password: "" }]);
  const updateDemoCredential = (index: number, field: keyof DemoCredential, value: string) =>
    setDemoCredentials(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  const removeDemoCredential = (index: number) => setDemoCredentials(prev => prev.filter((_, i) => i !== index));

  const handleSave = async () => {
    if (!user || !sellerProfile || !form.title.trim()) { toast.error("Título obrigatório"); return; }
    setSaving(true);
    try {
      const payload = {
        user_id: user.id, seller_id: sellerProfile.id,
        title: form.title.trim(), slug: editing?.slug || generateSlug(form.title),
        description: form.description.trim(), long_description: form.long_description.trim(),
        category: form.category, price: parseFloat(form.price) || 0,
        tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
        tech_stack: form.tech_stack.split(",").map(t => t.trim()).filter(Boolean),
        preview_image_url: form.preview_image_url.trim() || null,
        demo_url: form.demo_url.trim() || null,
        lovable_project_id: form.lovable_project_id.trim() || null,
        video_url: form.video_url.trim() || null,
        setup_instructions: form.setup_instructions.trim() || null,
        highlights: form.highlights.split(",").map(t => t.trim()).filter(Boolean),
        screenshots, media_urls: mediaUrls,
        demo_credentials: demoCredentials.filter(c => c.email.trim()),
      };
      if (editing?.id) {
        const { error } = await supabase.from("marketplace_listings").update(payload as any).eq("id", editing.id);
        if (error) throw error;
        setListings(prev => prev.map(l => l.id === editing.id ? { ...l, ...payload } : l));
        toast.success("Atualizado!");
      } else {
        const { data, error } = await supabase.from("marketplace_listings").insert(payload as any).select().single();
        if (error) throw error;
        setListings(prev => [data, ...prev]);
        toast.success("Projeto criado como rascunho!");
      }
      resetForm();
    } catch (err: any) { toast.error("Erro: " + (err.message || "tente novamente")); }
    finally { setSaving(false); }
  };

  const handlePublish = async (id: string) => {
    const { error } = await supabase.from("marketplace_listings").update({ status: "published" } as any).eq("id", id);
    if (error) return toast.error("Erro ao publicar");
    setListings(prev => prev.map(l => l.id === id ? { ...l, status: "published" } : l));
    toast.success("Publicado na loja!");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este projeto?")) return;
    const { error } = await supabase.from("marketplace_listings").delete().eq("id", id);
    if (error) return toast.error("Erro ao excluir");
    setListings(prev => prev.filter(l => l.id !== id));
    toast.success("Excluído");
  };

  const editListing = (l: any) => {
    setEditing(l);
    setForm({
      title: l.title, description: l.description, long_description: l.long_description || "",
      category: l.category, price: l.price?.toString() || "0",
      tags: (l.tags || []).join(", "), tech_stack: (l.tech_stack || []).join(", "),
      preview_image_url: l.preview_image_url || "", demo_url: l.demo_url || "",
      lovable_project_id: l.lovable_project_id || "", video_url: l.video_url || "",
      setup_instructions: l.setup_instructions || "", highlights: (l.highlights || []).join(", "),
    });
    setScreenshots(l.screenshots || []);
    setMediaUrls(l.media_urls || []);
    setDemoCredentials(Array.isArray(l.demo_credentials) ? l.demo_credentials : []);
  };

  const resetForm = () => {
    setEditing(null);
    setForm({ title: "", description: "", long_description: "", category: "webapp", price: "", tags: "", tech_stack: "", preview_image_url: "", demo_url: "", lovable_project_id: "", video_url: "", setup_instructions: "", highlights: "" });
    setScreenshots([]); setMediaUrls([]); setDemoCredentials([]);
  };

  if (authLoading || loading) {
    return <AppLayout><div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <Loader2 size={20} style={{ animation: "gl-spin .7s linear infinite", color: "var(--text-tertiary)" }} />
    </div></AppLayout>;
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", height: 38, padding: "0 12px", borderRadius: "var(--r2)",
    background: "var(--bg-3)", border: "1px solid var(--b1)",
    color: "var(--text-primary)", fontSize: 12, fontFamily: "var(--font)",
  };

  return (
    <AppLayout>
      <div className="rd-page-content" style={{ maxWidth: 960, margin: "0 auto" }}>
        <button onClick={() => navigate("/marketplace")} className="gl sm ghost" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 5 }}>
          <ArrowLeft size={13} /> Voltar para a Loja
        </button>

        <div className="rd-page-head">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="nav-ico-box" style={{ background: "linear-gradient(135deg, var(--orange), var(--red))" }}>
              <Package size={18} />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 900 }}>Meu Catálogo</h1>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                Comissão: 30% &bull; Você recebe: <span style={{ color: "var(--orange)", fontWeight: 700 }}>70%</span>
              </p>
            </div>
          </div>
        </div>

        {/* FORM */}
        <div className="rd-card" style={{ padding: 20, marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, marginBottom: 16, display: "flex", alignItems: "center", gap: 6, color: "var(--text-primary)" }}>
            <Plus size={16} style={{ color: "var(--orange)" }} /> {editing ? "Editar Projeto" : "Novo Projeto"}
          </h2>

          {/* Basic Info */}
          <div style={{ marginBottom: 20 }}>
            <div className="sec-label" style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}>
              <FileText size={11} /> INFORMAÇÕES BÁSICAS
            </div>
            <div className="rd-grid-2" style={{ gap: 10 }}>
              <div>
                <label className="sec-label" style={{ display: "block", marginBottom: 4 }}>TÍTULO *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} placeholder="Meu Dashboard Pro" />
              </div>
              <div>
                <label className="sec-label" style={{ display: "block", marginBottom: 4 }}>CATEGORIA</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inputStyle}>
                  <option value="webapp">Web App</option><option value="dashboard">Dashboard</option>
                  <option value="landing">Landing Page</option><option value="saas">SaaS</option>
                  <option value="ecommerce">E-commerce</option><option value="portfolio">Portfólio</option>
                  <option value="tool">Ferramenta</option><option value="ai">IA / Bot</option>
                  <option value="api">API / Backend</option>
                </select>
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label className="sec-label" style={{ display: "block", marginBottom: 4 }}>DESCRIÇÃO CURTA</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={inputStyle} placeholder="Um dashboard completo com gráficos e relatórios" />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label className="sec-label" style={{ display: "block", marginBottom: 4 }}>DESCRIÇÃO LONGA (MARKDOWN)</label>
                <textarea value={form.long_description} onChange={e => setForm(f => ({ ...f, long_description: e.target.value }))} rows={5}
                  style={{ ...inputStyle, height: "auto", padding: 12, resize: "none" as const }}
                  placeholder="Descreva detalhadamente..." />
              </div>
              <div>
                <label className="sec-label" style={{ display: "block", marginBottom: 4 }}>PREÇO (R$)</label>
                <input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} type="number" min="0" step="0.01" style={inputStyle} placeholder="0 = grátis" />
              </div>
              <div>
                <label className="sec-label" style={{ display: "block", marginBottom: 4 }}>DESTAQUES</label>
                <input value={form.highlights} onChange={e => setForm(f => ({ ...f, highlights: e.target.value }))} style={inputStyle} placeholder="Responsivo, Dark Mode" />
              </div>
              <div>
                <label className="sec-label" style={{ display: "block", marginBottom: 4 }}>TAGS</label>
                <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} style={inputStyle} placeholder="react, dashboard" />
              </div>
              <div>
                <label className="sec-label" style={{ display: "block", marginBottom: 4 }}>TECH STACK</label>
                <input value={form.tech_stack} onChange={e => setForm(f => ({ ...f, tech_stack: e.target.value }))} style={inputStyle} placeholder="React, TypeScript" />
              </div>
            </div>
          </div>

          {/* Preview & Media */}
          <div style={{ marginBottom: 20 }}>
            <div className="sec-label" style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}>
              <ImagePlus size={11} /> PREVIEW & MÍDIA
            </div>
            <div className="rd-grid-2" style={{ gap: 10, marginBottom: 12 }}>
              <div>
                <label className="sec-label" style={{ display: "block", marginBottom: 4 }}>IMAGEM DE CAPA (URL)</label>
                <input value={form.preview_image_url} onChange={e => setForm(f => ({ ...f, preview_image_url: e.target.value }))} style={inputStyle} placeholder="https://..." />
              </div>
              <div>
                <label className="sec-label" style={{ display: "block", marginBottom: 4 }}>VÍDEO (URL)</label>
                <input value={form.video_url} onChange={e => setForm(f => ({ ...f, video_url: e.target.value }))} style={inputStyle} placeholder="https://youtube.com/..." />
              </div>
              <div>
                <label className="sec-label" style={{ display: "block", marginBottom: 4 }}>PREVIEW LIVE (ID PROJETO)</label>
                <input value={form.lovable_project_id} onChange={e => setForm(f => ({ ...f, lovable_project_id: e.target.value }))} style={inputStyle} placeholder="UUID do projeto" />
              </div>
              <div>
                <label className="sec-label" style={{ display: "block", marginBottom: 4 }}>DEMO URL</label>
                <input value={form.demo_url} onChange={e => setForm(f => ({ ...f, demo_url: e.target.value }))} style={inputStyle} placeholder="https://demo.exemplo.com" />
              </div>
            </div>

            {/* Screenshots */}
            <label className="sec-label" style={{ display: "block", marginBottom: 6 }}>SCREENSHOTS</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {screenshots.map((url, i) => (
                <div key={i} style={{ position: "relative", width: 120, height: 72, borderRadius: "var(--r2)", overflow: "hidden", border: "1px solid var(--b1)" }}>
                  <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button onClick={() => setScreenshots(p => p.filter((_, j) => j !== i))}
                    style={{ position: "absolute", top: 3, right: 3, width: 18, height: 18, borderRadius: "50%", background: "rgba(0,0,0,.6)", color: "#fff", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 0 }}>
                    <X size={10} />
                  </button>
                </div>
              ))}
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                style={{ width: 120, height: 72, borderRadius: "var(--r2)", border: "2px dashed var(--b2)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, color: "var(--text-quaternary)", cursor: "pointer", background: "transparent", fontFamily: "var(--font)" }}>
                {uploading ? <Loader2 size={16} style={{ animation: "gl-spin .7s linear infinite" }} /> : <ImagePlus size={16} />}
                <span style={{ fontSize: 9, fontWeight: 600 }}>Adicionar</span>
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleScreenshotUpload} />

            {/* Media */}
            <label className="sec-label" style={{ display: "block", marginBottom: 6 }}>MÍDIA ADICIONAL</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {mediaUrls.map((url, i) => (
                <div key={i} style={{ position: "relative", width: 120, height: 72, borderRadius: "var(--r2)", overflow: "hidden", border: "1px solid var(--b1)" }}>
                  {url.match(/\.(mp4|webm|mov)$/i) ? (
                    <div style={{ width: "100%", height: "100%", background: "var(--bg-4)", display: "flex", alignItems: "center", justifyContent: "center" }}><Play size={16} style={{ color: "var(--text-quaternary)" }} /></div>
                  ) : (
                    <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  )}
                  <button onClick={() => setMediaUrls(p => p.filter((_, j) => j !== i))}
                    style={{ position: "absolute", top: 3, right: 3, width: 18, height: 18, borderRadius: "50%", background: "rgba(0,0,0,.6)", color: "#fff", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 0 }}>
                    <X size={10} />
                  </button>
                </div>
              ))}
              <button onClick={() => mediaInputRef.current?.click()} disabled={uploading}
                style={{ width: 120, height: 72, borderRadius: "var(--r2)", border: "2px dashed var(--b2)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, color: "var(--text-quaternary)", cursor: "pointer", background: "transparent", fontFamily: "var(--font)" }}>
                {uploading ? <Loader2 size={16} style={{ animation: "gl-spin .7s linear infinite" }} /> : <Upload size={16} />}
                <span style={{ fontSize: 9, fontWeight: 600 }}>Upload</span>
              </button>
            </div>
            <input ref={mediaInputRef} type="file" accept="image/*,video/*" multiple style={{ display: "none" }} onChange={handleMediaUpload} />
          </div>

          {/* Demo Credentials */}
          <div style={{ marginBottom: 20 }}>
            <div className="sec-label" style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
              <Key size={11} /> ACESSOS DEMO (OPCIONAL)
            </div>
            <p style={{ fontSize: 10, color: "var(--text-quaternary)", marginBottom: 8 }}>Crie contas de demonstração para compradores testarem.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {demoCredentials.map((cred, i) => (
                <div key={i} className="rd-card" style={{ padding: 10, display: "flex", alignItems: "center", gap: 8 }}>
                  <input value={cred.label} onChange={e => updateDemoCredential(i, "label", e.target.value)}
                    style={{ ...inputStyle, width: 90, height: 32, fontSize: 11 }} placeholder="Tipo" />
                  <input value={cred.email} onChange={e => updateDemoCredential(i, "email", e.target.value)}
                    style={{ ...inputStyle, flex: 1, height: 32, fontSize: 11 }} placeholder="email@demo.com" />
                  <input value={cred.password} onChange={e => updateDemoCredential(i, "password", e.target.value)}
                    style={{ ...inputStyle, width: 120, height: 32, fontSize: 11 }} placeholder="senha" />
                  <button onClick={() => removeDemoCredential(i)} className="gl ico xs ghost" style={{ color: "var(--red)" }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <button onClick={addDemoCredential} className="gl sm ghost" style={{ alignSelf: "flex-start" }}>
                <Plus size={12} /> Adicionar Acesso Demo
              </button>
            </div>
          </div>

          {/* Setup Instructions */}
          <div style={{ marginBottom: 20 }}>
            <div className="sec-label" style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
              <Sparkles size={11} /> INSTRUÇÕES DE SETUP
            </div>
            <textarea value={form.setup_instructions} onChange={e => setForm(f => ({ ...f, setup_instructions: e.target.value }))} rows={4}
              style={{ ...inputStyle, height: "auto", padding: 12, resize: "none" as const }}
              placeholder="Instruções pós-compra: como configurar, variáveis de ambiente, etc." />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleSave} disabled={saving} className="gl sm orange" style={{ display: "flex", alignItems: "center", gap: 5 }}>
              {saving ? <Loader2 size={13} style={{ animation: "gl-spin .7s linear infinite" }} /> : <Save size={13} />}
              {editing ? "Salvar Alterações" : "Criar Rascunho"}
            </button>
            {editing && (
              <button onClick={resetForm} className="gl sm ghost">Cancelar</button>
            )}
          </div>
        </div>

        {/* MY LISTINGS */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Package size={14} style={{ color: "var(--orange)" }} />
          <span className="sec-label">MEUS PROJETOS ({listings.length})</span>
          <div style={{ flex: 1, height: 1, background: "var(--b1)" }} />
        </div>

        {listings.length === 0 ? (
          <div className="rd-card" style={{ textAlign: "center", padding: "48px 20px" }}>
            <Code2 size={32} style={{ color: "var(--text-quaternary)", opacity: 0.15, margin: "0 auto 8px" }} />
            <p style={{ fontSize: 12, color: "var(--text-quaternary)" }}>Nenhum projeto cadastrado ainda.</p>
          </div>
        ) : (
          <div className="rd-grid-2">
            {listings.map(l => (
              <div key={l.id} className="rd-card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ position: "relative", aspectRatio: "16/9", background: "var(--bg-3)", overflow: "hidden" }}>
                  {l.preview_image_url ? (
                    <img src={l.preview_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Code2 size={28} style={{ color: "var(--text-quaternary)", opacity: 0.12 }} />
                    </div>
                  )}
                  <div style={{ position: "absolute", top: 8, left: 8 }}>
                    <span className={`chip ${l.status === "published" ? "green" : ""}`} style={{ fontSize: 8 }}>
                      {l.status === "draft" ? "Rascunho" : l.status === "published" ? "Publicado" : l.status}
                    </span>
                  </div>
                  <div style={{ position: "absolute", top: 8, right: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 9999, background: "rgba(0,0,0,.6)", color: "#fff", backdropFilter: "blur(8px)" }}>
                      {l.price === 0 ? "Grátis" : `R$ ${l.price.toFixed(2)}`}
                    </span>
                  </div>
                </div>
                <div style={{ padding: 14 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.title}</h3>
                  <p style={{ fontSize: 11, color: "var(--text-tertiary)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden", marginBottom: 10 }}>{l.description}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "var(--text-quaternary)", marginBottom: 10 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 2 }}><Eye size={10} /> {l.views_count || 0}</span>
                    <span>&bull;</span>
                    <span>{l.sales_count || 0} vendas</span>
                    {l.demo_credentials?.length > 0 && (<>
                      <span>&bull;</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 2, color: "var(--orange)" }}><Key size={10} /> Demo</span>
                    </>)}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {l.status === "draft" && (
                      <button onClick={() => handlePublish(l.id)} className="gl sm" style={{ background: "rgba(16,185,129,.12)", color: "var(--green)", border: "1px solid rgba(16,185,129,.2)" }}>
                        Publicar
                      </button>
                    )}
                    <button onClick={() => editListing(l)} className="gl sm ghost"><Pencil size={11} /> Editar</button>
                    <button onClick={() => navigate(`/marketplace/${l.slug}`)} className="gl sm ghost"><Eye size={11} /> Ver</button>
                    <button onClick={() => handleDelete(l.id)} className="gl ico xs ghost" style={{ marginLeft: "auto", color: "var(--red)" }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
