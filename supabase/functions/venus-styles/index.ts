import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { VENUS_CORS } from "../_shared/venus-license.ts";

const CSS_FALLBACK = `
#vns-bar{display:flex;align-items:center;gap:6px;padding:4px}
.vns-pill-btn{display:flex;align-items:center;gap:5px;height:30px;padding:0 10px;border-radius:99px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#fff;cursor:pointer;font-size:12px}
.vns-icon-btn{width:30px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:8px;border:1px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.6);cursor:pointer}
.vns-send-btn{width:30px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:#fff;color:#000;cursor:pointer;border:none}
`;

const CSS_FULL = `
:root{--vns-primary:#7c3aed;--vns-primary-glow:#a78bfa;--vns-bg:#0a0a0f;--vns-surface:rgba(255,255,255,0.04);--vns-border:rgba(255,255,255,0.08);--vns-text:#e2e8f0;--vns-text-muted:rgba(255,255,255,0.5);--vns-radius:12px;--vns-radius-pill:99px}
#vns-bar{display:flex;align-items:center;gap:8px;padding:6px 12px;background:var(--vns-bg);border:1px solid var(--vns-border);border-radius:var(--vns-radius);backdrop-filter:blur(20px);box-shadow:0 8px 32px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.05);font-family:'JetBrains Mono',monospace}
.vns-pill-btn{display:flex;align-items:center;gap:6px;height:32px;padding:0 14px;border-radius:var(--vns-radius-pill);border:1px solid var(--vns-border);background:var(--vns-surface);color:var(--vns-text);cursor:pointer;font-size:12px;font-weight:500;letter-spacing:0.02em;transition:all .2s ease}
.vns-pill-btn:hover{background:rgba(124,58,237,0.15);border-color:var(--vns-primary);color:#fff;box-shadow:0 0 16px rgba(124,58,237,0.2)}
.vns-pill-btn.active{background:linear-gradient(135deg,var(--vns-primary),var(--vns-primary-glow));border-color:transparent;color:#fff;box-shadow:0 4px 16px rgba(124,58,237,0.4)}
.vns-icon-btn{width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:10px;border:1px solid var(--vns-border);background:var(--vns-surface);color:var(--vns-text-muted);cursor:pointer;transition:all .2s ease}
.vns-icon-btn:hover{background:rgba(124,58,237,0.12);border-color:var(--vns-primary);color:var(--vns-primary-glow);transform:translateY(-1px)}
.vns-send-btn{width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:10px;background:linear-gradient(135deg,var(--vns-primary),var(--vns-primary-glow));color:#fff;cursor:pointer;border:none;box-shadow:0 4px 12px rgba(124,58,237,0.3);transition:all .15s ease}
.vns-send-btn:hover{transform:scale(1.05);box-shadow:0 6px 20px rgba(124,58,237,0.5)}
.vns-send-btn:active{transform:scale(0.95)}
.vns-input{flex:1;height:32px;padding:0 12px;border-radius:10px;border:1px solid var(--vns-border);background:rgba(0,0,0,0.3);color:var(--vns-text);font-size:13px;font-family:inherit;outline:none;transition:border-color .2s}
.vns-input:focus{border-color:var(--vns-primary);box-shadow:0 0 0 3px rgba(124,58,237,0.1)}
.vns-input::placeholder{color:var(--vns-text-muted)}
.vns-badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:var(--vns-radius-pill);font-size:10px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase}
.vns-badge-pro{background:linear-gradient(135deg,var(--vns-primary),var(--vns-primary-glow));color:#fff}
.vns-badge-free{background:var(--vns-surface);color:var(--vns-text-muted);border:1px solid var(--vns-border)}
.vns-dropdown{position:absolute;top:calc(100% + 8px);right:0;min-width:200px;background:var(--vns-bg);border:1px solid var(--vns-border);border-radius:var(--vns-radius);box-shadow:0 16px 48px rgba(0,0,0,0.5);padding:4px;z-index:99999;backdrop-filter:blur(20px)}
.vns-dropdown-item{display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:8px;color:var(--vns-text);font-size:13px;cursor:pointer;transition:background .15s}
.vns-dropdown-item:hover{background:rgba(124,58,237,0.1)}
.vns-separator{height:1px;background:var(--vns-border);margin:4px 0}
.vns-panel{position:fixed;top:0;right:0;width:420px;height:100vh;background:var(--vns-bg);border-left:1px solid var(--vns-border);z-index:99998;display:flex;flex-direction:column;box-shadow:-8px 0 32px rgba(0,0,0,0.3)}
.vns-panel-header{display:flex;align-items:center;justify-content:space-between;padding:16px;border-bottom:1px solid var(--vns-border)}
.vns-panel-body{flex:1;overflow-y:auto;padding:16px}
.vns-note{position:absolute;width:200px;min-height:120px;padding:12px;border-radius:var(--vns-radius);background:rgba(124,58,237,0.1);border:1px solid rgba(124,58,237,0.2);backdrop-filter:blur(10px);cursor:grab;font-size:13px;color:var(--vns-text);box-shadow:0 4px 16px rgba(0,0,0,0.2);transition:box-shadow .2s}
.vns-note:hover{box-shadow:0 8px 32px rgba(124,58,237,0.15)}
.vns-note.dragging{cursor:grabbing;box-shadow:0 12px 40px rgba(124,58,237,0.3);z-index:999}
@keyframes vns-pulse{0%,100%{opacity:1}50%{opacity:.5}}
.vns-loading{animation:vns-pulse 1.5s ease-in-out infinite}
`;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...VENUS_CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: VENUS_CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ css: CSS_FALLBACK }); }

  const licenseKey = ((body.license_key as string) || (body.licenseKey as string) || "").trim();
  if (!licenseKey) return json({ css: CSS_FALLBACK });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data } = await supabase
    .from("venus_licenses")
    .select("id, active, expires_at")
    .eq("license_key", licenseKey)
    .eq("active", true)
    .single();

  if (!data) return json({ css: CSS_FALLBACK });
  if (data.expires_at && new Date(data.expires_at) < new Date()) return json({ css: CSS_FALLBACK });

  return json({ css: CSS_FULL });
});
