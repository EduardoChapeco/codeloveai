// Starble Speed — SSO Bridge
// Listens for CLF1 token messages from starble.lovable.app and lovable.dev
'use strict';

window.addEventListener('message', (e) => {
  // Accept messages from Starble or Lovable origins
  if (e.origin !== 'https://starble.lovable.app' && e.origin !== 'https://lovable.dev') return;

  const d = e.data;
  if (!d || typeof d !== 'object') return;

  // CLF1 SSO token from Starble Connect page
  if (d.type === 'clf_sso_token' && d.token?.startsWith('CLF1.')) {
    chrome.runtime.sendMessage({ __clf_sso_login: true, token: d.token });
  }

  // Lovable Firebase token captured
  if (d.type === 'clf_token_bridge' && d.idToken) {
    chrome.runtime.sendMessage({
      __clf_store_lovable_token: true,
      idToken: d.idToken,
      refreshToken: d.refreshToken || null,
      uid: d.uid || null,
      email: d.email || null,
    });
  }

  // Workspace ID
  if (d.type === 'clf_workspace' && d.workspaceId) {
    chrome.runtime.sendMessage({ __clf_store_workspace: true, workspaceId: d.workspaceId });
  }
});
