import { useState } from "react";
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
  open: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  in_progress: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  resolved: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  closed: "text-muted-foreground bg-muted/30 border-border/60",
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
  useState(() => {
    if (!user) { setLoading(false); return; }
    supabase
      .from("support_tickets")
      .select("id, ticket_num, title, status, priority, category, created_at")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setTickets((data as Ticket[]) || []);
        setLoading(false);
      });
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("support_tickets").insert({
        user_id: user!.id,
        title: form.title.trim(),
        body: form.body.trim(),
        category: form.category,
      });
      if (error) throw error;
      toast.success("Ticket criado! Nossa equipe irá responder em breve.");
      setForm({ title: "", body: "", category: "general" });
      setShowForm(false);
      // Refresh
      const { data } = await supabase
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
          <h1 className="text-xl font-bold mb-2">Acesse sua conta para abrir um ticket</h1>
          <p className="text-muted-foreground text-sm mb-6">O suporte é exclusivo para usuários registrados.</p>
          <Link to="/login" className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            Fazer Login
          </Link>
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
            <div className="h-10 w-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <LifeBuoy className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Suporte</h1>
              <p className="text-xs text-muted-foreground">Seus tickets de atendimento</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Novo Ticket
          </button>
        </div>

        {/* New ticket form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="mb-8 p-6 rounded-2xl bg-muted/20 border border-border/60">
            <h2 className="font-semibold mb-5">Abrir Novo Ticket</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Categoria</label>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Assunto</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Descreva brevemente o problema..."
                  required
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Descrição detalhada</label>
                <textarea
                  value={form.body}
                  onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                  placeholder="Descreva o problema com o máximo de detalhes possível: passos para reproduzir, mensagens de erro, screenshots relevantes..."
                  required
                  rows={5}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-9 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {submitting ? "Enviando..." : "Enviar Ticket"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="h-9 px-4 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
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
          <div className="text-center py-20 text-muted-foreground">
            <LifeBuoy className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">Nenhum ticket aberto</p>
            <p className="text-sm mt-1">Clique em "Novo Ticket" para entrar em contato com nosso suporte.</p>
            <div className="mt-6">
              <Link to="/ajuda" className="text-sm text-primary hover:underline">Antes, verifique nossa Central de Ajuda →</Link>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {tickets.map(t => (
              <div
                key={t.id}
                className="flex items-center justify-between p-4 rounded-xl bg-muted/20 border border-border/60 hover:border-border transition-all group"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="text-xs text-muted-foreground shrink-0 font-mono">#{t.ticket_num}</div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
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
        <div className="mt-12 p-5 rounded-xl bg-blue-500/5 border border-blue-500/20 flex items-start gap-4">
          <LifeBuoy className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium mb-1">Muitos problemas têm solução rápida!</p>
            <p className="text-xs text-muted-foreground mb-3">Antes de abrir um ticket, confira nossa Central de Ajuda — há guias passo-a-passo para os problemas mais comuns.</p>
            <Link to="/ajuda" className="text-xs text-blue-400 hover:underline flex items-center gap-1">
              Acessar Central de Ajuda <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
