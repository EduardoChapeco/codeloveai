// Shared token revocation helper for Cloudflare workers

const WORKER_URLS = [
  "https://codelove-fix-api.eusoueduoficial.workers.dev",
  "https://Starble-fix-api.eusoueduoficial.workers.dev",
];

interface RevokeResult {
  ok: boolean;
  attempts: number;
  revokedOn: string[];
  errors: string[];
}

export async function revokeTokenEverywhere(token: string): Promise<RevokeResult> {
  const adminSecret = Deno.env.get("CODELOVE_ADMIN_SECRET");
  const result: RevokeResult = {
    ok: false,
    attempts: 0,
    revokedOn: [],
    errors: [],
  };

  if (!token || !token.startsWith("CLF1.")) {
    result.errors.push("Token inválido para revogação");
    return result;
  }

  if (!adminSecret) {
    result.errors.push("CODELOVE_ADMIN_SECRET ausente");
    return result;
  }

  for (const baseUrl of WORKER_URLS) {
    const headers = {
      "Content-Type": "application/json",
      "X-Admin-Secret": adminSecret,
    };

    try {
      result.attempts++;
      const revokeResp = await fetch(`${baseUrl}/admin/revoke`, {
        method: "POST",
        headers,
        body: JSON.stringify({ token }),
      });

      if (revokeResp.ok) {
        result.revokedOn.push(`${baseUrl}/admin/revoke`);
        continue;
      }

      result.attempts++;
      const unbindResp = await fetch(`${baseUrl}/admin/unbind`, {
        method: "POST",
        headers,
        body: JSON.stringify({ token }),
      });

      if (unbindResp.ok) {
        result.revokedOn.push(`${baseUrl}/admin/unbind`);
      } else {
        const text = await unbindResp.text().catch(() => "");
        result.errors.push(`${baseUrl}: revoke=${revokeResp.status}, unbind=${unbindResp.status} ${text.slice(0, 120)}`);
      }
    } catch (e) {
      result.errors.push(`${baseUrl}: ${(e as Error).message}`);
    }
  }

  result.ok = result.revokedOn.length > 0;
  return result;
}
