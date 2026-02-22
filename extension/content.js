// CodeLove AI Extension — Content Script
// Injects panel, intercepts chat, captures Lovable API tokens automatically

(function () {
  "use strict";

  if (window.__codeloveAI) return;
  window.__codeloveAI = true;

  // Signal presence so codeloveai.com can detect extension
  window.postMessage({ type: "clf_extension_ready" }, "*");

  // ─── Automatic Lovable Token Capture via XHR/Fetch interception ───
  let capturedLovableToken = null;

  /**
   * Save a new token as the current valid token.
   * Move any previous token to the history array so it doesn't
   * interfere with the active token used by the extension.
   */
  function setCurrentLovableToken(token) {
    chrome.storage.local.get(["lovable_api_token", "lovable_token_history"], (data) => {
      const history = data.lovable_token_history || [];
      // Archive old token if different
      if (data.lovable_api_token && data.lovable_api_token !== token) {
        history.unshift({
          token: data.lovable_api_token,
          archivedAt: new Date().toISOString(),
        });
        // Keep only last 20 entries
        if (history.length > 20) history.length = 20;
      }
      chrome.storage.local.set({
        lovable_api_token: token,
        lovable_token_history: history,
        lovable_token_updated_at: new Date().toISOString(),
      });
    });
  }

  // Intercept fetch to capture Bearer tokens to api.lovable.dev
  const origFetch = window.fetch;
  window.fetch = function (...args) {
    try {
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
      if (url.includes("api.lovable.dev") || url.includes("lovable.dev")) {
        const headers = args[1]?.headers;
        let authHeader = null;
        if (headers instanceof Headers) {
          authHeader = headers.get("authorization");
        } else if (headers && typeof headers === "object") {
          authHeader = headers["authorization"] || headers["Authorization"];
        }
        if (authHeader && authHeader.startsWith("Bearer ")) {
          const token = authHeader.replace("Bearer ", "");
          if (token && token.length > 20 && token !== capturedLovableToken) {
            capturedLovableToken = token;
            setCurrentLovableToken(token);
            notifyPlatformToken(token, null);
          }
        }
      }
    } catch (e) { /* silent */ }
    return origFetch.apply(this, args);
  };

  // Intercept XMLHttpRequest too
  const origXHROpen = XMLHttpRequest.prototype.open;
  const origXHRSetHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__codeloveUrl = url;
    return origXHROpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    if (this.__codeloveUrl && (
      this.__codeloveUrl.includes("api.lovable.dev") ||
      this.__codeloveUrl.includes("lovable.dev")
    )) {
      if (name.toLowerCase() === "authorization" && value.startsWith("Bearer ")) {
        const token = value.replace("Bearer ", "");
        if (token && token.length > 20 && token !== capturedLovableToken) {
          capturedLovableToken = token;
          setCurrentLovableToken(token);
          notifyPlatformToken(token, null);
        }
      }
    }
    return origXHRSetHeader.call(this, name, value);
  };

  /**
   * Notify background and platform of a captured token.
   * @param {string} token - The Firebase ID token (Bearer)
   * @param {string|null} refreshToken - Firebase refresh token (may be null)
   */
  function notifyPlatformToken(token, refreshToken) {
    // Send to background script — it will auto-save to platform via lovable-proxy
    chrome.runtime.sendMessage({
      type: "LOVABLE_TOKEN_CAPTURED",
      token,
      refreshToken: refreshToken || null,
    });

    // Also try auto-save if user has clf_token in storage (logged in to platform)
    chrome.storage.local.get("clf_token", (data) => {
      if (data.clf_token) {
        chrome.runtime.sendMessage({
          type: "AUTO_SAVE_LOVABLE_TOKEN",
          lovableToken: token,
          refreshToken: refreshToken || null,
          supabaseJwt: data.clf_token,
        });
      }
    });
  }

  // ─── SSO Bridge: capture CodeLove platform token from localStorage ───
  function captureCodeLoveToken() {
    try {
      const token = localStorage.getItem("clf_token") ||
                    localStorage.getItem("supabase.auth.token") ||
                    sessionStorage.getItem("clf_token");
      const email = localStorage.getItem("clf_email");
      const name = localStorage.getItem("clf_name");
      if (token) {
        chrome.storage.local.set({ clf_token: token, clf_email: email, clf_name: name });
      }
    } catch(e) { /* silent */ }
  }

  // ─── Listen for messages from the page ───
  window.addEventListener("message", (event) => {
    // SSO login from platform
    if (event.data?.type === "clf_sso_login" && event.data.token) {
      chrome.storage.local.set({
        clf_token: event.data.token,
        clf_email: event.data.email || "",
        clf_name: event.data.name || "",
      });
    }

    // SSO logout
    if (event.data?.type === "clf_sso_logout") {
      chrome.storage.local.remove(["clf_token", "clf_email", "clf_name"]);
    }

    // ── Handle clf_token_bridge (fired by extension popup "Integrar" button) ──
    if (event.data?.type === "clf_token_bridge" && event.data.idToken) {
      console.log("[CodeLove AI] clf_token_bridge received — saving idToken + refreshToken");
      const { idToken, refreshToken } = event.data;
      setCurrentLovableToken(idToken);
      if (refreshToken) {
        chrome.storage.local.set({ lovable_refresh_token: refreshToken });
      }
      notifyPlatformToken(idToken, refreshToken || null);
    }

    // ── NEW: Also handle clf_token_bridge dispatched as postMessage from same-window ──
    // Relay clf_lovable_token back to the page so LovableConnect.tsx receives it
    if (event.data?.type === "clf_request_lovable_token") {
      chrome.storage.local.get(["lovable_api_token", "lovable_refresh_token"], (data) => {
        if (data.lovable_api_token) {
          // Send clf_lovable_token (legacy path) AND clf_token_bridge (new path)
          const target = /** @type {Window} */ (event.source || window);
          const targetOrigin = event.origin || "*";
          try {
            target.postMessage({
              type: "clf_lovable_token",
              token: data.lovable_api_token,
            }, targetOrigin);

            // Also send as clf_token_bridge so the new handler on LovableConnect picks it up
            target.postMessage({
              type: "clf_token_bridge",
              idToken: data.lovable_api_token,
              refreshToken: data.lovable_refresh_token || null,
              source: "extension_storage",
              version: "0.0.1-beta",
            }, targetOrigin);
          } catch(e) {
            window.postMessage({
              type: "clf_lovable_token",
              token: data.lovable_api_token,
            }, window.location.origin);
          }
        } else {
          // No token yet — tell the platform
          const target = /** @type {Window} */ (event.source || window);
          try {
            target.postMessage({ type: "clf_lovable_token_missing" }, event.origin || "*");
          } catch(e) { /* silent */ }
        }
      });
    }

    // Platform ping to detect extension
    if (event.data?.type === "clf_ping") {
      const target = /** @type {Window} */ (event.source || window);
      try {
        target.postMessage({ type: "clf_pong" }, event.origin || "*");
      } catch(e) {
        window.postMessage({ type: "clf_pong" }, window.location.origin);
      }
    }
  });

  // ─── Also listen for clf_token_bridge as a CustomEvent (dispatched on document) ───
  document.addEventListener("clf_token_bridge", (event) => {
    const detail = /** @type {CustomEvent} */ (event).detail;
    if (detail?.idToken) {
      console.log("[CodeLove AI] clf_token_bridge CustomEvent received");
      setCurrentLovableToken(detail.idToken);
      if (detail.refreshToken) {
        chrome.storage.local.set({ lovable_refresh_token: detail.refreshToken });
      }
      notifyPlatformToken(detail.idToken, detail.refreshToken || null);
    }
  });

  // ─── Panel injection ───
  function createPanel() {
    const panel = document.createElement("div");
    panel.id = "codelove-panel";
    panel.innerHTML = `
      <div id="codelove-panel-header">
        <span class="codelove-logo">CODELOVE AI</span>
        <button id="codelove-close">✕</button>
      </div>
      <div id="codelove-panel-tabs">
        <button class="codelove-tab active" data-tab="dashboard">Dashboard</button>
        <button class="codelove-tab" data-tab="chat">Chat</button>
        <button class="codelove-tab" data-tab="projects">Projetos</button>
        <button class="codelove-tab" data-tab="settings">Config</button>
      </div>
      <div id="codelove-panel-content">
        <div class="codelove-section" data-section="dashboard">
          <h3>Dashboard</h3>
          <div id="codelove-status">Capturando token automaticamente...</div>
          <div id="codelove-token-status" style="margin-top:12px;padding:10px;border-radius:8px;font-size:11px;"></div>
          <div id="codelove-platform-status" style="margin-top:8px;padding:10px;border-radius:8px;font-size:11px;"></div>
        </div>
        <div class="codelove-section" data-section="chat" style="display:none">
          <h3>Chat AI</h3>
          <div id="codelove-chat-messages"></div>
          <div id="codelove-chat-input-wrap">
            <textarea id="codelove-chat-input" placeholder="Pergunte algo..."></textarea>
            <button id="codelove-chat-send">Enviar</button>
          </div>
        </div>
        <div class="codelove-section" data-section="projects" style="display:none">
          <h3>Projetos</h3>
          <div id="codelove-projects-list">Conecte sua conta para ver projetos.</div>
        </div>
        <div class="codelove-section" data-section="settings" style="display:none">
          <h3>Configurações</h3>
          <label>URL da Plataforma:</label>
          <input id="codelove-platform-url" placeholder="https://..." />
          <button id="codelove-save-settings">Salvar</button>
          <hr />
          <label>Modo de interceptação:</label>
          <select id="codelove-intercept-mode">
            <option value="off">Desativado</option>
            <option value="overlay">Overlay (bloquear chat nativo)</option>
          </select>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    // Tab switching
        panel.querySelectorAll(".codelove-tab").forEach((tab) => {
          tab.addEventListener("click", () => {
            panel.querySelectorAll(".codelove-tab").forEach((t) => t.classList.remove("active"));
            tab.classList.add("active");
            panel.querySelectorAll(".codelove-section").forEach((s) => { s.style.display = "none"; });
            const section = panel.querySelector(`[data-section="${tab.dataset.tab}"]`);
            if (section) section.style.display = "block";
          });
        });

    document.getElementById("codelove-close")?.addEventListener("click", togglePanel);

    document.getElementById("codelove-save-settings")?.addEventListener("click", () => {
      const urlEl = /** @type {HTMLInputElement} */ (document.getElementById("codelove-platform-url"));
      const modeEl = /** @type {HTMLSelectElement} */ (document.getElementById("codelove-intercept-mode"));
      const url = urlEl?.value;
      const mode = modeEl?.value;
      chrome.storage.local.set({ platformUrl: url, interceptMode: mode });
      alert("Configurações salvas!");
    });

    chrome.storage.local.get(["platformUrl", "interceptMode"], (data) => {
      const urlEl = /** @type {HTMLInputElement} */ (document.getElementById("codelove-platform-url"));
      const modeEl = /** @type {HTMLSelectElement} */ (document.getElementById("codelove-intercept-mode"));
      if (data.platformUrl && urlEl) urlEl.value = data.platformUrl;
      if (data.interceptMode && modeEl) modeEl.value = data.interceptMode;
    });

    updateTokenStatusUI();
    return panel;
  }

  function updateTokenStatusUI() {
    const el = document.getElementById("codelove-token-status");
    const elPlatform = document.getElementById("codelove-platform-status");
    if (!el) return;
    chrome.storage.local.get(["lovable_api_token", "lovable_refresh_token", "clf_token", "lovable_token_history", "lovable_token_updated_at"], (data) => {
      const historyCount = (data.lovable_token_history || []).length;
      if (data.lovable_api_token) {
        el.style.background = "#0a2a0a";
        el.style.border = "1px solid #1a4a1a";
        el.style.color = "#4ade80";
        const refreshInfo = data.lovable_refresh_token ? " (com refresh)" : "";
        const updatedInfo = data.lovable_token_updated_at ? ` — ${new Date(data.lovable_token_updated_at).toLocaleTimeString()}` : "";
        const historyInfo = historyCount > 0 ? ` | ${historyCount} antigo(s) no histórico` : "";
        el.textContent = `✅ Token ativo${refreshInfo}${updatedInfo}${historyInfo}`;
      } else {
        el.style.background = "#2a1a0a";
        el.style.border = "1px solid #4a3a1a";
        el.style.color = "#fbbf24";
        el.textContent = "⏳ Aguardando — faça qualquer ação no Lovable para capturar o token";
      }
      if (elPlatform) {
        if (data.clf_token) {
          elPlatform.style.background = "#0a1a2a";
          elPlatform.style.border = "1px solid #1a3a4a";
          elPlatform.style.color = "#60a5fa";
          elPlatform.textContent = "🔗 Conectado à plataforma CodeLove AI";
        } else {
          elPlatform.style.background = "#1a1a1a";
          elPlatform.style.border = "1px solid #333";
          elPlatform.style.color = "#888";
          elPlatform.textContent = "⚪ Plataforma CodeLove AI não conectada";
        }
      }
    });
  }

  // Listen for storage changes to update UI
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.lovable_api_token || changes.clf_token || changes.lovable_refresh_token) {
      updateTokenStatusUI();
    }
  });

  let panelEl = null;
  let panelOpen = false;

  function togglePanel() {
    if (!panelEl) panelEl = createPanel();
    panelOpen = !panelOpen;
    panelEl.classList.toggle("open", panelOpen);
    (document.body.style as any).marginRight = panelOpen ? "420px" : "0";
    document.body.style.transition = "margin-right 0.3s ease";
    chrome.storage.local.set({ panelOpen });
  }

  // ─── Intercept mode ───
  chrome.storage.local.get("interceptMode", (data) => {
    if (data.interceptMode === "overlay") {
      injectOverlay();
    }
  });

  function injectOverlay() {
    const chatArea = document.querySelector('[class*="chat"]');
    if (!chatArea) return;
    const overlay = document.createElement("div");
    overlay.id = "codelove-overlay";
    overlay.innerHTML = `
      <div class="codelove-overlay-badge">
        <strong>BLOQUEADO</strong> — use o painel CodeLove AI
      </div>
    `;
    (overlay.style as any).cssText = "position:absolute;inset:0;z-index:9999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;";
    (overlay.querySelector(".codelove-overlay-badge") as HTMLElement).style.cssText = "background:#fff;color:#000;padding:16px 32px;border-radius:12px;font-size:14px;font-weight:bold;";
    (chatArea as HTMLElement).style.position = "relative";
    chatArea.appendChild(overlay);
  }

  // ─── Extension button (floating) ───
  const btn = document.createElement("button");
  btn.id = "codelove-toggle";
  btn.textContent = "⚡";
  btn.title = "CodeLove AI";
  (btn.style as any).cssText = "position:fixed;bottom:20px;right:20px;z-index:99999;width:48px;height:48px;border-radius:50%;background:#000;color:#fff;border:none;cursor:pointer;font-size:20px;box-shadow:0 4px 12px rgba(0,0,0,0.3);transition:transform 0.2s;";
  btn.addEventListener("mouseenter", () => (btn.style.transform = "scale(1.1)"));
  btn.addEventListener("mouseleave", () => (btn.style.transform = "scale(1)"));
  btn.addEventListener("click", togglePanel);
  document.body.appendChild(btn);

  // Initial token capture attempt
  setTimeout(captureCodeLoveToken, 1000);
})();
