
<plan_title>Corrigir tratamento de 403 e recriar projeto Brain</plan_title>
<plan_summary>
Adicionar retry com refresh de token em respostas 403 (além de 401) na função `loveai-brain`, e implementar lógica para recriar automaticamente o projeto Brain quando o projeto original não é mais acessível.
</plan_summary>
<plan_steps>
<plan_step>
Atualizar `adminFetch()` em `loveai-brain/index.ts` para tratar 403 da mesma forma que 401 — invalidar cache, tentar refresh do token e retry da requisição.
</plan_step>
<plan_step>
Na ação `chat`, quando o envio falhar com 403 após retry, marcar o brain project como `status: 'error'` e retornar um erro mais descritivo indicando que o projeto Brain precisa ser recriado.
</plan_step>
<plan_step>
Adicionar na ação `setup` a capacidade de recriar o projeto Brain quando o existente está com `status: 'error'` (deletando o registro antigo e criando um novo).
</plan_step>
<plan_step>
Fazer deploy da edge function atualizada e testar chamando o endpoint para verificar se o 403 é resolvido com refresh ou se o Brain é recriado automaticamente.
</plan_step>
</plan_steps>
