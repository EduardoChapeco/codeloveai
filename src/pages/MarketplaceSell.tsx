import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { toast } from "sonner";
import {
  Package, Save, Eye, Loader2, Plus, Trash2, ArrowLeft,
  ImagePlus, Tag, Code2, Upload, Video, Key, X, GripVertical,
  Pencil, Globe, Play, FileText, Sparkles,
} from "lucide-react";

interface DemoCredential {
  label: string;
  email: string;
  password: string;
}

const glassCard = {
  background: "var(--liquid-glass-bg, rgba(255,255,255,0.04))",
  backdropFilter: "blur(40px) saturate(200%)",
  WebkitBackdropFilter: "blur(40px) saturate(200%)",
  border: "0.5px solid var(--clf-border)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 12px rgba(0,0,0,0.08)",
} as const;

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
    lovable_project_id: "", video_url: "", setup_instructions: "",
    highlights: "",
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
      let { data: sp } = await supabase
        .from("seller_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!sp) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, email")
          .eq("user_id", user.id)
          .maybeSingle();

        const { data: newSp } = await supabase
          .from("seller_profiles")
          .insert({ user_id: user.id, display_name: profile?.name || user.email?.split("@")[0] || "Vendedor" })
          .select()
          .single();
        sp = newSp;
      }
      setSellerProfile(sp);

      const { data: myListings } = await supabase
        .from("marketplace_listings")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setListings(myListings || []);
      setLoading(false);
    };
    load();
  }, [user, authLoading, navigate]);

  const generateSlug = (title: string) =>
    title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Date.now().toString(36);

  /* ── File upload helper ── */
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

  const addDemoCredential = () => {
    setDemoCredentials(prev => [...prev, { label: "Admin", email: "", password: "" }]);
  };

  const updateDemoCredential = (index: number, field: keyof DemoCredential, value: string) => {
    setDemoCredentials(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  const removeDemoCredential = (index: number) => {
    setDemoCredentials(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!user || !sellerProfile || !form.title.trim()) {
      toast.error("Título obrigatório"); return;
    }
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        seller_id: sellerProfile.id,
        title: form.title.trim(),
        slug: editing?.slug || generateSlug(form.title),
        description: form.description.trim(),
        long_description: form.long_description.trim(),
        category: form.category,
        price: parseFloat(form.price) || 0,
        tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
        tech_stack: form.tech_stack.split(",").map(t => t.trim()).filter(Boolean),
        preview_image_url: form.preview_image_url.trim() || null,
        demo_url: form.demo_url.trim() || null,
        lovable_project_id: form.lovable_project_id.trim() || null,
        video_url: form.video_url.trim() || null,
        setup_instructions: form.setup_instructions.trim() || null,
        highlights: form.highlights.split(",").map(t => t.trim()).filter(Boolean),
        screenshots,
        media_urls: mediaUrls,
        demo_credentials: demoCredentials.filter(c => c.email.trim()),
      };

      if (editing?.id) {
        const { error } = await supabase.from("marketplace_listings")
          .update(payload as any).eq("id", editing.id);
        if (error) throw error;
        setListings(prev => prev.map(l => l.id === editing.id ? { ...l, ...payload } : l));
        toast.success("Atualizado!");
      } else {
        const { data, error } = await supabase.from("marketplace_listings")
          .insert(payload as any).select().single();
        if (error) throw error;
        setListings(prev => [data, ...prev]);
        toast.success("Projeto criado como rascunho!");
      }
      resetForm();
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "tente novamente"));
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (id: string) => {
    const { error } = await supabase.from("marketplace_listings")
      .update({ status: "published" } as any).eq("id", id);
    if (error) return toast.error("Erro ao publicar");
    setListings(prev => prev.map(l => l.id === id ? { ...l, status: "published" } : l));
    toast.success("Publicado na loja! 🎉");
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
      setup_instructions: l.setup_instructions || "",
      highlights: (l.highlights || []).join(", "),
    });
    setScreenshots(l.screenshots || []);
    setMediaUrls(l.media_urls || []);
    setDemoCredentials(Array.isArray(l.demo_credentials) ? l.demo_credentials : []);
  };

  const resetForm = () => {
    setEditing(null);
    setForm({ title: "", description: "", long_description: "", category: "webapp", price: "", tags: "", tech_stack: "", preview_image_url: "", demo_url: "", lovable_project_id: "", video_url: "", setup_instructions: "", highlights: "" });
    setScreenshots([]);
    setMediaUrls([]);
    setDemoCredentials([]);
  };

  if (authLoading || loading) {
    return <AppLayout><div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></AppLayout>;
  }

  const statusColors: Record<string, string> = {
    draft: "bg-muted/40 text-muted-foreground",
    published: "bg-green-500/10 text-green-600",
    suspended: "bg-red-500/10 text-red-600",
    archived: "bg-muted/40 text-muted-foreground",
  };

  const inputClass = "w-full h-10 px-4 rounded-2xl bg-muted/20 border border-border/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all";
  const labelClass = "text-[11px] font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wider";

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <button onClick={() => navigate("/marketplace")} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para a Loja
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/25">
            <Package className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Meu Catálogo</h1>
            <p className="text-xs text-muted-foreground font-medium">
              Gerencie seus projetos à venda — Comissão: 30% • Você recebe: <span className="text-primary font-bold">70%</span>
            </p>
          </div>
        </div>

        {/* ── FORM ── */}
        <div className="rounded-2xl p-6 mb-10" style={glassCard}>
          <h2 className="text-base font-black mb-6 flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" /> {editing ? "Editar Projeto" : "Novo Projeto"}
          </h2>

          {/* Section: Informações Básicas */}
          <div className="mb-8">
            <h3 className="text-[11px] font-black text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" /> Informações Básicas
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Título *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className={inputClass} placeholder="Meu Dashboard Pro" />
              </div>
              <div>
                <label className={labelClass}>Categoria</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className={inputClass}>
                  <option value="webapp">Web App</option>
                  <option value="dashboard">Dashboard</option>
                  <option value="landing">Landing Page</option>
                  <option value="saas">SaaS</option>
                  <option value="ecommerce">E-commerce</option>
                  <option value="portfolio">Portfólio</option>
                  <option value="tool">Ferramenta</option>
                  <option value="ai">IA / Bot</option>
                  <option value="api">API / Backend</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Descrição curta</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className={inputClass} placeholder="Um dashboard completo com gráficos e relatórios" />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Descrição Longa (Markdown)</label>
                <textarea value={form.long_description} onChange={e => setForm(f => ({ ...f, long_description: e.target.value }))}
                  rows={6}
                  className="w-full px-4 py-3 rounded-2xl bg-muted/20 border border-border/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  placeholder="Descreva detalhadamente: funcionalidades, setup, tecnologias usadas, o que está incluído..." />
              </div>
              <div>
                <label className={labelClass}>Preço (R$)</label>
                <input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} type="number" min="0" step="0.01"
                  className={inputClass} placeholder="0 = grátis" />
              </div>
              <div>
                <label className={labelClass}>Destaques (separados por vírgula)</label>
                <input value={form.highlights} onChange={e => setForm(f => ({ ...f, highlights: e.target.value }))}
                  className={inputClass} placeholder="Responsivo, Dark Mode, Multi-idioma" />
              </div>
              <div>
                <label className={labelClass}>Tags</label>
                <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                  className={inputClass} placeholder="react, dashboard, analytics" />
              </div>
              <div>
                <label className={labelClass}>Tech Stack</label>
                <input value={form.tech_stack} onChange={e => setForm(f => ({ ...f, tech_stack: e.target.value }))}
                  className={inputClass} placeholder="React, TypeScript, Supabase" />
              </div>
            </div>
          </div>

          {/* Section: Preview & Mídia */}
          <div className="mb-8">
            <h3 className="text-[11px] font-black text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
              <ImagePlus className="h-3.5 w-3.5" /> Preview & Mídia
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className={labelClass}>Imagem de Capa (URL)</label>
                <input value={form.preview_image_url} onChange={e => setForm(f => ({ ...f, preview_image_url: e.target.value }))}
                  className={inputClass} placeholder="https://..." />
              </div>
              <div>
                <label className={labelClass}>Vídeo Demonstrativo (URL YouTube/MP4)</label>
                <input value={form.video_url} onChange={e => setForm(f => ({ ...f, video_url: e.target.value }))}
                  className={inputClass} placeholder="https://youtube.com/watch?v=..." />
              </div>
              <div>
                <label className={labelClass}>Preview Live (ID do Projeto Lovable)</label>
                <input value={form.lovable_project_id} onChange={e => setForm(f => ({ ...f, lovable_project_id: e.target.value }))}
                  className={inputClass} placeholder="UUID do projeto para preview ao vivo" />
                <p className="text-[10px] text-muted-foreground/60 mt-1">O preview será exibido em sandbox seguro — URL não será visível</p>
              </div>
              <div>
                <label className={labelClass}>Demo URL (link externo opcional)</label>
                <input value={form.demo_url} onChange={e => setForm(f => ({ ...f, demo_url: e.target.value }))}
                  className={inputClass} placeholder="https://demo.exemplo.com" />
              </div>
            </div>

            {/* Screenshots upload */}
            <div className="mb-4">
              <label className={labelClass}>Screenshots (upload de imagens)</label>
              <div className="flex flex-wrap gap-3 mb-2">
                {screenshots.map((url, i) => (
                  <div key={i} className="relative group h-24 w-36 rounded-xl overflow-hidden border border-border/30">
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button onClick={() => setScreenshots(p => p.filter((_, j) => j !== i))}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  className="h-24 w-36 rounded-xl border-2 border-dashed border-border/40 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors">
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                  <span className="text-[9px] font-semibold">Adicionar</span>
                </button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleScreenshotUpload} />
            </div>

            {/* Media upload (images + videos) */}
            <div>
              <label className={labelClass}>Mídia Adicional (vídeos, imagens, GIFs)</label>
              <div className="flex flex-wrap gap-3 mb-2">
                {mediaUrls.map((url, i) => (
                  <div key={i} className="relative group h-24 w-36 rounded-xl overflow-hidden border border-border/30">
                    {url.match(/\.(mp4|webm|mov)$/i) ? (
                      <div className="h-full w-full bg-muted/30 flex items-center justify-center">
                        <Play className="h-6 w-6 text-muted-foreground" />
                      </div>
                    ) : (
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    )}
                    <button onClick={() => setMediaUrls(p => p.filter((_, j) => j !== i))}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button onClick={() => mediaInputRef.current?.click()} disabled={uploading}
                  className="h-24 w-36 rounded-xl border-2 border-dashed border-border/40 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors">
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                  <span className="text-[9px] font-semibold">Upload</span>
                </button>
              </div>
              <input ref={mediaInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleMediaUpload} />
            </div>
          </div>

          {/* Section: Acessos Demo */}
          <div className="mb-8">
            <h3 className="text-[11px] font-black text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
              <Key className="h-3.5 w-3.5" /> Acessos Demo (opcional)
            </h3>
            <p className="text-[10px] text-muted-foreground/60 mb-3">
              Crie contas de demonstração para que compradores possam testar antes de comprar.
            </p>
            <div className="space-y-3">
              {demoCredentials.map((cred, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl p-3" style={{ ...glassCard, background: "rgba(255,255,255,0.02)" }}>
                  <input value={cred.label} onChange={e => updateDemoCredential(i, "label", e.target.value)}
                    className="w-28 h-8 px-3 rounded-lg bg-muted/20 border border-border/30 text-xs" placeholder="Tipo" />
                  <input value={cred.email} onChange={e => updateDemoCredential(i, "email", e.target.value)}
                    className="flex-1 h-8 px-3 rounded-lg bg-muted/20 border border-border/30 text-xs" placeholder="email@demo.com" />
                  <input value={cred.password} onChange={e => updateDemoCredential(i, "password", e.target.value)}
                    className="w-36 h-8 px-3 rounded-lg bg-muted/20 border border-border/30 text-xs" placeholder="senha" />
                  <button onClick={() => removeDemoCredential(i)}
                    className="h-8 w-8 rounded-lg hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button onClick={addDemoCredential}
                className="h-9 px-4 rounded-xl border border-dashed border-border/40 text-xs text-muted-foreground hover:text-primary hover:border-primary/30 flex items-center gap-1.5 transition-colors">
                <Plus className="h-3.5 w-3.5" /> Adicionar Acesso Demo
              </button>
            </div>
          </div>

          {/* Section: Setup */}
          <div className="mb-8">
            <h3 className="text-[11px] font-black text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5" /> Instruções de Setup
            </h3>
            <textarea value={form.setup_instructions} onChange={e => setForm(f => ({ ...f, setup_instructions: e.target.value }))}
              rows={4}
              className="w-full px-4 py-3 rounded-2xl bg-muted/20 border border-border/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              placeholder="Instruções pós-compra: como configurar, variáveis de ambiente, etc." />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={saving}
              className="h-11 px-6 rounded-2xl bg-primary text-primary-foreground text-sm font-bold flex items-center gap-2 disabled:opacity-50 hover:shadow-lg hover:shadow-primary/25 transition-all">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editing ? "Salvar Alterações" : "Criar Rascunho"}
            </button>
            {editing && (
              <button onClick={resetForm} className="h-11 px-5 rounded-2xl border border-border/30 text-sm text-muted-foreground hover:text-foreground transition-colors">
                Cancelar
              </button>
            )}
          </div>
        </div>

        {/* ── MY LISTINGS (bigger cards) ── */}
        <h2 className="text-base font-black mb-5 flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" /> Meus Projetos ({listings.length})
        </h2>
        {listings.length === 0 ? (
          <div className="text-center py-16 rounded-2xl" style={glassCard}>
            <Code2 className="h-10 w-10 text-muted-foreground/15 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground/60">Nenhum projeto cadastrado ainda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {listings.map(l => (
              <div key={l.id} className="rounded-2xl overflow-hidden group" style={glassCard}>
                {/* Preview image */}
                <div className="relative aspect-[16/9] bg-muted/10 overflow-hidden">
                  {l.preview_image_url ? (
                    <img src={l.preview_image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <Code2 className="h-10 w-10 text-muted-foreground/10" />
                    </div>
                  )}
                  <div className="absolute top-3 left-3">
                    <span className={`text-[10px] font-bold px-3 py-1.5 rounded-xl ${statusColors[l.status] || statusColors.draft}`}>
                      {l.status === "draft" ? "Rascunho" : l.status === "published" ? "Publicado" : l.status}
                    </span>
                  </div>
                  <div className="absolute top-3 right-3">
                    <span className="px-3 py-1.5 rounded-xl text-xs font-black bg-black/60 text-white backdrop-blur-sm">
                      {l.price === 0 ? "Grátis" : `R$ ${l.price.toFixed(2)}`}
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="p-5">
                  <h3 className="text-base font-bold mb-1 truncate">{l.title}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{l.description}</p>

                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60 mb-4">
                    <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" /> {l.views_count || 0}</span>
                    <span>•</span>
                    <span>{l.sales_count || 0} vendas</span>
                    {l.demo_credentials?.length > 0 && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-0.5 text-primary"><Key className="h-3 w-3" /> Demo</span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {l.status === "draft" && (
                      <button onClick={() => handlePublish(l.id)}
                        className="h-9 px-4 rounded-xl bg-green-500/10 text-green-600 text-xs font-bold hover:bg-green-500/20 transition-colors">
                        Publicar
                      </button>
                    )}
                    <button onClick={() => editListing(l)}
                      className="h-9 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:bg-muted/30 transition-colors text-muted-foreground hover:text-foreground"
                      style={glassCard}>
                      <Pencil className="h-3 w-3" /> Editar
                    </button>
                    <button onClick={() => navigate(`/marketplace/${l.slug}`)}
                      className="h-9 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:bg-muted/30 transition-colors text-muted-foreground hover:text-foreground"
                      style={glassCard}>
                      <Eye className="h-3 w-3" /> Ver
                    </button>
                    <button onClick={() => handleDelete(l.id)}
                      className="h-9 w-9 rounded-xl hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive ml-auto transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
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
