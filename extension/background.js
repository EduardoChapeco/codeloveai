// Starble Extension — Background Service Worker
// Handles message routing, token relay, and auto-save

// ✅ CORRECT Supabase project: qlhhmmboxlufvdtpbrsm (Starble)
const DEFAULT_PLATFORM_URL = "https://qlhhmmboxlufvdtpbrsm.supabase.co/functions/v1";

chrome.runtime.onInstalled.addListener(() => {
  console.log("[Starble] Extension installed");
  chrome.storage.local.set({
    panelOpen: false,
    interceptMode: "off",
    platformUrl: DEFAULT_PLATFORM_URL,
  });
});

async function getPlatformUrl() {
  const { platformUrl } = await chrome.storage.local.get("platformUrl");
  return platformUrl || DEFAULT_PLATFORM_URL;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "PROXY_REQUEST") {
    handleProxyRequest(message.payload).then(sendResponse).catch((err) => {
      sendResponse({ error: err.message });
    });
    return true;
  }

  if (message.type === "GET_AUTH") {
    chrome.storage.local.get(["clf_token", "clf_email", "lovable_api_token", "lovable_refresh_token", "lovable_token_history", "lovable_token_updated_at"], (data) => {
      sendResponse(data);
    });
    return true;
  }

  if (message.type === "LOVABLE_TOKEN_CAPTURED") {
    console.log("[Starble] Lovable API token captured automatically");
    // Save refresh token if provided
    if (message.refreshToken) {
      chrome.storage.local.set({ lovable_refresh_token: message.refreshToken });
    }
    // Auto-save if user is logged into platform
    chrome.storage.local.get("clf_token", (data) => {
      if (data.clf_token && message.token) {
        autoSaveLovableToken(message.token, message.refreshToken || null, data.clf_token).then((res) => {
          if (res?.success || res?.ok) {
            console.log("[Starble] Token auto-saved to platform");
          }
        });
      }
    });
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "AUTO_SAVE_LOVABLE_TOKEN") {
    autoSaveLovableToken(message.lovableToken, message.refreshToken || null, message.supabaseJwt)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  // ── Notes sync ──
  if (message.type === "SYNC_NOTES") {
    chrome.storage.local.get("clf_token", (data) => {
      if (!data.clf_token) {
        sendResponse({ error: "Não autenticado" });
        return;
      }
      syncNotes(message.notes || [], message.folders || [], data.clf_token)
        .then(sendResponse)
        .catch((err) => sendResponse({ error: err.message }));
    });
    return true;
  }

  if (message.type === "GET_NOTES") {
    chrome.storage.local.get("clf_token", (data) => {
      if (!data.clf_token) {
        sendResponse({ error: "Não autenticado" });
        return;
      }
      fetchNotes(data.clf_token)
        .then(sendResponse)
        .catch((err) => sendResponse({ error: err.message }));
    });
    return true;
  }
});

async function handleProxyRequest({ route, method = "GET", body, supabaseJwt }) {
  const baseUrl = await getPlatformUrl();

  const res = await fetch(`${baseUrl}/lovable-proxy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseJwt}`,
    },
    body: JSON.stringify({ route, method, payload: body }),
  });

  if (!res.ok) throw new Error(`Proxy error: ${res.status}`);
  return res.json();
}

async function autoSaveLovableToken(lovableToken, refreshToken, supabaseJwt) {
  const baseUrl = await getPlatformUrl();

  try {
    const res = await fetch(`${baseUrl}/lovable-proxy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseJwt}`,
      },
      body: JSON.stringify({
        action: "save-token",
        token: lovableToken,
        refreshToken: refreshToken || null,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error("[Starble] Token save failed:", data.error || res.status);
      return { error: data.error || `Status ${res.status}` };
    }

    return await res.json();
  } catch (e) {
    console.error("[Starble] Token save error:", e.message);
    return { error: e.message };
  }
}

async function syncNotes(notes, folders, supabaseJwt) {
  const baseUrl = await getPlatformUrl();

  try {
    const res = await fetch(`${baseUrl}/notes-sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseJwt}`,
      },
      body: JSON.stringify({ notes, folders }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { error: data.error || `Status ${res.status}` };
    }

    return await res.json();
  } catch (e) {
    return { error: e.message };
  }
}

async function fetchNotes(supabaseJwt) {
  const baseUrl = await getPlatformUrl();

  try {
    const res = await fetch(`${baseUrl}/notes-sync`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${supabaseJwt}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { error: data.error || `Status ${res.status}` };
    }

    return await res.json();
  } catch (e) {
    return { error: e.message };
  }
}
