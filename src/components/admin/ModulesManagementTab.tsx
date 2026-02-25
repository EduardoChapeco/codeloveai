import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, Pencil, Check, X, Package } from "lucide-react";
import { toast } from "sonner";

interface ModuleCatalogItem {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  price_per_user_cents: number;
  billing_model: string;
  is_default: boolean;
  is_active: boolean;
  display_order: number;
}

interface TenantModuleRow {
  id: string;
  tenant_id: string;
  module_slug: string;
  enabled: boolean;
  price_override_cents: number | null;
  billing_model_override: string | null;
}

interface TenantOption {
  id: string;
  name: string;
  slug: string;
}

const billingLabels: Record<string, string> = {
  free: "Gratuito",
  per_user: "Por usuário",
  per_message: "Por mensagem",
  flat: "Taxa fixa",
};

export default function ModulesManagementTab() {
  const [modules, setModules] = useState<ModuleCatalogItem[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [tenantModules, setTenantModules] = useState<TenantModuleRow[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ price: string; billing_model: string }>({ price: "0", billing_model: "free" });

  useEffect(() => {
    fetchCatalog();
  }, []);

  useEffect(() => {
    if (selectedTenant) fetchTenantModules(selectedTenant);
  }, [selectedTenant]);

  const fetchCatalog = async () => {
    setLoading(true);
    const [modRes, tenRes] = await Promise.all([
      supabase.from("module_catalog").select("*").order("display_order"),
      supabase.from("tenants").select("id, name, slug").order("name"),
    ]);
    setModules((modRes.data as ModuleCatalogItem[]) || []);
    setTenants((tenRes.data as TenantOption[]) || []);
    setLoading(false);
  };

  const fetchTenantModules = async (tenantId: string) => {
    const { data } = await supabase
      .from("tenant_modules")
      .select("*")
      .eq("tenant_id", tenantId);
    setTenantModules((data as TenantModuleRow[]) || []);
  };

  const saveModuleCatalog = async (mod: ModuleCatalogItem) => {
    setSaving(mod.id);
    const { error } = await supabase.from("module_catalog").update({
      price_per_user_cents: parseInt(editForm.price, 10),
      billing_model: editForm.billing_model,
    }).eq("id", mod.id);
    if (error) toast.error(error.message);
    else { toast.success(`Módulo ${mod.name} atualizado`); await fetchCatalog(); }
    setSaving(null);
    setEditingModule(null);
  };

  const toggleModuleActive = async (mod: ModuleCatalogItem) => {
    await supabase.from("module_catalog").update({ is_active: !mod.is_active }).eq("id", mod.id);
    toast.success(`${mod.name} ${!mod.is_active ? "ativado" : "desativado"}`);
    await fetchCatalog();
  };

  const toggleTenantModule = async (slug: string, currentlyEnabled: boolean) => {
    if (!selectedTenant) return;
    const existing = tenantModules.find(tm => tm.module_slug === slug);
    if (existing) {
      await supabase.from("tenant_modules").update({ enabled: !currentlyEnabled }).eq("id", existing.id);
    } else {
      await (supabase as any).from("tenant_modules").insert({
        tenant_id: selectedTenant,
        module_slug: slug,
        enabled: !currentlyEnabled,
      });
    }
    toast.success(`Módulo ${slug} ${!currentlyEnabled ? "habilitado" : "desabilitado"} para o tenant`);
    await fetchTenantModules(selectedTenant);
  };

  const formatPrice = (cents: number) => `R$${(cents / 100).toFixed(2).replace(".", ",")}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Module Catalog */}
      <div className="lv-card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="lv-overline mb-1">Catálogo de Módulos</p>
            <p className="lv-caption">Defina preços e modelo de cobrança para cada módulo do sistema.</p>
          </div>
          <Package className="h-5 w-5 text-muted-foreground" />
        </div>

        <div className="space-y-3">
          {modules.map(mod => {
            const isEditing = editingModule === mod.id;
            return (
              <div key={mod.id} className={`lv-card-sm flex items-center justify-between gap-4 ${!mod.is_active ? "opacity-50" : ""}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="lv-body-strong">{mod.name}</p>
                    {mod.is_default && <span className="lv-badge text-[10px]">Padrão</span>}
                    {!mod.is_active && <span className="lv-badge lv-badge-destructive text-[10px]">Inativo</span>}
                  </div>
                  <p className="lv-caption truncate">{mod.description}</p>
                </div>

                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={editForm.price}
                      onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))}
                      className="lv-input w-24 h-8 text-xs"
                      placeholder="Centavos"
                    />
                    <select
                      value={editForm.billing_model}
                      onChange={e => setEditForm(f => ({ ...f, billing_model: e.target.value }))}
                      className="lv-input h-8 text-xs w-32"
                    >
                      <option value="free">Gratuito</option>
                      <option value="per_user">Por usuário</option>
                      <option value="per_message">Por mensagem</option>
                      <option value="flat">Taxa fixa</option>
                    </select>
                    <button onClick={() => saveModuleCatalog(mod)} className="lv-btn-primary h-8 px-3 text-xs" disabled={saving === mod.id}>
                      {saving === mod.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    </button>
                    <button onClick={() => setEditingModule(null)} className="lv-btn-secondary h-8 px-3 text-xs">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">
                        {mod.billing_model === "free" ? "Grátis" : formatPrice(mod.price_per_user_cents)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{billingLabels[mod.billing_model]}</p>
                    </div>
                    <button
                      onClick={() => { setEditingModule(mod.id); setEditForm({ price: String(mod.price_per_user_cents), billing_model: mod.billing_model }); }}
                      className="lv-btn-secondary h-8 w-8 p-0 flex items-center justify-center"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => toggleModuleActive(mod)}
                      className={`h-8 px-3 text-xs rounded-xl ${mod.is_active ? "bg-destructive/10 text-destructive hover:bg-destructive/20" : "bg-primary/10 text-primary hover:bg-primary/20"} transition-colors`}
                    >
                      {mod.is_active ? "Desativar" : "Ativar"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tenant Module Assignment */}
      <div className="lv-card">
        <p className="lv-overline mb-1">Módulos por Tenant</p>
        <p className="lv-caption mb-4">Selecione um tenant para gerenciar quais módulos ele pode acessar.</p>

        <select
          value={selectedTenant}
          onChange={e => setSelectedTenant(e.target.value)}
          className="lv-input h-10 mb-6"
        >
          <option value="">Selecione um tenant...</option>
          {tenants.map(t => (
            <option key={t.id} value={t.id}>{t.name} (/{t.slug})</option>
          ))}
        </select>

        {selectedTenant && (
          <div className="space-y-2">
            {modules.filter(m => m.is_active).map(mod => {
              const tmRow = tenantModules.find(tm => tm.module_slug === mod.slug);
              const enabled = tmRow ? tmRow.enabled : mod.is_default;
              return (
                <div key={mod.slug} className="flex items-center justify-between lv-card-sm">
                  <div>
                    <p className="lv-body-strong text-sm">{mod.name}</p>
                    <p className="lv-caption text-xs">
                      {mod.billing_model === "free" ? "Grátis" : `${formatPrice(tmRow?.price_override_cents ?? mod.price_per_user_cents)} / ${billingLabels[tmRow?.billing_model_override ?? mod.billing_model]}`}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleTenantModule(mod.slug, enabled)}
                    className={`h-8 px-4 text-xs rounded-xl font-medium transition-colors ${
                      enabled
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {enabled ? "✓ Habilitado" : "Desabilitado"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
