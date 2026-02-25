

## Análise Completa — Estado Atual da Plataforma Starble

### ✅ O QUE ESTÁ FUNCIONANDO

1. **Planos no Banco de Dados** — Corretos e alinhados:
   - Grátis (R$0/dia) ✅
   - Individual (R$4,90/dia) ✅
   - Agência (R$49,90/mês, 10 projetos, label "Popular") ✅
   - White Label (R$299/mês, 30% comissão) ✅
   - Diário e Mensal (legados, `is_public=false`) ✅

2. **PlansPage.tsx** — Separação WL/regular funciona corretamente ✅
3. **Checkout.tsx** — Filtra WL (price < 20000) ✅
4. **Index.tsx** — Landing page com planos hardcoded corretos ✅
5. **Dashboard.tsx** — Queries paralelas com `Promise.all` ✅
6. **TenantContext.tsx** — Carregamento paralelo do tenant ✅
7. **TenantAdmin.tsx** — Editor in-page com preview, módulos, extensão ✅
8. **Admin.tsx — Membros** — Lista clicável + `MemberDetailPanel` com 6 sub-tabs ✅
9. **Admin.tsx — Afiliados, Faturas, Extensão, Chat, Worker Tokens** — Funcionando ✅
10. **MemberDetailPanel** — Perfil, licenças, uso, projetos, ativações, mensagens ✅

---

### ⚠️ PROBLEMAS ENCONTRADOS

#### 1. **Tabelas `support_tickets` e `ticket_replies` NÃO EXISTEM no banco**
- O Admin.tsx tem uma aba "Suporte" completa que faz queries a essas tabelas
- `fetchTickets()` é chamado no `useEffect` inicial → **gera erro silencioso** (queries falham mas são capturadas)
- A aba Suporte renderiza mas nunca mostra tickets reais

**Fix:** Criar migration com as tabelas `support_tickets` e `ticket_replies` com RLS

#### 2. **`MemberDetailPanel` referencia `token_activations` com cast `(supabase as any)`**
- A tabela `token_activations` existe no banco, mas usa cast forçado — funciona mas pode ter problemas de tipagem
- Isso é aceitável (tabela existe, apenas não está nos types gerados)

#### 3. **`MemberDetailPanel` referencia `subscriptions`**
- A tabela `subscriptions` existe ✅ — sem problemas

#### 4. **Admin.tsx — Aba "Suporte" não tem ícone no tab bar**
- O array de tabs inclui `"support"` mas o bloco de ícones não tem `{t === "support" && ...}`
- Resultado: a aba "Suporte" aparece sem ícone (apenas texto)

#### 5. **Checkout fallback plans desatualizados**
- Os `fallbackPlans` hardcoded usam preços antigos (R$4,90 e R$97) e nomes "Diário"/"Mensal"
- Deveria refletir os planos atuais (Individual/Agência) caso o banco falhe

#### 6. **Dashboard referencia tabela `tokens`**
- A tabela `tokens` existe ✅, mas é legada — o sistema usa `licenses` agora
- Funciona mas SSO bridge depende dela

---

### 🔧 PLANO DE CORREÇÃO

#### Fase 1 — Criar tabelas de suporte (migration)
```sql
CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'medium',
  category TEXT NOT NULL DEFAULT 'general',
  tenant_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ticket_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
- RLS: Admins ALL, Users SELECT/INSERT own tickets/replies
- Validation triggers for status and priority

#### Fase 2 — Fix ícone do Suporte no Admin
- Adicionar `{t === "support" && <MessageSquare className="h-3 w-3" />}` no tab bar

#### Fase 3 — Atualizar fallback plans no Checkout
- Mudar fallback para Individual (R$4,90/dia) e Agência (R$49,90/mês)

#### Fase 4 — Adicionar `SupportPage.tsx` para usuários
- A página `/suporte` já existe no router mas precisa verificar se tem formulário de ticket

