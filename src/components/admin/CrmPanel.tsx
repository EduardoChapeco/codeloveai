import { useState, useEffect, useCallback, useRef, useMemo, forwardRef, type HTMLAttributes } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Upload, Users, Search, Phone, Tag, Trash2, FileSpreadsheet,
  Send, MessageSquare, Loader2, Plus, Filter, CheckCircle2,
  AlertCircle, Clock, Globe, BarChart3, Zap, Pause, Play,
  FileText, X, ChevronRight, RefreshCw, Wifi, WifiOff, RotateCcw,
  Eye, ArrowRight, GripVertical, Building2, MapPin, Mail,
  TrendingUp, TrendingDown, UserCheck, UserX, Activity,
  MessageCircle, Calendar, DollarSign, ChevronDown, ChevronUp,
  Star, Edit3, Save, ExternalLink, Hash, Sparkles, Brain
} from "lucide-react";
import WhatsAppConnect from "@/components/WhatsAppConnect";

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
  updated_at: string;
  pipeline_stage: string;
  pipeline_moved_at: string;
  last_interaction_at: string | null;
  total_messages_sent: number;
  total_messages_received: number;
  conversion_value: number;
  notes: string | null;
  company: string | null;
  city: string | null;
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

interface CrmActivity {
  id: string;
  activity_type: string;
  description: string;
  created_at: string;
}

interface QueueMessage {
  id: string;
  phone: string;
  message: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

type CrmView = "kanban" | "contacts" | "campaigns" | "lists" | "whatsapp" | "metrics";

const GlassCard = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ children, className = "", onClick, ...props }, ref) => (
    <div
      ref={ref}
      onClick={onClick}
      className={`rounded-2xl border border-white/[0.06] ${onClick ? "cursor-pointer hover:border-white/[0.12] hover:bg-white/[0.03]" : ""} transition-all ${className}`}
      style={{ background: "rgba(255,255,255,0.02)", backdropFilter: "blur(40px) saturate(180%)" }}
      {...props}
    >
      {children}
    </div>
  ),
);

GlassCard.displayName = "GlassCard";

const PIPELINE_STAGES = [
  { id: "lead", label: "Leads", icon: Users, color: "from-blue-500/20 to-blue-600/10", accent: "text-blue-400", border: "border-blue-500/20", bg: "bg-blue-500/10" },
  { id: "contacted", label: "Contatados", icon: MessageCircle, color: "from-violet-500/20 to-violet-600/10", accent: "text-violet-400", border: "border-violet-500/20", bg: "bg-violet-500/10" },
  { id: "engaged", label: "Engajados", icon: Activity, color: "from-amber-500/20 to-amber-600/10", accent: "text-amber-400", border: "border-amber-500/20", bg: "bg-amber-500/10" },
  { id: "negotiation", label: "Negociação", icon: DollarSign, color: "from-emerald-500/20 to-emerald-600/10", accent: "text-emerald-400", border: "border-emerald-500/20", bg: "bg-emerald-500/10" },
  { id: "customer", label: "Clientes", icon: UserCheck, color: "from-primary/20 to-primary/10", accent: "text-primary", border: "border-primary/20", bg: "bg-primary/10" },
  { id: "churned", label: "Churn", icon: UserX, color: "from-red-500/20 to-red-600/10", accent: "text-red-400", border: "border-red-500/20", bg: "bg-red-500/10" },
];

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 12) return `+${digits}`;
  if (digits.length === 11) return `+55${digits}`;
  if (digits.length === 10) return `+55${digits}`;
  return `+${digits}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}m`;
}

export default function CrmPanel({ tenantId, userId }: CrmPanelProps) {
  const [view, setView] = useState<CrmView>("kanban");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [lists, setLists] = useState<ContactList[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Smart Import state
  const [showSmartImport, setShowSmartImport] = useState(false);
  const [smartImportStep, setSmartImportStep] = useState<"analyzing" | "mapping" | "importing" | "done">("analyzing");
  const [smartImportMapping, setSmartImportMapping] = useState<any>(null);
  const [smartImportRows, setSmartImportRows] = useState<string[]>([]);
  const [smartImportFileName, setSmartImportFileName] = useState("");
  const [smartImportResult, setSmartImportResult] = useState<{ imported: number; duplicates: number; total: number } | null>(null);

  // Detail panel
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [contactActivities, setContactActivities] = useState<CrmActivity[]>([]);
  const [editingContact, setEditingContact] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Contact>>({});
  const [newNote, setNewNote] = useState("");

  // Campaign form
  const [campaignForm, setCampaignForm] = useState({
    name: "", message_template: "", media_url: "", target_tags: "" as string, schedule_at: ""
  });

  // WhatsApp session
  const [waSession, setWaSession] = useState({ webhook_url: "", api_key: "", instance_name: "" });
  const [waConnected, setWaConnected] = useState<boolean | null>(null);
  const [waSaving, setWaSaving] = useState(false);
  const [waTesting, setWaTesting] = useState(false);
  const [dispatching, setDispatching] = useState<string | null>(null);

  // Queue view
  const [selectedCampaignQueue, setSelectedCampaignQueue] = useState<string | null>(null);
  const [queueMessages, setQueueMessages] = useState<QueueMessage[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);

  const fetchContacts = useCallback(async () => {
    const { data } = await supabase.from("crm_contacts")
      .select("*").eq("tenant_id", tenantId).eq("is_active", true)
      .order("created_at", { ascending: false }).limit(500);
    setContacts((data || []) as Contact[]);
  }, [tenantId]);

  const fetchLists = useCallback(async () => {
    const { data } = await supabase.from("crm_contact_lists")
      .select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
    setLists((data || []) as ContactList[]);
  }, [tenantId]);

  const fetchCampaigns = useCallback(async () => {
    const { data } = await supabase.from("crm_campaigns")
      .select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
    setCampaigns((data || []) as Campaign[]);
  }, [tenantId]);

  const fetchWaSession = useCallback(async () => {
    const { data } = await supabase.from("crm_whatsapp_sessions")
      .select("*").eq("tenant_id", tenantId).maybeSingle();
    if (data) {
      const d = data as any;
      setWaSession({ webhook_url: d.webhook_url || "", api_key: d.api_key_encrypted || "", instance_name: d.instance_name || "" });
      setWaConnected(d.is_connected ?? null);
    }
  }, [tenantId]);

  const fetchActivities = useCallback(async (contactId: string) => {
    const { data } = await supabase.from("crm_activities")
      .select("id, activity_type, description, created_at")
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false }).limit(50);
    setContactActivities((data || []) as CrmActivity[]);
  }, []);

  const fetchQueue = useCallback(async (campaignId: string) => {
    setQueueLoading(true);
    const { data } = await supabase.from("crm_message_queue")
      .select("id, phone, message, status, error_message, sent_at, created_at")
      .eq("campaign_id", campaignId).order("created_at", { ascending: true }).limit(200);
    setQueueMessages((data || []) as QueueMessage[]);
    setQueueLoading(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchContacts(), fetchLists(), fetchCampaigns(), fetchWaSession()]).finally(() => setLoading(false));
  }, [fetchContacts, fetchLists, fetchCampaigns, fetchWaSession]);

  useEffect(() => {
    if (selectedCampaignQueue) fetchQueue(selectedCampaignQueue);
  }, [selectedCampaignQueue, fetchQueue]);

  // ═══ Pipeline grouped contacts ═══
  const pipelineGroups = useMemo(() => {
    const groups: Record<string, Contact[]> = {};
    for (const stage of PIPELINE_STAGES) groups[stage.id] = [];
    for (const c of contacts) {
      const stage = c.pipeline_stage || "lead";
      if (groups[stage]) groups[stage].push(c);
      else groups["lead"].push(c);
    }
    return groups;
  }, [contacts]);

  // ═══ Metrics ═══
  const metrics = useMemo(() => {
    const total = contacts.length;
    const customers = contacts.filter(c => c.pipeline_stage === "customer").length;
    const churned = contacts.filter(c => c.pipeline_stage === "churned").length;
    const conversionRate = total > 0 ? Math.round((customers / total) * 100) : 0;
    const churnRate = total > 0 ? Math.round((churned / total) * 100) : 0;
    const totalValue = contacts.reduce((s, c) => s + (c.conversion_value || 0), 0);
    const avgTimeToConvert = (() => {
      const converted = contacts.filter(c => c.pipeline_stage === "customer" && c.pipeline_moved_at && c.created_at);
      if (!converted.length) return 0;
      const totalDays = converted.reduce((s, c) => {
        return s + (new Date(c.pipeline_moved_at).getTime() - new Date(c.created_at).getTime()) / 86400000;
      }, 0);
      return Math.round(totalDays / converted.length);
    })();
    return { total, customers, churned, conversionRate, churnRate, totalValue, avgTimeToConvert };
  }, [contacts]);

  // ═══ Move contact to stage ═══
  const moveContact = async (contactId: string, newStage: string) => {
    const { error } = await supabase.from("crm_contacts")
      .update({ pipeline_stage: newStage } as any).eq("id", contactId);
    if (error) return toast.error(error.message);

    // Log activity
    await supabase.from("crm_activities").insert({
      tenant_id: tenantId, contact_id: contactId, user_id: userId,
      activity_type: "stage_change",
      description: `Movido para ${PIPELINE_STAGES.find(s => s.id === newStage)?.label || newStage}`,
    } as any);

    setContacts(prev => prev.map(c => c.id === contactId ? { ...c, pipeline_stage: newStage, pipeline_moved_at: new Date().toISOString() } : c));
    if (selectedContact?.id === contactId) setSelectedContact(prev => prev ? { ...prev, pipeline_stage: newStage } : prev);
    toast.success("Contato movido!");
  };

  // ═══ Open contact detail ═══
  const openContact = (contact: Contact) => {
    setSelectedContact(contact);
    setEditingContact(false);
    setEditForm({});
    fetchActivities(contact.id);
  };

  // ═══ Save contact edit ═══
  const saveContactEdit = async () => {
    if (!selectedContact) return;
    const { error } = await supabase.from("crm_contacts")
      .update(editForm as any).eq("id", selectedContact.id);
    if (error) return toast.error(error.message);
    setContacts(prev => prev.map(c => c.id === selectedContact.id ? { ...c, ...editForm } : c));
    setSelectedContact(prev => prev ? { ...prev, ...editForm } : prev);
    setEditingContact(false);
    toast.success("Contato atualizado!");
  };

  // ═══ Add note ═══
  const addNote = async () => {
    if (!selectedContact || !newNote.trim()) return;
    await supabase.from("crm_activities").insert({
      tenant_id: tenantId, contact_id: selectedContact.id, user_id: userId,
      activity_type: "note", description: newNote.trim(),
    } as any);
    setNewNote("");
    fetchActivities(selectedContact.id);
    toast.success("Nota adicionada!");
  };

  // ═══ CSV Upload ═══
  const handleFileUpload = async (files: FileList) => {
    if (!files.length) return;
    const file = files[0];
    setUploading(true);
    try {
      const text = await file.text();
      const rows = text.split(/\r?\n/).filter(l => l.trim());
      if (rows.length < 2) { toast.error("Arquivo vazio ou com poucos dados"); setUploading(false); return; }

      setSmartImportFileName(file.name);
      setSmartImportRows(rows);
      setSmartImportStep("analyzing");
      setShowSmartImport(true);
      setSmartImportResult(null);

      // Send to AI for analysis
      const { data, error } = await supabase.functions.invoke("crm-smart-import", {
        body: { action: "analyze", raw_text: rows.slice(0, 15).join("\n") }
      });
      if (error || data?.error) {
        toast.error(data?.error || "Erro na análise IA");
        setShowSmartImport(false);
        setUploading(false);
        return;
      }

      // Set mapping with confirmed_field defaulting to suggested_field
      const mapping = data.mapping;
      mapping.columns = mapping.columns.map((col: any) => ({
        ...col,
        confirmed_field: col.suggested_field,
      }));
      setSmartImportMapping(mapping);
      setSmartImportStep("mapping");
    } catch (err: any) {
      toast.error(err.message || "Erro ao ler arquivo");
      setShowSmartImport(false);
    }
    setUploading(false);
  };

  const executeSmartImport = async () => {
    if (!smartImportMapping) return;
    setSmartImportStep("importing");
    try {
      const { data, error } = await supabase.functions.invoke("crm-smart-import", {
        body: {
          action: "import",
          column_mapping: smartImportMapping,
          rows: smartImportRows,
          tenant_id: tenantId,
          user_id: userId,
          file_name: smartImportFileName,
        }
      });
      if (error || data?.error) {
        toast.error(data?.error || "Erro na importação");
        setSmartImportStep("mapping");
        return;
      }
      setSmartImportResult(data);
      setSmartImportStep("done");
      toast.success(`${data.imported} contatos importados!`);
      fetchContacts();
      fetchLists();
    } catch (err: any) {
      toast.error(err.message);
      setSmartImportStep("mapping");
    }
  };

  // ═══ Campaign actions ═══
  const handleCreateCampaign = async () => {
    if (!campaignForm.name || !campaignForm.message_template) return toast.error("Preencha nome e mensagem");
    const tags = campaignForm.target_tags.split(",").map(t => t.trim()).filter(Boolean);
    const { error } = await supabase.from("crm_campaigns").insert({
      tenant_id: tenantId, user_id: userId, name: campaignForm.name,
      message_template: campaignForm.message_template, media_url: campaignForm.media_url || null,
      target_tags: tags, schedule_at: campaignForm.schedule_at || null, status: "draft",
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Campanha criada!");
    setShowNewCampaign(false);
    setCampaignForm({ name: "", message_template: "", media_url: "", target_tags: "", schedule_at: "" });
    fetchCampaigns();
  };

  const dispatchCampaign = async (campaign: Campaign) => {
    if (dispatching) return;
    setDispatching(campaign.id);
    try {
      if (campaign.status === "draft") {
        const { data: allContacts } = await supabase.from("crm_contacts")
          .select("id, phone_normalized, name, tags").eq("tenant_id", tenantId).eq("is_active", true);
        if (!allContacts?.length) { toast.error("Nenhum contato encontrado"); return; }
        const campaignTags = (campaign.target_tags || []).map(t => t.toLowerCase().trim()).filter(Boolean);
        const targetContacts = campaignTags.length > 0
          ? allContacts.filter(c => (c.tags || []).some((t: string) => campaignTags.includes(t.toLowerCase())))
          : allContacts;
        if (!targetContacts.length) { toast.error("Nenhum contato com as tags selecionadas"); return; }
        const queue = targetContacts.map(c => ({
          tenant_id: tenantId, campaign_id: campaign.id, contact_id: c.id,
          phone: c.phone_normalized, message: campaign.message_template.replace(/\{name\}/g, c.name || ""),
          media_url: campaign.media_url || null, status: "pending",
        }));
        for (let i = 0; i < queue.length; i += 100) {
          await supabase.from("crm_message_queue").insert(queue.slice(i, i + 100) as any[]);
        }
        await supabase.from("crm_campaigns").update({ status: "running", total_recipients: queue.length } as any).eq("id", campaign.id);
        toast.success(`${queue.length} mensagens enfileiradas`);
      }
      const { data } = await supabase.functions.invoke("crm-dispatch", {
        body: { tenant_id: tenantId, campaign_id: campaign.id, batch_size: 10 },
      });
      toast.success(`Lote enviado! ${data?.sent || 0} ok, ${data?.failed || 0} falhas. ${data?.remaining || 0} restantes.`);
      fetchCampaigns();
    } catch (err: any) { toast.error(err.message); }
    finally { setDispatching(null); }
  };

  const retryFailed = async (campaignId: string) => {
    try {
      const { data } = await supabase.functions.invoke("crm-dispatch", {
        body: { tenant_id: tenantId, campaign_id: campaignId, mode: "retry" },
      });
      toast.success(data?.message || "Falhas resetadas");
      if (selectedCampaignQueue === campaignId) fetchQueue(campaignId);
      fetchCampaigns();
    } catch (err: any) { toast.error(err.message); }
  };

  const deleteContact = async (id: string) => {
    await supabase.from("crm_contacts").update({ is_active: false } as any).eq("id", id);
    toast.success("Contato removido");
    fetchContacts();
    if (selectedContact?.id === id) setSelectedContact(null);
  };

  const saveWaSession = async () => {
    if (!waSession.webhook_url || !waSession.api_key) return toast.error("Preencha URL e chave de API");
    setWaSaving(true);
    const { error } = await supabase.from("crm_whatsapp_sessions").upsert({
      tenant_id: tenantId, webhook_url: waSession.webhook_url,
      api_key_encrypted: waSession.api_key, instance_name: waSession.instance_name || "default",
      is_connected: false, updated_at: new Date().toISOString(),
    } as any, { onConflict: "tenant_id" });
    setWaSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Configuração salva!");
  };

  const testConnection = async () => {
    setWaTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("crm-dispatch", {
        body: { tenant_id: tenantId, mode: "test" },
      });
      if (error) throw error;
      setWaConnected(data?.connected ?? false);
      if (data?.connected) toast.success("✅ WhatsApp conectado!");
      else toast.error(`Desconectado: ${data?.state || "desconhecido"}`);
    } catch (err: any) { setWaConnected(false); toast.error(err.message); }
    setWaTesting(false);
  };

  const filteredContacts = contacts.filter(c =>
    !search || c.phone.includes(search) || c.name?.toLowerCase().includes(search.toLowerCase()) || c.company?.toLowerCase().includes(search.toLowerCase())
  );


  const StageBadge = ({ stage }: { stage: string }) => {
    const s = PIPELINE_STAGES.find(p => p.id === stage) || PIPELINE_STAGES[0];
    return (
      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${s.bg} ${s.accent} inline-flex items-center gap-1`}>
        <s.icon className="h-2.5 w-2.5" /> {s.label}
      </span>
    );
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      draft: "bg-muted/50 text-muted-foreground", scheduled: "bg-blue-500/10 text-blue-400",
      running: "bg-emerald-500/10 text-emerald-400", paused: "bg-amber-500/10 text-amber-400",
      completed: "bg-primary/10 text-primary", cancelled: "bg-destructive/10 text-destructive",
      pending: "bg-amber-500/10 text-amber-400", sending: "bg-blue-500/10 text-blue-400",
      sent: "bg-emerald-500/10 text-emerald-400", failed: "bg-destructive/10 text-destructive",
      processing: "bg-blue-500/10 text-blue-400",
    };
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${map[status] || map.draft}`}>{status}</span>;
  };

  const NAV_ITEMS: { id: CrmView; label: string; icon: any; count?: number }[] = [
    { id: "kanban", label: "Pipeline", icon: BarChart3 },
    { id: "contacts", label: "Contatos", icon: Users, count: contacts.length },
    { id: "campaigns", label: "Campanhas", icon: Send, count: campaigns.length },
    { id: "lists", label: "Listas", icon: FileSpreadsheet, count: lists.length },
    { id: "whatsapp", label: "WhatsApp", icon: MessageSquare },
    { id: "metrics", label: "Métricas", icon: TrendingUp },
  ];

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* ═══ HEADER ═══ */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground tracking-tight">Pipeline de Clientes</h2>
          <p className="text-xs text-muted-foreground">Acompanhe a jornada de cada contato, do lead ao cliente fiel</p>
        </div>
        <div className="flex items-center gap-2">
          {waConnected !== null && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold ${waConnected ? "bg-emerald-500/10 text-emerald-400" : "bg-destructive/10 text-destructive"}`}>
              {waConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {waConnected ? "Online" : "Offline"}
            </div>
          )}
          <input type="file" ref={fileRef} accept=".csv,.txt,.xls,.xlsx,.tsv,.vcf" className="hidden"
            onChange={e => e.target.files && handleFileUpload(e.target.files)} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="h-11 px-5 rounded-2xl bg-primary text-primary-foreground text-sm font-bold flex items-center gap-2 hover:shadow-lg hover:shadow-primary/25 transition-all active:scale-[0.97]">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Importar com IA
          </button>
        </div>
      </div>

      {/* ═══ METRIC CARDS ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total", value: metrics.total, icon: Users, accent: "text-foreground" },
          { label: "Clientes", value: metrics.customers, icon: UserCheck, accent: "text-emerald-400" },
          { label: "Conversão", value: `${metrics.conversionRate}%`, icon: TrendingUp, accent: "text-primary" },
          { label: "Churn", value: `${metrics.churnRate}%`, icon: TrendingDown, accent: "text-red-400" },
          { label: "Valor Total", value: `R$ ${metrics.totalValue.toLocaleString("pt-BR")}`, icon: DollarSign, accent: "text-amber-400" },
          { label: "Tempo Médio", value: `${metrics.avgTimeToConvert}d`, icon: Clock, accent: "text-blue-400" },
        ].map((m) => (
          <GlassCard key={m.label} className="p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <m.icon className={`h-3.5 w-3.5 ${m.accent}`} />
              <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">{m.label}</span>
            </div>
            <p className={`text-lg font-black ${m.accent} tabular-nums`}>{m.value}</p>
          </GlassCard>
        ))}
      </div>

      {/* ═══ NAV TABS ═══ */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {NAV_ITEMS.map(n => (
          <button key={n.id} onClick={() => { setView(n.id); setSelectedContact(null); setSelectedCampaignQueue(null); }}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold rounded-2xl transition-all whitespace-nowrap ${
              view === n.id
                ? "bg-primary/10 text-primary border border-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-white/[0.03] border border-transparent"
            }`}>
            <n.icon className="h-4 w-4" />
            {n.label}
            {n.count !== undefined && <span className="text-[10px] opacity-60">{n.count}</span>}
          </button>
        ))}
      </div>

      {/* ═══ KANBAN VIEW ═══ */}
      {view === "kanban" && (
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: 400 }}>
          {PIPELINE_STAGES.map(stage => {
            const stageContacts = pipelineGroups[stage.id] || [];
            return (
              <div key={stage.id} className="min-w-[280px] max-w-[320px] flex-shrink-0">
                {/* Column header */}
                <div className={`rounded-2xl border ${stage.border} bg-gradient-to-b ${stage.color} p-4 mb-3`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <stage.icon className={`h-4 w-4 ${stage.accent}`} />
                      <span className="text-sm font-bold text-foreground">{stage.label}</span>
                    </div>
                    <span className={`text-lg font-black ${stage.accent} tabular-nums`}>{stageContacts.length}</span>
                  </div>
                </div>

                {/* Cards */}
                <div className="space-y-2">
                  {stageContacts.slice(0, 20).map(contact => (
                    <GlassCard key={contact.id} className="p-4 group" onClick={() => openContact(contact)}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-foreground truncate">{contact.name || "Sem nome"}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{contact.phone_normalized}</p>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                          {PIPELINE_STAGES.filter(s => s.id !== stage.id).slice(0, 2).map(s => (
                            <button key={s.id} onClick={(e) => { e.stopPropagation(); moveContact(contact.id, s.id); }}
                              title={`Mover para ${s.label}`}
                              className={`h-6 w-6 rounded-lg ${s.bg} flex items-center justify-center hover:scale-110 transition-transform`}>
                              <s.icon className={`h-3 w-3 ${s.accent}`} />
                            </button>
                          ))}
                        </div>
                      </div>

                      {(contact.company || contact.city) && (
                        <div className="flex items-center gap-2 mb-2 text-[10px] text-muted-foreground">
                          {contact.company && <span className="flex items-center gap-1"><Building2 className="h-2.5 w-2.5" />{contact.company}</span>}
                          {contact.city && <span className="flex items-center gap-1"><MapPin className="h-2.5 w-2.5" />{contact.city}</span>}
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex gap-1">
                          {(contact.tags || []).slice(0, 2).map((t, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded bg-white/[0.06] text-[8px] font-semibold text-muted-foreground">{t}</span>
                          ))}
                        </div>
                        <span className="text-[9px] text-muted-foreground">{timeAgo(contact.pipeline_moved_at || contact.created_at)}</span>
                      </div>

                      {contact.conversion_value > 0 && (
                        <div className="mt-2 pt-2 border-t border-white/[0.04] flex items-center gap-1">
                          <DollarSign className="h-3 w-3 text-emerald-400" />
                          <span className="text-xs font-bold text-emerald-400">R$ {contact.conversion_value.toLocaleString("pt-BR")}</span>
                        </div>
                      )}
                    </GlassCard>
                  ))}

                  {stageContacts.length === 0 && (
                    <div className="text-center py-8 opacity-30">
                      <stage.icon className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-[10px] text-muted-foreground">Vazio</p>
                    </div>
                  )}

                  {stageContacts.length > 20 && (
                    <p className="text-center text-[10px] text-muted-foreground py-2">+{stageContacts.length - 20} contatos</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ CONTACTS LIST VIEW ═══ */}
      {view === "contacts" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
              <input className="w-full h-12 pl-10 pr-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Buscar por nome, telefone ou empresa..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            {filteredContacts.slice(0, 50).map(c => (
              <GlassCard key={c.id} className="p-4 flex items-center gap-4" onClick={() => openContact(c)}>
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-black text-lg shrink-0">
                  {(c.name || "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-bold text-foreground truncate">{c.name || "Sem nome"}</p>
                    {c.is_international && <Globe className="h-3 w-3 text-amber-400 shrink-0" />}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="font-mono">{c.phone_normalized}</span>
                    {c.company && <span className="flex items-center gap-1"><Building2 className="h-2.5 w-2.5" />{c.company}</span>}
                    {c.city && <span className="flex items-center gap-1"><MapPin className="h-2.5 w-2.5" />{c.city}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex gap-1">
                    {(c.tags || []).slice(0, 2).map((t, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-bold">{t}</span>
                    ))}
                  </div>
                  <StageBadge stage={c.pipeline_stage} />
                  <ChevronRight className="h-4 w-4 text-muted-foreground/30" />
                </div>
              </GlassCard>
            ))}
            {filteredContacts.length === 0 && (
              <div className="text-center py-16">
                <Users className="h-12 w-12 text-muted-foreground/15 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-1">Nenhum contato encontrado</p>
                <p className="text-[11px] text-muted-foreground/60 mb-4">Importe um CSV para começar a construir seu pipeline</p>
                <button onClick={() => fileRef.current?.click()}
                  className="h-12 px-6 rounded-2xl bg-primary text-primary-foreground text-sm font-bold inline-flex items-center gap-2">
                  <Upload className="h-4 w-4" /> Importar seu primeiro CSV
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ CAMPAIGNS VIEW ═══ */}
      {view === "campaigns" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{campaigns.length} campanhas</p>
            <button onClick={() => setShowNewCampaign(true)}
              className="h-11 px-5 rounded-2xl bg-primary text-primary-foreground text-sm font-bold flex items-center gap-2 hover:shadow-lg hover:shadow-primary/25 transition-all">
              <Plus className="h-4 w-4" /> Nova Campanha
            </button>
          </div>

          {showNewCampaign && (
            <GlassCard className="p-6 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-bold text-foreground">Nova Campanha</h3>
                <button onClick={() => setShowNewCampaign(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-2">Nome</label>
                  <input className="w-full h-12 px-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={campaignForm.name} onChange={e => setCampaignForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Black Friday 2026" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-2">Tags alvo</label>
                  <input className="w-full h-12 px-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={campaignForm.target_tags} onChange={e => setCampaignForm(f => ({ ...f, target_tags: e.target.value }))} placeholder="leads, premium" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-2">Mensagem</label>
                <textarea className="w-full h-32 px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={campaignForm.message_template} onChange={e => setCampaignForm(f => ({ ...f, message_template: e.target.value }))}
                  placeholder="Olá {name}! Temos uma oferta especial..." />
                <p className="text-[9px] text-muted-foreground mt-1">Use {"{name}"} para personalizar</p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-2">URL de Mídia (opcional)</label>
                <input className="w-full h-12 px-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={campaignForm.media_url} onChange={e => setCampaignForm(f => ({ ...f, media_url: e.target.value }))} placeholder="https://..." />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowNewCampaign(false)} className="h-11 px-5 rounded-2xl text-sm font-bold text-muted-foreground hover:text-foreground">Cancelar</button>
                <button onClick={handleCreateCampaign} className="h-11 px-6 rounded-2xl bg-primary text-primary-foreground text-sm font-bold flex items-center gap-2">
                  <Send className="h-4 w-4" /> Criar Campanha
                </button>
              </div>
            </GlassCard>
          )}

          {campaigns.map(c => {
            const progress = c.total_recipients > 0 ? Math.round(((c.sent_count || 0) + (c.failed_count || 0)) / c.total_recipients * 100) : 0;
            const isViewingQueue = selectedCampaignQueue === c.id;
            return (
              <GlassCard key={c.id} className="overflow-hidden">
                <div className="p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${
                      c.status === "running" ? "bg-emerald-500/10" : c.status === "completed" ? "bg-primary/10" : "bg-muted/50"
                    }`}>
                      {c.status === "running" ? <Zap className="h-5 w-5 text-emerald-400" /> : <Send className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{c.message_template.substring(0, 80)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right text-xs tabular-nums">
                      <span className="text-emerald-400 font-bold">{c.sent_count || 0}</span>
                      {(c.failed_count || 0) > 0 && <span className="text-destructive font-bold">/{c.failed_count}</span>}
                      <span className="text-muted-foreground">/{c.total_recipients || 0}</span>
                    </div>
                    {statusBadge(c.status)}
                    <div className="flex items-center gap-1.5">
                      {(c.status === "draft" || c.status === "running") && (
                        <button onClick={() => dispatchCampaign(c)} disabled={!!dispatching}
                          className="h-10 px-4 rounded-xl bg-emerald-500/10 text-emerald-400 text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-500/20 disabled:opacity-50">
                          {dispatching === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                          {c.status === "draft" ? "Disparar" : "Continuar"}
                        </button>
                      )}
                      {(c.failed_count || 0) > 0 && (
                        <button onClick={() => retryFailed(c.id)}
                          className="h-10 px-4 rounded-xl bg-amber-500/10 text-amber-400 text-xs font-bold flex items-center gap-1.5 hover:bg-amber-500/20">
                          <RotateCcw className="h-3.5 w-3.5" /> Reenviar
                        </button>
                      )}
                      <button onClick={() => setSelectedCampaignQueue(isViewingQueue ? null : c.id)}
                        className="h-10 px-4 rounded-xl bg-white/[0.04] text-muted-foreground text-xs font-bold flex items-center gap-1.5 hover:bg-white/[0.08]">
                        <BarChart3 className="h-3.5 w-3.5" /> Fila
                      </button>
                    </div>
                  </div>
                </div>
                {c.total_recipients > 0 && (
                  <div className="h-1.5 bg-white/[0.03]">
                    <div className="h-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-500 rounded-full" style={{ width: `${progress}%` }} />
                  </div>
                )}
                {isViewingQueue && (
                  <div className="border-t border-white/[0.06] p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold text-foreground">Fila de Mensagens</h4>
                      <button onClick={() => fetchQueue(c.id)} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1">
                        <RefreshCw className="h-3 w-3" /> Atualizar
                      </button>
                    </div>
                    {queueLoading ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                    : queueMessages.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">Fila vazia</p>
                    : (
                      <div className="space-y-1.5 max-h-64 overflow-y-auto">
                        {queueMessages.map(m => (
                          <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.04]">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="text-[11px] font-mono text-foreground truncate">{m.phone}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {m.error_message && <span className="text-[9px] text-destructive max-w-[200px] truncate">{m.error_message.substring(0, 40)}</span>}
                              {m.sent_at && <span className="text-[9px] text-muted-foreground">{new Date(m.sent_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>}
                              {statusBadge(m.status)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </GlassCard>
            );
          })}
          {campaigns.length === 0 && !showNewCampaign && (
            <div className="text-center py-16">
              <Send className="h-12 w-12 text-muted-foreground/15 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-1">Nenhuma campanha criada</p>
              <p className="text-[11px] text-muted-foreground/60 mb-4">Crie campanhas para disparar mensagens automáticas</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ LISTS VIEW ═══ */}
      {view === "lists" && (
        <div className="space-y-3">
          {lists.map(l => (
            <GlassCard key={l.id} className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                  <FileSpreadsheet className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{l.name}</p>
                  <p className="text-[10px] text-muted-foreground">{l.file_name} • {new Date(l.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
              </div>
              <div className="flex items-center gap-6 text-xs">
                <div className="text-center">
                  <p className="font-black text-foreground tabular-nums text-lg">{l.imported_count}</p>
                  <p className="text-[9px] text-muted-foreground">importados</p>
                </div>
                <div className="text-center">
                  <p className="font-black text-amber-400 tabular-nums text-lg">{l.duplicates_found}</p>
                  <p className="text-[9px] text-muted-foreground">duplicados</p>
                </div>
                {statusBadge(l.status)}
              </div>
            </GlassCard>
          ))}
          {lists.length === 0 && (
            <div className="text-center py-16">
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground/15 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">Nenhuma lista importada</p>
              <button onClick={() => fileRef.current?.click()}
                className="h-12 px-6 rounded-2xl bg-primary text-primary-foreground text-sm font-bold inline-flex items-center gap-2">
                <Upload className="h-4 w-4" /> Importar CSV
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══ WHATSAPP CONFIG ═══ */}
      {view === "whatsapp" && (
        <div className="space-y-4">
          {/* Quick Connect - Instance auto-creation */}
          <WhatsAppConnect userId={userId} tenantId={tenantId} />

          {/* Manual config section */}
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={`h-14 w-14 rounded-2xl flex items-center justify-center border ${
                  waConnected ? "border-emerald-500/30 bg-emerald-500/10" : "border-white/[0.08] bg-white/[0.04]"
                }`}>
                  <MessageSquare className={`h-6 w-6 ${waConnected ? "text-emerald-400" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Configuração Avançada</h3>
                  <p className="text-xs text-muted-foreground">Configure manualmente sua conexão com Evolution API</p>
                </div>
              </div>
              <button onClick={testConnection} disabled={waTesting}
                className="h-11 px-5 rounded-2xl bg-emerald-500/10 text-emerald-400 text-sm font-bold flex items-center gap-2 hover:bg-emerald-500/20 disabled:opacity-50">
                {waTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                Testar Conexão
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-2">URL da API</label>
                <input className="w-full h-12 px-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={waSession.webhook_url} onChange={e => setWaSession(s => ({ ...s, webhook_url: e.target.value }))} placeholder="https://api.evolution..." />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-2">API Key</label>
                <input type="password" className="w-full h-12 px-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={waSession.api_key} onChange={e => setWaSession(s => ({ ...s, api_key: e.target.value }))} placeholder="••••••••" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-2">Instância</label>
                <input className="w-full h-12 px-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={waSession.instance_name} onChange={e => setWaSession(s => ({ ...s, instance_name: e.target.value }))} placeholder="default" />
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <button onClick={saveWaSession} disabled={waSaving}
                className="h-11 px-6 rounded-2xl bg-primary text-primary-foreground text-sm font-bold flex items-center gap-2">
                {waSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar Configuração
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* ═══ METRICS VIEW ═══ */}
      {view === "metrics" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pipeline distribution */}
            <GlassCard className="p-6">
              <h3 className="text-sm font-bold text-foreground mb-4">Distribuição do Pipeline</h3>
              <div className="space-y-3">
                {PIPELINE_STAGES.map(stage => {
                  const count = (pipelineGroups[stage.id] || []).length;
                  const pct = contacts.length > 0 ? Math.round((count / contacts.length) * 100) : 0;
                  return (
                    <div key={stage.id}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <stage.icon className={`h-3.5 w-3.5 ${stage.accent}`} />
                          <span className="text-xs font-semibold text-foreground">{stage.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-black ${stage.accent} tabular-nums`}>{count}</span>
                          <span className="text-[10px] text-muted-foreground">{pct}%</span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden">
                        <div className={`h-full rounded-full ${stage.bg} transition-all duration-500`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </GlassCard>

            {/* Campaign performance */}
            <GlassCard className="p-6">
              <h3 className="text-sm font-bold text-foreground mb-4">Performance de Campanhas</h3>
              <div className="space-y-3">
                {campaigns.slice(0, 5).map(c => {
                  const successRate = c.total_recipients > 0 ? Math.round(((c.sent_count || 0) / c.total_recipients) * 100) : 0;
                  return (
                    <div key={c.id} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{c.name}</p>
                        <p className="text-[10px] text-muted-foreground">{c.total_recipients} destinatários</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-20 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400" style={{ width: `${successRate}%` }} />
                        </div>
                        <span className="text-xs font-bold text-primary tabular-nums">{successRate}%</span>
                      </div>
                    </div>
                  );
                })}
                {campaigns.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Sem campanhas</p>}
              </div>
            </GlassCard>
          </div>

          {/* Source distribution */}
          <GlassCard className="p-6">
            <h3 className="text-sm font-bold text-foreground mb-4">Origem dos Contatos</h3>
            <div className="flex gap-4 flex-wrap">
              {Object.entries(contacts.reduce((acc, c) => { const s = c.source || "desconhecido"; acc[s] = (acc[s] || 0) + 1; return acc; }, {} as Record<string, number>))
                .sort((a, b) => b[1] - a[1])
                .map(([source, count]) => (
                  <div key={source} className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
                    <Hash className="h-3 w-3 text-primary" />
                    <span className="text-xs font-bold text-foreground">{source}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
                  </div>
                ))}
            </div>
          </GlassCard>
        </div>
      )}

      {/* ═══ CONTACT DETAIL PANEL (Side sheet) ═══ */}
      {selectedContact && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelectedContact(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg animate-slide-in-right" onClick={e => e.stopPropagation()}
            style={{ background: "rgba(10,10,15,0.95)", backdropFilter: "blur(40px) saturate(200%)", borderLeft: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="h-full overflow-y-auto p-6 space-y-6">
              {/* Close */}
              <button onClick={() => setSelectedContact(null)}
                className="h-10 w-10 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-5 w-5" />
              </button>

              {/* Avatar & Name */}
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-primary font-black text-2xl shrink-0 shadow-lg shadow-primary/10">
                  {(selectedContact.name || "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  {editingContact ? (
                    <input className="w-full h-10 px-3 rounded-xl bg-white/[0.06] border border-white/[0.1] text-lg font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      value={editForm.name ?? selectedContact.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                  ) : (
                    <h3 className="text-lg font-black text-foreground truncate">{selectedContact.name || "Sem nome"}</h3>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <StageBadge stage={selectedContact.pipeline_stage} />
                    {selectedContact.is_international && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-400 flex items-center gap-1">
                        <Globe className="h-2.5 w-2.5" /> Internacional
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => {
                  if (editingContact) saveContactEdit();
                  else { setEditingContact(true); setEditForm({ name: selectedContact.name, company: selectedContact.company, city: selectedContact.city, notes: selectedContact.notes, email: selectedContact.email }); }
                }}
                  className="h-10 px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-bold text-foreground flex items-center gap-2 transition-colors">
                  {editingContact ? <><Save className="h-3.5 w-3.5" /> Salvar</> : <><Edit3 className="h-3.5 w-3.5" /> Editar</>}
                </button>
              </div>

              {/* Quick info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-center gap-1.5 mb-1"><Phone className="h-3 w-3 text-muted-foreground" /><span className="text-[9px] text-muted-foreground uppercase font-bold">Telefone</span></div>
                  <p className="text-sm font-bold text-foreground font-mono">{selectedContact.phone_normalized}</p>
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-center gap-1.5 mb-1"><Mail className="h-3 w-3 text-muted-foreground" /><span className="text-[9px] text-muted-foreground uppercase font-bold">Email</span></div>
                  {editingContact ? (
                    <input className="w-full h-8 px-2 rounded-lg bg-white/[0.06] border border-white/[0.1] text-sm text-foreground focus:outline-none"
                      value={editForm.email ?? selectedContact.email ?? ""} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                  ) : (
                    <p className="text-sm font-bold text-foreground truncate">{selectedContact.email || "—"}</p>
                  )}
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-center gap-1.5 mb-1"><Building2 className="h-3 w-3 text-muted-foreground" /><span className="text-[9px] text-muted-foreground uppercase font-bold">Empresa</span></div>
                  {editingContact ? (
                    <input className="w-full h-8 px-2 rounded-lg bg-white/[0.06] border border-white/[0.1] text-sm text-foreground focus:outline-none"
                      value={editForm.company ?? selectedContact.company ?? ""} onChange={e => setEditForm(f => ({ ...f, company: e.target.value }))} />
                  ) : (
                    <p className="text-sm font-bold text-foreground">{selectedContact.company || "—"}</p>
                  )}
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-center gap-1.5 mb-1"><MapPin className="h-3 w-3 text-muted-foreground" /><span className="text-[9px] text-muted-foreground uppercase font-bold">Cidade</span></div>
                  {editingContact ? (
                    <input className="w-full h-8 px-2 rounded-lg bg-white/[0.06] border border-white/[0.1] text-sm text-foreground focus:outline-none"
                      value={editForm.city ?? selectedContact.city ?? ""} onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))} />
                  ) : (
                    <p className="text-sm font-bold text-foreground">{selectedContact.city || "—"}</p>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
                  <p className="text-lg font-black text-emerald-400 tabular-nums">{selectedContact.total_messages_sent}</p>
                  <p className="text-[9px] text-muted-foreground uppercase font-bold">Enviadas</p>
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
                  <p className="text-lg font-black text-blue-400 tabular-nums">{selectedContact.total_messages_received}</p>
                  <p className="text-[9px] text-muted-foreground uppercase font-bold">Recebidas</p>
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
                  <p className="text-lg font-black text-amber-400 tabular-nums">R$ {(selectedContact.conversion_value || 0).toLocaleString("pt-BR")}</p>
                  <p className="text-[9px] text-muted-foreground uppercase font-bold">Valor</p>
                </div>
              </div>

              {/* Move to stage */}
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Mover para</p>
                <div className="flex flex-wrap gap-2">
                  {PIPELINE_STAGES.filter(s => s.id !== selectedContact.pipeline_stage).map(s => (
                    <button key={s.id} onClick={() => moveContact(selectedContact.id, s.id)}
                      className={`h-10 px-4 rounded-2xl ${s.bg} ${s.accent} text-xs font-bold flex items-center gap-2 hover:scale-[1.03] transition-transform border ${s.border}`}>
                      <s.icon className="h-3.5 w-3.5" /> {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Tags</p>
                <div className="flex gap-2 flex-wrap">
                  {(selectedContact.tags || []).map((t, i) => (
                    <span key={i} className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">{t}</span>
                  ))}
                  {(!selectedContact.tags || selectedContact.tags.length === 0) && <span className="text-xs text-muted-foreground">Sem tags</span>}
                </div>
              </div>

              {/* Notes */}
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Notas</p>
                {editingContact ? (
                  <textarea className="w-full h-20 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={editForm.notes ?? selectedContact.notes ?? ""} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
                ) : (
                  <p className="text-xs text-muted-foreground">{selectedContact.notes || "Sem anotações"}</p>
                )}
              </div>

              {/* Quick note add */}
              <div className="flex gap-2">
                <input className="flex-1 h-11 px-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Adicionar observação..." value={newNote} onChange={e => setNewNote(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addNote()} />
                <button onClick={addNote} disabled={!newNote.trim()}
                  className="h-11 px-4 rounded-2xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50">
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {/* Activity timeline */}
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Histórico de Atividades</p>
                <div className="space-y-3">
                  {contactActivities.map(a => (
                    <div key={a.id} className="flex gap-3">
                      <div className="h-8 w-8 rounded-xl bg-white/[0.04] flex items-center justify-center shrink-0">
                        {a.activity_type === "stage_change" ? <ArrowRight className="h-3.5 w-3.5 text-primary" />
                         : a.activity_type === "note" ? <FileText className="h-3.5 w-3.5 text-amber-400" />
                         : <Activity className="h-3.5 w-3.5 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground">{a.description}</p>
                        <p className="text-[10px] text-muted-foreground">{timeAgo(a.created_at)} atrás</p>
                      </div>
                    </div>
                  ))}
                  {contactActivities.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">Sem atividades registradas</p>
                  )}
                </div>
              </div>

              {/* Timestamps */}
              <div className="border-t border-white/[0.06] pt-4 space-y-1">
                <p className="text-[10px] text-muted-foreground">Cadastrado em {new Date(selectedContact.created_at).toLocaleDateString("pt-BR")}</p>
                {selectedContact.last_interaction_at && (
                  <p className="text-[10px] text-muted-foreground">Última interação: {timeAgo(selectedContact.last_interaction_at)} atrás</p>
                )}
                <p className="text-[10px] text-muted-foreground">No estágio atual há {timeAgo(selectedContact.pipeline_moved_at || selectedContact.created_at)}</p>
              </div>

              {/* Delete */}
              <button onClick={() => deleteContact(selectedContact.id)}
                className="w-full h-11 rounded-2xl bg-destructive/10 text-destructive text-sm font-bold flex items-center justify-center gap-2 hover:bg-destructive/20 transition-colors">
                <Trash2 className="h-4 w-4" /> Remover Contato
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ SMART IMPORT MODAL ═══ */}
      {showSmartImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { if (smartImportStep !== "importing" && smartImportStep !== "analyzing") setShowSmartImport(false); }}>
          <div className="w-full max-w-2xl mx-4 rounded-3xl border border-white/[0.08] overflow-hidden" style={{ background: "var(--background)" }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="p-6 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Brain className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Importação Inteligente</h3>
                  <p className="text-[11px] text-muted-foreground">{smartImportFileName} • {smartImportRows.length} linhas</p>
                </div>
              </div>
              {smartImportStep !== "importing" && smartImportStep !== "analyzing" && (
                <button onClick={() => setShowSmartImport(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Analyzing */}
            {smartImportStep === "analyzing" && (
              <div className="p-12 flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-bold text-foreground">IA analisando colunas...</p>
                <p className="text-xs text-muted-foreground">Identificando campos automaticamente</p>
              </div>
            )}

            {/* Mapping */}
            {smartImportStep === "mapping" && smartImportMapping && (
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <p className="text-sm font-bold text-foreground">Colunas identificadas</p>
                  <span className="text-[10px] text-muted-foreground">Delimitador: {smartImportMapping.delimiter} • Header: {smartImportMapping.has_header ? "Sim" : "Não"}</span>
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {smartImportMapping.columns.map((col: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{col.detected_header}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {(col.sample_values || []).slice(0, 3).join(" • ")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="h-1.5 w-12 rounded-full bg-white/[0.06] overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${(col.confidence || 0) * 100}%` }} />
                        </div>
                        <select
                          value={col.confirmed_field}
                          onChange={e => {
                            const updated = { ...smartImportMapping };
                            updated.columns = updated.columns.map((c: any, i: number) =>
                              i === idx ? { ...c, confirmed_field: e.target.value } : c
                            );
                            setSmartImportMapping(updated);
                          }}
                          className="h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          <option value="name">Nome</option>
                          <option value="email">Email</option>
                          <option value="phone">Telefone</option>
                          <option value="company">Empresa</option>
                          <option value="city">Cidade</option>
                          <option value="tags">Tags</option>
                          <option value="notes">Notas</option>
                          <option value="skip">Ignorar</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => setShowSmartImport(false)} className="h-11 px-5 rounded-2xl text-sm font-bold text-muted-foreground hover:text-foreground">
                    Cancelar
                  </button>
                  <button onClick={executeSmartImport} className="h-11 px-6 rounded-2xl bg-primary text-primary-foreground text-sm font-bold flex items-center gap-2">
                    <Upload className="h-4 w-4" /> Importar {smartImportRows.length - (smartImportMapping.has_header ? 1 : 0)} contatos
                  </button>
                </div>
              </div>
            )}

            {/* Importing */}
            {smartImportStep === "importing" && (
              <div className="p-12 flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-bold text-foreground">Importando contatos...</p>
                <p className="text-xs text-muted-foreground">Processando {smartImportRows.length} linhas</p>
              </div>
            )}

            {/* Done */}
            {smartImportStep === "done" && smartImportResult && (
              <div className="p-12 flex flex-col items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                </div>
                <p className="text-base font-bold text-foreground">Importação concluída!</p>
                <div className="flex gap-6 text-center">
                  <div>
                    <p className="text-2xl font-black text-emerald-400 tabular-nums">{smartImportResult.imported}</p>
                    <p className="text-[10px] text-muted-foreground">importados</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-amber-400 tabular-nums">{smartImportResult.duplicates}</p>
                    <p className="text-[10px] text-muted-foreground">duplicados</p>
                  </div>
                </div>
                <button onClick={() => setShowSmartImport(false)} className="h-11 px-6 rounded-2xl bg-primary text-primary-foreground text-sm font-bold mt-2">
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
