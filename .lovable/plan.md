
## Plano: Propagação Global do Design + Correções Críticas

### Problemas Identificados

1. **Fonte errada**: Sistema usa SF Pro/system-ui, mas usuário quer **Inter** (estilo Threads/Meta)
2. **"LoveAI Brain" no sidebar** (AppSidebar.tsx linha 152): Deveria ser **"Star AI"**
3. **Automação visível**: Aparece no sidebar para todos — deveria estar oculta
4. **Star AI (Brain page) quebrada**: O fluxo inicial (verificação de status via `loveai-brain` edge function) pode falhar silenciosamente, deixando a página em loading infinito. O `brainActive` fica `null` e nunca sai do spinner
5. **Cantos retos em alguns cards**: Cards usando classes legadas (`Card` shadcn) ou `rounded-lg` em vez de `rounded-[18px]`/`rounded-2xl`
6. **Ícones**: Migrar para estilo mais limpo (Threads/Meta) — usar variantes `strokeWidth={1.5}` nos ícones Lucide

---

### Correções

#### Fase 1 — Fonte Inter
- Adicionar `<link>` do Google Fonts para **Inter** no `index.html`
- Atualizar `src/index.css` body font-family para `"Inter", -apple-system, ...`

#### Fase 2 — Sidebar: Renomear + Ocultar Automação
- `AppSidebar.tsx` linha 152: `"LoveAI Brain"` → `"Star AI"`
- `AppSidebar.tsx` linha 155: Remover `{ to: "/automation", label: "Automação", icon: Workflow }` do `mainItems`

#### Fase 3 — Star AI (Brain) — Corrigir fluxo inicial
- `Brain.tsx` linha 73: O hook `useFeatureFlag` está bypassado com hardcode `{ enabled: true, loading: false }` — restaurar para usar o hook real
- Adicionar fallback de erro no `checkBrainStatus` para que, se a função falhar, mostre o botão "Ativar Star AI" em vez de loading infinito
- Renomear todas as referências visuais de "LoveAI Brain" → "Star AI" na página

#### Fase 4 — Cantos arredondados globais
- `src/components/ui/card.tsx`: `rounded-[18px]` já existe ✅
- Auditar páginas que usam `rounded-lg` ou `rounded-md` em cards/containers e trocar por `rounded-2xl` ou `rounded-[18px]`
- Páginas a verificar: `Checkout.tsx`, `Install.tsx`, `LovableProjects.tsx`, `Admin.tsx`, `Automation.tsx`

#### Fase 5 — Ícones estilo Threads
- Adicionar classe global `.lv-icon` com `strokeWidth: 1.5` no CSS
- Aplicar nos componentes principais (sidebar, dashboard, header)

---

### Arquivos Afetados
- `index.html` (fonte Inter)
- `src/index.css` (font-family, ícones)
- `src/components/AppSidebar.tsx` (rename + hide automation)
- `src/pages/Brain.tsx` (fix flow + rename)
- `src/pages/Checkout.tsx` (cantos)
- `src/pages/Install.tsx` (cantos)
- `src/pages/LovableProjects.tsx` (cantos)
- `.lovable/tasks/1772010000000-task.md` (task file)
