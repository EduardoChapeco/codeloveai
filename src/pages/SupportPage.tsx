import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { LifeBuoy, Plus, ChevronRight, Clock, CheckCircle2, AlertCircle, Loader2, X, Send } from "lucide-react";
import AppLayout from "@/components/AppLayout";

type Ticket = {
  id: string;
  ticket_num: number;
  title: string;
  status: string;
  priority: string;
  category: string;
  created_at: string;
};

const statusColors: Record<string, string> = {
  open: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  in_progress: "bg-primary/10 text-primary border-primary/20",
  resolved: "bg-green-500/10 text-green-500 border-green-500/20",
  closed: "bg-muted text-muted-foreground border-border",
};

const statusIcons: Record<string, React.ReactNode> = {
  open: <AlertCircle className="h-3.5 w-3.5" />,
  in_progress: <Clock className="h-3.5 w-3.5" />,
  resolved: <CheckCircle2 className="h-3.5 w-3.5" />,
  closed: <X className="h-3.5 w-3.5" />,
};

const statusLabels: Record<string, string> = {
  open: "Aberto",
  in_progress: "Em Atendimento",
  resolved: "Resolvido",
  closed: "Fechado",
};

const categories = [
  { value: "general", label: "Geral" },
  { value: "bug", label: "Bug / Erro" },
  { value: "billing", label: "Cobrança / Planos" },
  { value: "whitlabel", label: "White Label" },
  { value: "orchestrator", label: "Orchestrator" },
  { value: "extension", label: "Extensão Chrome" },
  { value: "security", label: "Segurança / LGPD" },
  { value: "feature_request", label: "Sugestão de Recurso" },
];

export default function SupportPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", category: "general" });

  // Load tickets on mount
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (supabase as any)
      .from("support_tickets")
      .select("id, ticket_num, title, status, priority, category, created_at")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }: any) => {
        setTickets((data as Ticket[]) || []);
        setLoading(false);
      });
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await (supabase as any).from("support_tickets").insert({
        user_id: user!.id,
        title: form.title.trim(),
        body: form.body.trim(),
        category: form.category,
      });
      if (error) throw error;
      toast.success("Ticket criado! Nossa equipe irá responder em breve.");
      setForm({ title: "", body: "", category: "general" });
      setShowForm(false);
      const { data } = await (supabase as any)
        .from("support_tickets")
        .select("id, ticket_num, title, status, priority, category, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      setTickets((data as Ticket[]) || []);
    } catch {
      toast.error("Erro ao criar ticket. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto px-6 py-24 text-center">
          <LifeBuoy className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
          <h1 className="lv-heading-md mb-2">Acesse sua conta para abrir um ticket</h1>
          <p className="lv-body mb-6">O suporte é exclusivo para usuários registrados.</p>
          <Link to="/login" className="lv-btn-primary">Fazer Login</Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <LifeBuoy className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="lv-heading-md">Suporte</h1>
              <p className="lv-caption">Seus tickets de atendimento</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="lv-btn-primary h-10 px-4 text-sm flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Novo Ticket
          </button>
        </div>

        {/* New ticket form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="mb-8 lv-card p-6">
            <h2 className="lv-heading-sm mb-5">Abrir Novo Ticket</h2>
            <div className="space-y-4">
              <div>
                <label className="lv-caption mb-1.5 block">Categoria</label>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="lv-input"
                >
                  {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="lv-caption mb-1.5 block">Assunto</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Descreva brevemente o problema..."
                  required
                  className="lv-input"
                />
              </div>
              <div>
                <label className="lv-caption mb-1.5 block">Descrição detalhada</label>
                <textarea
                  value={form.body}
                  onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                  placeholder="Descreva o problema com o máximo de detalhes possível..."
                  required
                  rows={5}
                  className="lv-input resize-none"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="lv-btn-primary h-10 px-5 text-sm flex items-center gap-2"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {submitting ? "Enviando..." : "Enviar Ticket"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="lv-btn-ghost h-10 px-4 text-sm"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Ticket list */}
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-20">
            <LifeBuoy className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="lv-body-strong">Nenhum ticket aberto</p>
            <p className="lv-caption mt-1">Clique em "Novo Ticket" para entrar em contato com nosso suporte.</p>
            <div className="mt-6">
              <Link to="/ajuda" className="text-sm text-primary hover:underline">Antes, verifique nossa Central de Ajuda →</Link>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {tickets.map(t => (
              <div
                key={t.id}
                className="lv-card-interactive flex items-center justify-between !p-4 group"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="lv-caption shrink-0 font-mono">#{t.ticket_num}</div>
                  <div className="min-w-0">
                    <p className="lv-body-strong truncate">{t.title}</p>
                    <p className="lv-caption mt-0.5">
                      {categories.find(c => c.value === t.category)?.label} · {new Date(t.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium shrink-0 ml-4 ${statusColors[t.status]}`}>
                  {statusIcons[t.status]}
                  {statusLabels[t.status]}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Self-help banner */}
        <div className="mt-12 lv-card-sm flex items-start gap-4">
          <LifeBuoy className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="lv-body-strong mb-1">Muitos problemas têm solução rápida!</p>
            <p className="lv-caption mb-3">Antes de abrir um ticket, confira nossa Central de Ajuda — há guias passo-a-passo para os problemas mais comuns.</p>
            <Link to="/ajuda" className="text-xs text-primary hover:underline flex items-center gap-1">
              Acessar Central de Ajuda <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
