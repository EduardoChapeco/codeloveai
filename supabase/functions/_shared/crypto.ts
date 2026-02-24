/**
 * Shared Cryptography Helper for Edge Functions
 * Used for obfuscating sensitive data and generating secure identifiers.
 */

const CROCKFORD = "0123456789abcdefghjkmnpqrstvwxyz";

/**
 * Generates a sortable secure identifier (type-id)
 */
export function generateTypeId(prefix: string): string {
  const now = BigInt(Date.now());
  const bytes = new Uint8Array(16);
  bytes[0] = Number((now >> 40n) & 0xFFn);
  bytes[1] = Number((now >> 32n) & 0xFFn);
  bytes[2] = Number((now >> 24n) & 0xFFn);
  bytes[3] = Number((now >> 16n) & 0xFFn);
  bytes[4] = Number((now >> 8n) & 0xFFn);
  bytes[5] = Number(now & 0xFFn);
  const randBytes = new Uint8Array(10);
  crypto.getRandomValues(randBytes);
  bytes[6] = (0x70 | (randBytes[0] & 0x0F));
  bytes[7] = randBytes[1];
  bytes[8] = (0x80 | (randBytes[2] & 0x3F));
  bytes[9] = randBytes[3];
  for (let i = 4; i < 10; i++) bytes[6 + i] = randBytes[i];

  let val = 0n;
  for (const b of bytes) val = (val << 8n) | BigInt(b);
  const chars: string[] = [];
  for (let i = 0; i < 26; i++) {
    chars.unshift(CROCKFORD[Number(val & 31n)]);
    val >>= 5n;
  }
  return `${prefix}_${chars.join("")}`;
}

/**
 * SHA-256 Hash of text
 */
export async function hashText(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Obfuscate sensitive strings for logs
 */
export function obfuscate(token: string | null): string {
  if (!token) return "null";
  if (token.length <= 8) return "****";
  return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
}
