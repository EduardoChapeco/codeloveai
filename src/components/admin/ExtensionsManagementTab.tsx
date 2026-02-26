import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, Pencil, Plus, Trash2, Check, X, Puzzle, Link2, Unlink, Upload, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

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

interface ExtensionFile {
  id: string;
  file_url: string;
  version: string;
  instructions: string;
  is_latest: boolean;
  created_at: string;
  uploaded_by: string;
  extension_id: string | null;
}

const tierOptions = ["free", "pro", "enterprise", "white_label_only"];

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
  const { user } = useAuth();

  // Extension files upload state
  const [extFiles, setExtFiles] = useState<ExtensionFile[]>([]);
  const [extVersion, setExtVersion] = useState("");
  const [extFile, setExtFile] = useState<File | null>(null);
  const [extInstructions, setExtInstructions] = useState("");
  const [uploading, setUploading] = useState(false);
  const [activeSection, setActiveSection] = useState<"catalog" | "files">("files");
  // NEW: which catalog extension this file belongs to
  const [selectedExtensionId, setSelectedExtensionId] = useState<string>("");

  const fetchAll = async () => {
    setLoading(true);
    const [extRes, plansRes, linksRes, filesRes] = await Promise.all([
      supabase.from("extension_catalog").select("*").order("display_order"),
      supabase.from("plans").select("id, name, price, billing_cycle").eq("is_active", true).order("display_order"),
      supabase.from("plan_extensions").select("*"),
      supabase.from("extension_files").select("*").order("created_at", { ascending: false }),
    ]);
    const exts = (extRes.data || []).map((e: any) => ({
      ...e,
      features: Array.isArray(e.features) ? e.features : [],
    }));
    setExtensions(exts);
    setPlans((plansRes.data || []) as PlanOption[]);
    setPlanLinks((linksRes.data || []) as PlanExtensionLink[]);
    setExtFiles((filesRes.data as ExtensionFile[]) || []);
    // Auto-select first extension if none selected
    if (!selectedExtensionId && exts.length > 0) {
      setSelectedExtensionId(exts[0].id);
    }
    setLoading(false);
  };

  const uploadExtension = async () => {
    if (!extFile || !extVersion) return toast.error("Selecione arquivo e versão.");
    if (!user) return toast.error("Não autenticado.");
    if (!selectedExtensionId) return toast.error("Selecione a extensão de destino.");
    setUploading(true);
    try {
      // Find the extension slug for the path
      const ext = extensions.find(e => e.id === selectedExtensionId);
      const slug = ext?.slug || "unknown";
      const path = `${slug}/v${extVersion}/${extFile.name}`;
      const { error: upErr } = await supabase.storage.from("extensions").upload(path, extFile, { upsert: true });
      if (upErr) throw upErr;
      // Only archive previous versions of THIS specific extension
      await supabase.from("extension_files")
        .update({ is_latest: false } as any)
        .eq("is_latest", true)
        .eq("extension_id", selectedExtensionId);
      await supabase.from("extension_files").insert({
        file_url: path,
        version: extVersion,
        uploaded_by: user.id,
        is_latest: true,
        instructions: extInstructions,
        extension_id: selectedExtensionId,
      } as any);
      toast.success(`Extensão ${ext?.name || slug} v${extVersion} publicada!`);
      setExtVersion(""); setExtFile(null); setExtInstructions("");
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Erro ao fazer upload");
    } finally {
      setUploading(false);
    }
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

  // Get files for a specific extension
  const getFilesForExtension = (extId: string) =>
    extFiles.filter(f => f.extension_id === extId);

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

  const renderFilesSection = () => (
    <div className="space-y-6">
      {/* Upload form */}
      <div className="lv-card p-6 space-y-4">
        <p className="lv-body-strong flex items-center gap-2"><Upload className="h-4 w-4 text-primary" /> Upload de Nova Versão</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Extension selector */}
          <div className="space-y-1.5">
            <label className="lv-caption block">Extensão *</label>
            <select
              className="lv-input w-full"
              value={selectedExtensionId}
              onChange={e => setSelectedExtensionId(e.target.value)}
            >
              <option value="">Selecione a extensão...</option>
              {extensions.map(ext => (
                <option key={ext.id} value={ext.id}>{ext.name} ({ext.slug})</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="lv-caption block">Versão *</label>
            <input placeholder="ex: 2.1.0" value={extVersion}
              onChange={e => setExtVersion(e.target.value)}
              className="lv-input w-full" />
          </div>
          <div className="space-y-1.5">
            <label className="lv-caption block">Arquivo (.zip / .crx)</label>
            <input type="file" accept=".zip,.crx,.xpi,.txt"
              onChange={e => setExtFile(e.target.files?.[0] || null)}
              className="lv-input w-full file:hidden pt-2.5" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="lv-caption block">Changelog / Instruções</label>
          <textarea
            placeholder="Quais são as novidades desta versão?"
            value={extInstructions}
            onChange={e => setExtInstructions(e.target.value)}
            rows={3}
            className="lv-input w-full"
          />
        </div>
        <button onClick={uploadExtension} disabled={uploading || !selectedExtensionId} className="lv-btn-primary h-9 px-6 text-xs flex items-center gap-2">
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          PUBLICAR VERSÃO
        </button>
      </div>

      {/* Files grouped by extension */}
      {extensions.map(ext => {
        const files = getFilesForExtension(ext.id);
        if (files.length === 0) return null;
        return (
          <div key={ext.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: ext.hero_color }}>
                <Puzzle className="h-3.5 w-3.5 text-white" />
              </div>
              <p className="lv-body-strong">{ext.name} — {files.length} arquivo(s)</p>
            </div>
            {files.map(ef => (
              <div key={ef.id} className="lv-card p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Puzzle className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="lv-body-strong">v{ef.version}</span>
                    <span className={`lv-badge text-[10px] ${ef.is_latest ? 'lv-badge-success' : 'lv-badge-muted'}`}>
                      {ef.is_latest ? 'PRODUÇÃO' : 'ARQUIVADA'}
                    </span>
                  </div>
                  <p className="lv-caption text-muted-foreground">{format(new Date(ef.created_at), "dd/MM/yyyy HH:mm")}</p>
                  {ef.instructions && <p className="lv-caption text-muted-foreground/60 mt-1 line-clamp-2">{ef.instructions}</p>}
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {/* Orphan files (no extension_id) */}
      {(() => {
        const orphans = extFiles.filter(f => !f.extension_id);
        if (orphans.length === 0) return null;
        return (
          <div className="space-y-3">
            <p className="lv-body-strong text-yellow-600">⚠️ Arquivos sem extensão vinculada ({orphans.length})</p>
            <p className="lv-caption text-muted-foreground">Estes arquivos foram enviados antes do sistema de vinculação. Re-envie-os selecionando a extensão correta.</p>
            {orphans.map(ef => (
              <div key={ef.id} className="lv-card p-4 flex items-center gap-4 border-yellow-500/20">
                <div className="h-10 w-10 rounded-xl bg-yellow-500/10 flex items-center justify-center shrink-0">
                  <Puzzle className="h-5 w-5 text-yellow-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="lv-body-strong">v{ef.version}</span>
                    <span className="lv-badge lv-badge-muted text-[10px]">SEM VÍNCULO</span>
                  </div>
                  <p className="lv-caption text-muted-foreground">{ef.file_url}</p>
                </div>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Section tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveSection("files")}
          className={`h-9 px-4 rounded-xl text-xs font-medium flex items-center gap-2 transition-all ${activeSection === "files" ? "lv-btn-primary" : "lv-btn-secondary"}`}
        >
          <Upload className="h-3.5 w-3.5" /> Arquivos da Extensão
        </button>
        <button
          onClick={() => setActiveSection("catalog")}
          className={`h-9 px-4 rounded-xl text-xs font-medium flex items-center gap-2 transition-all ${activeSection === "catalog" ? "lv-btn-primary" : "lv-btn-secondary"}`}
        >
          <Puzzle className="h-3.5 w-3.5" /> Catálogo & Planos
        </button>
      </div>

      {activeSection === "files" && renderFilesSection()}

      {activeSection === "catalog" && (
        <>
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
              const files = getFilesForExtension(ext.id);
              const latestFile = files.find(f => f.is_latest);
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
                        {latestFile && (
                          <span className="lv-badge lv-badge-success text-[10px]">Arquivo: v{latestFile.version}</span>
                        )}
                        {!latestFile && (
                          <span className="lv-badge text-[10px] bg-yellow-500/10 text-yellow-600">Sem arquivo</span>
                        )}
                        {ext.is_featured && <span className="lv-badge text-[10px]" style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>Destaque</span>}
                      </div>
                      <p className="lv-caption text-muted-foreground">{ext.tagline}</p>
                      <p className="lv-caption text-muted-foreground/60 mt-0.5">slug: <code className="text-xs bg-muted px-1 rounded">{ext.slug}</code> · {ext.features.length} features · {files.length} arquivo(s)</p>

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
        </>
      )}
    </div>
  );
}
