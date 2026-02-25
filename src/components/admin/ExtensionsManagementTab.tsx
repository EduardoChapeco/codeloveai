import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, Pencil, Plus, Trash2, Check, X, Puzzle, Link2, Unlink } from "lucide-react";
import { toast } from "sonner";

interface ExtensionItem {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  hero_color: string;
  tier: string;
  is_active: boolean;
  is_featured: boolean;
  display_order: number;
  version: string;
  features: { title: string; description: string }[];
}

interface PlanOption {
  id: string;
  name: string;
  price: number;
  billing_cycle: string;
}

interface PlanExtensionLink {
  id: string;
  plan_id: string;
  extension_id: string;
}

const tierOptions = ["free", "pro", "enterprise"];

const emptyForm = {
  slug: "", name: "", tagline: "", description: "", icon: "Puzzle",
  hero_color: "#6366f1", tier: "free", is_active: true, is_featured: false,
  display_order: 0, version: "1.0.0", features: "[]",
};

export default function ExtensionsManagementTab() {
  const [extensions, setExtensions] = useState<ExtensionItem[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [planLinks, setPlanLinks] = useState<PlanExtensionLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [linkingExtId, setLinkingExtId] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const [extRes, plansRes, linksRes] = await Promise.all([
      supabase.from("extension_catalog").select("*").order("display_order"),
      supabase.from("plans").select("id, name, price, billing_cycle").eq("is_active", true).order("display_order"),
      supabase.from("plan_extensions").select("*"),
    ]);
    setExtensions((extRes.data || []).map((e: any) => ({
      ...e,
      features: Array.isArray(e.features) ? e.features : [],
    })));
    setPlans((plansRes.data || []) as PlanOption[]);
    setPlanLinks((linksRes.data || []) as PlanExtensionLink[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const startEdit = (ext: ExtensionItem) => {
    setEditingId(ext.id);
    setCreating(false);
    setForm({
      slug: ext.slug, name: ext.name, tagline: ext.tagline,
      description: ext.description, icon: ext.icon, hero_color: ext.hero_color,
      tier: ext.tier, is_active: ext.is_active, is_featured: ext.is_featured,
      display_order: ext.display_order, version: ext.version,
      features: JSON.stringify(ext.features, null, 2),
    } as any);
  };

  const startCreate = () => {
    setEditingId(null);
    setCreating(true);
    setForm(emptyForm);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setCreating(false);
  };

  const saveExtension = async () => {
    setSaving(true);
    try {
      let parsedFeatures: any[];
      try {
        parsedFeatures = JSON.parse(form.features);
      } catch {
        toast.error("Features JSON inválido");
        setSaving(false);
        return;
      }

      const payload = {
        slug: form.slug,
        name: form.name,
        tagline: form.tagline,
        description: form.description,
        icon: form.icon,
        hero_color: form.hero_color,
        tier: form.tier,
        is_active: (form as any).is_active,
        is_featured: (form as any).is_featured,
        display_order: Number((form as any).display_order),
        version: form.version,
        features: parsedFeatures,
      };

      if (editingId) {
        const { error } = await supabase.from("extension_catalog")
          .update(payload as any).eq("id", editingId);
        if (error) throw error;
        toast.success("Extensão atualizada!");
      } else {
        const { error } = await supabase.from("extension_catalog")
          .insert(payload as any);
        if (error) throw error;
        toast.success("Extensão criada!");
      }
      cancelEdit();
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const deleteExtension = async (id: string) => {
    if (!confirm("Deletar esta extensão permanentemente?")) return;
    const { error } = await supabase.from("extension_catalog").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Extensão removida"); fetchAll(); }
  };

  const linkPlan = async (extId: string, planId: string) => {
    const { error } = await supabase.from("plan_extensions")
      .insert({ plan_id: planId, extension_id: extId } as any);
    if (error) {
      if (error.code === "23505") toast.info("Já vinculado");
      else toast.error(error.message);
    } else {
      toast.success("Plano vinculado!");
      fetchAll();
    }
  };

  const unlinkPlan = async (linkId: string) => {
    const { error } = await supabase.from("plan_extensions").delete().eq("id", linkId);
    if (error) toast.error(error.message);
    else { toast.success("Vínculo removido"); fetchAll(); }
  };

  const getLinkedPlans = (extId: string) =>
    planLinks.filter(l => l.extension_id === extId);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const renderForm = () => (
    <div className="lv-card space-y-4 p-5">
      <p className="lv-body-strong">{editingId ? "Editar Extensão" : "Nova Extensão"}</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="lv-caption block mb-1">Slug</label>
          <input className="lv-input w-full" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="speed" disabled={!!editingId} />
        </div>
        <div>
          <label className="lv-caption block mb-1">Nome</label>
          <input className="lv-input w-full" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Starble Speed" />
        </div>
        <div>
          <label className="lv-caption block mb-1">Ícone (Lucide)</label>
          <input className="lv-input w-full" value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} placeholder="Zap" />
        </div>
      </div>
      <div>
        <label className="lv-caption block mb-1">Tagline</label>
        <input className="lv-input w-full" value={form.tagline} onChange={e => setForm({ ...form, tagline: e.target.value })} />
      </div>
      <div>
        <label className="lv-caption block mb-1">Descrição</label>
        <textarea className="lv-input w-full" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="lv-caption block mb-1">Tier</label>
          <select className="lv-input w-full" value={form.tier} onChange={e => setForm({ ...form, tier: e.target.value })}>
            {tierOptions.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="lv-caption block mb-1">Cor Hero</label>
          <input type="color" className="lv-input w-full h-9" value={form.hero_color} onChange={e => setForm({ ...form, hero_color: e.target.value })} />
        </div>
        <div>
          <label className="lv-caption block mb-1">Versão</label>
          <input className="lv-input w-full" value={form.version} onChange={e => setForm({ ...form, version: e.target.value })} />
        </div>
        <div>
          <label className="lv-caption block mb-1">Ordem</label>
          <input type="number" className="lv-input w-full" value={(form as any).display_order} onChange={e => setForm({ ...form, display_order: Number(e.target.value) } as any)} min={0} />
        </div>
      </div>
      <div className="flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={(form as any).is_active} onChange={e => setForm({ ...form, is_active: e.target.checked } as any)} className="h-4 w-4 rounded" />
          <span className="lv-caption">Ativo</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={(form as any).is_featured} onChange={e => setForm({ ...form, is_featured: e.target.checked } as any)} className="h-4 w-4 rounded" />
          <span className="lv-caption">Destaque</span>
        </label>
      </div>
      <div>
        <label className="lv-caption block mb-1">Features (JSON)</label>
        <textarea className="lv-input w-full font-mono text-xs" rows={5} value={form.features} onChange={e => setForm({ ...form, features: e.target.value })} placeholder='[{"title":"...", "description":"..."}]' />
      </div>
      <div className="flex gap-2">
        <button onClick={saveExtension} disabled={saving} className="lv-btn-primary h-9 px-5 text-xs flex items-center gap-2">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {editingId ? "Salvar" : "Criar"}
        </button>
        <button onClick={cancelEdit} className="lv-btn-secondary h-9 px-4 text-xs flex items-center gap-2">
          <X className="h-3.5 w-3.5" /> Cancelar
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="lv-body-strong">Catálogo de Extensões — {extensions.length} extensão(ões)</p>
          <p className="lv-caption text-muted-foreground mt-0.5">Gerencie extensões e vincule a planos dinamicamente.</p>
        </div>
        {!creating && !editingId && (
          <button onClick={startCreate} className="lv-btn-primary h-9 px-4 text-xs flex items-center gap-2">
            <Plus className="h-3.5 w-3.5" /> Nova Extensão
          </button>
        )}
      </div>

      {(creating || editingId) && renderForm()}

      {/* Extensions list */}
      <div className="space-y-3">
        {extensions.map(ext => {
          const linked = getLinkedPlans(ext.id);
          return (
            <div key={ext.id} className="lv-card p-4">
              <div className="flex items-start gap-4">
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: ext.hero_color }}
                >
                  <Puzzle className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="lv-body-strong">{ext.name}</span>
                    <span className={`lv-badge text-[10px] ${ext.is_active ? 'lv-badge-success' : 'lv-badge-muted'}`}>
                      {ext.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                    <span className="lv-badge lv-badge-muted text-[10px]">{ext.tier}</span>
                    <span className="lv-badge lv-badge-muted text-[10px]">v{ext.version}</span>
                    {ext.is_featured && <span className="lv-badge text-[10px]" style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>Destaque</span>}
                  </div>
                  <p className="lv-caption text-muted-foreground">{ext.tagline}</p>
                  <p className="lv-caption text-muted-foreground/60 mt-0.5">slug: <code className="text-xs bg-muted px-1 rounded">{ext.slug}</code> · {ext.features.length} features</p>

                  {/* Plan links */}
                  <div className="mt-3">
                    <p className="lv-caption font-medium mb-1.5">Planos vinculados:</p>
                    <div className="flex flex-wrap gap-2">
                      {linked.map(link => {
                        const plan = plans.find(p => p.id === link.plan_id);
                        return (
                          <span key={link.id} className="inline-flex items-center gap-1.5 lv-badge lv-badge-muted text-[10px]">
                            {plan?.name || link.plan_id.slice(0, 8)}
                            <button onClick={() => unlinkPlan(link.id)} className="hover:text-destructive" title="Desvincular">
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        );
                      })}
                      {linkingExtId === ext.id ? (
                        <div className="flex items-center gap-1">
                          <select
                            className="lv-input h-7 text-xs"
                            defaultValue=""
                            onChange={e => { if (e.target.value) { linkPlan(ext.id, e.target.value); setLinkingExtId(null); } }}
                          >
                            <option value="">Selecionar plano...</option>
                            {plans
                              .filter(p => !linked.some(l => l.plan_id === p.id))
                              .map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.name} (R${(p.price / 100).toFixed(2)}/{p.billing_cycle})
                                </option>
                              ))}
                          </select>
                          <button onClick={() => setLinkingExtId(null)} className="lv-btn-icon h-7 w-7">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setLinkingExtId(ext.id)}
                          className="inline-flex items-center gap-1 lv-badge text-[10px] cursor-pointer hover:bg-primary/10"
                        >
                          <Link2 className="h-3 w-3" /> Vincular Plano
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => startEdit(ext)} className="lv-btn-icon h-8 w-8" title="Editar">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => deleteExtension(ext.id)} className="lv-btn-icon h-8 w-8 hover:text-destructive" title="Deletar">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
