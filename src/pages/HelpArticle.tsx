import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, AlertTriangle } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Article content map — Technical but user-safe (no internal secrets)
const ARTICLES: Record<string, { title: string; category: string; content: string }> = {
  "primeiros-passos": {
    title: "Primeiros Passos com o Starble",
    category: "Começando",
    content: `## Bem-vindo ao Starble

O Starble é uma plataforma de automação e inteligência para criadores de projetos digitais.

### 1. Instale a Extensão Chrome

Acesse **/install** e siga as instruções. A extensão Chrome é o núcleo da experiência Starble — ela habilita a integração com as ferramentas de criação de projetos e enriquece seu fluxo de trabalho.

**Requisitos mínimos:**
- Chrome 120+ (ou Chromium-based: Edge, Brave, Arc)
- Conta Starble ativa

### 2. Crie sua Conta

Acesse **/register** gratuitamente. Você recebe **10 mensagens gratuitas** para explorar a plataforma sem compromisso.

### 3. Configure seu Perfil

Em **/profile**, adicione nome, foto e configure preferências de notificação.

### 4. Dashboard

Seu painel em **/dashboard** centraliza:
- Status da extensão e conexão
- Uso de mensagens e plano atual
- Atalhos para todas as ferramentas

> **Recomendação importante**: Para projetos que você planeja colocar em produção, é fundamental manter uma cópia do código no GitHub e usar Supabase externo para dados críticos. Veja os artigos de boas práticas para mais detalhes.`,
  },
  "extensao-chrome": {
    title: "Usando a Extensão Chrome",
    category: "Extensão",
    content: `## Extensão Chrome — Guia Completo

A extensão Starble enriquece e monitora seu fluxo de trabalho.

### Instalação
1. Acesse **/install** na plataforma
2. Clique em "Instalar Extensão"
3. Na Chrome Web Store, clique em "Adicionar ao Chrome"
4. Confirme as permissões

### Primeiro Uso
Após instalar, clique no ícone da extensão (barra superior do Chrome) e faça login com suas credenciais Starble.

### Funcionalidades
- **Assistência contextual**: sugestões baseadas no que você está fazendo
- **Captura de contexto**: salva sessões importantes automaticamente
- **Atalhos rápidos**: acesso rápido às ferramentas pela extensão

### Troubleshooting
| Problema | Solução |
|---|---|
| Extensão não conecta | Faça logout e login novamente |
| HWID inválido | Verifique em /profile se seu dispositivo está registrado |
| Extensão desatualizada | Acesse chrome://extensions e clique em "Atualizar" |

Se o problema persistir, **abra um ticket** em /suporte com o log de erro.`,
  },
  "seguranca-boas-praticas": {
    title: "Segurança e Boas Práticas",
    category: "Segurança",
    content: `## Segurança ao Usar o Starble

### Proteja suas Credenciais
- **Nunca compartilhe** sua senha com ninguém — nem com o suporte Starble (não solicitamos senhas)
- Use senhas únicas e complexas (16+ caracteres)
- Ative 2FA em todas as contas vinculadas

### Boas Práticas para seus Projetos

#### 1. Mantenha Backup no GitHub
Projetos criados em plataformas de desenvolvimento *em nuvem* podem estar sujeitos a:
- Mudanças nos termos de serviço do provedor
- Instabilidades ou interrupções do serviço
- Remoção acidental de projetos

**Recomendação**: conecte todos os projetos a um repositório GitHub de sua propriedade. Isso garante que você sempre terá acesso ao código, independentemente do que aconteça com qualquer plataforma.

#### 2. Use Supabase Externo para Dados Críticos
Para projetos em produção com dados reais de usuários, utilize seu próprio projeto Supabase:
- Controle total dos dados e das políticas de acesso
- Independência de integrações de terceiros
- Conformidade com LGPD mais fácil de garantir

#### 3. Backup Regular do Banco de Dados
O Supabase oferece a funcionalidade de **export completo do banco**. Recomendamos:
- Backup semanal para projetos ativos
- Backup diário para projetos em produção com dados críticos

#### 4. Riscos de Integrações
O Starble utiliza integrações que podem ser afetadas por:
- Mudanças de API de terceiros
- Limites de uso ou suspensão de contas de terceiros
- Atualizações que modifiquem comportamentos esperados

Ao usar funcionalidades experimentais (Lab), mantenha expectativas calibradas e sempre tenha planos alternativos.

### Em Caso de Incidente
Se suspeitar de acesso não autorizado à sua conta:
1. Mude sua senha imediatamente
2. Revogue tokens de acesso em /profile
3. Abra um ticket urgente em /suporte`,
  },
  "planos-limites": {
    title: "Planos e Limites de Uso",
    category: "Planos",
    content: `## Planos Starble

### Plano Gratuito (Free Trial)
- **10 mensagens** para explorar a plataforma
- Acesso ao dashboard e extensão
- Sem necessidade de cartão de crédito

### Planos Pagos
Consulte **/precos** para valores e limites atualizados. Os planos diferem em:
- Número de mensagens diárias/mensais
- Acesso a funcionalidades Lab (quando disponíveis)
- Suporte prioritário

### Como o Sistema de Mensagens Funciona
- Cada interação com assistentes de IA conta como **1 mensagem**
- O limite é resetado diariamente à meia-noite (horário de Brasília)
- Usuários com plano **Master/Admin** têm acesso ilimitado

### Upgrade de Plano
1. Acesse **/precos** ou **/checkout**
2. Selecione o plano desejado
3. Complete o pagamento
4. Seu limite é atualizado instantaneamente

### Reembolsos
Consulte nossa política em /termos — seção "Política de Reembolso".`,
  },
  "white-label-guia": {
    title: "White Label — Guia para Operadores",
    category: "White Label",
    content: `## Starble White Label — Guia Operacional

### O que é o Programa White Label?
O White Label permite lançar a plataforma Starble com sua própria marca: logo, cores, domínio customizado e planos personalizados para seus clientes.

### Configuração Inicial
1. Acesse **/whitelabel/onboarding**
2. Configure: nome da empresa, logo (PNG/SVG), paleta de cores
3. Configure domínio personalizado no seu provedor DNS
4. Publique e comece a onboarding dos seus clientes

### Gestão de Usuários (Tenant Admin)
Como operador, em **/admin/tenant** você pode:
- Criar e gerenciar usuários do seu tenant
- Definir limites de plano por usuário
- Visualizar relatórios de uso

### Suporte Hierárquico
**Seus clientes → Você** (problemas de uso, configuração, billing)  
**Você → Starble** (problemas de plataforma, infraestrutura, bugs)

Para escalar um problema técnico para o Starble, abra um ticket em **/suporte** com a categoria "White Label".

### Programa de Afiliados para WL Operators
Como operador White Label, você pode configurar um programa de afiliados próprio para seus clientes. Acesse o painel em **/admin/tenant** > Afiliados.

### Responsabilidades do Operador
- Você é responsável pelo suporte de primeiro nível dos seus usuários
- Conformidade com LGPD para dados coletados pelo seu tenant
- Manutenção dos pagamentos e faturamento dos seus clientes
- Comunicação de mudanças de plataforma para seus usuários`,
  },
  "backups-recomendacoes": {
    title: "Backups e Boas Práticas de Projeto",
    category: "Segurança",
    content: `## Por que Backups são Essenciais?

O Starble trabalha com integrações com plataformas de criação de projetos e banco de dados. Dada a natureza das integrações, recomendamos fortemente:

### Backup do Código-Fonte (GitHub)
Todo projeto deve ter seu código sincronizado com GitHub:

\`\`\`
1. Acesse as configurações do seu projeto
2. Conecte ao GitHub e autorize o acesso
3. Configure sincronização automática (recomendado)
\`\`\`

**Por quê isso é crítico:**
- Plataformas de nuvem podem ter interrupções, mudanças de política ou encerrar serviços
- Com o código no GitHub, você pode hospedar seu projeto em qualquer outra plataforma
- Facilita colaboração com outros desenvolvedores
- Histórico de versão completo e rollback rápido

### Backup do Banco de Dados (Supabase)

Se você usa Supabase para seu projeto:

1. Acesse o dashboard do Supabase
2. Vá em **Project Settings > Database**
3. Use a opção de **Database Backups** (disponível em planos pagos)
4. Para export manual: **Table Editor > Export as CSV** ou SQL

**Frequência recomendada:**
- Projetos em desenvolvimento: semanal
- Projetos em produção: diário

### Supabase Externo vs. Integrado
Para projetos que vão para produção real, recomendamos usar um projeto Supabase **próprio** (não o integrado pela plataforma de criação). Isso garante:

- Controle total dos dados
- Conformidade com LGPD/privacidade
- Portabilidade — migre sem depender de terceiros
- Melhor performance configurável`,
  },
  "afiliados-como-funciona": {
    title: "Programa de Afiliados — Como Funciona",
    category: "FAQ",
    content: `## Programa de Afiliados Starble

### Como me tornar afiliado?
1. Crie ou acesse sua conta em **/login**
2. Acesse seu **Dashboard** e clique em "Programa de Afiliados"
3. Aceite os termos e copie seu link único

### Como funciona a comissão?
- **Starter (0-5 indicações/mês):** 15%
- **Pro (6-20 indicações/mês):** 22%
- **Elite (21+ indicações/mês):** 30%

A comissão é calculada sobre o valor líquido pago pelo cliente indicado.

### Quando recebo?
Pagamentos são processados mensalmente, entre os dias 10 e 15. Mínimo para saque: **R$100**.

### Por quanto tempo recebo?
Enquanto o cliente indicado mantiver a assinatura ativa.

### O que não é permitido?
- Indicar a si mesmo (autoindicação) → **banimento do programa**
- Spam ou práticas desonestas de captação
- Uso de marca Starble sem autorização prévia

Para dúvidas específicas, consulte os Termos de Uso em **/termos** ou abra um ticket.`,
  },
  "labs-acesso": {
    title: "Starble Labs — Acesso e Restrições",
    category: "Labs",
    content: `## Starble Labs — Quem pode acessar?

### O que é o Starble Labs?
O Starble Labs reúne funcionalidades experimentais avançadas como **Orchestrator Engine** (criação autônoma de projetos) e **StarCrawl** (extração inteligente de conteúdo web).

### Acesso Exclusivo para White Label
As funcionalidades do Labs são **exclusivas para proprietários de White Label** (role: \`tenant_owner\`). Isso significa:

- **Proprietários White Label**: Acesso total a todas as funcionalidades Labs
- **Usuários comuns**: Podem visualizar as páginas informativas, mas **não podem utilizar** as funcionalidades, independente do plano contratado
- **Admins de tenant**: Não têm acesso — apenas o proprietário do tenant

### Por que essa restrição?
As funcionalidades Labs consomem recursos significativos de infraestrutura e são projetadas para operadores que gerenciam múltiplos usuários e projetos.

### Como obter acesso?
1. Contrate um plano White Label em **/whitelabel/onboarding**
2. Complete a configuração do seu tenant
3. As funcionalidades Labs serão desbloqueadas automaticamente

### Extensões e Planos
Cada extensão é vinculada a planos específicos pelo administrador master. A permissão de acesso é controlada pela tabela \`plan_extensions\` — nenhum tenant pode publicar extensões, apenas o admin master faz upload das extensões pelo painel administrativo.`,
  },
  "modulos-extras": {
    title: "Módulos Extras e Cobrança",
    category: "Planos",
    content: `## Módulos Extras — Como funciona?

### O que são módulos?
O sistema Starble é composto por módulos que podem ser ativados ou desativados pelo administrador master: Chat AI, Deploy, Preview, Notas, Split View, Automação, White Label, Afiliados e Comunidade.

### Controle hierárquico
Os módulos seguem uma hierarquia de controle:
1. **Admin Global (Master)** — Define quais módulos existem e seus preços base
2. **Tenant** — O admin master pode habilitar/desabilitar módulos por tenant
3. **Plano** — Os planos determinam quais módulos o usuário final acessa

### Modelos de cobrança
O admin master pode configurar diferentes modelos por módulo:
- **Gratuito** — Incluído sem custo adicional
- **Por usuário** — Cobrado por cada usuário ativo no tenant
- **Por mensagem** — Cobrado por mensagem enviada
- **Taxa fixa** — Valor fixo mensal por tenant

### Quem pode gerenciar?
Apenas o **admin master** pode:
- Criar e editar módulos no catálogo
- Definir preços e modelos de cobrança
- Ativar/desativar módulos por tenant

Tenants **não podem** criar ou modificar módulos — apenas utilizar os que foram habilitados para eles.`,
  },
};

export default function HelpArticle() {
  const { slug } = useParams<{ slug: string }>();
  const article = slug ? ARTICLES[slug] : null;

  if (!article) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto px-6 py-24 text-center">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Artigo não encontrado</h1>
          <p className="text-muted-foreground text-sm mb-6">Este artigo não existe ou foi movido.</p>
          <Link to="/ajuda" className="text-primary hover:underline text-sm">← Voltar à Central de Ajuda</Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-8">
          <Link to="/ajuda" className="hover:text-foreground transition-colors flex items-center gap-1">
            <BookOpen className="h-3.5 w-3.5" /> Central de Ajuda
          </Link>
          <span>/</span>
          <span className="text-foreground">{article.category}</span>
        </div>

        <Link to="/ajuda" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        <h1 className="text-2xl font-bold mb-8">{article.title}</h1>

        <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {article.content}
          </ReactMarkdown>
        </div>

        {/* Help footer */}
        <div className="mt-16 p-6 rounded-xl bg-muted/30 border border-border/60">
          <p className="text-sm font-medium mb-1">Este artigo foi útil?</p>
          <p className="text-xs text-muted-foreground mb-4">Se não encontrou o que precisava, abra um ticket e nossa equipe irá te ajudar.</p>
          <Link to="/suporte" className="text-xs text-primary hover:underline">Abrir Ticket de Suporte →</Link>
        </div>
      </div>
    </AppLayout>
  );
}
