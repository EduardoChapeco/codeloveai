// Speed Extension — panel.js
// Handles UI logic, chat communication, and tab switching

const SB = 'https://qlhhmmboxlufvdtpbrsm.supabase.co/functions/v1';
const SPEED_EDGE = `${SB}/lovable-proxy`;
const LOVABLE_API = 'https://api.lovable.dev';
const GIT_SHA = '9810ecd6b501b23b14c5d4ee731d8cda244d003b';

// ── State ──────────────────────────────────────────────────────────
let state = {
  token: null,
  projectId: null,
  license: null,
  branding: null,
  activePage: 'page-chat',
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
    if (targetPage === 'page-project') refreshProjects();
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
  // Remove empty state message if exists
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
    // Success — response will arrive via SPD_AI_RESPONSE listener
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

// Auto-resize textarea
chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = (chatInput.scrollHeight) + 'px';
});

// ── Settings Logic ─────────────────────────────────────────────────
async function refreshSettingsUI() {
  const containerAcc = document.getElementById('settings-account');
  const containerTok = document.getElementById('settings-token');

  const { spd_email, spd_name, spd_cache, spd_license } = await chrome.storage.local.get(['spd_email', 'spd_name', 'spd_cache', 'spd_license']);
  
  // Account
  if (spd_license) {
    const isValid = spd_cache?.valid;
    containerAcc.innerHTML = `
      <div class="card">
        <div class="card-label">LicençaAtiva</div>
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

  // Token Status
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
async function refreshProjects() {
  const activeContainer = document.getElementById('active-project');
  const listContainer = document.getElementById('projects-list');

  // Active
  if (state.projectId) {
    activeContainer.innerHTML = `
      <div class="card">
        <div class="project-name">Projeto Atual</div>
        <div class="project-id">${state.projectId}</div>
        <button class="btn btn-primary btn-block" style="margin-top:10px;" id="btn-deploy">Deploy no Lovable</button>
        <div id="deploy-status" style="font-size:12px; margin-top:8px; text-align:center;"></div>
      </div>
    `;
    document.getElementById('btn-deploy').onclick = async () => {
      const status = document.getElementById('deploy-status');
      status.textContent = 'Iniciando deploy...';
      chrome.runtime.sendMessage({ type: 'SPD_DEPLOY' }, (res) => {
        if (res?.ok) status.textContent = '✅ Publicado com sucesso!';
        else status.textContent = '❌ Erro: ' + (res?.error || 'Falha');
      });
    };
  } else {
    activeContainer.innerHTML = '<div class="empty-state">Nenhum projeto selecionado</div>';
  }

  // List
  if (!state.token) {
    listContainer.innerHTML = '<div class="empty-state">Abra o Lovable para listar projetos</div>';
    return;
  }

  try {
    const res = await fetch(`${LOVABLE_API}/projects`, {
      headers: { Authorization: `Bearer ${state.token}` }
    });
    const projects = await res.json();
    if (!Array.isArray(projects)) throw new Error();

    listContainer.innerHTML = projects.map(p => `
      <div class="project-card ${p.id === state.projectId ? 'selected' : ''}" data-id="${p.id}">
        <div class="project-name">${p.name || 'Sem nome'}</div>
        <div class="project-id">${p.id}</div>
      </div>
    `).join('');

    document.querySelectorAll('.project-card').forEach(card => {
      card.onclick = () => {
        const id = card.dataset.id;
        chrome.storage.local.set({ spd_project_id: id });
        state.projectId = id;
        refreshProjects();
        alert('Projeto alterado!');
      };
    });
  } catch (e) {
    listContainer.innerHTML = '<div class="empty-state">Erro ao carregar projetos</div>';
  }
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
    'spd_token', 'spd_project_id', 'spd_license', 'spd_branding', 'spd_theme'
  ]);

  state.token = data.spd_token;
  state.projectId = data.spd_project_id;
  state.license = data.spd_license;
  state.branding = data.spd_branding;

  // Apply Theme
  setTheme(data.spd_theme || 'dark');

  // Apply Branding
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

  // Update Status
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
  refreshProjects();
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
    init(); // re-apply
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
