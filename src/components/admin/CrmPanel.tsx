import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Upload, Users, Search, Phone, Tag, Trash2, FileSpreadsheet,
  Send, MessageSquare, Loader2, Plus, Filter, CheckCircle2,
  AlertCircle, Clock, Globe, BarChart3, Zap, Pause, Play,
  FileText, X, ChevronRight
} from "lucide-react";

interface CrmPanelProps {
  tenantId: string;
  userId: string;
}

interface Contact {
  id: string;
  phone: string;
  phone_normalized: string;
  name: string;
  email: string;
  tags: string[];
  is_international: boolean;
  is_active: boolean;
  source: string;
  created_at: string;
}

interface ContactList {
  id: string;
  name: string;
  file_name: string;
  total_rows: number;
  duplicates_found: number;
  imported_count: number;
  status: string;
  created_at: string;
}

interface Campaign {
  id: string;
  name: string;
  message_template: string;
  media_url: string | null;
  media_type: string;
  target_tags: string[];
  status: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  schedule_at: string | null;
  created_at: string;
}

type CrmTab = "contacts" | "lists" | "campaigns" | "whatsapp";

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 12) return `+${digits}`;
  if (digits.length === 11) return `+55${digits}`;
  if (digits.length === 10) return `+55${digits}`;
  return `+${digits}`;
}

export default function CrmPanel({ tenantId, userId }: CrmPanelProps) {
  const [tab, setTab] = useState<CrmTab>("contacts");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [lists, setLists] = useState<ContactList[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Campaign form
  const [campaignForm, setCampaignForm] = useState({
    name: "", message_template: "", media_url: "", target_tags: "" as string, schedule_at: ""
  });

  const fetchContacts = useCallback(async () => {
    const { data } = await supabase.from("crm_contacts")
      .select("*").eq("tenant_id", tenantId).eq("is_active", true)
      .order("created_at", { ascending: false }).limit(500);
    setContacts((data || []) as Contact[]);
  }, [tenantId]);

  const fetchLists = useCallback(async () => {
    const { data } = await supabase.from("crm_contact_lists")
      .select("*").eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    setLists((data || []) as ContactList[]);
  }, [tenantId]);

  const fetchCampaigns = useCallback(async () => {
    const { data } = await supabase.from("crm_campaigns")
      .select("*").eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    setCampaigns((data || []) as Campaign[]);
  }, [tenantId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchContacts(), fetchLists(), fetchCampaigns()]).finally(() => setLoading(false));
  }, [fetchContacts, fetchLists, fetchCampaigns]);

  // ═══ CSV Upload & Parse ═══
  const handleFileUpload = async (files: FileList) => {
    if (!files.length) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      try {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 1) continue;

        // Create list record
        const { data: list, error: listErr } = await supabase.from("crm_contact_lists").insert({
          tenant_id: tenantId, user_id: userId, name: file.name.replace(/\.(csv|xlsx|xls|txt)$/i, ""),
          file_name: file.name, total_rows: lines.length, status: "processing"
        } as any).select("id").single();
        if (listErr || !list) { toast.error(`Erro ao criar lista: ${listErr?.message}`); continue; }

        // Parse contacts - detect phone numbers in each line
        const phoneRegex = /(\+?\d[\d\s\-().]{7,}\d)/g;
        const parsed: { phone: string; phone_normalized: string; name: string; is_international: boolean }[] = [];
        const seen = new Set<string>();

        for (const line of lines) {
          const phones = line.match(phoneRegex);
          if (!phones) continue;
          for (const rawPhone of phones) {
            const normalized = normalizePhone(rawPhone);
            if (seen.has(normalized)) continue;
            seen.add(normalized);
            const nameMatch = line.replace(rawPhone, "").replace(/[,;|"\t]+/g, " ").trim();
            parsed.push({
              phone: rawPhone.trim(),
              phone_normalized: normalized,
              name: nameMatch.substring(0, 100),
              is_international: !normalized.startsWith("+55"),
            });
          }
        }

        // Batch upsert with dedup
        let imported = 0;
        let duplicates = 0;
        const BATCH_SIZE = 100;

        for (let i = 0; i < parsed.length; i += BATCH_SIZE) {
          const batch = parsed.slice(i, i + BATCH_SIZE).map(c => ({
            tenant_id: tenantId, user_id: userId,
            phone: c.phone, phone_normalized: c.phone_normalized,
            name: c.name, is_international: c.is_international,
            source: "csv", tags: [file.name.replace(/\.\w+$/, "")]
          }));

          const { data: result, error } = await supabase.from("crm_contacts")
            .upsert(batch as any[], { onConflict: "tenant_id,phone_normalized", ignoreDuplicates: true })
            .select("id");

          if (!error) imported += result?.length || 0;
          duplicates += batch.length - (result?.length || 0);
        }

        // Update list record
        await supabase.from("crm_contact_lists").update({
          status: "completed", imported_count: imported, duplicates_found: duplicates, total_rows: parsed.length
        } as any).eq("id", list.id);

        toast.success(`${file.name}: ${imported} importados, ${duplicates} duplicados ignorados`);
      } catch (err: any) {
        toast.error(`Erro ao processar ${file.name}: ${err.message}`);
      }
    }

    setUploading(false);
    fetchContacts();
    fetchLists();
  };

  // ═══ Create Campaign ═══
  const handleCreateCampaign = async () => {
    if (!campaignForm.name || !campaignForm.message_template) return toast.error("Preencha nome e mensagem");
    const tags = campaignForm.target_tags.split(",").map(t => t.trim()).filter(Boolean);
    const { error } = await supabase.from("crm_campaigns").insert({
      tenant_id: tenantId, user_id: userId,
      name: campaignForm.name, message_template: campaignForm.message_template,
      media_url: campaignForm.media_url || null, target_tags: tags,
      schedule_at: campaignForm.schedule_at || null, status: "draft",
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Campanha criada!");
    setShowNewCampaign(false);
    setCampaignForm({ name: "", message_template: "", media_url: "", target_tags: "", schedule_at: "" });
    fetchCampaigns();
  };

  const deleteContact = async (id: string) => {
    await supabase.from("crm_contacts").update({ is_active: false } as any).eq("id", id);
    toast.success("Contato removido");
    fetchContacts();
  };

  const filteredContacts = contacts.filter(c =>
    !search || c.phone.includes(search) || c.name.toLowerCase().includes(search.toLowerCase())
  );

  const TABS: { id: CrmTab; label: string; icon: any; count?: number }[] = [
    { id: "contacts", label: "Contatos", icon: Users, count: contacts.length },
    { id: "lists", label: "Listas", icon: FileSpreadsheet, count: lists.length },
    { id: "campaigns", label: "Campanhas", icon: Send, count: campaigns.length },
    { id: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  ];

  const GlassCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <div className={`rounded-2xl border border-white/[0.06] p-6 ${className}`}
      style={{ background: "rgba(255,255,255,0.02)", backdropFilter: "blur(40px) saturate(180%)" }}>
      {children}
    </div>
  );

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string }> = {
      draft: { bg: "bg-muted/50", text: "text-muted-foreground" },
      scheduled: { bg: "bg-blue-500/10", text: "text-blue-400" },
      running: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
      paused: { bg: "bg-amber-500/10", text: "text-amber-400" },
      completed: { bg: "bg-primary/10", text: "text-primary" },
      cancelled: { bg: "bg-destructive/10", text: "text-destructive" },
    };
    const s = map[status] || map.draft;
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.bg} ${s.text}`}>{status}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground tracking-tight">CRM & Mensageria</h2>
          <p className="text-xs text-muted-foreground">Gerencie contatos, importe listas e dispare campanhas via WhatsApp</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="file" ref={fileRef} accept=".csv,.txt,.xls,.xlsx" multiple className="hidden"
            onChange={e => e.target.files && handleFileUpload(e.target.files)} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-2 hover:shadow-lg hover:shadow-primary/25 transition-all active:scale-[0.98]">
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Importar CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Contatos", value: contacts.length, icon: Users, color: "text-primary" },
          { label: "Listas", value: lists.length, icon: FileSpreadsheet, color: "text-blue-400" },
          { label: "Campanhas", value: campaigns.length, icon: Send, color: "text-emerald-400" },
          { label: "Internacionais", value: contacts.filter(c => c.is_international).length, icon: Globe, color: "text-amber-400" },
        ].map((s) => (
          <GlassCard key={s.label} className="!p-4">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={`h-4 w-4 ${s.color}`} />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{s.label}</span>
            </div>
            <p className={`text-2xl font-bold ${s.color} tabular-nums`}>{s.value}</p>
          </GlassCard>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/[0.06] pb-0">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-colors ${
              tab === t.id ? "bg-white/[0.04] text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
            }`}>
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
            {t.count !== undefined && <span className="ml-1 text-[10px] text-muted-foreground">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* ═══ CONTACTS TAB ═══ */}
      {tab === "contacts" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
              <input className="w-full h-10 pl-9 pr-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Buscar por nome ou telefone..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Nome</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Telefone</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Tags</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Tipo</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {filteredContacts.slice(0, 100).map(c => (
                  <tr key={c.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-foreground">{c.name || "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs font-mono text-foreground">{c.phone_normalized}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex gap-1 flex-wrap">
                        {(c.tags || []).slice(0, 3).map((t, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-semibold">{t}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {c.is_international ? (
                        <span className="text-[10px] text-amber-400 flex items-center gap-1"><Globe className="h-3 w-3" /> INT</span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">BR</span>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <button onClick={() => deleteContact(c.id)} className="h-7 w-7 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredContacts.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-12">
                    <Users className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhum contato. Importe um CSV para começar.</p>
                  </td></tr>
                )}
              </tbody>
            </table>
            {filteredContacts.length > 100 && (
              <div className="px-4 py-2 border-t border-white/[0.06] text-[10px] text-muted-foreground text-center">
                Exibindo 100 de {filteredContacts.length} contatos
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ LISTS TAB ═══ */}
      {tab === "lists" && (
        <div className="space-y-3">
          {lists.map(l => (
            <GlassCard key={l.id} className="!p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <FileSpreadsheet className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{l.name}</p>
                  <p className="text-[10px] text-muted-foreground">{l.file_name} • {new Date(l.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="text-center">
                  <p className="font-bold text-foreground tabular-nums">{l.imported_count}</p>
                  <p className="text-[9px] text-muted-foreground">importados</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-amber-400 tabular-nums">{l.duplicates_found}</p>
                  <p className="text-[9px] text-muted-foreground">duplicados</p>
                </div>
                {statusBadge(l.status)}
              </div>
            </GlassCard>
          ))}
          {lists.length === 0 && (
            <div className="text-center py-16">
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">Nenhuma lista importada</p>
              <button onClick={() => fileRef.current?.click()}
                className="h-10 px-6 rounded-xl bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2">
                <Upload className="h-4 w-4" /> Importar seu primeiro CSV
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══ CAMPAIGNS TAB ═══ */}
      {tab === "campaigns" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{campaigns.length} campanhas</p>
            <button onClick={() => setShowNewCampaign(true)}
              className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-2 hover:shadow-lg hover:shadow-primary/25 transition-all">
              <Plus className="h-3.5 w-3.5" /> Nova Campanha
            </button>
          </div>

          {showNewCampaign && (
            <GlassCard className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-foreground">Nova Campanha</h3>
                <button onClick={() => setShowNewCampaign(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Nome da Campanha</label>
                  <input className="w-full h-10 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={campaignForm.name} onChange={e => setCampaignForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Black Friday 2026" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Tags alvo (separar por vírgula)</label>
                  <input className="w-full h-10 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={campaignForm.target_tags} onChange={e => setCampaignForm(f => ({ ...f, target_tags: e.target.value }))} placeholder="leads, premium" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Mensagem</label>
                <textarea className="w-full h-28 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={campaignForm.message_template} onChange={e => setCampaignForm(f => ({ ...f, message_template: e.target.value }))}
                  placeholder="Olá {name}! Temos uma oferta especial..." />
                <p className="text-[9px] text-muted-foreground mt-1">Use {"{name}"} para personalizar com o nome do contato</p>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">URL de Mídia (opcional)</label>
                <input className="w-full h-10 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={campaignForm.media_url} onChange={e => setCampaignForm(f => ({ ...f, media_url: e.target.value }))} placeholder="https://..." />
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowNewCampaign(false)} className="h-9 px-4 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground">Cancelar</button>
                <button onClick={handleCreateCampaign} className="h-9 px-6 rounded-xl bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-2">
                  <Send className="h-3.5 w-3.5" /> Criar Campanha
                </button>
              </div>
            </GlassCard>
          )}

          {campaigns.map(c => (
            <GlassCard key={c.id} className="!p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                    c.status === "running" ? "bg-emerald-500/10" : c.status === "completed" ? "bg-primary/10" : "bg-muted/50"
                  }`}>
                    {c.status === "running" ? <Zap className="h-5 w-5 text-emerald-400" /> : <Send className="h-5 w-5 text-muted-foreground" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground line-clamp-1">{c.message_template.substring(0, 80)}...</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right text-xs">
                    <span className="text-emerald-400 font-bold tabular-nums">{c.sent_count}</span>
                    <span className="text-muted-foreground">/{c.total_recipients}</span>
                  </div>
                  {statusBadge(c.status)}
                </div>
              </div>
            </GlassCard>
          ))}

          {campaigns.length === 0 && !showNewCampaign && (
            <div className="text-center py-16">
              <Send className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-1">Nenhuma campanha criada</p>
              <p className="text-[11px] text-muted-foreground/60 mb-4">Crie campanhas para disparar mensagens automáticas para seus contatos</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ WHATSAPP TAB ═══ */}
      {tab === "whatsapp" && (
        <div className="space-y-4">
          <GlassCard>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <MessageSquare className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Integração WhatsApp</h3>
                <p className="text-[10px] text-muted-foreground">Conecte sua instância para envio automatizado</p>
              </div>
            </div>

            <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-4 mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-amber-400">Configuração Necessária</p>
                  <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                    Para envio automático, configure uma API de WhatsApp (Evolution API, Z-API ou similar).
                    Insira a URL do webhook e a chave de API abaixo.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">URL da API</label>
                <input className="w-full h-10 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-foreground font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="https://api.evolution.ai/..." />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Chave de API</label>
                <input type="password" className="w-full h-10 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-foreground font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="••••••••••••" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Nome da Instância</label>
                <input className="w-full h-10 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="minha-instancia" />
              </div>
              <button className="h-10 px-6 rounded-xl bg-emerald-500 text-white text-sm font-semibold flex items-center gap-2 hover:bg-emerald-600 transition-colors">
                <Zap className="h-4 w-4" /> Salvar e Testar Conexão
              </button>
            </div>
          </GlassCard>

          <GlassCard>
            <h3 className="text-sm font-bold text-foreground mb-3">Como funciona o envio automático</h3>
            <div className="space-y-3">
              {[
                { step: "1", title: "Importe seus contatos", desc: "Faça upload de arquivos CSV com números de WhatsApp" },
                { step: "2", title: "Crie uma campanha", desc: "Defina a mensagem, mídia e tags de segmentação" },
                { step: "3", title: "Configure a API", desc: "Conecte sua instância do WhatsApp Web via API" },
                { step: "4", title: "Agende ou dispare", desc: "O sistema envia automaticamente via cron jobs" },
              ].map(s => (
                <div key={s.step} className="flex items-start gap-3">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-primary">{s.step}</span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{s.title}</p>
                    <p className="text-[10px] text-muted-foreground">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
