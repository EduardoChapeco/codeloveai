// CodeLove AI Extension — Content Script
// Injects panel, intercepts chat, captures tokens

(function () {
  "use strict";

  // Prevent double injection
  if (window.__codeloveAI) return;
  window.__codeloveAI = true;

  // ─── Token capture (best effort) ───
  function captureToken() {
    // Try localStorage SSO bridge
    const token = localStorage.getItem("clf_token");
    const email = localStorage.getItem("clf_email");
    const name = localStorage.getItem("clf_name");
    if (token) {
      chrome.storage.local.set({ clf_token: token, clf_email: email, clf_name: name });
    }
  }

  // Listen for SSO messages from platform
  window.addEventListener("message", (event) => {
    if (event.data?.type === "clf_sso_login") {
      chrome.storage.local.set({
        clf_token: event.data.token,
        clf_email: event.data.email,
        clf_name: event.data.name,
      });
    }
    if (event.data?.type === "clf_sso_logout") {
      chrome.storage.local.remove(["clf_token", "clf_email", "clf_name"]);
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
          <p>Status da conta, token, plano ativo.</p>
          <div id="codelove-status">Carregando...</div>
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
            <option value="intercept">Interceptar fetch</option>
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
        panel.querySelectorAll(".codelove-section").forEach((s) => (s.style.display = "none"));
        panel.querySelector(`[data-section="${tab.dataset.tab}"]`).style.display = "block";
      });
    });

    // Close
    document.getElementById("codelove-close").addEventListener("click", togglePanel);

    // Settings save
    document.getElementById("codelove-save-settings")?.addEventListener("click", () => {
      const url = document.getElementById("codelove-platform-url").value;
      const mode = document.getElementById("codelove-intercept-mode").value;
      chrome.storage.local.set({ platformUrl: url, interceptMode: mode });
      alert("Configurações salvas!");
    });

    // Load settings
    chrome.storage.local.get(["platformUrl", "interceptMode"], (data) => {
      if (data.platformUrl) document.getElementById("codelove-platform-url").value = data.platformUrl;
      if (data.interceptMode) document.getElementById("codelove-intercept-mode").value = data.interceptMode;
    });

    return panel;
  }

  let panelEl = null;
  let panelOpen = false;

  function togglePanel() {
    if (!panelEl) panelEl = createPanel();
    panelOpen = !panelOpen;
    panelEl.classList.toggle("open", panelOpen);
    document.body.style.marginRight = panelOpen ? "420px" : "0";
    document.body.style.transition = "margin-right 0.3s ease";
    chrome.storage.local.set({ panelOpen });
  }

  // ─── Intercept mode ───
  chrome.storage.local.get("interceptMode", (data) => {
    if (data.interceptMode === "overlay") {
      injectOverlay();
    } else if (data.interceptMode === "intercept") {
      interceptFetch();
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
    overlay.style.cssText = "position:absolute;inset:0;z-index:9999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;";
    overlay.querySelector(".codelove-overlay-badge").style.cssText = "background:#fff;color:#000;padding:16px 32px;border-radius:12px;font-size:14px;font-weight:bold;";
    chatArea.style.position = "relative";
    chatArea.appendChild(overlay);
  }

  function interceptFetch() {
    const origFetch = window.fetch;
    window.fetch = function (...args) {
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
      if (url.includes("/projects/") && url.includes("/chat")) {
        console.log("[CodeLove AI] Intercepted chat request:", url);
        // Redirect to platform — placeholder logic
        return Promise.resolve(new Response(JSON.stringify({ intercepted: true }), { status: 200 }));
      }
      return origFetch.apply(this, args);
    };
  }

  // ─── Extension button (floating) ───
  const btn = document.createElement("button");
  btn.id = "codelove-toggle";
  btn.textContent = "⚡";
  btn.title = "CodeLove AI";
  btn.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:99999;width:48px;height:48px;border-radius:50%;background:#000;color:#fff;border:none;cursor:pointer;font-size:20px;box-shadow:0 4px 12px rgba(0,0,0,0.3);transition:transform 0.2s;";
  btn.addEventListener("mouseenter", () => (btn.style.transform = "scale(1.1)"));
  btn.addEventListener("mouseleave", () => (btn.style.transform = "scale(1)"));
  btn.addEventListener("click", togglePanel);
  document.body.appendChild(btn);

  // Initial token capture
  setTimeout(captureToken, 1000);
})();
