
# CodeLove AI - Complete Implementation Plan

## Overview
This plan implements the full CodeLove AI platform evolution across 8 modules: migrating from Cloudflare to backend functions, evolving the database schema, redesigning the landing page, building White Label onboarding, tenant dashboard, user dashboard with affiliates, Chrome extension branding, and Mercado Pago webhook/checkout integration.

## Current State Assessment

**Already implemented:**
- `validate-license` edge function (similar to validate-hwid but missing `dailyMessages`, `type`, `tenantId` fields)
- `generate-clf-token` edge function (CLF1 token generation with HMAC-SHA256)
- `validate` edge function (CLF1 token validation with rate limiting)
- `mercadopago-webhook` edge function (payment processing with tenant splits)
- `send-message`, `send-security-fix`, `send-seo-fix`, `download-project`, `publish-project` edge functions
- Multi-tenant architecture with `tenants`, `licenses`, `affiliates`, `tenant_users` tables
- Auth system with registration, login, dashboard
- Basic landing page and checkout page with Mercado Pago PIX integration

**Missing / Needs creation:**
- `daily_usage` table and usage tracking
- Several columns on `licenses` (plan_type, daily_messages, hourly_limit, affiliate_id)
- Several columns on `tenants` (status, domain, mp_access_token, plan_type, branding jsonb)
- Several columns on `affiliates` (commission_rate, total_earned, referral_code)
- `transactions` table (does not exist)
- `validate-hwid` edge function (new, replaces Cloudflare Worker)
- `get-user-context` edge function
- `increment-usage` edge function
- `process-wl-setup` edge function
- `create-mp-preference` edge function
- `mp-webhook` edge function (exists as `mercadopago-webhook` but needs adaptation)
- White Label onboarding wizard page (`/whitelabel/onboarding`)
- Tenant dashboard page (`/tenant/dashboard`)
- Redesigned landing page
- Updated registration page with affiliate/referral support
- Updated user dashboard with usage counters and affiliate card

---

## Module 1 -- Validate-HWID Edge Function

Create `supabase/functions/validate-hwid/index.ts`:
- Receives `{ hwid, licenseKey, token? }` via POST
- Queries `licenses` table by `token` field (mapped from licenseKey)
- Checks `is_active = true` and `expires_at > now()`
- Registers HWID if not set; rejects if different HWID already registered
- Returns `{ valid, plan, dailyMessages, type, tenantId }`
- CORS enabled, no JWT verification
- Uses service role client for DB access

---

## Module 2 -- Database Schema Evolution

Run a single migration adding:

**Table: tenants** (ALTER existing):
- `status` text DEFAULT 'active' (with validation trigger for: pending, active, suspended)
- `domain` text UNIQUE
- `mp_access_token` text
- `plan_type` text DEFAULT 'messages' (with validation trigger)
- `branding` jsonb DEFAULT '{}'

Note: `setup_paid`, `commission_percent` already exist. Map `commission_rate` to existing `commission_percent`. `affiliate_commission_rate` maps to `affiliate_global_split_percent`.

**Table: licenses** (ALTER existing):
- `plan_type` text DEFAULT 'messages'
- `daily_messages` int DEFAULT 10
- `hourly_limit` int DEFAULT null
- `affiliate_id` uuid REFERENCES affiliates(id)

Note: `tenant_id` already exists on licenses.

**Table: affiliates** (ALTER existing):
- `commission_rate` numeric DEFAULT 0.30
- `total_earned` numeric DEFAULT 0
- `referral_code` text UNIQUE

Note: `tenant_id` already exists.

**New table: transactions**
- id, type, tenant_id, affiliate_id, user_id, amount, mp_payment_id, commission_percent, status, description, created_at

**New table: daily_usage**
- id, license_id (FK), user_id, tenant_id, date, messages_used
- UNIQUE(license_id, date)
- RLS: users see own usage

All with proper RLS policies and indexes.

---

## Module 3 -- Redesigned Landing Page

Update `src/pages/Index.tsx` with:
- Dark hero section (#1A1A2E background, #6C3CE1 accents)
- Title: "A extensao que turbina o Lovable sem gastar seus creditos"
- Badge: "10 mensagens gratis por dia para testar"
- CTAs: "Comecar Gratis" -> /register, "Ver como funciona" -> scroll
- 3-card "How it works" section
- Plans section (Free, Pro, Agency)
- White Label section with CTA -> /whitelabel/onboarding
- Affiliates section with CTA -> /register?tipo=afiliado
- Footer with links

---

## Module 4 -- White Label Onboarding

### 4.1 -- Wizard Page (`/whitelabel/onboarding`)

Create `src/pages/WhiteLabelOnboarding.tsx` with 5-step wizard:
1. Company Data (name, CNPJ, site, phone, segment)
2. Visual Customization (platform name, logo upload to `tenant-assets` bucket, colors, subdomain validation)
3. Billing Model (messages/day or hourly, pricing tiers, MP access token)
4. Setup Payment (R$299 via Mercado Pago Checkout Pro)
5. Confirmation (URL, credentials, redirect to tenant dashboard)

State persisted in localStorage as `wl_onboarding_state`.
Storage bucket `tenant-assets` needs to be created.

### 4.2 -- Edge Function `process-wl-setup`

Create `supabase/functions/process-wl-setup/index.ts`:
- Receives `{ tenantId, mpPaymentId, mpAccessToken }`
- Verifies payment with Mercado Pago API
- Updates tenant: `setup_paid=true, status='active', mp_access_token`
- Inserts into transactions table
- Returns `{ success, tenantSlug }`

---

## Module 5 -- Tenant Dashboard

Create `src/pages/TenantDashboard.tsx` at route `/tenant/dashboard`:
- Protected route: user must be tenant owner with active status
- Sidebar navigation: Overview, Users, Revenue, Customization, Affiliates, Settings
- Overview: cards for active users, monthly revenue, daily messages, active affiliates
- Users tab: table with email, plan, usage, actions (suspend, change plan)
- Revenue tab: transaction history, monthly chart, commission breakdown
- Customization tab: edit branding (reuse wizard step 2 form)
- Affiliates tab: enable/disable, set commission %, list affiliates
- Settings tab: change name/logo/colors, billing model, MP key, cancel WL

---

## Module 6 -- User Dashboard + Registration Updates

### 6.1 -- Enhanced Dashboard (`/dashboard`)

Update `src/pages/Dashboard.tsx`:
- Detect tenant branding from license's tenant_id
- Daily usage card with progress bar (green/yellow/red)
- Plan info card with upgrade button
- Affiliate card (if user is affiliate): code, link, earnings, payout request
- Choice card (if not affiliate/tenant): become affiliate or create WL
- Recent messages section

### 6.2 -- Registration with Affiliates

Update `src/pages/Register.tsx`:
- Support `?tipo=afiliado` and `?ref={code}` query params
- Affiliate section shown when `tipo=afiliado`
- On signup: create user, optionally create affiliate record with `nanoid(8)` referral code
- Auto-create free license (10 msg/day, no expiry)
- Capture referral code from URL and link to affiliate

---

## Module 7 -- Extension Context + Usage Tracking

### 7.1 -- Edge Function `get-user-context`

Create `supabase/functions/get-user-context/index.ts`:
- Receives `{ licenseKey }`
- Joins licenses with tenants for branding
- Queries daily_usage for today's count
- Returns `{ valid, plan: { type, dailyLimit, usedToday, planName }, branding: { appName, primaryColor, secondaryColor, logoUrl, isTenant, tenantId } }`

### 7.2 -- Edge Function `increment-usage`

Create `supabase/functions/increment-usage/index.ts`:
- Receives `{ licenseKey }`
- Upserts daily_usage: INSERT ON CONFLICT UPDATE SET messages_used = messages_used + 1
- Returns updated count

Note: The Chrome extension panel.js updates are documented but live outside this repo's deploy scope. The edge functions provide the API the extension will call.

---

## Module 8 -- Mercado Pago Webhook + Checkout

### 8.1 -- Edge Function `mp-webhook`

The existing `mercadopago-webhook` handles standard member purchases and WL purchases. Create a new `mp-webhook` edge function (or update the existing one) that also:
- Handles affiliate commission distribution (30% to affiliate)
- Handles platform commission for tenant users (20% to CodeLove)
- Updates `affiliates.total_earned`
- Inserts into `transactions` table with proper types

### 8.2 -- Edge Function `create-mp-preference`

Create `supabase/functions/create-mp-preference/index.ts`:
- Receives `{ licenseKey, planId, userId, planName, planPrice }`
- Creates Mercado Pago checkout preference with notification_url pointing to mp-webhook
- Returns `{ preferenceId, checkoutUrl }`

---

## New Routes to Register

Add to `src/App.tsx`:
- `/whitelabel/onboarding` -> WhiteLabelOnboarding
- `/tenant/dashboard` -> TenantDashboard
- `/cadastro` -> redirect or alias to `/register` with query param support

---

## File Changes Summary

### New Files (approx. 14):
1. `supabase/functions/validate-hwid/index.ts`
2. `supabase/functions/get-user-context/index.ts`
3. `supabase/functions/increment-usage/index.ts`
4. `supabase/functions/process-wl-setup/index.ts`
5. `supabase/functions/mp-webhook/index.ts`
6. `supabase/functions/create-mp-preference/index.ts`
7. `src/pages/WhiteLabelOnboarding.tsx`
8. `src/pages/TenantDashboard.tsx`
9. 1 SQL migration file (via migration tool)

### Modified Files (approx. 4):
1. `src/App.tsx` -- add new routes
2. `src/pages/Index.tsx` -- complete redesign
3. `src/pages/Dashboard.tsx` -- add usage tracking, affiliate card, branding
4. `src/pages/Register.tsx` -- add affiliate/referral support

### Storage:
- Create `tenant-assets` bucket (public) for WL logos/favicons

### Secrets Needed:
- `MP_PLATFORM_ACCESS_TOKEN` -- needs to be mapped from existing `MERCADO_PAGO_ACCESS_TOKEN` or added as new secret

---

## Execution Order

The implementation will follow the module order (1-8) as dependencies flow naturally: schema first, then edge functions, then frontend pages.

## Technical Notes

- The `licenses.token` field maps to what the manual calls `licenseKey`/`key`
- The `licenses.device_id` field maps to `hwid`
- Existing `commission_percent` on tenants maps to `commission_rate` in the manual (stored as integer percentage, not decimal)
- Validation triggers will be used instead of CHECK constraints per Lovable Cloud guidelines
- All edge functions use `verify_jwt = false` in config.toml with license-based auth
- The `transactions` table is new and separate from existing `tenant_wallet_transactions` and `admin_commissions`
