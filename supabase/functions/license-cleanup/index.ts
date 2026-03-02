/**
 * license-cleanup v1.0
 * 
 * Periodic cleanup that:
 * 1. Deactivates expired licenses in DB
 * 2. Removes duplicate active licenses (keeps newest)
 * 3. Revokes legacy tokens on Cloudflare worker
 * 4. Deactivates orphan tokens (no matching active license)
 * 5. Never touches admin_master
 * 
 * Called by cron job or manually by admin.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { revokeTokenEverywhere } from "../_shared/token-revocation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ADMIN_USER_ID = "94547aa3-3eb5-4503-b329-21009280490b";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminSecret = Deno.env.get("CODELOVE_ADMIN_SECRET");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Optional: verify caller is admin or cron (service_role)
    const authHeader = req.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ") && !authHeader.includes(Deno.env.get("SUPABASE_ANON_KEY")!)) {
      // JWT auth — verify admin
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user?.id) {
        const userId = user.id;
        const { data: adminRole } = await adminClient
          .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
        if (!adminRole) {
          return new Response(JSON.stringify({ error: "Admin only" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }
    // If called by anon key (cron), allow through

    const now = new Date();
    const results = {
      expired_licenses_deactivated: 0,
      duplicate_licenses_removed: 0,
      orphan_tokens_deactivated: 0,
      cloudflare_tokens_revoked: 0,
      errors: [] as string[],
    };

    // ── 1. Deactivate expired licenses (not admin_master, not free) + revoke in workers ──
    const { data: expiredLicenses } = await adminClient
      .from("licenses")
      .select("id, key, user_id, expires_at, plan")
      .eq("active", true)
      .lt("expires_at", now.toISOString())
      .neq("plan", "admin_master")
      .neq("plan", "free");

    if (expiredLicenses && expiredLicenses.length > 0) {
      const ids = expiredLicenses.map((l: any) => l.id);
      await adminClient
        .from("licenses")
        .update({ active: false, status: "expired" })
        .in("id", ids);

      for (const lic of expiredLicenses) {
        if (lic.key?.startsWith("CLF1.") && adminSecret) {
          const rvk = await revokeTokenEverywhere(lic.key);
          if (rvk.ok) results.cloudflare_tokens_revoked += 1;
          if (rvk.errors.length) results.errors.push(...rvk.errors);
        }
      }

      results.expired_licenses_deactivated = ids.length;
      console.log(`[cleanup] Deactivated ${ids.length} expired licenses`);
    }

    // ── 2. Remove duplicate active licenses (keep newest per user) ──
    const { data: allActive } = await adminClient
      .from("licenses")
      .select("id, user_id, created_at, plan")
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (allActive) {
      const seenUsers = new Set<string>();
      const dupeIds: string[] = [];
      for (const lic of allActive) {
        if (lic.user_id === ADMIN_USER_ID) continue; // skip admin
        if (lic.plan === "free") continue; // never dedup free licenses
        if (seenUsers.has(lic.user_id)) {
          dupeIds.push(lic.id);
        } else {
          seenUsers.add(lic.user_id);
        }
      }
      if (dupeIds.length > 0) {
        await adminClient
          .from("licenses")
          .update({ active: false, status: "superseded" })
          .in("id", dupeIds);
        results.duplicate_licenses_removed = dupeIds.length;
        console.log(`[cleanup] Removed ${dupeIds.length} duplicate licenses`);
      }
    }

    // ── 3. Process tokens table → deactivate orphans and revoke on Cloudflare ──
    const { data: activeTokens } = await adminClient
      .from("tokens")
      .select("id, token, user_id, is_active")
      .eq("is_active", true);

    if (activeTokens) {
      for (const tkn of activeTokens) {
        // Skip admin master's token
        if (tkn.user_id === ADMIN_USER_ID) continue;

        // Check if user has a corresponding active license
        const { data: matchingLicense } = await adminClient
          .from("licenses")
          .select("id, active")
          .eq("user_id", tkn.user_id)
          .eq("active", true)
          .limit(1)
          .maybeSingle();

        const shouldRevoke = !matchingLicense;

        if (shouldRevoke) {
          // Deactivate in DB
          await adminClient
            .from("tokens")
            .update({ is_active: false })
            .eq("id", tkn.id);
          results.orphan_tokens_deactivated++;

          // Revoke on workers (all known worker URLs/endpoints)
          if (adminSecret && tkn.token && tkn.token.startsWith("CLF1.")) {
            const rvk = await revokeTokenEverywhere(tkn.token);
            if (rvk.ok) results.cloudflare_tokens_revoked += 1;
            if (rvk.errors.length) results.errors.push(...rvk.errors);
            console.log(`[cleanup] Revoked CF token for user ${tkn.user_id}`);
          }
        }
      }
    }

    // ── 4. Also deactivate admin's legacy token in tokens table (keep only licenses) ──
    await adminClient
      .from("tokens")
      .update({ is_active: false })
      .eq("user_id", ADMIN_USER_ID);

    // ── 5. Scrub inactive token history from account (destroy old token material) ──
    const { data: inactiveLicenses } = await adminClient
      .from("licenses")
      .select("id, key, active, plan")
      .eq("active", false)
      .neq("plan", "admin_master")
      .neq("plan", "free")
      .not("key", "is", null);

    if (inactiveLicenses && inactiveLicenses.length > 0) {
      for (const lic of inactiveLicenses) {
        const revokedKey = `REVOKED_${lic.id}`;
        await adminClient
          .from("licenses")
          .update({ key: revokedKey })
          .eq("id", lic.id)
          .neq("key", revokedKey);
      }
    }

    await adminClient
      .from("tokens")
      .delete()
      .eq("is_active", false);

    console.log(`[cleanup] Results:`, results);

    return new Response(JSON.stringify({
      ok: true,
      timestamp: now.toISOString(),
      ...results,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[cleanup] Error:", err);
    return new Response(JSON.stringify({ error: "Internal error", details: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
