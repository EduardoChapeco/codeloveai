
## Plano: Correção do Sistema de Licenciamento e Limites

### Problemas Identificados

1. **`generate-clf-token`** (linha 84-85): Aceita cegamente `plan: "pro"` e `expiresIn: 365 dias` do frontend — qualquer usuário autenticado gera token premium infinito
2. **`auto-onboard`** (linha 88-90): Cria assinaturas de 365 dias para qualquer novo usuário
3. **`LovableConnect.tsx`** (linha 110): Frontend envia `plan: "pro", expiresIn: 365*24*60*60*1000` — hardcoded
4. **`send-message`**: Não chama `increment-usage` nem verifica limite diário — limite de 10 msg/dia nunca é enforçado
5. **Extensão**: Nunca recebe informação de uso diário para exibir ao usuário

### Correções

**Fase 1 — `generate-clf-token` (servidor decide o plano)**
- Ignorar `plan` e `expiresIn` vindos do body
- Consultar `subscriptions` e `licenses` do usuário para determinar plano real
- Sem assinatura paga ativa → `plan: "free"`, expiry 24h, `daily_messages: 10`, `type: "trial"`
- Com assinatura paga → usar plano e duração correspondente
- Setar `daily_messages` e `type` na license criada

**Fase 2 — `auto-onboard` → trial de 24h (não 365 dias)**
- Mudar de 365 dias para 1 dia (24h)
- Plan label: `"trial"` em vez de `"1_day"`
- Remover chamada ao webhook externo que gera tokens de 365 dias

**Fase 3 — `LovableConnect.tsx` → remover hardcodes**
- Remover `plan: "pro"` e `expiresIn: 365*...` do body
- Enviar body vazio, servidor decide tudo
- Exibir tipo de plano real retornado pelo servidor

**Fase 4 — `send-message` → enforçar limite diário**
- Antes de enviar: consultar `daily_usage` para a license
- Se `messages_used >= daily_messages` → bloquear com erro 429
- Após envio bem-sucedido: chamar `increment_daily_usage` RPC
- Retornar `usedToday` e `dailyLimit` na resposta para a extensão exibir

**Fase 5 — Task file**
- Criar `.lovable/tasks/1772010000000-task.md` com status done

### Arquivos Afetados
- `supabase/functions/generate-clf-token/index.ts`
- `supabase/functions/auto-onboard/index.ts`  
- `supabase/functions/send-message/index.ts`
- `src/pages/LovableConnect.tsx`
- `.lovable/tasks/1772010000000-task.md`
