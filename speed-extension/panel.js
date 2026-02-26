// Speed Extension — panel.js
// Handles UI logic, chat communication, and tab switching

const SB = 'https://qlhhmmboxlufvdtpbrsm.supabase.co/functions/v1';
const SPEED_EDGE = `${SB}/speed-chat`;
const LOVABLE_API = 'https://api.lovable.dev';
const GIT_SHA = '9810ecd6b501b23b14c5d4ee731d8cda244d003b';

// ── State ──────────────────────────────────────────────────────────
let state = {
  token: null,
  projectId: null,
  license: null,
  branding: null,
  activePage: 'page-chat',
  workspaceId: null,
  projects: [],
  projectsLoaded: false,
};

// ── DOM Elements ───────────────────────────────────────────────────
const msgContainer = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const btnSend = document.getElementById('btn-send');
const btnTheme = document.getElementById('btn-theme');
const toggleDark = document.getElementById('toggle-dark');
const headerTitle = document.getElementById('header-title');
const headerLogoLine = document.getElementById('header-logo');

// ── Tab Navigation ─────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const targetPage = tab.dataset.page;
    if (!targetPage) return;
    
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(targetPage).classList.add('active');
    
    state.activePage = targetPage;
    if (targetPage === 'page-project') {
      if (!state.projectsLoaded || state.projects.length === 0) loadProjects();
      else renderProjList();
    }
  });
});

// ── Theme Management ───────────────────────────────────────────────
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const isDark = theme === 'dark';
  btnTheme.textContent = isDark ? '🌙' : '☀️';
  if (toggleDark) toggleDark.checked = isDark;
  chrome.storage.local.set({ spd_theme: theme });
}

btnTheme.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  setTheme(current === 'dark' ? 'light' : 'dark');
});

if (toggleDark) {
  toggleDark.addEventListener('change', (e) => {
    setTheme(e.target.checked ? 'dark' : 'light');
  });
}

// ── Chat Logic ─────────────────────────────────────────────────────
function addMessage(text, role = 'ai') {
  const statusEl = document.getElementById('chat-status');
  if (statusEl) statusEl.remove();

  const msg = document.createElement('div');
  msg.className = `msg msg-${role}`;
  msg.textContent = text;
  msgContainer.appendChild(msg);
  msgContainer.scrollTop = msgContainer.scrollHeight;
  return msg;
}

function showTyping() {
  const div = document.createElement('div');
  div.className = 'typing-indicator';
  div.id = 'typing';
  div.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
  msgContainer.appendChild(div);
  msgContainer.scrollTop = msgContainer.scrollHeight;
}

function hideTyping() {
  const el = document.getElementById('typing');
  if (el) el.remove();
}

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text || btnSend.disabled) return;

  if (!state.token) return alert('Token Lovable não capturado. Abra o Lovable.dev');
  if (!state.projectId) return alert('Projeto não identificado. Navegue para um projeto no Lovable');
  if (!state.license) return alert('Chave de licença não configurada em Configurações');

  addMessage(text, 'user');
  chatInput.value = '';
  chatInput.style.height = 'auto';
  btnSend.disabled = true;
  showTyping();

  try {
    const res = await fetch(SPEED_EDGE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Speed-Client': '1'
      },
      body: JSON.stringify({
        task: text,
        lovable_token: state.token,
        project_id: state.projectId,
      })
    });

    const data = await res.json();
    if (!data.ok) {
      hideTyping();
      addMessage(`Erro: ${data.error || 'Falha ao enviar'}`, 'system');
      btnSend.disabled = false;
    }
  } catch (err) {
    hideTyping();
    addMessage(`Erro de rede: ${err.message}`, 'system');
    btnSend.disabled = false;
  }
}

btnSend.addEventListener('click', sendMessage);
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = (chatInput.scrollHeight) + 'px';
});

// ── Settings Logic ─────────────────────────────────────────────────
async function refreshSettingsUI() {
  const containerAcc = document.getElementById('settings-account');
  const containerTok = document.getElementById('settings-token');

  const { spd_email, spd_name, spd_cache, spd_license } = await chrome.storage.local.get(['spd_email', 'spd_name', 'spd_cache', 'spd_license']);
  
  if (spd_license) {
    const isValid = spd_cache?.valid;
    containerAcc.innerHTML = `
      <div class="card">
        <div class="card-label">Licença Ativa</div>
        <div class="card-value">
          <span class="status-dot ${isValid ? 'green' : 'red'}"></span>
          ${spd_license.substring(0, 10)}... 
        </div>
        <div style="font-size:11px; color:var(--txt2); margin-top:4px;">${spd_name || 'Usuário'} (${spd_email || ''})</div>
        <button class="btn btn-ghost btn-block" style="margin-top:10px;" id="btn-logout">Sair / Trocar Chave</button>
      </div>
    `;
    document.getElementById('btn-logout').onclick = async () => {
      await chrome.storage.local.remove(['spd_license', 'spd_cache', 'spd_email', 'spd_name', 'spd_branding']);
      location.reload();
    };
  } else {
    containerAcc.innerHTML = `
      <div class="card">
        <label class="card-label">Chave CLF1</label>
        <input type="text" class="input-field" id="license-input" placeholder="Cole sua licença CLF1...">
        <button class="btn btn-primary btn-block" style="margin-top:10px;" id="btn-activate">Ativar Licença</button>
        <a href="https://starble.lovable.app/lovable/connect" target="_blank" class="link">Obter chave na Starble</a>
      </div>
    `;
    document.getElementById('btn-activate').onclick = () => {
      const key = document.getElementById('license-input').value.trim();
      if (!key.startsWith('CLF1.')) return alert('Formato inválido. Use CLF1.xxx');
      chrome.runtime.sendMessage({ type: 'SPD_SSO_LOGIN', licenseKey: key }, (res) => {
        if (res?.ok) refreshSettingsUI();
        else alert('Chave inválida ou erro na ativação');
      });
    };
  }

  const statusColor = state.token ? 'green' : 'yellow';
  const statusText = state.token ? 'Token capturado' : 'Aguardando Lovable...';
  containerTok.innerHTML = `
    <div class="card">
      <div class="card-value">
        <span class="status-dot ${statusColor}"></span>
        ${statusText}
      </div>
      ${state.token ? `<div style="font-size:11px; color:var(--txt2); margin-top:4px;">Expira em breve</div>` : ''}
      <button class="btn btn-ghost btn-block" style="margin-top:10px;" id="btn-capture">Capturar Agora</button>
    </div>
  `;
  document.getElementById('btn-capture').onclick = () => {
    chrome.runtime.sendMessage({ type: 'SPD_CAPTURE_TOKENS' });
  };
}

// ── Project Logic ──────────────────────────────────────────────────
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

async function loadProjects() {
  const list = document.getElementById('projects-list');
  if (list) list.innerHTML = '<div class="empty-state">Carregando...</div>';
  if (!state.token) {
    // Try to sync from storage
    const d = await new Promise(r => chrome.storage.local.get(['spd_token'], r));
    state.token = d.spd_token || null;
    if (!state.token) {
      chrome.runtime.sendMessage({ type: 'SPD_CAPTURE_TOKENS' });
      await new Promise(r => setTimeout(r, 1200));
      const d2 = await new Promise(r => chrome.storage.local.get(['spd_token'], r));
      state.token = d2.spd_token || null;
    }
  }
  if (!state.token) {
    if (list) list.innerHTML = '<div class="empty-state">Token não capturado. Abra o Lovable.dev e clique em Capturar Token.</div>';
    return;
  }

  const H = {
    'Authorization': 'Bearer ' + state.token,
    'Origin': 'https://lovable.dev',
    'Referer': 'https://lovable.dev/',
    'x-client-git-sha': GIT_SHA,
  };

  // STEP 1: resolve workspaceId
  if (!state.workspaceId) {
    try {
      const r = await fetch(`${LOVABLE_API}/user/workspaces`, { headers: H });
      if (r.ok) {
        const d = await r.json();
        const arr = Array.isArray(d) ? d : (d.workspaces || d.data || []);
        const ws = arr[0];
        state.workspaceId = ws?.id || ws?.workspace_id || ws || null;
        if (typeof state.workspaceId !== 'string') state.workspaceId = null;
        if (state.workspaceId) chrome.storage.local.set({ spd_workspace_id: state.workspaceId });
      }
    } catch {}

    // Fallback: capture from open Lovable tabs
    if (!state.workspaceId) {
      try {
        const tabs = await new Promise(r => chrome.tabs.query({ url: 'https://lovable.dev/*' }, r));
        for (const tab of (tabs || [])) {
          const m = (tab.url || '').match(/\/workspaces\/([A-Za-z0-9_-]{5,60})/);
          if (m) { state.workspaceId = m[1]; chrome.storage.local.set({ spd_workspace_id: state.workspaceId }); break; }
        }
      } catch {}
    }

    // Fallback 2: ask content script
    if (!state.workspaceId) {
      try {
        const tabs = await new Promise(r => chrome.tabs.query({ url: 'https://lovable.dev/*' }, r));
        if (tabs[0]) {
          const st = await new Promise(r => {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'SPD_GET_STATE' }, s => r(s || {}));
            setTimeout(() => r({}), 2000);
          });
          if (st.workspaceId) { state.workspaceId = st.workspaceId; chrome.storage.local.set({ spd_workspace_id: state.workspaceId }); }
        }
      } catch {}
    }
  }

  // STEP 2: fetch projects via workspace
  if (state.token && state.workspaceId) {
    try {
      for (const lim of [100, 50]) {
        const r = await fetch(`${LOVABLE_API}/workspaces/${state.workspaceId}/projects?limit=${lim}`, { headers: H });
        if (r.ok) {
          const d = await r.json();
          const arr = Array.isArray(d) ? d : (d.projects || d.data || d.items || []);
          if (arr.length > 0 || lim === 50) {
            state.projects = arr.map(p => ({
              id: p.id || p.project_id,
              display_name: p.display_name || p.name || p.title || (p.id || '').slice(0, 14),
              slug: p.slug || null,
              custom_domain: p.custom_domain || null,
            })).filter(p => p.id);
            state.projectsLoaded = true;
            renderProjList();
            return;
          }
        }
      }
    } catch {}
  }

  // STEP 3 (fallback): fetch projects directly
  if (state.token) {
    try {
      const r = await fetch(`${LOVABLE_API}/projects?limit=50`, { headers: H });
      if (r.ok) {
        const d = await r.json();
        const arr = Array.isArray(d) ? d : (d.projects || d.data || []);
        if (arr.length > 0) {
          state.projects = arr.map(p => ({
            id: p.id || p.project_id,
            display_name: p.display_name || p.name || p.title || (p.id || '').slice(0, 14),
          })).filter(p => p.id);
          state.projectsLoaded = true;
          renderProjList();
          return;
        }
      }
    } catch {}
  }

  state.projectsLoaded = true;
  const msg = !state.token
    ? 'Token não capturado — abra o Lovable.dev primeiro.'
    : !state.workspaceId
    ? 'Workspace não encontrado — navegue num projeto no Lovable.dev e tente novamente.'
    : 'Nenhum projeto encontrado. Verifique sua conta no Lovable.dev.';
  if (list) list.innerHTML = `<div class="empty-state">${msg}</div>`;
}

function renderProjList() {
  const el = document.getElementById('projects-list');
  if (!el) return;
  const q = (document.getElementById('proj-search')?.value || '').toLowerCase();
  const items = state.projects.filter(p =>
    (p.display_name || p.name || '').toLowerCase().includes(q) || (p.id || '').includes(q)
  );
  if (!items.length) {
    el.innerHTML = state.projects.length === 0
      ? '<div class="empty-state">Nenhum projeto carregado. Clique em Atualizar.</div>'
      : '<div class="empty-state">Nenhum projeto encontrado para essa busca.</div>';
    return;
  }
  el.innerHTML = '';
  items.slice(0, 100).forEach(p => {
    const name = p.display_name || p.name || (p.id || '').slice(0, 14) || '—';
    const active = p.id === state.projectId;
    const card = document.createElement('div');
    card.className = 'project-card' + (active ? ' selected' : '');
    card.innerHTML = `
      <div class="status-dot ${active ? 'green' : ''}"></div>
      <div class="proj-info">
        <div class="project-name">${esc(name)}</div>
        <div class="project-id">${(p.id || '').slice(0, 22)}…</div>
      </div>
      <div class="proj-acts">
        <a href="https://lovable.dev/projects/${p.id}" target="_blank" title="Abrir no Lovable">↗</a>
        <button class="sel-btn" data-id="${p.id}" title="Selecionar">${active ? '✓' : '›'}</button>
      </div>
    `;
    card.querySelector('.sel-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      state.projectId = p.id;
      chrome.storage.local.set({ spd_project_id: p.id });
      renderProjList();
    });
    el.appendChild(card);
  });
}

function initProjects() {
  document.getElementById('proj-refresh-btn')?.addEventListener('click', () => {
    state.projectsLoaded = false;
    state.projects = [];
    state.workspaceId = null;
    loadProjects();
  });
  document.getElementById('proj-search')?.addEventListener('input', renderProjList);
}

// ── Helpers ────────────────────────────────────────────────────────
function makeUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function makeAiMsgId() {
  const C = '01PbWWqgKDBDorh525uecKaGZD21FGSoCeR';
  return 'aimsg_' + Array.from({ length: 26 }, () => C[Math.floor(Math.random() * 32)]).join('');
}

// ── Initialize ─────────────────────────────────────────────────────
async function init() {
  const data = await chrome.storage.local.get([
    'spd_token', 'spd_project_id', 'spd_license', 'spd_branding', 'spd_theme', 'spd_workspace_id'
  ]);

  state.token = data.spd_token;
  state.projectId = data.spd_project_id;
  state.license = data.spd_license;
  state.branding = data.spd_branding;
  state.workspaceId = data.spd_workspace_id || null;

  setTheme(data.spd_theme || 'dark');

  if (state.branding) {
    if (state.branding.primaryColor) {
      document.documentElement.style.setProperty('--acc', state.branding.primaryColor);
    }
    if (state.branding.appName) {
      headerTitle.textContent = state.branding.appName;
    }
    if (state.branding.logoUrl) {
      headerLogoLine.innerHTML = `<img src="${state.branding.logoUrl}" alt="logo">`;
    }
  }

  const statusEl = document.getElementById('chat-status');
  if (state.token && state.projectId) {
    statusEl.textContent = 'Pronto para conversar';
    btnSend.disabled = false;
  } else if (!state.token) {
    statusEl.textContent = '⚠️ Token Lovable não capturado';
  } else {
    statusEl.textContent = '⚠️ Projeto não identificado';
  }

  refreshSettingsUI();
  initProjects();
  loadProjects();
}

// ── Listen to storage changes ──────────────────────────────────────
chrome.storage.onChanged.addListener((changes) => {
  if (changes.spd_token) {
    state.token = changes.spd_token.newValue;
    refreshSettingsUI();
    document.getElementById('chat-status').textContent = 'Token atualizado. Pronto!';
    btnSend.disabled = false;
  }
  if (changes.spd_project_id) state.projectId = changes.spd_project_id.newValue;
  if (changes.spd_license) state.license = changes.spd_license.newValue;
  if (changes.spd_branding) {
    state.branding = changes.spd_branding.newValue;
    init();
  }
});

// ── Listen to AI responses from background/content ──────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SPD_AI_RESPONSE') {
    hideTyping();
    const payload = msg.payload;
    const text = payload.text || payload.content || payload.message || '';
    if (text) {
      addMessage(text, 'ai');
    }
    btnSend.disabled = false;
  }
});

init();
