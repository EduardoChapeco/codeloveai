

## Plan: Free Master Launch (30 dias) + UI Overhaul

### 1. Create "Free Master" plan in DB & update auto-onboard
- Create a new plan "Free Master" (30 days, unlimited messages, daily_message_limit=NULL, is_public=true, is_active=true)
- Link Speed extension to this new plan via `plan_extensions`
- Update `auto-onboard` edge function to use the new "Free Master" plan instead of the old "Grátis" (10msg/day)
- Set expires_at to 30 days from activation (not 100 years)
- Add `is_promotional` flag to plan so admin can deactivate it globally

### 2. Rename Community to "CodeLovers" & make it the default landing
- Update sidebar: rename "Comunidade" → "CodeLovers", move to first position in mainItems
- Update `MobileBottomNav` to put CodeLovers first
- Update `Index.tsx` so authenticated users redirect to `/community` instead of showing Index
- Update all references to "Comunidade" → "CodeLovers"

### 3. Unify Install + Dashboard Extension panel
- Merge the extension download/install step-by-step from `Install.tsx` into the Dashboard page as a unified section
- Remove the separate "Instalar" sidebar item (or redirect to dashboard)
- Remove access gate from Install page (everything is free now)

### 4. Sidebar: move "Painel" above "Assistente" button in footer
- Reorder sidebar: Dashboard link stays at top but also appears as pinned item above the Assistente button in the footer section
- Remove `useHasActiveAccess` gates throughout (everything is open)

### 5. Design improvements
- Clean up warning banners on Dashboard (remove credit warnings, upgrade CTAs for free users)
- Update hero/landing to reflect "30 dias grátis, tudo liberado" messaging
- Ensure Editor, Orchestrator pages don't gate on plan access

### 6. Admin kill switch
- Add admin action in AdminGlobal to deactivate the "Free Master" plan and mass-expire all associated licenses

