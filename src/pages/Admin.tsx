import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { LogOut, Key, UserCheck, UserX, Ban, XCircle, Users, Coins, Upload, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Member {
  user_id: string;
  name: string;
  email: string;
  subscription?: { plan: string; status: string; expires_at: string };
  token?: string;
  isAffiliate?: boolean;
}

interface AffiliateInfo {
  id: string;
  user_id: string;
  affiliate_code: string;
  display_name: string;
  discount_percent: number;
  coins?: { balance: number; total_earned: number; total_spent: number };
  weeklyReferrals: number;
  totalReferrals: number;
  pendingReferrals: number;
}

const planOptions = [
  { value: "1_day", label: "1 Dia", days: 1 },
  { value: "7_days", label: "7 Dias", days: 7 },
  { value: "1_month", label: "1 Mês", days: 30 },
  { value: "12_months", label: "12 Meses", days: 365 },
];

const planLabels: Record<string, string> = {
  "1_day": "1 Dia", "7_days": "7 Dias", "1_month": "1 Mês", "12_months": "12 Meses",
};

type Tab = "members" | "affiliates" | "extension";

export default function Admin() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("members");
  const [members, setMembers] = useState<Member[]>([]);
  const [affiliates, setAffiliates] = useState<AffiliateInfo[]>([]);
  const [tokenInput, setTokenInput] = useState<Record<string, string>>({});
  const [planInput, setPlanInput] = useState<Record<string, string>>({});
  const [newAffUserId, setNewAffUserId] = useState("");
  const [newAffCode, setNewAffCode] = useState("");
  const [newAffName, setNewAffName] = useState("");
  const [extVersion, setExtVersion] = useState("");
  const [extFile, setExtFile] = useState<File | null>(null);
  const [extInstructions, setExtInstructions] = useState("");
  const [extensions, setExtensions] = useState<any[]>([]);

  useEffect(() => {
    if (!authLoading && !adminLoading) {
      if (!user) navigate("/login");
      else if (!isAdmin) navigate("/dashboard");
    }
  }, [user, isAdmin, authLoading, adminLoading, navigate]);

  // Fetch members
  const fetchMembers = async () => {
    const { data: profiles } = await supabase.from("profiles").select("*");
    if (!profiles) return;

    const { data: allAffiliates } = await supabase.from("affiliates").select("user_id");
    const affUserIds = new Set((allAffiliates || []).map((a) => a.user_id));

    const memberList: Member[] = [];
    for (const p of profiles) {
      const { data: subs } = await supabase.from("subscriptions").select("*")
        .eq("user_id", p.user_id).order("created_at", { ascending: false }).limit(1);
      const { data: toks } = await supabase.from("tokens").select("token")
        .eq("user_id", p.user_id).eq("is_active", true).limit(1);

      memberList.push({
        user_id: p.user_id, name: p.name, email: p.email,
        subscription: subs?.[0] ? { plan: subs[0].plan, status: subs[0].status, expires_at: subs[0].expires_at } : undefined,
        token: toks?.[0]?.token,
        isAffiliate: affUserIds.has(p.user_id),
      });
    }
    setMembers(memberList);
  };

  // Fetch affiliates
  const fetchAffiliates = async () => {
    const { data: affs } = await supabase.from("affiliates").select("*");
    if (!affs) return;

    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);

    const list: AffiliateInfo[] = [];
    for (const a of affs) {
      const { data: coinsData } = await supabase.from("codecoins").select("*").eq("user_id", a.user_id).maybeSingle();
      const { data: refs } = await supabase.from("affiliate_referrals").select("*").eq("affiliate_id", a.id);
      const allRefs = refs || [];
      const weeklyConfirmed = allRefs.filter((r) => r.confirmed && new Date(r.created_at) >= monday).length;
      const pending = allRefs.filter((r) => !r.confirmed).length;

      list.push({
        id: a.id, user_id: a.user_id, affiliate_code: a.affiliate_code,
        display_name: a.display_name, discount_percent: a.discount_percent,
        coins: coinsData || undefined,
        weeklyReferrals: weeklyConfirmed, totalReferrals: allRefs.length, pendingReferrals: pending,
      });
    }
    setAffiliates(list);
  };

  const fetchExtensions = async () => {
    const { data } = await supabase.from("extension_files").select("*").order("created_at", { ascending: false });
    setExtensions(data || []);
  };

  useEffect(() => {
    if (isAdmin) {
      fetchMembers();
      fetchAffiliates();
      fetchExtensions();
    }
  }, [isAdmin]);

  // Member actions
  const assignToken = async (userId: string) => {
    const token = tokenInput[userId];
    if (!token) return toast.error("Insira um token.");
    await supabase.from("tokens").update({ is_active: false }).eq("user_id", userId);
    const { error } = await supabase.from("tokens").insert({ user_id: userId, token, is_active: true });
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
      user_id: userId, plan: plan.value as any, status: "active" as any,
      starts_at: new Date().toISOString(), expires_at: expiresAt.toISOString(),
    });
    if (error) return toast.error(error.message);
    toast.success("Plano atribuído!");
    fetchMembers();
  };

  const cancelSubscription = async (userId: string) => {
    if (!confirm("Cancelar assinatura?")) return;
    await supabase.from("subscriptions").update({ status: "cancelled" as any }).eq("user_id", userId).eq("status", "active");
    toast.success("Cancelada!");
    fetchMembers();
  };

  const banUser = async (userId: string) => {
    if (!confirm("Banir usuário?")) return;
    await supabase.from("tokens").update({ is_active: false }).eq("user_id", userId);
    await supabase.from("subscriptions").update({ status: "cancelled" as any }).eq("user_id", userId).eq("status", "active");
    toast.success("Banido!");
    fetchMembers();
  };

  // Affiliate actions
  const createAffiliate = async () => {
    if (!newAffUserId || !newAffCode || !newAffName) return toast.error("Preencha todos os campos.");
    // Add role
    await supabase.from("user_roles").insert({ user_id: newAffUserId, role: "affiliate" as any });
    // Create affiliate
    const { error } = await supabase.from("affiliates").insert({
      user_id: newAffUserId, affiliate_code: newAffCode.toUpperCase(), display_name: newAffName,
    });
    if (error) return toast.error(error.message);
    // Create codecoins record
    await supabase.from("codecoins").insert({ user_id: newAffUserId });
    toast.success("Afiliado criado!");
    setNewAffUserId(""); setNewAffCode(""); setNewAffName("");
    fetchAffiliates(); fetchMembers();
  };

  const confirmReferral = async (affiliateId: string, affiliateUserId: string, referralId: string) => {
    // Confirm referral
    await supabase.from("affiliate_referrals").update({ confirmed: true }).eq("id", referralId);
    // Add codecoin
    const { data: coins } = await supabase.from("codecoins").select("*").eq("user_id", affiliateUserId).maybeSingle();
    if (coins) {
      await supabase.from("codecoins").update({
        balance: coins.balance + 1, total_earned: coins.total_earned + 1, updated_at: new Date().toISOString(),
      }).eq("user_id", affiliateUserId);
    }
    // Log transaction
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    await supabase.from("codecoin_transactions").insert({
      user_id: affiliateUserId, amount: 1, type: "earned",
      description: "Indicação confirmada", week_start: monday.toISOString().split("T")[0],
    });
    toast.success("+1 CodeCoin creditado!");
    fetchAffiliates();
  };

  const redeemCoins = async (affiliateUserId: string) => {
    const { data: coins } = await supabase.from("codecoins").select("*").eq("user_id", affiliateUserId).maybeSingle();
    if (!coins || coins.balance < 2) return toast.error("Saldo insuficiente (mínimo 2 coins).");
    // Debit 2 coins
    await supabase.from("codecoins").update({
      balance: coins.balance - 2, total_spent: coins.total_spent + 2, updated_at: new Date().toISOString(),
    }).eq("user_id", affiliateUserId);
    // Extend/create 7 day subscription
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await supabase.from("subscriptions").insert({
      user_id: affiliateUserId, plan: "7_days" as any, status: "active" as any,
      starts_at: new Date().toISOString(), expires_at: expiresAt.toISOString(),
    });
    // Log transaction
    await supabase.from("codecoin_transactions").insert({
      user_id: affiliateUserId, amount: -2, type: "redeemed", description: "Resgate: 7 dias free",
    });
    toast.success("7 dias ativados! Renove o token manualmente.");
    fetchAffiliates();
  };

  // Extension upload
  const uploadExtension = async () => {
    if (!extFile || !extVersion) return toast.error("Selecione arquivo e versão.");
    const path = `extensions/v${extVersion}/${extFile.name}`;
    const { error: upErr } = await supabase.storage.from("extensions").upload(path, extFile);
    if (upErr) return toast.error(upErr.message);
    // Mark old as not latest
    await supabase.from("extension_files").update({ is_latest: false }).eq("is_latest", true);
    // Insert record
    await supabase.from("extension_files").insert({
      file_url: path, version: extVersion, uploaded_by: user!.id, is_latest: true,
      instructions: extInstructions,
    });
    toast.success("Extensão enviada!");
    setExtVersion(""); setExtFile(null); setExtInstructions("");
    fetchExtensions();
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
          <h1 className="ep-section-title">GERENCIAR</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {([["members", "MEMBROS"], ["affiliates", "AFILIADOS"], ["extension", "EXTENSÃO"]] as [Tab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`ep-btn-secondary h-10 px-6 text-[9px] ${tab === t ? "bg-foreground text-background" : ""}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Members Tab */}
        {tab === "members" && (
          <div className="space-y-4">
            {members.map((m) => (
              <div key={m.user_id} className="ep-card">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground">{m.name || "Sem nome"}</p>
                      {m.isAffiliate && <span className="ep-badge ep-badge-live text-[8px]">AFILIADO</span>}
                    </div>
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
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <select value={planInput[m.user_id] || ""}
                        onChange={(e) => setPlanInput((prev) => ({ ...prev, [m.user_id]: e.target.value }))}
                        className="ep-input h-10 rounded-[14px] text-xs px-3 bg-muted border border-border">
                        <option value="">Plano...</option>
                        {planOptions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                      </select>
                      <button onClick={() => assignPlan(m.user_id)} className="ep-btn-secondary h-10 px-4 text-[9px]">
                        <UserCheck className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input placeholder="Token..." value={tokenInput[m.user_id] || ""}
                        onChange={(e) => setTokenInput((prev) => ({ ...prev, [m.user_id]: e.target.value }))}
                        className="ep-input h-10 rounded-[14px] text-xs px-3 border border-border flex-1" />
                      <button onClick={() => assignToken(m.user_id)} className="ep-btn-secondary h-10 px-4 text-[9px]">
                        <Key className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      {m.subscription?.status === "active" && new Date(m.subscription.expires_at) > new Date() && (
                        <button onClick={() => cancelSubscription(m.user_id)} className="ep-btn-secondary h-10 px-4 text-[9px] text-destructive border-destructive/30">
                          <XCircle className="h-3 w-3 mr-1" /> CANCELAR
                        </button>
                      )}
                      <button onClick={() => banUser(m.user_id)} className="ep-btn-secondary h-10 px-4 text-[9px] text-destructive border-destructive/30">
                        <Ban className="h-3 w-3 mr-1" /> BANIR
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {members.length === 0 && (
              <div className="ep-empty">
                <UserX className="h-10 w-10 mx-auto mb-4" />
                <p className="ep-empty-title">NENHUM MEMBRO</p>
              </div>
            )}
          </div>
        )}

        {/* Affiliates Tab */}
        {tab === "affiliates" && (
          <div className="space-y-6">
            {/* Create affiliate */}
            <div className="ep-card">
              <p className="ep-subtitle mb-4">CRIAR AFILIADO</p>
              <div className="flex flex-col md:flex-row gap-3">
                <select value={newAffUserId} onChange={(e) => setNewAffUserId(e.target.value)}
                  className="ep-input h-10 rounded-[14px] text-xs px-3 bg-muted border border-border flex-1">
                  <option value="">Selecionar membro...</option>
                  {members.filter((m) => !m.isAffiliate).map((m) => (
                    <option key={m.user_id} value={m.user_id}>{m.name || m.email}</option>
                  ))}
                </select>
                <input placeholder="Código (ex: ABC123)" value={newAffCode}
                  onChange={(e) => setNewAffCode(e.target.value)}
                  className="ep-input h-10 rounded-[14px] text-xs px-3 border border-border" />
                <input placeholder="Nome de exibição" value={newAffName}
                  onChange={(e) => setNewAffName(e.target.value)}
                  className="ep-input h-10 rounded-[14px] text-xs px-3 border border-border" />
                <button onClick={createAffiliate} className="ep-btn-primary h-10 px-6 text-[9px]">CRIAR</button>
              </div>
            </div>

            {/* Affiliate list */}
            {affiliates.map((a) => (
              <div key={a.id} className="ep-card">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                  <div className="flex-1">
                    <p className="text-sm font-bold text-foreground">{a.display_name}</p>
                    <p className="text-xs text-muted-foreground font-medium font-mono">Código: {a.affiliate_code}</p>
                    <div className="flex items-center gap-4 mt-3">
                      <div className="text-center">
                        <p className="text-lg font-bold">{a.coins?.balance || 0}</p>
                        <p className="text-[9px] text-muted-foreground">COINS</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold">{a.weeklyReferrals}/2</p>
                        <p className="text-[9px] text-muted-foreground">SEMANA</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold">{a.totalReferrals}</p>
                        <p className="text-[9px] text-muted-foreground">TOTAL</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold">{a.pendingReferrals}</p>
                        <p className="text-[9px] text-muted-foreground">PENDENTES</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {(a.coins?.balance || 0) >= 2 && (
                      <button onClick={() => redeemCoins(a.user_id)} className="ep-btn-primary h-10 px-4 text-[9px]">
                        <Coins className="h-3 w-3 mr-1" /> RESGATAR 2 COINS (7 DIAS)
                      </button>
                    )}
                    <button onClick={() => {
                      // Show pending referrals - simple confirm all
                      supabase.from("affiliate_referrals").select("*")
                        .eq("affiliate_id", a.id).eq("confirmed", false)
                        .then(({ data: pendingRefs }) => {
                          if (!pendingRefs?.length) return toast.info("Nenhuma pendente.");
                          if (confirm(`Confirmar ${pendingRefs.length} indicação(ões)?`)) {
                            pendingRefs.forEach((r) => confirmReferral(a.id, a.user_id, r.id));
                          }
                        });
                    }} className="ep-btn-secondary h-10 px-4 text-[9px]">
                      <UserCheck className="h-3 w-3 mr-1" /> CONFIRMAR PENDENTES
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {affiliates.length === 0 && (
              <div className="ep-empty">
                <Users className="h-10 w-10 mx-auto mb-4" />
                <p className="ep-subtitle">NENHUM AFILIADO</p>
              </div>
            )}
          </div>
        )}

        {/* Extension Tab */}
        {tab === "extension" && (
          <div className="space-y-6">
            <div className="ep-card">
              <p className="ep-subtitle mb-4">UPLOAD DA EXTENSÃO</p>
              <div className="space-y-3">
                <div className="flex flex-col md:flex-row gap-3">
                  <input placeholder="Versão (ex: 1.0.3)" value={extVersion}
                    onChange={(e) => setExtVersion(e.target.value)}
                    className="ep-input h-10 rounded-[14px] text-xs px-3 border border-border" />
                  <input type="file" accept=".zip,.crx,.xpi,.txt"
                    onChange={(e) => setExtFile(e.target.files?.[0] || null)}
                    className="ep-input h-10 rounded-[14px] text-xs px-3 border border-border flex-1" />
                </div>
                <textarea
                  placeholder="Instruções de instalação (passo a passo para o usuário)..."
                  value={extInstructions}
                  onChange={(e) => setExtInstructions(e.target.value)}
                  rows={5}
                  className="ep-input w-full rounded-[14px] text-xs px-4 py-3 border border-border resize-none"
                />
                <button onClick={uploadExtension} className="ep-btn-primary h-10 px-6 text-[9px]">
                  <Upload className="h-3 w-3 mr-1" /> ENVIAR EXTENSÃO
                </button>
              </div>
            </div>

            {extensions.map((ext) => (
              <div key={ext.id} className="ep-card">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold text-foreground">v{ext.version}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(ext.created_at), "dd/MM/yyyy HH:mm")}</p>
                  </div>
                  <span className={`ep-badge ${ext.is_latest ? "ep-badge-live" : "ep-badge-offline"}`}>
                    {ext.is_latest ? "ATUAL" : "ANTIGA"}
                  </span>
                </div>
                {ext.instructions && (
                  <div className="bg-muted rounded-[12px] p-4 mt-2">
                    <p className="ep-subtitle text-[9px] mb-2">INSTRUÇÕES</p>
                    <pre className="text-xs text-muted-foreground font-medium whitespace-pre-wrap">{ext.instructions}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
