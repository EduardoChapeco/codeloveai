

# Fix All Build Errors — Implementation Plan

## Root Cause Analysis
All build errors stem from 4 issues across edge functions:

### Fix 1: `TenantInfo` interface missing `id` field
**File:** `supabase/functions/_shared/tenant-resolver.ts`
- The DB query selects `id` but the interface only has `tenant_id`
- Add `id: string` to the `TenantInfo` interface (line 12-17)
- Add `id: DEFAULT_TENANT_ID` to the fallback object (line 80-85)
- **This fixes errors in:** `activate-free-plan`, `admin-create-user`, `admin-token-actions`, `affiliate-enroll`, `auto-onboard`, `chat-relay`, `create-checkout`

### Fix 2: `mercadopago-webhook` strict type inference
**File:** `supabase/functions/mercadopago-webhook/index.ts`
- Change function parameter types from `ReturnType<typeof createClient>` to `any` for all 3 handler functions:
  - `handleWalletTopup` (line 136)
  - `handleWhiteLabelPurchase` (line 190)
  - `handleMemberPurchase` (line 419)
- This resolves all the `never` type and overload errors

### Fix 3: `string | undefined` assignment errors
**Files:** `create-checkout/index.ts` (line 37), `create-white-label-checkout/index.ts` (line 31)
- Change `let userEmail: string;` to `let userEmail: string = "";`
- `claims.email` can be undefined, so the variable needs a default value

### Fix 4: Null check on `tenantConfig.data`
**File:** `supabase/functions/admin-create-user/index.ts`
- Extract `tokenCost` with null coalescing: `const tokenCost = tenantConfig?.data?.token_cost ?? 0;`
- Replace all `tenantConfig.data.token_cost` references (lines 175, 220, 221, 226) with `tokenCost`

### Fix 5: `getClaims` method not found in `chat-relay`
**File:** `supabase/functions/chat-relay/index.ts` (line 2)
- Uses `https://esm.sh/@supabase/supabase-js@2.49.1` (pinned old version) — update to `@2` (unpinned) to match other functions that work with `getClaims`

## Summary
- **9 files modified** (1 shared module + 8 edge functions)
- **~30 type errors resolved** from 4 root causes
- No logic changes — only type safety fixes

