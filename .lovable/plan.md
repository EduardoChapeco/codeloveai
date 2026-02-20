

# CodeLove AI — Plano de Implementação

## Visão Geral
Plataforma completa para venda de acesso a uma extensão não oficial para Lovable. Design minimalista preto/branco, sem sombras, sem gradientes, com tipografia bold e border-radius arredondados conforme o design system fornecido.

---

## 1. Landing Page (`/`)
- **Hero Section** — Título impactante "A MELHOR PLATAFORMA DE ENVIOS INFINITOS" com subtítulo explicando: crie quantos projetos quiser, envie quantas mensagens quiser, 24/7 sem parar. CTA para ver planos.
- **Seção de Benefícios** — Cards minimalistas destacando: envios ilimitados, sem descontar créditos, funciona 24/7, método próprio de comunicação com a plataforma.
- **Seção de Planos** — 4 cards de preço:
  - 1 dia — R$9,99
  - 7 dias — R$49,90
  - 1 mês — R$149,90
  - 12 meses — R$499,00
  - Cada card com botão "ASSINAR" que redireciona para checkout Mercado Pago
- **Seção FAQ** — Perguntas frequentes sobre o funcionamento
- **Seção de Termos** — Disclaimers obrigatórios:
  - Venda de acesso à extensão, não ao Lovable
  - Extensão não oficial, sem vínculo com Lovable
  - Sem reembolso se extensão parar de funcionar
  - Serviço considerado entregue após envio e ativação do token
  - Risco de bloqueio/suspensão de conta é do cliente
  - Não utiliza créditos da conta Lovable
  - Checkbox obrigatório de concordância com os termos

---

## 2. Autenticação
- **Página de Login** (`/login`) — Email + senha, design minimalista
- **Página de Cadastro** (`/register`) — Nome, email, senha
- **Recuperação de senha** — Fluxo completo com página `/reset-password`

---

## 3. Área do Membro (`/dashboard`)
- **Visão geral** — Status da assinatura (ativo/expirado), dias restantes
- **Download da Extensão** — Botão para baixar o arquivo da extensão
- **Token de Ativação** — Exibição do token com botão de copiar
- **Histórico de Planos** — Planos adquiridos com datas

---

## 4. Painel Admin (`/admin`)
- **Lista de Membros** — Tabela com nome, email, plano, status, data de expiração
- **Gerenciar Membro** — Ativar/desativar, inserir token manualmente, definir plano e período de validade
- **Adicionar Membro** — Formulário inline para cadastrar membros manualmente

---

## 5. Backend (Supabase/Lovable Cloud)
- **Tabelas**: profiles, user_roles, subscriptions (plano, datas, status), tokens
- **RLS**: Membros veem apenas seus dados; admins acessam tudo via função `has_role`
- **Edge Function**: Webhook do Mercado Pago para ativar assinatura automaticamente após pagamento

---

## 6. Integração Mercado Pago
- Edge function para criar preferência de pagamento
- Webhook para receber notificação de pagamento aprovado e ativar o plano do membro
- Redirecionamento pós-pagamento para o dashboard

---

## Design
- Fundo branco puro, texto preto, sem sombras, sem gradientes, sem rounded-full
- Tipografia Inter, títulos font-black italic uppercase tracking-tighter
- Cards com `rounded-[48px]`, botões com `rounded-[24px]`
- Todas as cores via tokens semânticos HSL
- Micro-interações com `active:scale-95` e `hover:border-foreground`

