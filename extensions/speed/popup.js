// Starble Speed — popup.js v1.0.0
'use strict';

const SUPABASE = 'https://qlhhmmboxlufvdtpbrsm.supabase.co';
const LOVABLE  = 'https://api.lovable.dev';
const CK       = 'spd_s2';

const S = {
  licensed: false, licInfo: null, planBlocked: false, planError: null,
  idToken: null, refreshToken: null, uid: null, email: null,
  projectId: null, workspaceId: null,
};

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('popup-logo').src = chrome.runtime.getURL('icon48.png');
  initButtons();
  await loadState();
  await checkLicense();
  applyStoredBranding();
  syncFromTab();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.clf_license?.newValue) setTimeout(() => checkLicense(), 300);
    if (changes._clf_sso_done?.newValue) setTimeout(() => checkLicense(), 200);
    if (changes.clf_lovable_token?.newValue) { S.idToken = changes.clf_lovable_token.newValue; updateTokenUI(); }
  });
});

function cget(keys) { return new Promise(r => chrome.storage.local.get(keys, r)); }
function cset(obj)  { return new Promise(r => chrome.storage.local.set(obj, r)); }

function getDeviceId() {
  const s = [navigator.userAgent, navigator.language, screen.width + 'x' + screen.height].join('|');
  let h = 0; for (let i = 0; i < s.length; i++) { h = ((h<<5)-h)+s.charCodeAt(i); h|=0; }
  return 'd'+Math.abs(h).toString(36);
}

async function loadState() {
  const d = await cget(['clf_lovable_token','clf_lovable_refresh','clf_lovable_uid','clf_lovable_email','clf_workspace_id','clf_project']);
  S.idToken = d.clf_lovable_token||null; S.refreshToken = d.clf_lovable_refresh||null;
  S.uid = d.clf_lovable_uid||null; S.email = d.clf_lovable_email||null;
  S.workspaceId = d.clf_workspace_id||null;
  if (d.clf_project?.id && (Date.now()-(d.clf_project.ts||0)) < 7200000) S.projectId = d.clf_project.id;
  updateTokenUI(); updateProjUI();
}

async function checkLicense() {
  const { clf_license, spd_plan_error } = await cget(['clf_license','spd_plan_error']);

  if (spd_plan_error) {
    S.planBlocked = true; S.planError = spd_plan_error; S.licensed = false; applyUI(); return;
  }

  if (!clf_license?.startsWith('CLF1.')) { S.licensed=false; applyUI(); return; }
  const did = getDeviceId();
  const { [CK]: cd } = await cget([CK]);
  if (cd?.v && cd?.d===did && cd?.t===clf_license && (Date.now()-cd.ts)<86400000) {
    S.licensed=true; S.licInfo=cd.i; S.planBlocked=false; applyUI(); return;
  }
  try {
    const resp = await new Promise((res,rej) => {
      const t = setTimeout(()=>rej(new Error('timeout')),9000);
      chrome.runtime.sendMessage({__clf_validate:true,token:clf_license},r=>{ clearTimeout(t); res(r); });
    });
    if (resp?.ok) { S.licensed=true; S.licInfo=resp.data; S.planBlocked=false; cset({[CK]:{t:clf_license,d:did,v:true,ts:Date.now(),i:resp.data}}); }
    else { S.licensed=false; }
  } catch {
    if (cd?.v && cd?.d===did && cd?.t===clf_license && (Date.now()-cd.ts)<86400000) { S.licensed=true; S.licInfo=cd.i; S.planBlocked=false; }
    else S.licensed=false;
  }
  applyUI();
}

function applyUI() {
  const pill = document.getElementById('p-pill');
  const ac   = document.getElementById('p-active-card');
  const ic   = document.getElementById('p-inactive-card');
  const pb   = document.getElementById('p-plan-blocked');

  if (S.planBlocked) {
    if (pill) { pill.textContent='Bloqueado'; pill.className='pill err'; }
    if (pb) { pb.style.display='block'; document.getElementById('p-plan-blocked-msg').textContent = S.planError || 'Plano insuficiente.'; }
    if (ac) ac.style.display='none';
    if (ic) ic.style.display='none';
    return;
  }

  if (pill) { pill.textContent=S.licensed?'Ativo':'Inativo'; pill.className='pill '+(S.licensed?'on':'off'); }
  if (pb) pb.style.display='none';
  if (ac) ac.style.display = S.licensed?'block':'none';
  if (ic) ic.style.display = S.licensed?'none':'block';
  if (S.licensed && S.licInfo) {
    setText('p-lic-name', S.licInfo.name||S.licInfo.n||'—');
    setText('p-lic-email', S.licInfo.email||S.licInfo.e||'—');
    const plan = S.licInfo.plan||S.licInfo.plan_type||'speed';
    setText('p-lic-plan', 'Plano: ' + plan.charAt(0).toUpperCase() + plan.slice(1) + ' · Speed ativado');
  }
}

function updateTokenUI() {
  const dot = document.getElementById('p-token-dot');
  const lbl = document.getElementById('p-token-label');
  const sub = document.getElementById('p-token-sub');
  if (dot) dot.className='dot '+(S.idToken?'ok':'off');
  if (lbl) lbl.textContent=S.idToken?'Token capturado':'Token nao capturado';
  if (sub) sub.textContent=S.idToken?(S.email||'Lovable conectado'):'Recarregue o Lovable';
}

function updateProjUI() {
  const dot = document.getElementById('p-proj-dot');
  const nm  = document.getElementById('p-proj-name');
  const sub = document.getElementById('p-proj-sub');
  if (dot) dot.className='dot '+(S.projectId?'ok':'off');
  if (nm)  nm.textContent=S.projectId?'Projeto ativo':'Nenhum projeto';
  if (sub) sub.textContent=S.projectId?S.projectId.slice(0,18)+'…':'Abra um projeto no Lovable';
}

function syncFromTab() {
  chrome.runtime.sendMessage({__clf_get_tab_state:true},state=>{
    if (!state||chrome.runtime.lastError) return;
    if (state.idToken && !S.idToken) {
      S.idToken=state.idToken; S.refreshToken=state.refreshToken;
      S.uid=state.uid; S.email=state.email;
      cset({clf_lovable_token:S.idToken,clf_lovable_refresh:S.refreshToken,clf_token_ts:Date.now()});
      updateTokenUI();
    }
    if (state.projectId && !S.projectId) {
      S.projectId=state.projectId;
      cset({clf_project:{id:state.projectId,ts:Date.now()}});
      updateProjUI();
    }
  });
}

function applyStoredBranding() {
  chrome.storage.local.get(['spd_branding'],d=>{
    const b=d.spd_branding; if(!b) return;
    const root=document.documentElement;
    if (b.primaryColor) { root.style.setProperty('--primary','#'+b.primaryColor.replace('#','')); }
    if (b.appName) { const el=document.getElementById('popup-app-name'); if(el) el.textContent=b.appName; document.title=b.appName; }
    if (b.logoUrl) { const el=document.getElementById('popup-logo'); if(el) el.src=b.logoUrl; }
  });
}

function initButtons() {
  document.getElementById('p-sso-btn')?.addEventListener('click',()=>{
    chrome.tabs.create({url:'https://starble.lovable.app/lovable/connect'}); window.close();
  });
  document.getElementById('p-activate-btn')?.addEventListener('click',activateLicense);
  document.getElementById('p-revoke-btn')?.addEventListener('click',revokeLicense);
  document.getElementById('p-open-panel')?.addEventListener('click',async()=>{
    const tabs=await new Promise(r=>chrome.tabs.query({url:'https://lovable.dev/*'},r));
    if (tabs[0]) { chrome.tabs.sendMessage(tabs[0].id,{__clf_panel_open:true}); chrome.tabs.update(tabs[0].id,{active:true}); }
    else chrome.tabs.create({url:'https://lovable.dev'});
    window.close();
  });
  document.getElementById('p-capture-btn')?.addEventListener('click',captureToken);
  document.getElementById('p-deploy-btn')?.addEventListener('click',quickDeploy);
  document.getElementById('p-sso-connect')?.addEventListener('click',connectSSO);
}

async function captureToken() {
  showAlert('p-main-alert','info','Capturando...');
  const tabs=await new Promise(r=>chrome.tabs.query({url:'https://lovable.dev/*'},r));
  if (!tabs.length) { showAlert('p-main-alert','err','Abra o Lovable.dev primeiro.'); return; }
  chrome.tabs.sendMessage(tabs[0].id,{__clf_get_state:true},state=>{
    if (chrome.runtime.lastError||!state?.idToken) { showAlert('p-main-alert','err','Nao encontrado. Recarregue o Lovable.'); return; }
    S.idToken=state.idToken; S.uid=state.uid; S.email=state.email;
    if (state.projectId) { S.projectId=state.projectId; cset({clf_project:{id:state.projectId,ts:Date.now()}}); }
    cset({clf_lovable_token:S.idToken,clf_token_ts:Date.now()});
    updateTokenUI(); updateProjUI();
    showAlert('p-main-alert','ok','Token capturado!');
  });
}

async function quickDeploy() {
  if (!S.projectId||!S.idToken) { showAlert('p-main-alert','err','Projeto ou token indisponivel.'); return; }
  showAlert('p-main-alert','info','Iniciando deploy...');
  try {
    const r=await fetch(LOVABLE+'/projects/'+S.projectId+'/deployments?async=true',{
      method:'POST',headers:{'Authorization':'Bearer '+S.idToken,'Content-Type':'application/json','Origin':'https://lovable.dev'},body:'{}'
    });
    const d=await r.json();
    showAlert('p-main-alert',r.ok?'ok':'err',r.ok?'Deploy iniciado!':'Erro: '+(d.message||r.status));
  } catch(e) { showAlert('p-main-alert','err','Erro: '+e.message); }
}

async function connectSSO() {
  showAlert('p-main-alert','info','Conectando...');
  const tabs=await new Promise(r=>chrome.tabs.query({url:'https://lovable.dev/*'},r));
  if (tabs[0]) {
    chrome.tabs.sendMessage(tabs[0].id,{__clf_get_state:true},async st=>{
      if (!chrome.runtime.lastError&&st?.idToken) { S.idToken=st.idToken; updateTokenUI(); }
      if (!S.idToken) { showAlert('p-main-alert','err','Token nao capturado. Abra o Lovable.'); return; }
      const payload={type:'clf_token_bridge',idToken:S.idToken,refreshToken:S.refreshToken||null,source:'speed_popup'};
      chrome.runtime.sendMessage({__clf_connect_starble:true,payload},()=>{});
      showAlert('p-main-alert','ok','Conectando ao Starble...');
    });
  } else { showAlert('p-main-alert','err','Abra o Lovable.dev primeiro.'); }
}

async function activateLicense() {
  let token=document.getElementById('p-token-inp')?.value?.trim();
  if (token) token=token.replace(/^["'\s]+|["'\s]+$/g,'').trim();
  if (!token) { showAlert('p-activate-alert','err','Cole a chave de licenca.'); return; }
  if (token.startsWith('eyJ')) { showAlert('p-activate-alert','err','Este e um token Firebase, nao uma chave CLF1.'); return; }
  if (!token.startsWith('CLF1.')) { showAlert('p-activate-alert','err','Chave invalida. Deve comecar com CLF1.'); return; }
  const btn=document.getElementById('p-activate-btn'); btn.disabled=true; btn.textContent='Validando...';
  try {
    const resp=await new Promise((res,rej)=>{
      const t=setTimeout(()=>rej(new Error('timeout')),10000);
      chrome.runtime.sendMessage({__clf_validate:true,token},r=>{ clearTimeout(t); res(r); });
    });
    if (resp?.ok) {
      await cset({clf_license:token,[CK]:{t:token,d:getDeviceId(),v:true,ts:Date.now(),i:resp.data}});
      S.licensed=true; S.licInfo=resp.data; S.planBlocked=false;
      chrome.runtime.sendMessage({__clf_badge:'active'});
      applyUI();
    } else { showAlert('p-activate-alert','err','Chave invalida ou nao encontrada.'); }
  } catch { showAlert('p-activate-alert','err','Erro de conexao.'); }
  btn.disabled=false; btn.textContent='Ativar';
}

async function revokeLicense() {
  if (!confirm('Remover licenca?')) return;
  await cset({clf_license:null,[CK]:null,spd_plan_error:null});
  S.licensed=false; S.licInfo=null; S.planBlocked=false;
  chrome.runtime.sendMessage({__clf_badge:'inactive'});
  applyUI();
}

function setText(id,v) { const el=document.getElementById(id); if(el) el.textContent=v; }
function showAlert(id,type,msg) {
  const el=document.getElementById(id); if(!el) return;
  el.className='alert on '+type; el.textContent=msg;
  if (type==='ok') setTimeout(()=>{ if(el.textContent===msg) el.className='alert'; },4000);
}
