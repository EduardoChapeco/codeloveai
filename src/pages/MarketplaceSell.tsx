import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { toast } from "sonner";
import {
  Package, Save, Eye, Loader2, Plus, Trash2, ArrowLeft,
  ImagePlus, Tag, Code2,
} from "lucide-react";

export default function MarketplaceSell() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [sellerProfile, setSellerProfile] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // New listing form
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    title: "", description: "", long_description: "", category: "webapp",
    price: "", tags: "", tech_stack: "", preview_image_url: "", demo_url: "",
    screenshots: "",
  });

  useEffect(() => {
    if (!authLoading && !user) navigate("/login?returnTo=/marketplace/vender");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // Get or create seller profile
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

      // Load my listings
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
        screenshots: form.screenshots.split(",").map(s => s.trim()).filter(Boolean),
      };

      if (editing?.id) {
        const { error } = await supabase.from("marketplace_listings")
          .update(payload as any).eq("id", editing.id);
        if (error) throw error;
        setListings(prev => prev.map(l => l.id === editing.id ? { ...l, ...payload } : l));
        toast.success("Atualizado!");
      } else {
        const { data, error } = await supabase.from("marketplace_listings")
          .insert(payload).select().single();
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
      screenshots: (l.screenshots || []).join(", "),
    });
  };

  const resetForm = () => {
    setEditing(null);
    setForm({ title: "", description: "", long_description: "", category: "webapp", price: "", tags: "", tech_stack: "", preview_image_url: "", demo_url: "", screenshots: "" });
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

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <button onClick={() => navigate("/marketplace")} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para a Loja
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <Package className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Meu Catálogo</h1>
            <p className="text-xs text-muted-foreground">Gerencie seus projetos à venda — comissão da plataforma: 40%</p>
          </div>
        </div>

        {/* Form */}
        <div className="clf-liquid-glass rounded-2xl p-6 mb-8">
          <h2 className="text-sm font-bold mb-4 flex items-center gap-2">
            <Plus className="h-4 w-4" /> {editing ? "Editar Projeto" : "Novo Projeto"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Título *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full h-9 px-3 rounded-xl bg-muted/20 border border-border/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Meu Dashboard Pro" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Categoria</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full h-9 px-3 rounded-xl bg-muted/20 border border-border/30 text-sm focus:outline-none">
                <option value="webapp">Web App</option>
                <option value="dashboard">Dashboard</option>
                <option value="landing">Landing Page</option>
                <option value="saas">SaaS</option>
                <option value="ecommerce">E-commerce</option>
                <option value="portfolio">Portfólio</option>
                <option value="tool">Ferramenta</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Descrição curta</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full h-9 px-3 rounded-xl bg-muted/20 border border-border/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Um dashboard completo com gráficos e relatórios" />
            </div>
            <div className="md:col-span-2">
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Descrição longa</label>
              <textarea value={form.long_description} onChange={e => setForm(f => ({ ...f, long_description: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2 rounded-xl bg-muted/20 border border-border/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                placeholder="Descreva detalhadamente o que inclui, funcionalidades, setup..." />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Preço (R$)</label>
              <input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} type="number" min="0" step="0.01"
                className="w-full h-9 px-3 rounded-xl bg-muted/20 border border-border/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="0 = grátis" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">URL da Demo</label>
              <input value={form.demo_url} onChange={e => setForm(f => ({ ...f, demo_url: e.target.value }))}
                className="w-full h-9 px-3 rounded-xl bg-muted/20 border border-border/30 text-sm focus:outline-none"
                placeholder="https://..." />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Tags (separadas por vírgula)</label>
              <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                className="w-full h-9 px-3 rounded-xl bg-muted/20 border border-border/30 text-sm focus:outline-none"
                placeholder="react, dashboard, analytics" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Tech Stack (separado por vírgula)</label>
              <input value={form.tech_stack} onChange={e => setForm(f => ({ ...f, tech_stack: e.target.value }))}
                className="w-full h-9 px-3 rounded-xl bg-muted/20 border border-border/30 text-sm focus:outline-none"
                placeholder="React, TypeScript, Supabase" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Imagem de Preview (URL)</label>
              <input value={form.preview_image_url} onChange={e => setForm(f => ({ ...f, preview_image_url: e.target.value }))}
                className="w-full h-9 px-3 rounded-xl bg-muted/20 border border-border/30 text-sm focus:outline-none"
                placeholder="https://..." />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Screenshots (URLs, separadas por vírgula)</label>
              <input value={form.screenshots} onChange={e => setForm(f => ({ ...f, screenshots: e.target.value }))}
                className="w-full h-9 px-3 rounded-xl bg-muted/20 border border-border/30 text-sm focus:outline-none"
                placeholder="https://img1.png, https://img2.png" />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-5">
            <button onClick={handleSave} disabled={saving}
              className="h-9 px-5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {editing ? "Salvar Alterações" : "Criar Rascunho"}
            </button>
            {editing && (
              <button onClick={resetForm} className="h-9 px-4 rounded-xl border border-border/30 text-xs text-muted-foreground hover:text-foreground">
                Cancelar
              </button>
            )}
          </div>
        </div>

        {/* My listings */}
        <h2 className="text-sm font-bold mb-4">Meus Projetos ({listings.length})</h2>
        {listings.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 py-8 text-center">Nenhum projeto cadastrado ainda.</p>
        ) : (
          <div className="space-y-3">
            {listings.map(l => (
              <div key={l.id} className="clf-liquid-glass rounded-xl p-4 flex items-center gap-4">
                <div className="h-16 w-24 rounded-lg bg-muted/20 overflow-hidden shrink-0">
                  {l.preview_image_url ? (
                    <img src={l.preview_image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center"><Code2 className="h-5 w-5 text-muted-foreground/15" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold truncate">{l.title}</h3>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${statusColors[l.status] || statusColors.draft}`}>
                      {l.status === "draft" ? "Rascunho" : l.status === "published" ? "Publicado" : l.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{l.description}</p>
                  <p className="text-xs font-bold mt-1">{l.price === 0 ? "Grátis" : `R$ ${l.price.toFixed(2)}`} <span className="font-normal text-muted-foreground">• {l.sales_count} vendas</span></p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {l.status === "draft" && (
                    <button onClick={() => handlePublish(l.id)}
                      className="h-7 px-3 rounded-lg bg-green-500/10 text-green-600 text-[10px] font-semibold hover:bg-green-500/20">
                      Publicar
                    </button>
                  )}
                  <button onClick={() => editListing(l)}
                    className="h-7 w-7 rounded-lg hover:bg-muted/30 flex items-center justify-center text-muted-foreground">
                    <Tag className="h-3 w-3" />
                  </button>
                  <button onClick={() => navigate(`/marketplace/${l.slug}`)}
                    className="h-7 w-7 rounded-lg hover:bg-muted/30 flex items-center justify-center text-muted-foreground">
                    <Eye className="h-3 w-3" />
                  </button>
                  <button onClick={() => handleDelete(l.id)}
                    className="h-7 w-7 rounded-lg hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
