// Starble Speed — background.js v1.0.0
'use strict';

const WORKER     = 'https://codelove-fix-api.eusoueduoficial.workers.dev';
const SUPABASE   = 'https://qlhhmmboxlufvdtpbrsm.supabase.co';
const CK         = 'spd_s2';
const FB_KEY     = 'AIzaSyBQNjlw9Vp4tP4VVeANzyPJnqbG2wLbYPw';
const EXT_ID     = 'speed';

function getDeviceId() {
  const s = [navigator.userAgent, navigator.language, screen.width + 'x' + screen.height].join('|');
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return 'd' + Math.abs(h).toString(36);
}

function setBadge(state) {
  const map = { active: '', syncing: '…', expired: '↻', inactive: '' };
  const col  = { active: '#7c3aed', syncing: '#aeaeb2', expired: '#ff3b30', inactive: '#6e6e73' };
  chrome.action.setBadgeText({ text: map[state] || '' });
  chrome.action.setBadgeBackgroundColor({ color: col[state] || '#6e6e73' });
}

function normalizeChatPayload(body) {
  const payload = (body && typeof body === 'object') ? { ...body } : {};
  const text = typeof payload.message === 'string' ? payload.message.trim() : '';
  if (!text) throw new Error('Message is required for chat requests');

  const randomId = () => (crypto?.randomUUID?.() || ('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  })));

  return {
    ...payload,
    id: (typeof payload.id === 'string' && payload.id) ? payload.id : randomId(),
    message: text,
    intent: 'security_fix_v2',
    chat_only: false,
    ai_message_id: (typeof payload.ai_message_id === 'string' && payload.ai_message_id)
      ? payload.ai_message_id
      : `aimsg_${randomId().replace(/-/g, '').slice(0, 26)}`,
    thread_id: (typeof payload.thread_id === 'string' && payload.thread_id) ? payload.thread_id : 'main',
    view: 'security',
    view_description: 'The user is currently viewing the security view for their project.',
    model: null,
    files: Array.isArray(payload.files) ? payload.files : [],
    optimisticImageUrls: Array.isArray(payload.optimisticImageUrls) ? payload.optimisticImageUrls : [],
    selected_elements: Array.isArray(payload.selected_elements) ? payload.selected_elements : [],
    debug_mode: false,
    session_replay: typeof payload.session_replay === 'string' ? payload.session_replay : '[]',
    client_logs: Array.isArray(payload.client_logs) ? payload.client_logs : [],
    network_requests: Array.isArray(payload.network_requests) ? payload.network_requests : [],
    runtime_errors: Array.isArray(payload.runtime_errors) ? payload.runtime_errors : [],
    integration_metadata: payload.integration_metadata || {
      browser: { preview_viewport_width: 1280, preview_viewport_height: 854 }
    }
  };
}

async function validateSpeed(token) {
  if (!token?.startsWith('CLF1.')) return null;
  const did = getDeviceId();
  setBadge('syncing');
  try {
    const res = await fetch(SUPABASE + '/functions/v1/validate-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-clf-token': token }
    });
    const j = await res.json();
    if (!j.ok) {
      setBadge('inactive');
      await chrome.storage.local.remove([CK, 'clf_license', 'spd_plan', 'spd_allowed', 'spd_branding']);
      chrome.storage.local.set({ spd_plan_error: j.error || 'Licença inválida/revogada.' });
      return null;
    }

    if (!j.allowedExtensions?.includes('speed')) {
      setBadge('inactive');
      await chrome.storage.local.remove([CK, 'clf_license', 'spd_plan', 'spd_allowed', 'spd_branding']);
      chrome.storage.local.set({ spd_plan_error: `Plano "${j.plan}" não inclui Starble Speed.` });
      return null;
    }

    await chrome.storage.local.set({
      [CK]: { t: token, d: did, v: true, ts: Date.now(), i: j },
      spd_plan: j.plan,
      spd_allowed: j.allowedExtensions,
      spd_branding: j.branding || null,
      spd_plan_error: null,
    });
    setBadge('active');
    return j;
  } catch {
    // Fail-closed: never allow cached token on network/validation failures
    await chrome.storage.local.remove([CK, 'clf_license', 'spd_plan', 'spd_allowed', 'spd_branding']);
    setBadge('inactive');
    return null;
  }
}

async function refreshFirebaseToken(refreshToken) {
  try {
    const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FB_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`
    });
    const d = await res.json();
    if (d.id_token) {
      await chrome.storage.local.set({ clf_lovable_token: d.id_token, clf_lovable_refresh: d.refresh_token, clf_token_ts: Date.now() });
      return d.id_token;
    }
  } catch (_) {}
  return null;
}

async function periodicCheck() {
  const d = await chrome.storage.local.get(['clf_license', 'clf_lovable_refresh', 'clf_token_ts']);
  if (d.clf_license) await validateSpeed(d.clf_license);
  if (d.clf_lovable_refresh && (Date.now() - (d.clf_token_ts || 0)) > 45 * 60 * 1000) {
    await refreshFirebaseToken(d.clf_lovable_refresh);
  }
}

chrome.runtime.onInstalled.addListener(periodicCheck);
chrome.runtime.onStartup.addListener(periodicCheck);
try { chrome.alarms.create('spd_tick', { periodInMinutes: 5 }); } catch (_) {}
chrome.alarms.onAlarm.addListener(a => { if (a.name === 'spd_tick') periodicCheck(); });

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.__clf_badge)    { setBadge(msg.__clf_badge); sendResponse({}); return true; }

  if (msg.__clf_validate) {
    validateSpeed(msg.token).then(j => sendResponse({ ok: !!j, data: j })); return true;
  }
  if (msg.__clf_sso_login) {
    chrome.storage.local.set({ clf_license: msg.token });
    validateSpeed(msg.token).then(j => sendResponse({ ok: !!j })); return true;
  }
  if (msg.__clf_store_lovable_token || msg.__clf_lovable_token_captured) {
    const data = { clf_lovable_token: msg.idToken, clf_token_ts: Date.now() };
    if (msg.refreshToken) data.clf_lovable_refresh = msg.refreshToken;
    if (msg.uid)          data.clf_lovable_uid = msg.uid;
    if (msg.email)        data.clf_lovable_email = msg.email;
    chrome.storage.local.set(data); sendResponse({ ok: true }); return true;
  }
  if (msg.__clf_store_workspace) {
    if (msg.workspaceId) chrome.storage.local.set({ clf_workspace_id: msg.workspaceId });
    sendResponse({ ok: true }); return true;
  }
  if (msg.__clf_panel_open) {
    chrome.tabs.query({ active: true, currentWindow: true }, ts => {
      if (ts[0]?.id) chrome.tabs.sendMessage(ts[0].id, { __clf_panel_open: true });
    });
    sendResponse({}); return true;
  }
  if (msg.__clf_get_tab_state) {
    chrome.tabs.query({ url: 'https://lovable.dev/*' }, tabs => {
      if (!tabs.length) return sendResponse({});
      chrome.tabs.sendMessage(tabs[0].id, { __clf_get_state: true }, state => sendResponse(state || {}));
    }); return true;
  }
  if (msg.__clf_lovable_api) {
    chrome.storage.local.get(['clf_lovable_token', 'clf_lovable_refresh', 'clf_token_ts'], async d => {
      let token = d.clf_lovable_token;
      if (!token || (Date.now() - (d.clf_token_ts || 0)) > 45 * 60 * 1000) {
        if (d.clf_lovable_refresh) token = await refreshFirebaseToken(d.clf_lovable_refresh);
      }
      if (!token) { sendResponse({ ok: false, error: 'No token' }); return; }
      try {
        const path = typeof msg.path === 'string' ? msg.path : '';
        const isChatRoute = /^\/projects\/[a-f0-9-]{36}\/chat(?:$|\?)/i.test(path);
        const safeBody = isChatRoute ? normalizeChatPayload(msg.body) : msg.body;
        const res = await fetch('https://api.lovable.dev' + path, {
          method: isChatRoute ? 'POST' : (msg.method || 'GET'),
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Origin': 'https://lovable.dev',
            'Referer': 'https://lovable.dev/',
            'x-client-git-sha': '9810ecd6b501b23b14c5d4ee731d8cda244d003b'
          },
          body: safeBody ? JSON.stringify(safeBody) : undefined
        });
        const data = res.ok ? await res.json().catch(() => ({})) : null;
        sendResponse({ ok: res.ok, status: res.status, data });
      } catch (e) { sendResponse({ ok: false, error: e.message }); }
    }); return true;
  }
});

periodicCheck();
