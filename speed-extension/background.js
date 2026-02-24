// Speed Extension — background.js (Service Worker)
// Handles: side panel, license validation, token management, branding sync

const SB = 'https://qlhhmmboxlufvdtpbrsm.supabase.co/functions/v1';
const FIREBASE_KEY = 'AIzaSyBQNjlw9Vp4tP4VVeANzyPJnqbG2wLbYPw';
const FIREBASE_REFRESH_URL = `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_KEY}`;

// ── Side panel behavior ──────────────────────────────────────────────
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Speed] Extension installed');
});

// ── Device ID (persistent) ───────────────────────────────────────────
async function getDeviceId() {
  const { spd_hwid } = await chrome.storage.local.get('spd_hwid');
  if (spd_hwid) return spd_hwid;
  const raw = `${navigator.userAgent}-${navigator.language}-${Date.now()}`;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const id = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
  await chrome.storage.local.set({ spd_hwid: id });
  return id;
}

// ── Decode CLF1 token locally ────────────────────────────────────────
function decodeCLF1(licenseKey) {
  try {
    // CLF1 tokens are NOT JWTs — they are simple string keys
    // Local validation: just check format CLF1.xxx
    if (!licenseKey || typeof licenseKey !== 'string') return { valid: false };
    if (!licenseKey.startsWith('CLF1.')) return { valid: false };
    return { valid: true, key: licenseKey };
  } catch {
    return { valid: false };
  }
}

// ── Validate license with server ─────────────────────────────────────
async function validateLicense(licenseKey) {
  try {
    const hwid = await getDeviceId();
    const res = await fetch(`${SB}/validate-hwid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey, hwid }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { valid: false, error: data.error || `Status ${res.status}` };
    }
    const data = await res.json();
    if (data.valid) {
      await chrome.storage.local.set({
        spd_cache: {
          valid: true,
          data,
          ts: Date.now(),
        },
      });
    }
    return data;
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

// ── Fetch branding ───────────────────────────────────────────────────
async function fetchBranding(licenseKey) {
  try {
    const res = await fetch(`${SB}/get-branding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    await chrome.storage.local.set({ spd_branding: data });
    return data;
  } catch {
    return null;
  }
}

// ── Set badge ────────────────────────────────────────────────────────
function setBadge(color, text) {
  chrome.action.setBadgeBackgroundColor({ color });
  chrome.action.setBadgeText({ text });
}

// ── Firebase token refresh ───────────────────────────────────────────
async function refreshFirebaseToken() {
  const data = await chrome.storage.local.get(['spd_token_expiry', 'spd_refresh']);
  if (!data.spd_refresh) return;

  const now = Date.now();
  const tenMin = 10 * 60 * 1000;
  if (data.spd_token_expiry && (data.spd_token_expiry - now) > tenMin) return;

  try {
    const res = await fetch(FIREBASE_REFRESH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(data.spd_refresh)}`,
    });
    if (!res.ok) return;
    const json = await res.json();
    if (!json.id_token) return;

    const parts = json.id_token.split('.');
    let expiry = null;
    if (parts.length === 3) {
      try {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        expiry = payload.exp ? payload.exp * 1000 : null;
      } catch { /* ignore */ }
    }

    await chrome.storage.local.set({
      spd_token: json.id_token,
      spd_refresh: json.refresh_token || data.spd_refresh,
      spd_token_ts: Date.now(),
      spd_token_expiry: expiry,
      spd_uid: json.user_id || undefined,
    });
    console.log('[Speed] Firebase token refreshed via background');
  } catch (e) {
    console.error('[Speed] Background token refresh failed:', e);
  }
}

// Refresh every 45 minutes
chrome.alarms.create('spd_token_refresh', { periodInMinutes: 45 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'spd_token_refresh') {
    refreshFirebaseToken();
  }
});

// ── Message handlers ─────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Validate CLF1 license
  if (msg.type === 'SPD_VALIDATE') {
    const local = decodeCLF1(msg.licenseKey);
    if (!local.valid) {
      sendResponse({ ok: false, error: 'Formato de licença invalido' });
      return false;
    }
    // Also validate server-side
    validateLicense(msg.licenseKey).then((res) => {
      setBadge(res.valid ? '#22c55e' : '#ef4444', res.valid ? '✓' : '✗');
      sendResponse({ ok: res.valid, data: res });
    });
    return true;
  }

  // SSO Login — save license + validate + fetch branding
  if (msg.type === 'SPD_SSO_LOGIN') {
    const { licenseKey, email, name } = msg;
    chrome.storage.local.set({
      spd_license: licenseKey,
      spd_email: email || '',
      spd_name: name || '',
    });
    // Validate + fetch branding in parallel
    Promise.all([
      validateLicense(licenseKey),
      fetchBranding(licenseKey),
    ]).then(([valRes]) => {
      setBadge(valRes.valid ? '#22c55e' : '#ef4444', valRes.valid ? '✓' : '✗');
      sendResponse({ ok: valRes.valid, data: valRes });
    });
    return true;
  }

  // Get Lovable token from storage
  if (msg.type === 'SPD_GET_LOVABLE_TOKEN') {
    chrome.storage.local.get(['spd_token', 'spd_token_expiry'], (data) => {
      sendResponse({ token: data.spd_token || null, expiry: data.spd_token_expiry || null });
    });
    return true;
  }

  // Store token received from content.js
  if (msg.type === 'SPD_STORE_TOKEN') {
    chrome.storage.local.set({
      spd_token: msg.token,
      spd_refresh: msg.refreshToken,
      spd_token_ts: Date.now(),
      spd_token_expiry: msg.expiry,
    });
    sendResponse({ ok: true });
    return false;
  }

  // Manual badge set
  if (msg.type === 'SPD_BADGE') {
    setBadge(msg.color || '#666', msg.text || '');
    sendResponse({ ok: true });
    return false;
  }

  // Get tab state from content.js in active Lovable tab
  if (msg.type === 'SPD_GET_TAB_STATE') {
    chrome.tabs.query({ url: 'https://lovable.dev/*', active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) {
        // Try any lovable tab
        chrome.tabs.query({ url: 'https://lovable.dev/*' }, (allTabs) => {
          if (allTabs.length === 0) {
            sendResponse({ ok: false, error: 'Nenhuma aba Lovable aberta' });
            return;
          }
          chrome.tabs.sendMessage(allTabs[0].id, { type: 'SPD_GET_STATE' }, (res) => {
            sendResponse(res || { ok: false });
          });
        });
      } else {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'SPD_GET_STATE' }, (res) => {
          sendResponse(res || { ok: false });
        });
      }
    });
    return true;
  }

  // AI response relay from content.js to panel
  if (msg.type === 'SPD_AI_RESPONSE') {
    // Broadcast to all extension contexts (panel will pick it up)
    // Store latest AI response
    chrome.storage.local.set({ spd_last_ai: msg.payload });
    return false;
  }
});

// ── Startup: validate cached license + fetch branding ───────────────
chrome.storage.local.get(['spd_license'], (data) => {
  if (data.spd_license) {
    validateLicense(data.spd_license).then((res) => {
      setBadge(res.valid ? '#22c55e' : '#ef4444', res.valid ? '✓' : '✗');
    });
    fetchBranding(data.spd_license);
  }
});
