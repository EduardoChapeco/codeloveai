
## Auditoria Completa do Sistema Starble — Plano de Correções e Melhorias

### 1. Páginas Criadas mas NÃO Registradas no Router (App.tsx)

As seguintes páginas existem em `src/pages/` mas **não têm rota** no `App.tsx`, ou seja, estão **inacessíveis**:

| Página | Rota sugerida | Status |
|--------|---------------|--------|
| `AffiliateDashboard.tsx` | `/afiliado/dashboard` | ❌ Sem rota |
| `AffiliatesPage.tsx` | `/afiliados/painel` | ❌ Sem rota |
| `AffiliateRefPage.tsx` | `/ref/:code` | ❌ Sem rota |
| `WlAffiliateDashboard.tsx` | `/wl/afiliados` | ❌ Sem rota |
| `WhiteLabelRefPage.tsx` | `/wl/ref/:code` | ❌ Sem rota |
| `PartnersLanding.tsx` | `/parceiros` | ❌ Sem rota |
| `LovableCloudAdmin.tsx` | `/admin/cloud` | ❌ Sem rota |

**Correção:** Registrar todas as rotas no `App.tsx` com `lazyRetry`.

### 2. Navegação Quebrada

O `AppNav.tsx` tem link `/affiliate` que **não existe** em nenhuma rota. Deve apontar para `/afiliado/dashboard`.

### 3. Duplicação TenantDashboard vs TenantAdmin

- `TenantDashboard.tsx` (`/tenant/dashboard`) — versão simplificada com overview
- `TenantAdmin.tsx` (`/admin/tenant`) — versão completa com Brand/Users/Licenses/Finances

**Decisão:** Manter `TenantAdmin` como painel principal. Redirecionar `/tenant/dashboard` para `/admin/tenant` ou eliminar a duplicação fazendo TenantDashboard redirecionar.

### 4. Sistema de Personalização de Tenants (MELHORIA SOLICITADA)

O `TenantAdmin.tsx` aba "Brand" tem apenas campos básicos (cores, URLs, SEO, termos). Falta:

**Adicionar ao TenantAdmin:**
- **Tema preset** (selector visual: default, midnight, neon-cyber, etc.)
- **Font family** (dropdown: system, Inter, Poppins, DM Sans, Space Grotesk, Nunito)
- **Border radius** (slider: 0px a 24px)
- **Preview em tempo real** do tema aplicado
- **Upload de logo/favicon** direto para o bucket `tenant-assets` (em vez de URLs manuais)
- **Módulos configuráveis** (toggle para cada módulo: chat, deploy, preview, notas, etc.)
- **Extension mode** (security_fix_v2, seo_fix, error_fix, custom)
- **Custom mode prompt** (textarea para modo custom)
- **Trial minutes** configurável
- **Limite de projetos** por plano

### 5. Novos Planos com Limite de Projetos (SOLICITADO)

Criar/atualizar planos na tabela `plans`:

| Plano | Preço | Ciclo | Limite Projetos | Público-alvo |
|-------|-------|-------|-----------------|--------------|
| Individual | R$4,90/dia | Diário | 2 projetos | Freelancer |
| Agência | R$49,90/mês | Mensal | 10 projetos | Agências |

**Requer:**
- Adicionar coluna `max_projects` na tabela `plans` (migration)
- Atualizar `validate-plan` e `send-message` para verificar limite de projetos
- Atualizar UI de PlansPage para mostrar novo atributo

### 6. Tasks (.md) — Verificação de Conclusão

| Task | Status no arquivo | Real |
|------|-------------------|------|
| `1771892474348` (Starble v2.0) | ✅ done | Confirmado |
| `1771892641405` (Plano de implementação) | ✅ done | Confirmado |
| `1771981961756` (Prompt Master v1.0) | ✅ done | Confirmado |

Todas as tasks anteriores foram concluídas.

### 7. Runtime Errors Pendentes

Não há erros de runtime capturados nos logs do console. O sistema está estável.

### 8. Plano de Execução

**Fase 1 — Rotas e Navegação:**
1. Registrar todas as 7 páginas órfãs no `App.tsx`
2. Corrigir link `/affiliate` no `AppNav.tsx`
3. Redirect `/tenant/dashboard` → `/admin/tenant`

**Fase 2 — Personalização Avançada do Tenant:**
1. Expandir aba "Brand" do `TenantAdmin.tsx` com:
   - Theme preset selector
   - Font family dropdown
   - Border radius slider
   - Upload de logo/favicon para storage
   - Módulos toggle
   - Extension mode + custom prompt
   - Trial minutes
2. Adicionar aba "Planos" no TenantAdmin para gerenciamento de planos do tenant
3. Preview em tempo real das mudanças de tema

**Fase 3 — Limite de Projetos:**
1. Migration: `ALTER TABLE plans ADD COLUMN max_projects integer DEFAULT NULL`
2. Inserir/atualizar planos (Individual R$4,90 e Agência R$49,90)
3. Atualizar Edge Functions para validar limite
4. Atualizar UI do PlansPage

**Fase 4 — Task e Documentação:**
1. Criar nova task `.md` consolidando todas as melhorias
2. Marcar como done ao concluir
