// Speed Extension — content.js
// Bridges injected.js (page context) ↔ extension (background/panel)
// Runs as content script on lovable.dev

(function () {
  'use strict';
  if (window.__SpeedContent) return;
  window.__SpeedContent = true;

  const FIREBASE_KEY = 'AIzaSyBQNjlw9Vp4tP4VVeANzyPJnqbG2wLbYPw';
  const FIREBASE_REFRESH_URL = `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_KEY}`;

  // ── Inject injected.js into page context ───────────────────────────
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('injected.js');
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);

  // ── Extract projectId from URL ─────────────────────────────────────
  function extractProjectId(url) {
    const match = url.match(/\/projects?\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
    return match ? match[1] : null;
  }

  function updateProjectId() {
    const pid = extractProjectId(window.location.href);
    if (pid) {
      chrome.storage.local.set({ spd_project_id: pid });
    }
  }
  updateProjectId();

  // ── SPA navigation watcher ─────────────────────────────────────────
  const origPushState = history.pushState;
  const origReplaceState = history.replaceState;
  history.pushState = function (...args) {
    origPushState.apply(this, args);
    updateProjectId();
  };
  history.replaceState = function (...args) {
    origReplaceState.apply(this, args);
    updateProjectId();
  };
  window.addEventListener('popstate', updateProjectId);

  // ── Decode JWT to get expiry ───────────────────────────────────────
  function decodeJwtExpiry(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload.exp ? payload.exp * 1000 : null; // ms
    } catch {
      return null;
    }
  }

  // ── Extract refresh token from localStorage ────────────────────────
  function extractRefreshToken() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (key.startsWith('firebase:authUser:')) {
          try {
            const val = JSON.parse(localStorage.getItem(key) || '');
            const rt = val?.spiTokenManager?.refreshToken || val?.refreshToken;
            if (rt && typeof rt === 'string' && rt.length > 10) return rt;
          } catch { /* not JSON */ }
        }
      }
    } catch { /* silent */ }
    return null;
  }

  // ── Listen for messages from injected.js ───────────────────────────
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    // Token captured
    if (event.data?.type === 'SPD_TOKEN' && event.data.token) {
      const token = event.data.token;
      const expiry = decodeJwtExpiry(token);
      const refreshToken = extractRefreshToken();

      chrome.storage.local.set({
        spd_token: token,
        spd_token_ts: Date.now(),
        spd_token_expiry: expiry,
        spd_refresh: refreshToken,
      });

      // Notify background
      chrome.runtime.sendMessage({
        type: 'SPD_STORE_TOKEN',
        token,
        refreshToken,
        expiry,
      });
    }

    // AI response from WebSocket
    if (event.data?.type === 'SPD_AI_RESPONSE' && event.data.payload) {
      chrome.runtime.sendMessage({
        type: 'SPD_AI_RESPONSE',
        payload: event.data.payload,
      });
    }
  });

  // ── Handle messages from panel/background ──────────────────────────
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'SPD_GET_STATE') {
      chrome.storage.local.get(['spd_token', 'spd_project_id', 'spd_token_expiry'], (data) => {
        sendResponse({
          token: data.spd_token || null,
          projectId: data.spd_project_id || null,
          tokenExpiry: data.spd_token_expiry || null,
        });
      });
      return true;
    }

    if (msg.type === 'SPD_CAPTURE_TOKENS') {
      // Re-inject to trigger capture
      const s = document.createElement('script');
      s.src = chrome.runtime.getURL('injected.js');
      s.onload = () => s.remove();
      (document.head || document.documentElement).appendChild(s);
      sendResponse({ ok: true });
      return false;
    }

    if (msg.type === 'SPD_DEPLOY') {
      chrome.storage.local.get(['spd_token', 'spd_project_id'], async (data) => {
        if (!data.spd_token || !data.spd_project_id) {
          sendResponse({ ok: false, error: 'Token ou projeto ausente' });
          return;
        }
        try {
          const res = await fetch(
            `https://api.lovable.dev/projects/${data.spd_project_id}/deployments?async=true`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${data.spd_token}`,
                Origin: 'https://lovable.dev',
                Referer: 'https://lovable.dev/',
              },
            }
          );
          const result = await res.json().catch(() => ({}));
          sendResponse({ ok: res.ok, status: res.status, data: result });
        } catch (e) {
          sendResponse({ ok: false, error: e.message });
        }
      });
      return true;
    }
  });

  // ── Auto-refresh Firebase token ────────────────────────────────────
  async function refreshFirebaseToken() {
    const data = await chrome.storage.local.get(['spd_token_expiry', 'spd_refresh']);
    if (!data.spd_refresh) return;

    const expiry = data.spd_token_expiry;
    const now = Date.now();
    const tenMin = 10 * 60 * 1000;

    if (expiry && (expiry - now) > tenMin) return; // Still valid

    try {
      const res = await fetch(FIREBASE_REFRESH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(data.spd_refresh)}`,
      });

      if (!res.ok) return;
      const json = await res.json();
      if (!json.id_token) return;

      const newExpiry = decodeJwtExpiry(json.id_token);
      chrome.storage.local.set({
        spd_token: json.id_token,
        spd_refresh: json.refresh_token || data.spd_refresh,
        spd_token_ts: Date.now(),
        spd_token_expiry: newExpiry,
      });
      console.log('[Speed] Firebase token refreshed');
    } catch (e) {
      console.error('[Speed] Token refresh failed:', e);
    }
  }

  // Check every 5 minutes
  setInterval(refreshFirebaseToken, 5 * 60 * 1000);
  // Initial check after 30s
  setTimeout(refreshFirebaseToken, 30000);
})();
