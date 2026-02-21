// CodeLove AI Extension — Background Service Worker
// Handles message routing, token relay, and auto-save

chrome.runtime.onInstalled.addListener(() => {
  console.log("[CodeLove AI] Extension installed");
  chrome.storage.local.set({ panelOpen: false, interceptMode: "off" });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "PROXY_REQUEST") {
    handleProxyRequest(message.payload).then(sendResponse).catch((err) => {
      sendResponse({ error: err.message });
    });
    return true;
  }

  if (message.type === "GET_AUTH") {
    chrome.storage.local.get(["clf_token", "clf_email", "lovable_api_token"], (data) => {
      sendResponse(data);
    });
    return true;
  }

  if (message.type === "LOVABLE_TOKEN_CAPTURED") {
    console.log("[CodeLove AI] Lovable API token captured automatically");
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "AUTO_SAVE_LOVABLE_TOKEN") {
    autoSaveLovableToken(message.lovableToken, message.supabaseJwt)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
});

async function handleProxyRequest({ route, method = "GET", body, supabaseJwt }) {
  const { platformUrl } = await chrome.storage.local.get("platformUrl");
  if (!platformUrl) throw new Error("Platform URL not configured");

  const res = await fetch(`${platformUrl}/lovable-proxy`, {
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

async function autoSaveLovableToken(lovableToken, supabaseJwt) {
  const { platformUrl } = await chrome.storage.local.get("platformUrl");
  if (!platformUrl) return { skipped: true, reason: "No platform URL" };

  try {
    const res = await fetch(`${platformUrl}/lovable-proxy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseJwt}`,
      },
      body: JSON.stringify({ action: "save-token", token: lovableToken }),
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
