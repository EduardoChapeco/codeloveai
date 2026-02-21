// CodeLove AI Extension — Background Service Worker
// Handles message routing between content script and platform API

const PLATFORM_BASE = ""; // Set via storage or options page — e.g. https://your-supabase-url/functions/v1

chrome.runtime.onInstalled.addListener(() => {
  console.log("[CodeLove AI] Extension installed");
  chrome.storage.local.set({ panelOpen: false, interceptMode: "off" });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "PROXY_REQUEST") {
    handleProxyRequest(message.payload).then(sendResponse).catch((err) => {
      sendResponse({ error: err.message });
    });
    return true; // async response
  }

  if (message.type === "GET_AUTH") {
    chrome.storage.local.get(["clf_token", "clf_email"], (data) => {
      sendResponse(data);
    });
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
