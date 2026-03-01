export type EvolutionResult = {
  ok: boolean;
  status: number;
  data: Record<string, unknown> | null;
  raw: string;
  endpoint: string;
  contentType: string;
};

function toRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return null;
}

function collectNestedCandidates(data: Record<string, unknown> | null): Array<Record<string, unknown>> {
  if (!data) return [];
  const out: Array<Record<string, unknown>> = [];
  const queue: unknown[] = [data];
  const seen = new Set<unknown>();

  while (queue.length) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);

    const rec = toRecord(current);
    if (!rec) continue;

    out.push(rec);

    for (const value of Object.values(rec)) {
      if (toRecord(value)) queue.push(value);
      if (Array.isArray(value)) {
        for (const item of value) {
          if (toRecord(item)) queue.push(item);
        }
      }
    }
  }

  return out;
}

function findFirstStringByKeys(data: Record<string, unknown> | null, keys: string[]): string | null {
  for (const node of collectNestedCandidates(data)) {
    for (const key of keys) {
      const val = node[key];
      if (typeof val === "string" && val.trim()) return val.trim();
    }
  }
  return null;
}

function normalizeDataUriQr(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("data:image")) return trimmed;

  const base64Like = /^[A-Za-z0-9+/=\n\r]+$/.test(trimmed) && trimmed.length > 100;
  if (base64Like) return trimmed.replace(/\s+/g, "");

  return null;
}

export function extractQr(data: Record<string, unknown> | null): string | null {
  const qr = findFirstStringByKeys(data, ["base64", "qr", "qrCode", "code", "qrcode"]);
  if (!qr) return null;
  return normalizeDataUriQr(qr);
}

export function mapConnectionState(data: Record<string, unknown> | null): "connected" | "disconnected" {
  const state = findFirstStringByKeys(data, ["state", "status", "connectionState", "instanceState", "connectionStatus"]);
  const normalized = (state || "").toLowerCase();

  if (
    normalized.includes("open") ||
    normalized.includes("connected") ||
    normalized.includes("online") ||
    normalized.includes("ready")
  ) {
    return "connected";
  }

  return "disconnected";
}

export function pickPhone(data: Record<string, unknown> | null): string | null {
  return findFirstStringByKeys(data, ["phoneNumber", "number", "remoteJid", "jid", "wid"]);
}

export function hasInstanceAlreadyExists(status: number, raw: string, data: Record<string, unknown> | null): boolean {
  if (status === 409) return true;

  const text = `${raw} ${JSON.stringify(data || {})}`.toLowerCase();
  return (
    text.includes("already exists") ||
    text.includes("já existe") ||
    text.includes("instance exists") ||
    text.includes("instance already") ||
    text.includes("duplicat")
  );
}

export function isLikelyColdStartHtml(raw: string, contentType: string): boolean {
  if (contentType.toLowerCase().includes("text/html")) return true;
  const t = raw.trim().toLowerCase();
  return t.startsWith("<!doctype html") || t.startsWith("<html") || t.includes("<head>") || t.includes("render.com");
}

export async function requestEvolution(
  baseUrl: string,
  apiKey: string,
  options: {
    method: "GET" | "POST";
    endpoints: string[];
    body?: Record<string, unknown>;
    timeoutMs?: number;
  },
): Promise<EvolutionResult> {
  const timeoutMs = options.timeoutMs ?? 45000;
  let last: EvolutionResult | null = null;

  for (const endpoint of options.endpoints) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method: options.method,
        headers: {
          "Content-Type": "application/json",
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
        },
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
        signal: controller.signal,
      });

      const contentType = res.headers.get("content-type") || "";
      const raw = await res.text().catch(() => "");
      let data: Record<string, unknown> | null = null;

      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          data = toRecord(parsed);
        } catch {
          data = null;
        }
      }

      const current: EvolutionResult = {
        ok: res.ok,
        status: res.status,
        data,
        raw,
        endpoint,
        contentType,
      };

      last = current;
      if (res.status !== 404) return current;
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      last = {
        ok: false,
        status: isAbort ? 504 : 502,
        data: null,
        raw: isAbort ? "timeout" : String(err),
        endpoint,
        contentType: "",
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return (
    last ?? {
      ok: false,
      status: 502,
      data: null,
      raw: "No endpoint available",
      endpoint: "",
      contentType: "",
    }
  );
}
