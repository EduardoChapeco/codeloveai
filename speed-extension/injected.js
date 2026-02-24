// Speed Extension — injected.js
// Runs in the PAGE context (not extension context)
// Intercepts fetch, XHR, and WebSocket to capture tokens and AI responses

(function () {
  'use strict';
  if (window.__SpeedExt) return;
  window.__SpeedExt = true;

  // ── Fetch intercept: capture Bearer tokens to api.lovable.dev ──────
  const _origFetch = window.fetch;
  window.fetch = function (...args) {
    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
      if (url.includes('api.lovable.dev')) {
        const headers = args[1]?.headers;
        let authHeader = null;
        if (headers instanceof Headers) {
          authHeader = headers.get('authorization');
        } else if (headers && typeof headers === 'object') {
          authHeader = headers['authorization'] || headers['Authorization'];
        }
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.replace('Bearer ', '');
          if (token && token.length > 20) {
            window.postMessage({ type: 'SPD_TOKEN', token }, '*');
          }
        }
      }
    } catch { /* silent */ }
    return _origFetch.apply(this, args);
  };

  // ── XHR intercept (fallback) ───────────────────────────────────────
  const _origXHROpen = XMLHttpRequest.prototype.open;
  const _origXHRSetHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__spdUrl = url;
    return _origXHROpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    try {
      if (this.__spdUrl && this.__spdUrl.includes('api.lovable.dev')) {
        if (name.toLowerCase() === 'authorization' && value.startsWith('Bearer ')) {
          const token = value.replace('Bearer ', '');
          if (token && token.length > 20) {
            window.postMessage({ type: 'SPD_TOKEN', token }, '*');
          }
        }
      }
    } catch { /* silent */ }
    return _origXHRSetHeader.call(this, name, value);
  };

  // ── WebSocket intercept: capture AI responses ──────────────────────
  const _OrigWS = window.WebSocket;
  window.WebSocket = function (url, protocols) {
    const ws = protocols ? new _OrigWS(url, protocols) : new _OrigWS(url);

    ws.addEventListener('message', (event) => {
      try {
        if (typeof event.data === 'string' && event.data.length > 10) {
          // Try to parse as JSON
          let parsed;
          try { parsed = JSON.parse(event.data); } catch { return; }

          // Detect AI response patterns from Lovable
          if (parsed && (
            parsed.type === 'message' ||
            parsed.type === 'chat_message' ||
            parsed.type === 'ai_response' ||
            parsed.content ||
            parsed.text ||
            parsed.message
          )) {
            window.postMessage({
              type: 'SPD_AI_RESPONSE',
              payload: parsed,
            }, '*');
          }
        }
      } catch { /* silent */ }
    });

    return ws;
  };
  // Copy static properties
  Object.keys(_OrigWS).forEach((k) => {
    try { window.WebSocket[k] = _OrigWS[k]; } catch { /* readonly */ }
  });
  window.WebSocket.prototype = _OrigWS.prototype;

  // ── DOM Suppressor: hide toasts that reveal extension usage ─────────
  const SUPPRESS_PATTERNS = [
    /mensagem enviada/i,
    /message sent/i,
    /codelove/i,
    /clf.?ext/i,
    /speed.?ext/i,
  ];

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        const el = node;
        const text = el.textContent || '';
        if (SUPPRESS_PATTERNS.some((p) => p.test(text))) {
          el.style.display = 'none';
          setTimeout(() => el.remove(), 100);
        }
      }
    }
  });
  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
