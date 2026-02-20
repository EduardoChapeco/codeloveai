
# CodeLove AI — Plano de Implementação Completo

## Visão Geral
Plataforma completa para venda de acesso à extensão CodeLove AI (não oficial para Lovable). Inclui sistema de afiliados com codecoins, magic links e gestão completa pelo admin.

---

## ✅ JÁ IMPLEMENTADO

### 1. Landing Page (`/`)
- Hero, benefícios, planos (1 dia R$9,99 / 7 dias R$49,90 / 1 mês R$149,90 / 12 meses R$499,00)
- FAQ, termos de uso com checkbox obrigatório
- Checkout via Mercado Pago

### 2. Autenticação
- Login (`/login`), Cadastro (`/register`), Reset senha (`/forgot-password`, `/reset-password`)
- Primeiro usuário vira admin automaticamente

### 3. Dashboard do Membro (`/dashboard`)
- Status da assinatura, token, histórico, download da extensão

### 4. Painel Admin (`/admin`)
- Lista de membros, gerenciar tokens, planos, banir usuários

### 5. Backend
- Tabelas: profiles, subscriptions, tokens, user_roles
- RLS completo, Edge Functions (create-checkout, mercadopago-webhook)
- Roles: admin | member

---

## 🆕 A IMPLEMENTAR — Sistema de Afiliados

### Fase 1 — Database (Novas tabelas e enum)

**Alterar enum `app_role`:**
- Adicionar `'affiliate'` → admin | member | affiliate

**Tabela `affiliates`:**
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid PK | |
| user_id | uuid UNIQUE | FK auth.users |
| affiliate_code | text UNIQUE | Código único (ex: `ABC123`) |
| display_name | text | Nome exibido no magic link |
| discount_percent | int DEFAULT 20 | Desconto do afiliado |
| created_at | timestamp | |

**Tabela `affiliate_referrals`:**
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid PK | |
| affiliate_id | uuid | FK → affiliates |
| referred_user_id | uuid | Usuário que comprou |
| subscription_id | uuid | FK → subscriptions |
| confirmed | boolean DEFAULT false | Admin confirma pagamento |
| created_at | timestamp | |

**Tabela `codecoins`:**
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid PK | |
| user_id | uuid UNIQUE | FK (afiliado) |
| balance | int DEFAULT 0 | Saldo atual |
| total_earned | int DEFAULT 0 | Total acumulado |
| total_spent | int DEFAULT 0 | Total gasto |
| updated_at | timestamp | |

**Tabela `codecoin_transactions`:**
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid PK | |
| user_id | uuid | FK (afiliado) |
| amount | int | +1 ganho, -2 resgate |
| type | text | 'earned' ou 'redeemed' |
| description | text | Ex: "Indicação confirmada" |
| week_start | date | Semana de referência |
| created_at | timestamp | |

**Tabela `extension_files`:**
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid PK | |
| file_url | text | URL no storage |
| version | text | Ex: "1.0.3" |
| uploaded_by | uuid | Admin |
| is_latest | boolean DEFAULT true | Versão atual |
| created_at | timestamp | |

**Adicionar coluna em `subscriptions`:**
- `affiliate_code` text NULL — código do afiliado que indicou

**RLS para todas as novas tabelas:**
- Afiliado vê só os seus dados
- Admin gerencia tudo via `has_role(auth.uid(), 'admin')`

---

### Fase 2 — Dashboard do Afiliado (`/affiliate`)

**Funcionalidades:**
- Ver código de afiliado e copiar
- Ver saldo de codecoins (balance)
- Contador semanal: X/2 indicações confirmadas esta semana
- Histórico de indicações (referrals) com status
- Histórico de transações de coins
- Gerar magic link (copiar URL `/ref/CODIGO`)
- Solicitar tokens extras para clientes
- Comprar planos com 20% de desconto
- Status do próprio token e dias restantes

**Contadores visíveis:**
- "Indicações esta semana: X/2"
- "CodeCoins: X disponíveis"
- "Seu token expira em X dias"

---

### Fase 3 — Magic Link (`/ref/:code`)

**Página pública personalizada:**
- Exibe nome do afiliado (display_name)
- Mostra planos com preços normais
- Ao comprar, vincula o `affiliate_code` na subscription
- Visual "como se fosse dono da plataforma"
- Planos, benefícios, FAQ resumido
- Botão de compra redireciona para checkout com código do afiliado

---

### Fase 4 — Checkout com Afiliado

**Modificar `create-checkout` edge function:**
- Aceitar parâmetro opcional `affiliate_code`
- Gravar `affiliate_code` no `external_reference` do Mercado Pago
- Aplicar desconto 20% se comprador é afiliado

**Modificar `mercadopago-webhook`:**
- Ao confirmar pagamento, verificar se tem `affiliate_code`
- Se sim, criar registro em `affiliate_referrals`
- Admin confirma manualmente → codecoin é creditado

---

### Fase 5 — Sistema de CodeCoins

**Regras:**
- 1 compra confirmada via link do afiliado = +1 codecoin
- 2 codecoins na mesma semana = elegível para 7 dias free
- Admin ativa manualmente (renova token + debita 2 coins)
- Semana reinicia toda segunda-feira
- Coins não acumulam entre semanas para o benefício free

**Fluxo:**
1. Usuário compra via `/ref/CODIGO`
2. Pagamento confirmado (webhook ou manual pelo admin)
3. Admin confirma referral → +1 coin para afiliado
4. Afiliado atinge 2 coins na semana → solicita 7 dias free
5. Admin renova token do afiliado por 7 dias e debita 2 coins

---

### Fase 6 — Admin Expandido

**Novas abas/seções no `/admin`:**

**Aba Afiliados:**
- Lista de afiliados com código, coins, indicações
- Promover membro → afiliado
- Ver indicações pendentes de confirmação
- Confirmar pagamento → creditar coin
- Renovar token do afiliado (7 dias free)
- Debitar coins manualmente

**Aba Extensão:**
- Upload de arquivo da extensão (.zip/.crx)
- Histórico de versões
- Marcar versão como "latest"
- Storage bucket: `extensions` (privado, download via signed URL)

**Contadores no Admin:**
- Tokens expirando em < 3 dias
- Referrals pendentes de confirmação
- Afiliados elegíveis para renovação (≥2 coins/semana)

---

### Fase 7 — Storage para Extensão

**Bucket:** `extensions` (privado)
- Admin faz upload
- Membros/afiliados com assinatura ativa baixam via signed URL
- RLS: só autenticados com assinatura ativa podem baixar

---

## 🔐 Segurança

- Todas as tabelas com RLS
- Afiliados só veem seus próprios dados
- Coins só creditados após confirmação do admin
- Tokens de afiliado renovados apenas pelo admin
- Magic links são públicos (leitura) mas compras exigem autenticação
- Desconto de 20% validado server-side na edge function
- `affiliate_code` validado contra tabela `affiliates`

---

## 📋 Ordem de Implementação

1. **Fase 1**: Migration (tabelas, enum, RLS)
2. **Fase 2**: Dashboard afiliado
3. **Fase 3**: Magic link page
4. **Fase 4**: Checkout modificado
5. **Fase 5**: Sistema de coins
6. **Fase 6**: Admin expandido
7. **Fase 7**: Storage extensão
