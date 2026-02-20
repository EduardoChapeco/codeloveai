import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { LogOut, Key, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Member {
  user_id: string;
  name: string;
  email: string;
  subscription?: {
    plan: string;
    status: string;
    expires_at: string;
  };
  token?: string;
}

const planOptions = [
  { value: "1_day", label: "1 Dia", days: 1 },
  { value: "7_days", label: "7 Dias", days: 7 },
  { value: "1_month", label: "1 Mês", days: 30 },
  { value: "12_months", label: "12 Meses", days: 365 },
];

export default function Admin() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [tokenInput, setTokenInput] = useState<Record<string, string>>({});
  const [planInput, setPlanInput] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!authLoading && !adminLoading) {
      if (!user) navigate("/login");
      else if (!isAdmin) navigate("/dashboard");
    }
  }, [user, isAdmin, authLoading, adminLoading, navigate]);

  const fetchMembers = async () => {
    const { data: profiles } = await supabase.from("profiles").select("*");
    if (!profiles) return;

    const memberList: Member[] = [];
    for (const p of profiles) {
      const { data: subs } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", p.user_id)
        .order("created_at", { ascending: false })
        .limit(1);

      const { data: toks } = await supabase
        .from("tokens")
        .select("token")
        .eq("user_id", p.user_id)
        .eq("is_active", true)
        .limit(1);

      memberList.push({
        user_id: p.user_id,
        name: p.name,
        email: p.email,
        subscription: subs?.[0] ? {
          plan: subs[0].plan,
          status: subs[0].status,
          expires_at: subs[0].expires_at,
        } : undefined,
        token: toks?.[0]?.token,
      });
    }
    setMembers(memberList);
  };

  useEffect(() => {
    if (isAdmin) fetchMembers();
  }, [isAdmin]);

  const assignToken = async (userId: string) => {
    const token = tokenInput[userId];
    if (!token) return toast.error("Insira um token.");

    // Deactivate old tokens
    await supabase.from("tokens").update({ is_active: false }).eq("user_id", userId);

    const { error } = await supabase.from("tokens").insert({
      user_id: userId,
      token,
      is_active: true,
    });

    if (error) return toast.error(error.message);
    toast.success("Token atribuído!");
    setTokenInput((prev) => ({ ...prev, [userId]: "" }));
    fetchMembers();
  };

  const assignPlan = async (userId: string) => {
    const planValue = planInput[userId];
    if (!planValue) return toast.error("Selecione um plano.");
    const plan = planOptions.find((p) => p.value === planValue);
    if (!plan) return;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + plan.days);

    const { error } = await supabase.from("subscriptions").insert({
      user_id: userId,
      plan: plan.value as any,
      status: "active" as any,
      starts_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
    });

    if (error) return toast.error(error.message);
    toast.success("Plano atribuído!");
    fetchMembers();
  };

  const planLabels: Record<string, string> = {
    "1_day": "1 Dia",
    "7_days": "7 Dias",
    "1_month": "1 Mês",
    "12_months": "12 Meses",
  };

  if (authLoading || adminLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="ep-subtitle">CARREGANDO...</p>
    </div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-20 bg-background border-b border-border px-8 py-5 flex items-center justify-between">
        <Link to="/" className="ep-label text-sm tracking-[0.3em]">CODELOVE AI</Link>
        <div className="flex items-center gap-4">
          <span className="ep-badge ep-badge-live">ADMIN</span>
          <button onClick={signOut} className="ep-btn-icon h-10 w-10 rounded-[14px]">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-8 py-12 space-y-8">
        <div>
          <p className="ep-subtitle mb-2">PAINEL ADMINISTRATIVO</p>
          <h1 className="ep-section-title">GERENCIAR MEMBROS</h1>
        </div>

        <div className="space-y-4">
          {members.map((m) => (
            <div key={m.user_id} className="ep-card">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                {/* Info */}
                <div className="flex-1">
                  <p className="text-sm font-bold text-foreground">{m.name || "Sem nome"}</p>
                  <p className="text-xs text-muted-foreground font-medium">{m.email}</p>
                  {m.subscription && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`ep-badge ${m.subscription.status === "active" && new Date(m.subscription.expires_at) > new Date() ? "ep-badge-live" : "ep-badge-offline"}`}>
                        {planLabels[m.subscription.plan] || m.subscription.plan}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Exp: {format(new Date(m.subscription.expires_at), "dd/MM/yyyy")}
                      </span>
                    </div>
                  )}
                  {m.token && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Token: <code className="font-mono bg-muted px-2 py-0.5 rounded-[8px]">{m.token}</code>
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-3">
                  {/* Assign Plan */}
                  <div className="flex items-center gap-2">
                    <select
                      value={planInput[m.user_id] || ""}
                      onChange={(e) => setPlanInput((prev) => ({ ...prev, [m.user_id]: e.target.value }))}
                      className="ep-input h-10 rounded-[14px] text-xs px-3 bg-muted border border-border"
                    >
                      <option value="">Plano...</option>
                      {planOptions.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                    <button onClick={() => assignPlan(m.user_id)} className="ep-btn-secondary h-10 px-4 text-[9px]">
                      <UserCheck className="h-3 w-3" />
                    </button>
                  </div>
                  {/* Assign Token */}
                  <div className="flex items-center gap-2">
                    <input
                      placeholder="Token..."
                      value={tokenInput[m.user_id] || ""}
                      onChange={(e) => setTokenInput((prev) => ({ ...prev, [m.user_id]: e.target.value }))}
                      className="ep-input h-10 rounded-[14px] text-xs px-3 border border-border flex-1"
                    />
                    <button onClick={() => assignToken(m.user_id)} className="ep-btn-secondary h-10 px-4 text-[9px]">
                      <Key className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {members.length === 0 && (
            <div className="ep-empty">
              <div className="ep-empty-icon">
                <UserX className="h-10 w-10" />
              </div>
              <p className="ep-empty-title">NENHUM MEMBRO</p>
              <p className="text-sm text-muted-foreground font-medium">Nenhum membro cadastrado ainda.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
