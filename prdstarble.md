# PRD — Starble Design System Refactoring
## "White Dev-First" Migration Plan

| Campo | Valor |
|-------|-------|
| Versão | 1.0.0 |
| Data | Março 2026 |
| Status | PLANEJAMENTO |
| Escopo | Redesign visual completo — sem alteração funcional |
| Referências | AbacatePay · Firecrawl · Vercel · Resend · Neon |

---

## ÍNDICE

1. Diagnóstico do Estado Atual
2. Visão do Novo Design System
3. Mapeamento de Tokens — De → Para
4. Plano de Refatoração por Camada
5. Inventário Completo de Páginas & Componentes
6. Especificação dos Novos Componentes CSS
7. Plano de Migração por Fase
8. Regras de Preservação
9. Checklist de Validação

---

## 1. Diagnóstico do Estado Atual

### 1.1 Design System Atual: "Liquid Glass Dark v3"

O Starble opera atualmente com um design system chamado **Liquid Glass Dark**, caracterizado por:

| Aspecto | Estado Atual |
|---------|-------------|
| **Base cromática** | Fundo preto (#060606–#111111), texto branco (#f2f2f2) |
| **Superfícies** | Glassmorphism pesado — `backdrop-filter: blur(30px) saturate(200%)` |
| **Bordas** | `rgba(255,255,255,0.07–0.16)` — bordas de alfa branco |
| **Botões (.gl)** | Glass buttons com gradientes, shimmer animation, box-shadow multi-layer |
| **Cards (.rd-card)** | Fundo `var(--bg-2)` (#111111), borda `var(--b1)`, border-radius 16px |
| **Cores de acento** | Múltiplas: orange, blue, purple, green, red, teal, pink, indigo |
| **Tipografia** | Geist Sans/Mono, body 13px, headings com letter-spacing negativo |
| **Sombras** | Pesadas em dark mode: `rgba(0,0,0,0.4–0.65)` |
| **Animações** | Mesh gradients flutuantes, shimmer em botões, fade-up em entrada |
| **Layout** | Grid `#app-shell` com sidebar 220px + `#main` |

### 1.2 Arquivos de Design System

| Arquivo | Linhas | Conteúdo |
|---------|--------|----------|
| `src/index.css` | ~960 | Tokens raiz (:root/.dark), keyframes, componentes lv-*, clf-* |
| `src/styles/redesign.css` | ~1288 | Grid layout, sidebar, topbar, buttons .gl, chips, pages, chat, community, brain, toast, responsive |
| `tailwind.config.ts` | ~138 | Extend colors (shadcn HSL tokens), keyframes, animations |

### 1.3 Sistemas de Classes Sobrepostos (Dívida Técnica)

O projeto acumulou **4 sistemas de classes** ao longo do tempo:

1. **`lv-*`** — Liquid Glass v1 (lv-card, lv-btn-primary, lv-heading-xl, etc.)
2. **`clf-*`** — CLF Design System (clf-glass, clf-tab, clf-dot, etc.)
3. **`rd-*`** — Redesign v2 (rd-card, rd-heading, rd-grid-3, rd-ico-box, etc.)
4. **`.gl`** — Glass Buttons (gl, gl.primary, gl.ghost, gl.blue, etc.)
5. **Shadcn/Tailwind** — Classes utilitárias padrão (bg-primary, text-foreground, etc.)

**Problema**: Páginas misturam esses sistemas inconsistentemente. A migração deve consolidar tudo em **um único sistema**.

### 1.4 Anti-padrões Identificados no Design Atual

| Anti-padrão | Ocorrência |
|-------------|-----------|
| ✗ Glassmorphism pesado em todos os elementos | Cards, navs, modais, inputs |
| ✗ Backdrop-filter em cascata (performance) | 3–5 layers de blur simultâneos |
| ✗ Múltiplas cores de acento sem hierarquia | 8 cores de acento com peso visual igual |
| ✗ Mesh gradients animados no background | MeshBackground.tsx com 2 orbs animados |
| ✗ Botões com shimmer animation automático | `.gl::after` com translateX animation |
| ✗ Sombras exageradas em dark mode | `box-shadow: 0 8px 40px rgba(0,0,0,0.65)` |
| ✗ Border-radius inconsistente | 4px a 24px sem regra clara |

---

## 2. Visão do Novo Design System

### 2.1 Filosofia: "Utility over Decoration"

**De**: Dark glassmorphism com efeitos visuais pesados
**Para**: Clean white dev-first com precisão tipográfica

### 2.2 Mudanças Fundamentais

| Dimensão | ANTES (Liquid Glass) | DEPOIS (White Dev-First) |
|----------|---------------------|--------------------------|
| Background | #060606 (preto absoluto) | #FFFFFF / #FAFAFA (branco limpo) |
| Texto | #f2f2f2 (branco) | #09090B (preto) |
| Bordas | rgba(255,255,255,0.07) | #E4E4E7 (cinza sólido) |
| Superfícies | Glassmorphism + blur | Sólido com bordas sutis |
| Botão primário | Glass gradient branco | #18181B sólido (quase preto) |
| Acento | 8 cores vibrantes | 1 cor de marca (parcimônia) |
| Sombras | Pesadas, multi-layer | Mínimas: `0 1px 3px rgba(0,0,0,0.06)` |
| Border-radius | 12–24px variável | 6–12px consistente |
| Animações | Mesh orbs, shimmer | Fade-up sutil, hover border |
| Font size body | 13px | 14–16px |
| Letter-spacing H1 | -0.03em | -0.02em a -0.04em |
| Dark mode | Padrão (always dark) | Light é padrão, dark como toggle |

### 2.3 Os Quatro Pilares

| Pilar | Definição | Manifestação no Starble |
|-------|-----------|------------------------|
| **Precisão** | Cada pixel tem intenção | Grid de 1200px, spacing base 4px |
| **Hierarquia** | O olho sabe para onde ir | H1 bold 48px vs body 16px regular |
| **Velocidade** | Usuário entende em 3s | Hero direto, CTAs claros |
| **Confiança** | Parece feito por engenheiros | Sem stock photos, números reais |

### 2.4 Regra dos 60-30-10

```
60%  Branco (#FFFFFF, #FAFAFA)  → Backgrounds, espaço em branco
30%  Cinza (#E4E4E7 → #71717A) → Borders, texto secundário, cards
10%  Preto (#09090B, #18181B)   → Títulos, botão primário, logo
<1%  Cor da marca               → Apenas em elementos de identidade
```

---

## 3. Mapeamento de Tokens — De → Para

### 3.1 CSS Custom Properties — Nova Definição

```css
:root {
  /* ── Backgrounds ── */
  --background: 0 0% 100%;           /* #FFFFFF — página principal */
  --foreground: 0 0% 4%;             /* #09090B — texto principal */
  --card: 0 0% 100%;                 /* #FFFFFF */
  --card-foreground: 0 0% 4%;
  --popover: 0 0% 100%;
  --popover-foreground: 0 0% 4%;
  
  /* ── Primary: quase preto ── */
  --primary: 0 0% 9%;                /* #18181B — botão primário */
  --primary-foreground: 0 0% 100%;   /* #FFFFFF */
  
  /* ── Secondary ── */
  --secondary: 0 0% 96%;             /* #F4F4F5 */
  --secondary-foreground: 0 0% 9%;
  
  /* ── Muted ── */
  --muted: 0 0% 96%;                 /* #F4F4F5 */
  --muted-foreground: 0 0% 45%;      /* #71717A */
  
  /* ── Accent (igual secondary) ── */
  --accent: 0 0% 96%;
  --accent-foreground: 0 0% 9%;
  
  /* ── Destructive ── */
  --destructive: 0 84% 60%;          /* #DC2626 */
  --destructive-foreground: 0 0% 100%;
  
  /* ── Borders & Input ── */
  --border: 0 0% 90%;                /* #E4E4E7 */
  --input: 0 0% 90%;
  --ring: 0 0% 9%;
  --radius: 0.5rem;                  /* 8px base */
  
  /* ── Sidebar (mantém estrutura) ── */
  --sidebar-background: 0 0% 100%;
  --sidebar-foreground: 0 0% 25%;
  --sidebar-primary: 0 0% 9%;
  --sidebar-primary-foreground: 0 0% 100%;
  --sidebar-accent: 0 0% 96%;
  --sidebar-accent-foreground: 0 0% 25%;
  --sidebar-border: 0 0% 90%;
  --sidebar-ring: 0 0% 9%;
  
  /* ── Surfaces (novo) ── */
  --surface-1: #FFFFFF;
  --surface-2: #FAFAFA;
  --surface-3: #F4F4F5;
  
  /* ── Text hierarchy ── */
  --text-primary: #09090B;
  --text-secondary: #374151;
  --text-muted: #71717A;
  --text-disabled: #A1A1AA;
  
  /* ── Borders ── */
  --border-default: #E4E4E7;
  --border-subtle: #F4F4F5;
  --border-strong: #D1D5DB;
  
  /* ── Code ── */
  --code-bg: #F9FAFB;
  --code-border: #E5E7EB;
  --code-text: #1F2937;
  
  /* ── Shadows ── */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.06);
  --shadow-md: 0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04);
  --shadow-lg: 0 4px 12px rgba(0,0,0,0.06), 0 12px 32px rgba(0,0,0,0.08);
  
  /* ── Spacing (base 4px) ── */
  --s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px;
  --s6: 24px; --s8: 32px; --s12: 48px; --s16: 64px;
  --s24: 96px; --s32: 128px;
  
  /* ── Border Radius ── */
  --r-badge: 6px;
  --r-button: 8px;
  --r-card: 12px;
  --r-code: 8px;
  --r-modal: 16px;
  --r-full: 9999px;
  
  /* ── Font ── */
  --font: 'Geist', 'Inter', system-ui, sans-serif;
  --mono: 'Geist Mono', 'JetBrains Mono', monospace;
  
  /* ── Transitions ── */
  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);
  --duration-fast: 150ms;
  --duration-normal: 200ms;
}

/* ── DARK MODE (optional toggle) ── */
.dark {
  --background: 0 0% 4%;
  --foreground: 0 0% 96%;
  --card: 0 0% 7%;
  --card-foreground: 0 0% 96%;
  --popover: 0 0% 7%;
  --popover-foreground: 0 0% 96%;
  --primary: 0 0% 96%;
  --primary-foreground: 0 0% 4%;
  --secondary: 0 0% 11%;
  --secondary-foreground: 0 0% 60%;
  --muted: 0 0% 11%;
  --muted-foreground: 0 0% 45%;
  --accent: 0 0% 14%;
  --accent-foreground: 0 0% 60%;
  --destructive: 0 84% 60%;
  --destructive-foreground: 0 0% 100%;
  --border: 0 0% 15%;
  --input: 0 0% 15%;
  --ring: 0 0% 96%;
  --sidebar-background: 0 0% 5%;
  --sidebar-foreground: 0 0% 55%;
  --sidebar-primary: 0 0% 96%;
  --sidebar-primary-foreground: 0 0% 5%;
  --sidebar-accent: 0 0% 11%;
  --sidebar-accent-foreground: 0 0% 55%;
  --sidebar-border: 0 0% 15%;
  --sidebar-ring: 0 0% 96%;
  
  --surface-1: #09090B;
  --surface-2: #111113;
  --surface-3: #18181B;
  --text-primary: #FAFAFA;
  --text-secondary: #A1A1AA;
  --text-muted: #71717A;
  --text-disabled: #52525B;
  --border-default: #27272A;
  --border-subtle: #1E1E21;
  --border-strong: #3F3F46;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.4);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.5);
}
```

### 3.2 Token Migration Map

| Token Antigo | Token Novo | Motivo |
|-------------|-----------|--------|
| `--bg-0` (#060606) | `--surface-1` (#FFFFFF) | Base clara |
| `--bg-1` (#0c0c0c) | `--surface-2` (#FAFAFA) | Alternância de seção |
| `--bg-2` (#111111) | `--surface-1` (#FFFFFF) | Cards sobre fundo sutil |
| `--bg-3` (#191919) | `--surface-3` (#F4F4F5) | Inputs, hover |
| `--bg-4` (#222222) | `--border-default` (#E4E4E7) | Elementos de ênfase |
| `--b0` (rgba white 0.04) | `--border-subtle` (#F4F4F5) | Divisórias leves |
| `--b1` (rgba white 0.07) | `--border-default` (#E4E4E7) | Bordas padrão |
| `--b2` (rgba white 0.11) | `--border-strong` (#D1D5DB) | Bordas hover |
| `--text-primary` (#f2f2f2) | `--text-primary` (#09090B) | Inversão de cor |
| `--text-secondary` (#999999) | `--text-secondary` (#374151) | Mais contraste |
| `--text-tertiary` (#5c5c5c) | `--text-muted` (#71717A) | Labels, captions |
| `--text-quaternary` (#3d3d3d) | `--text-disabled` (#A1A1AA) | Desabilitados |
| `--orange` / `--blue` / etc. | **REMOVER** | Sem múltiplos acentos |
| `--liquid-glass-bg` | **REMOVER** | Sem glassmorphism |
| `--glass-*` | **REMOVER** | Sem glassmorphism |
| `--clf-*` | **REMOVER** | Consolidar em tokens únicos |

---

## 4. Plano de Refatoração por Camada

### 4.1 Camada 1: Tokens & Variables (`index.css :root`)

**Ação**: Substituir completamente as variáveis `:root` e `.dark` conforme seção 3.1.

**Remover**:
- Todos os tokens `--bg-0` a `--bg-5`, `--b0` a `--b3`
- Todos os tokens `--clf-*` (~40 variáveis)
- Todos os tokens `--liquid-glass-*`, `--glass-*`, `--mesh-*`
- Todas as cores de acento individuais (`--orange`, `--blue`, etc.)
- Todos os tokens `--er-*` (prefixed compat)

**Manter**:
- `--font` e `--mono` (já usa Geist)
- Structure de `--primary`, `--secondary`, etc. (shadcn compat)

### 4.2 Camada 2: Keyframes & Animations

**Remover**:
- `mesh-float-1`, `mesh-float-2` (mesh orbs)
- `clf-pulse`, `clf-pulse-blue` (pulse rings)
- `clf-dot` (typing dots complexos)
- `glass-shimmer` (shimmer nos botões)
- `lv-ping` (ping animation)

**Simplificar**:
- `fadeUp` → Manter, mas ajustar para `translateY(16px)` e `400ms`
- `fadeIn` → Manter como está

**Adicionar**:
```css
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes marquee {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}
```

### 4.3 Camada 3: Component Classes (`index.css @layer components`)

**Remover completamente** (~400 linhas):
- `.lv-mesh-bg`, `.clf-glass-nav`, `.clf-glass-modal`, `.clf-glass`, `.clf-glass-sm`, `.clf-liquid-glass`, `.clf-glass-sidebar`
- `.lv-nav-glass-btn`
- `.lv-card`, `.lv-card-sm`, `.lv-card-interactive`, `.lv-card-active`, `.lv-card-flat`, `.lv-card-accent`
- `.lv-btn-primary`, `.lv-btn-secondary`, `.lv-btn-accent`, `.lv-btn-danger`, `.lv-btn-ghost`, `.lv-btn-icon`
- `.lv-input`, `.lv-textarea`
- `.lv-badge`, `.lv-badge-*`
- `.lv-pill`, `.lv-pill-primary`
- `.lv-nav-item`, `.lv-nav-item-active`, `.lv-nav-item-inactive`
- `.lv-divider`, `.clf-section-label`
- `.clf-icon-wrap`, `.clf-icon-wrap-lg`, `.clf-app-icon`, `.clf-avatar`
- `.lv-empty`, `.lv-empty-icon`
- `.clf-typing-dot`
- `.clf-tabs`, `.clf-tab`, `.clf-tab-active`
- `.lv-glass-card`, `.lv-liquid-glass`, `.lv-stat-hud`, `.lv-project-card`
- `.lv-sheet-btn`
- Todas as classes `lv-heading-*`, `lv-body*`, `lv-label`, `lv-overline`, `lv-caption`, `lv-stat`, `lv-mono`
- Aliases tipográficos `title-xl`, `title-lg`, `title-md`, `label-lg`, `body-text`, `caption`, `caption-sm`, `sec-label`

### 4.4 Camada 4: Redesign CSS (`redesign.css`)

**Reestruturar completamente** — este é o arquivo principal do novo design system.

**Seções a reescrever**:

| Seção | Ação |
|-------|------|
| 1. Grid Layout (#app-shell) | Manter estrutura, atualizar cores |
| 2. Sidebar (#sidebar) | Fundo branco, bordas cinza, sem gradient |
| 3. Topbar (#topbar) | Sticky com blur, border condicional |
| 4. Glass Buttons (.gl) | **Substituir por botões sólidos** |
| 5. Chips/Badges (.chip) | Simplificar para monocromático |
| 6. Page System (.page) | Manter, atualizar cores |
| 7. Chat Styles | Recolorir para light |
| 8. Project Grid | Cards brancos com borda cinza |
| 9. Community Styles | Recolorir |
| 10. Star AI/Brain | Recolorir |
| 11. Toast System | Simplificar |
| 12–17. Resto | Recolorir |

### 4.5 Camada 5: Tailwind Config

**Atualizar `tailwind.config.ts`**:
- Remover keyframes de mesh, glass
- Adicionar `fadeInUp`, `marquee`
- Remover animations `mesh-*`, `glass-shimmer`

### 4.6 Camada 6: Componentes React

**Remover**:
- `src/components/MeshBackground.tsx` — substituir por fundo limpo ou grid de pontos sutil

**Atualizar** (todas as páginas — ver seção 5):
- Trocar classes `rd-card` → novo sistema
- Trocar `.gl` buttons → novos botões
- Trocar `.chip` → novos badges
- Trocar `rd-heading`, `rd-body`, `rd-label` → novas classes tipográficas
- Remover referências a cores de acento individuais

---

## 5. Inventário Completo de Páginas & Componentes

### 5.1 Páginas Públicas (sem auth)

| Rota | Arquivo | Complexidade | Notas |
|------|---------|-------------|-------|
| `/` | Index.tsx | 🔴 ALTA | Hero + benefits + plans + FAQ + footer. Usa .gl, .chip, .rd-* extensivamente |
| `/login` | Login.tsx | 🟡 MÉDIA | Form com lv-input ou rd-input |
| `/register` | Register.tsx | 🟡 MÉDIA | Form de cadastro |
| `/forgot-password` | ForgotPassword.tsx | 🟢 BAIXA | Form simples |
| `/reset-password` | ResetPassword.tsx | 🟢 BAIXA | Form simples |
| `/store` | MarketplaceLanding.tsx | 🔴 ALTA | Landing completa com hero, categorias, features, CTA |
| `/termos` | TermsOfUse.tsx | 🟢 BAIXA | Texto legal |
| `/afiliados` | AffiliateLanding.tsx | 🟡 MÉDIA | Landing pública |
| `/whitelabel` | WhiteLabelLanding.tsx | 🟡 MÉDIA | Landing pública |
| `/parceiros` | PartnersLanding.tsx | 🟡 MÉDIA | Landing pública |
| `/editor` | EditorLanding.tsx | 🟡 MÉDIA | Landing do editor |
| `/ref/:code` | AffiliateRefPage.tsx | 🟢 BAIXA | Redirect |
| `/wl/ref/:code` | WhiteLabelRefPage.tsx | 🟢 BAIXA | Redirect |
| `/extensoes/venus` | VenusPage.tsx | 🔴 ALTA | Landing complexa com hero, features, pricing |

### 5.2 Páginas Autenticadas (dentro do shell)

| Rota | Arquivo | Complexidade | Notas |
|------|---------|-------------|-------|
| `/home` `/dashboard` | Dashboard.tsx | 🔴 ALTA | Dashboard principal, stats, cards |
| `/lovable/projects` | LovableProjects.tsx | 🔴 ALTA | Grid de projetos (.proj-*) |
| `/ai` `/brain` | Brain.tsx | 🔴 ALTA | Chat brain, sidebar, modes |
| `/community` | Community.tsx | 🔴 ALTA | Feed social, sidebar, filters |
| `/marketplace` | Marketplace.tsx | 🟡 MÉDIA | Listing de produtos |
| `/marketplace/:slug` | MarketplaceDetail.tsx | 🟡 MÉDIA | Detalhe do produto |
| `/marketplace/vender` | MarketplaceSell.tsx | 🟡 MÉDIA | Form de venda |
| `/notes` | Notes.tsx | 🟡 MÉDIA | Editor de notas |
| `/plans` | PlansPage.tsx | 🟡 MÉDIA | Grid de planos |
| `/admin` | Admin.tsx | 🔴 ALTA | Painel admin multi-tab |
| `/admin/global` | AdminGlobal.tsx | 🔴 ALTA | Admin global multi-tab |
| `/admin/tenant` | TenantAdmin.tsx | 🟡 MÉDIA | Admin do tenant |
| `/admin/integrations` | AdminIntegrations.tsx | 🟡 MÉDIA | Configurações |
| `/admin/cloud` | LovableCloudAdmin.tsx | 🟡 MÉDIA | Cloud admin |
| `/admin/brainchain` | BrainchainAdmin.tsx | 🟡 MÉDIA | Brainchain admin |
| `/painel` | LovableConnect.tsx | 🟡 MÉDIA | Painel de conexão |
| `/profile/:userId` | Profile.tsx | 🟡 MÉDIA | Perfil do usuário |
| `/checkout` | Checkout.tsx | 🟡 MÉDIA | Checkout page |
| `/automation` | Automation.tsx | 🟡 MÉDIA | Automação rules |
| `/suporte` | SupportPage.tsx | 🟡 MÉDIA | Suporte |
| `/ajuda` | HelpCenter.tsx | 🟡 MÉDIA | Help center |
| `/ajuda/:slug` | HelpArticle.tsx | 🟢 BAIXA | Artigo individual |
| `/extensoes` | ExtensionStore.tsx | 🟡 MÉDIA | Loja de extensões |
| `/extensoes/:slug` | ExtensionDetail.tsx | 🟡 MÉDIA | Detalhe extensão |
| `/orquestrador` | OrchestratorPage.tsx | 🟡 MÉDIA | Orchestrator |
| `/orquestrador/:id` | OrchestratorProjectPanel.tsx | 🟡 MÉDIA | Projeto orch. |
| `/cirius/new` | CiriusNew.tsx | 🟡 MÉDIA | Novo projeto Cirius |
| `/cirius/project/:id` | CiriusProject.tsx | 🟡 MÉDIA | Projeto Cirius |
| `/cirius/integrations` | CiriusIntegrations.tsx | 🟡 MÉDIA | Integrações |
| `/cirius/editor/:id` | CiriusEditor.tsx | 🔴 ALTA | Editor completo (NÃO alterar funcionalidade) |
| `/afiliado/dashboard` | AffiliateDashboard.tsx | 🟡 MÉDIA | Dashboard afiliado |
| `/afiliados/painel` | AffiliatesPage.tsx | 🟡 MÉDIA | Painel afiliados |
| `/wl/afiliados` | WlAffiliateDashboard.tsx | 🟡 MÉDIA | WL dashboard |
| `/whitelabel/onboarding` | WhiteLabelOnboarding.tsx | 🟡 MÉDIA | Setup WL |
| `/faq/whitelabel` | WhiteLabelFAQ.tsx | 🟢 BAIXA | FAQ page |
| `/free` | FreePlan.tsx | 🟢 BAIXA | Ativação free |
| `/community/tests` | CommunityTestList.tsx | 🟡 MÉDIA | Lista de testes |
| `/community/test/:id` | CommunityTestSession.tsx | 🟡 MÉDIA | Sessão de teste |
| `/setup/evolution` | EvolutionSetupGuide.tsx | 🟢 BAIXA | Guia setup |
| `/lovable/preview` | LovablePreview.tsx | 🟢 BAIXA | Preview |
| `/lovable/upload-test` | LovableUploadTest.tsx | 🟢 BAIXA | Upload test |
| `/install` | Install.tsx | 🟢 BAIXA | Instalação |
| `/lovable-me-contrata` | LovableHireMe.tsx | 🟢 BAIXA | Hire page |

### 5.3 Lab Pages

| Rota | Arquivo | Complexidade |
|------|---------|-------------|
| `/lab/brain` | BrainLab.tsx | 🟡 MÉDIA |
| `/lab/starcrawl` | StarCrawlLab.tsx | 🟡 MÉDIA |
| `/lab/voice` | VoiceLab.tsx | 🟡 MÉDIA |
| `/lab/orchestrator` | OrchestratorLab.tsx | 🟡 MÉDIA |

### 5.4 Componentes de Layout

| Componente | Arquivo | Impacto |
|-----------|---------|---------|
| StarbleLayout | redesign/StarbleLayout.tsx | 🔴 Shell wrapper — atualizar dark class |
| StarbleSidebar | redesign/StarbleSidebar.tsx | 🔴 Sidebar completa |
| StarbleTopbar | redesign/StarbleTopbar.tsx | 🔴 Topbar |
| MobileBottomNav | MobileBottomNav.tsx | 🟡 Nav mobile |
| AppLayout | AppLayout.tsx | 🟡 Layout wrapper |
| AppSidebar | AppSidebar.tsx | 🟡 Sidebar legada |
| AppNav | AppNav.tsx | 🟡 Nav legada |
| MeshBackground | MeshBackground.tsx | 🔴 **REMOVER** |
| ChatPanel | chat/ChatPanel.tsx | 🟡 Chat floating |
| SupportChatPanel | chat/SupportChatPanel.tsx | 🟡 Support chat |

### 5.5 Componentes UI (shadcn)

Todos os componentes em `src/components/ui/` devem herdar os novos tokens automaticamente via CSS variables — **nenhuma edição necessária** se os tokens shadcn forem corretamente atualizados.

---

## 6. Especificação dos Novos Componentes CSS

### 6.1 Navbar (Topbar)

```css
#topbar {
  position: sticky;
  top: 0;
  z-index: 50;
  height: 60px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 24px;
  background: rgba(255,255,255,0.8);
  backdrop-filter: blur(12px) saturate(150%);
  -webkit-backdrop-filter: blur(12px) saturate(150%);
  border-bottom: 1px solid transparent;
  transition: border-color 200ms;
}
#topbar.scrolled {
  border-bottom-color: var(--border-default);
}
```

### 6.2 Botões (substituem .gl)

```css
/* Primary — quase preto */
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 36px;
  padding: 0 16px;
  border-radius: var(--r-button);
  font-size: 14px;
  font-weight: 500;
  background: #18181B;
  color: #FFFFFF;
  border: none;
  cursor: pointer;
  transition: background 150ms, transform 150ms;
  white-space: nowrap;
}
.btn-primary:hover { background: #09090B; transform: scale(0.98); }
.btn-primary:active { transform: scale(0.97); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary.lg { height: 44px; padding: 0 20px; }
.btn-primary.sm { height: 32px; padding: 0 12px; font-size: 12px; }

/* Ghost/Outline */
.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 16px;
  border-radius: var(--r-button);
  font-size: 14px;
  font-weight: 500;
  background: transparent;
  color: #18181B;
  border: 1px solid var(--border-default);
  cursor: pointer;
  transition: background 150ms, border-color 150ms;
}
.btn-ghost:hover { background: var(--surface-3); }

/* Destructive */
.btn-destructive {
  /* mesma estrutura de btn-primary */
  background: #DC2626;
  color: #FFFFFF;
}
.btn-destructive:hover { background: #B91C1C; }

/* Link */
.btn-link {
  color: #2563EB;
  text-decoration: none;
  font-weight: 500;
}
.btn-link:hover { text-decoration: underline; }
```

### 6.3 Cards

```css
.card {
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  border-radius: var(--r-card);
  padding: 24px;
  transition: border-color 200ms, box-shadow 200ms;
}
.card:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-md);
}
.card.interactive { cursor: pointer; }
.card.interactive:hover { transform: translateY(-2px); }
```

### 6.4 Badges

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  border-radius: var(--r-badge);
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
  background: var(--surface-3);
  color: var(--text-secondary);
  border: 1px solid var(--border-default);
}
.badge.dark {
  background: #18181B;
  color: #FFFFFF;
  border: none;
}
.badge.announcement {
  cursor: pointer;
  padding: 4px 12px;
  font-size: 13px;
}
.badge.announcement:hover { border-color: var(--border-strong); }
```

### 6.5 Inputs

```css
.input {
  height: 36px;
  padding: 0 12px;
  font-size: 14px;
  color: var(--text-primary);
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  border-radius: var(--r-button);
  outline: none;
  transition: border-color 150ms, box-shadow 150ms;
  width: 100%;
}
.input:focus {
  border-color: #18181B;
  box-shadow: 0 0 0 3px rgba(24,24,27,0.08);
}
.input::placeholder { color: var(--text-disabled); }
```

### 6.6 Sidebar

```css
#sidebar {
  background: var(--surface-1);
  border-right: 1px solid var(--border-default);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
/* Nav entries */
#sidebar .nav-entry {
  color: var(--text-muted);
  font-size: 14px;
  font-weight: 500;
  padding: 8px 12px;
  border-radius: var(--r-button);
  transition: background 150ms, color 150ms;
}
#sidebar .nav-entry:hover {
  background: var(--surface-3);
  color: var(--text-primary);
}
#sidebar .nav-entry.active {
  background: var(--surface-3);
  color: var(--text-primary);
  font-weight: 600;
}
```

### 6.7 Tipografia

```css
.heading-display { font-size: clamp(42px, 5vw, 64px); font-weight: 800; letter-spacing: -0.04em; color: var(--text-primary); line-height: 1.1; text-wrap: balance; }
.heading-1 { font-size: 48px; font-weight: 700; letter-spacing: -0.02em; color: var(--text-primary); line-height: 1.1; }
.heading-2 { font-size: 36px; font-weight: 700; letter-spacing: -0.02em; color: var(--text-primary); line-height: 1.1; }
.heading-3 { font-size: 28px; font-weight: 700; letter-spacing: -0.01em; color: var(--text-primary); line-height: 1.15; }
.heading-4 { font-size: 22px; font-weight: 600; color: var(--text-primary); line-height: 1.3; }
.body-lg { font-size: 18px; line-height: 1.6; color: var(--text-secondary); }
.body { font-size: 16px; line-height: 1.5; color: var(--text-secondary); }
.body-sm { font-size: 14px; line-height: 1.5; color: var(--text-muted); }
.caption { font-size: 12px; color: var(--text-muted); }
.overline { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); }
```

---

## 7. Plano de Migração por Fase

### Fase 0: Preparação (Estimativa: 2h)
- [ ] Criar branch `feat/white-design`
- [ ] Remover `document.documentElement.classList.add("dark")` de `StarbleLayout.tsx`
- [ ] Garantir que `<html>` NÃO tenha classe `dark` por padrão (light é o novo default)
- [ ] Adicionar toggle dark mode opcional (futuro)

### Fase 1: Tokens Foundation (Estimativa: 3h)
- [ ] Reescrever `:root` em `index.css` com novos tokens
- [ ] Reescrever `.dark` em `index.css`
- [ ] Remover **TODOS** os tokens legados (`--clf-*`, `--bg-0` a `--bg-5`, `--b0` a `--b3`, `--liquid-glass-*`, etc.)
- [ ] Atualizar `tailwind.config.ts` (remover mesh/glass keyframes)
- [ ] Verificar que shadcn components herdam cores corretas

### Fase 2: Componentes Base CSS (Estimativa: 4h)
- [ ] Remover todas as classes `lv-*`, `clf-*` de `index.css`
- [ ] Reescrever `redesign.css` seções 1–6 (grid, sidebar, topbar, buttons, badges, pages)
- [ ] Criar novos botões `.btn-primary`, `.btn-ghost`, `.btn-destructive`
- [ ] Criar novos cards `.card`
- [ ] Criar novos badges `.badge`
- [ ] Criar novos inputs `.input`
- [ ] Criar nova tipografia `.heading-*`, `.body-*`

### Fase 3: Layout Shell (Estimativa: 2h)
- [ ] Atualizar `StarbleSidebar.tsx` — cores brancas, bordas cinza
- [ ] Atualizar `StarbleTopbar.tsx` — blur navbar, border scroll
- [ ] Atualizar `StarbleLayout.tsx` — remover dark class forcing
- [ ] Atualizar `MobileBottomNav.tsx`
- [ ] Remover `MeshBackground.tsx` (ou substituir por grid de pontos)

### Fase 4: Páginas Públicas (Estimativa: 6h)
- [ ] `Index.tsx` — Hero branco, tipografia pesada, badges monocromáticos
- [ ] `Login.tsx` / `Register.tsx` — Forms limpos
- [ ] `ForgotPassword.tsx` / `ResetPassword.tsx`
- [ ] `MarketplaceLanding.tsx` — Hero + categorias + features
- [ ] `VenusPage.tsx` — Landing completa
- [ ] `EditorLanding.tsx`
- [ ] `AffiliateLanding.tsx` / `WhiteLabelLanding.tsx`
- [ ] `PartnersLanding.tsx`
- [ ] `TermsOfUse.tsx`

### Fase 5: Páginas Autenticadas — Core (Estimativa: 8h)
- [ ] `Dashboard.tsx` — Stats, cards de navegação
- [ ] `LovableProjects.tsx` — Grid de projetos
- [ ] `Brain.tsx` — Chat brain completo
- [ ] `Community.tsx` — Feed social
- [ ] `PlansPage.tsx` — Pricing grid
- [ ] `Marketplace.tsx` / `MarketplaceDetail.tsx` / `MarketplaceSell.tsx`
- [ ] `Notes.tsx`
- [ ] `Profile.tsx`

### Fase 6: Páginas Autenticadas — Admin & Secundárias (Estimativa: 6h)
- [ ] `Admin.tsx` / `AdminGlobal.tsx` — Painéis multi-tab
- [ ] `TenantAdmin.tsx`
- [ ] `AdminIntegrations.tsx` / `CiriusIntegrations.tsx`
- [ ] `LovableCloudAdmin.tsx` / `BrainchainAdmin.tsx`
- [ ] `Checkout.tsx` / `FreePlan.tsx`
- [ ] `Automation.tsx`
- [ ] `LovableConnect.tsx`
- [ ] `SupportPage.tsx` / `HelpCenter.tsx` / `HelpArticle.tsx`
- [ ] `ExtensionStore.tsx` / `ExtensionDetail.tsx`
- [ ] `AffiliateDashboard.tsx` / `AffiliatesPage.tsx` / `WlAffiliateDashboard.tsx`
- [ ] `WhiteLabelOnboarding.tsx` / `WhiteLabelFAQ.tsx`

### Fase 7: Páginas Especiais (Estimativa: 4h)
- [ ] `CiriusEditor.tsx` — Editor completo (preservar funcionalidade, recolorir)
- [ ] `CiriusNew.tsx` / `CiriusProject.tsx`
- [ ] `OrchestratorPage.tsx` / `OrchestratorProjectPanel.tsx`
- [ ] `CommunityTestList.tsx` / `CommunityTestSession.tsx`
- [ ] Lab pages (4 páginas)

### Fase 8: Componentes Compartilhados (Estimativa: 4h)
- [ ] `ChatPanel.tsx` — Chat flutuante
- [ ] `SupportChatPanel.tsx`
- [ ] `BrainTerminalChat.tsx`
- [ ] Admin components (AccessLogsPanel, CrmPanel, MemberDetailPanel, etc.)
- [ ] Cirius editor components (BottomIsland, SplitChatPanel, etc.)
- [ ] Orchestrator components

### Fase 9: QA & Polish (Estimativa: 3h)
- [ ] Testar todas as rotas
- [ ] Verificar responsive (375px, 768px, 1280px)
- [ ] Verificar contrast ratios (WCAG AA)
- [ ] Remover código CSS morto
- [ ] Performance: verificar que remoção de blur layers melhorou rendering

**Total estimado: ~42 horas de implementação**

---

## 8. Regras de Preservação

### 8.1 O que NÃO muda

| Item | Status |
|------|--------|
| Rotas (`App.tsx`) | ✅ Preservar 100% |
| Lógica de autenticação | ✅ Preservar 100% |
| Contextos (Auth, Tenant, Chat) | ✅ Preservar 100% |
| Hooks (useAuth, useFeatureFlag, etc.) | ✅ Preservar 100% |
| Edge Functions (supabase/functions/) | ✅ Preservar 100% |
| Database schema / RLS | ✅ Preservar 100% |
| Funcionalidade de cada página | ✅ Preservar 100% |
| Estrutura de sidebar/topbar/grid | ✅ Preservar estrutura |
| Componentes shadcn/ui | ✅ Herdam tokens automaticamente |
| Importações e dependências | ✅ Nenhuma nova dep necessária |

### 8.2 O que muda

| Item | Mudança |
|------|---------|
| CSS Variables (:root) | Paleta completa |
| Classes de componentes | Novas classes |
| Cores inline em JSX | Trocar por tokens |
| `className` em todos os componentes | Migrar para novo sistema |
| `style={{}}` com cores hardcoded | Trocar por tokens |
| MeshBackground | Remover |
| Dark mode forçado | Light como padrão |

### 8.3 Regra de Migração de Classes

| Classe Antiga | Classe Nova |
|--------------|-------------|
| `.gl` | `.btn-ghost` |
| `.gl.primary` | `.btn-primary` |
| `.gl.ghost` | `.btn-ghost` |
| `.gl.sm` | `.btn-ghost.sm` |
| `.gl.lg` | `.btn-primary.lg` ou `.btn-ghost.lg` |
| `.gl.blue` / `.gl.orange` / etc. | `.btn-primary` (sem variantes de cor) |
| `.rd-card` | `.card` |
| `.rd-heading` | `.heading-3` ou conforme contexto |
| `.rd-body` | `.body` ou `.body-sm` |
| `.rd-label` | `.overline` |
| `.rd-ico-box` | `.icon-box` |
| `.rd-grid-3` | `.grid-3` |
| `.rd-grid-4` | `.grid-4` |
| `.chip` | `.badge` |
| `.chip.indigo` | `.badge` (monocromático) |
| `.lv-card` | `.card` |
| `.lv-btn-primary` | `.btn-primary` |
| `.lv-input` | `.input` |
| `.lv-heading-xl` | `.heading-display` |
| `.clf-glass` | Remover (sem glass) |

---

## 9. Checklist de Validação

### Fundação
- [ ] Background da página é branco (#FFFFFF ou #FAFAFA)
- [ ] Texto principal é preto (#09090B)
- [ ] Bordas são cinza sólido (#E4E4E7)
- [ ] Sem `backdrop-filter: blur()` em cards
- [ ] Sem gradientes coloridos em nenhum elemento
- [ ] Sem sombras exageradas (max: `0 4px 12px rgba(0,0,0,0.08)`)
- [ ] Border-radius consistente: 6px badges, 8px buttons/inputs, 12px cards
- [ ] Geist Sans como font principal
- [ ] Body font-size: 14–16px (não 13px)
- [ ] Letter-spacing negativo em H1/H2

### Componentes
- [ ] Botão primário é #18181B (quase preto) com texto branco
- [ ] Botão ghost é transparente com borda #E4E4E7
- [ ] Cards são brancos com borda #E4E4E7, sem glassmorphism
- [ ] Badges são monocromáticos (fundo #F4F4F5, texto #374151)
- [ ] Inputs focados: border #18181B com ring sutil
- [ ] Navbar sticky com blur leve + border ao scroll
- [ ] Sidebar com fundo branco, bordas cinza

### Visual & Qualidade
- [ ] Sem mesh gradients animados
- [ ] Sem shimmer animations em botões
- [ ] Apenas fade-in-up como animação de entrada
- [ ] Hover em cards: border-color change + sombra sutil
- [ ] Responsive: mobile-first, testado em 375px, 768px, 1280px
- [ ] Sem código CSS morto (classes `lv-*`, `clf-*` removidas)
- [ ] Todas as páginas funcionando sem erros visuais

---

## Apêndice A: Class Migration Cheatsheet

```
ANTES                    →  DEPOIS
─────────────────────────────────────
.gl                      →  .btn-ghost
.gl.primary              →  .btn-primary
.gl.primary.lg           →  .btn-primary.lg
.gl.ghost                →  .btn-ghost
.gl.sm.ghost             →  .btn-ghost.sm
.gl.ico                  →  .btn-icon
.gl.blue / .orange / etc →  .btn-primary (sem cor)

.rd-card                 →  .card
.rd-card.interactive     →  .card.interactive
.rd-stat-card            →  .card (com stat content)
.rd-card-full            →  .card

.chip                    →  .badge
.chip.indigo             →  .badge
.chip.green              →  .badge

.rd-heading              →  .heading-3 (ou .heading-2 / .heading-4)
.rd-body                 →  .body-sm
.rd-label                →  .overline
.rd-ico-box              →  .icon-box
.rd-grid-2               →  .grid-2
.rd-grid-3               →  .grid-3
.rd-grid-4               →  .grid-4
.rd-input                →  .input
.rd-alert                →  .alert

.lv-card                 →  .card
.lv-btn-primary          →  .btn-primary
.lv-btn-secondary        →  .btn-ghost
.lv-btn-ghost            →  .btn-ghost (sem border)
.lv-input                →  .input
.lv-textarea             →  .input (textarea variant)
.lv-heading-xl           →  .heading-display
.lv-heading-lg           →  .heading-1
.lv-heading-md           →  .heading-3
.lv-body                 →  .body-sm
.lv-label                →  .overline
.lv-badge                →  .badge
.lv-pill                 →  .badge

.clf-glass               →  (remover)
.clf-glass-nav           →  (incorporado no #topbar)
.clf-tab                 →  .tab
.clf-section-label       →  .overline

MeshBackground           →  (remover componente)
```

---

*PRD Starble Design System Refactoring v1.0.0 — Março 2026*
