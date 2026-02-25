// Starble Speed — content.js
// Injected into lovable.dev to capture tokens and project state
'use strict';

// Inject the token interceptor script
const script = document.createElement('script');
script.src = chrome.runtime.getURL('injected.js');
script.onload = () => script.remove();
(document.head || document.documentElement).appendChild(script);

// Listen for intercepted tokens from injected.js
window.addEventListener('message', (e) => {
  if (e.source !== window || e.origin !== 'https://lovable.dev') return;
  const d = e.data;
  if (!d || typeof d !== 'object') return;

  if (d.__clf_lovable_token_captured && d.idToken) {
    chrome.runtime.sendMessage({
      __clf_lovable_token_captured: true,
      idToken: d.idToken,
      refreshToken: d.refreshToken || null,
      uid: d.uid || null,
      email: d.email || null,
    });
  }
});

// Respond to state queries from popup/background
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.__clf_get_state) {
    // Extract project ID from URL
    const m = location.pathname.match(/\/projects\/([a-f0-9-]{36})/);
    const projectId = m ? m[1] : null;

    // Try to get token from storage
    chrome.storage.local.get(['clf_lovable_token', 'clf_lovable_uid', 'clf_lovable_email'], (data) => {
      sendResponse({
        idToken: data.clf_lovable_token || null,
        uid: data.clf_lovable_uid || null,
        email: data.clf_lovable_email || null,
        projectId,
        url: location.href,
      });
    });
    return true;
  }

  if (msg.__clf_panel_open) {
    // Toggle side panel visibility (handled by extension API)
    sendResponse({ ok: true });
  }
});
