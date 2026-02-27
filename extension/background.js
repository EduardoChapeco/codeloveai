// Starble Extension — Background Service Worker
// Handles message routing, token relay, and auto-save

// ✅ CORRECT Supabase project: qlhhmmboxlufvdtpbrsm (Starble)
const DEFAULT_PLATFORM_URL = "https://qlhhmmboxlufvdtpbrsm.supabase.co/functions/v1";
const CLIENT_SIG_KEY = "stbl_c8f2a91d4e7b3c6a0f5e8d2b1a9c7f4e";

async function generateStarbleSig(appId = "ext") {
  const ts = Date.now().toString();
  const k = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(CLIENT_SIG_KEY),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`${appId}.${ts}`));
  const b64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return `${appId}.${ts}.${b64}`;
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("[Starble] Extension installed");
  chrome.storage.local.set({
    panelOpen: false,
    interceptMode: "off",
    platformUrl: DEFAULT_PLATFORM_URL,
  });
});

// Open Starble Connect page when user clicks the extension icon
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: "https://starble.lovable.app/lovable/connect" });
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

  // ── CLF1 License received from SSO bridge ──
  if (message.type === "CLF_LICENSE_RECEIVED" && message.token) {
    console.log("[Starble] CLF1 license received via SSO bridge — validating");
    validateLicense(message.token).then((res) => {
      if (res?.valid) {
        console.log("[Starble] License validated successfully ✅");
      } else {
        console.warn("[Starble] License validation failed:", res?.error || res?.message);
      }
    });
    sendResponse({ ok: true });
    return false;
  }
});

async function handleProxyRequest({ route, method = "GET", body, supabaseJwt }) {
  const baseUrl = await getPlatformUrl();
  const sig = await generateStarbleSig("ext");

  const res = await fetch(`${baseUrl}/lovable-proxy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseJwt}`,
      "x-starble-sig": sig,
    },
    body: JSON.stringify({ route, method, payload: body }),
  });

  if (!res.ok) throw new Error(`Proxy error: ${res.status}`);
  return res.json();
}

async function autoSaveLovableToken(lovableToken, refreshToken, supabaseJwt) {
  const baseUrl = await getPlatformUrl();
  const sig = await generateStarbleSig("ext");

  try {
    const res = await fetch(`${baseUrl}/lovable-proxy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseJwt}`,
        "x-starble-sig": sig,
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

async function validateLicense(licenseKey) {
  const baseUrl = await getPlatformUrl();

  try {
    const hwid = await getDeviceId();

    const res = await fetch(`${baseUrl}/validate-plan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-clf-token": licenseKey,
        "x-clf-hwid": hwid,
      },
      body: JSON.stringify({}),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.ok) {
      await chrome.storage.local.remove([
        "clf_token",
        "license_validated",
        "license_validated_at",
        "lovable_api_token",
        "lovable_refresh_token",
        "lovable_token_history",
      ]);
      return { valid: false, error: data.error || `Status ${res.status}`, purgeToken: true };
    }

    chrome.storage.local.set({
      license_validated: true,
      license_validated_at: new Date().toISOString(),
    });

    return { valid: true, ...data };
  } catch (e) {
    await chrome.storage.local.remove(["clf_token", "license_validated", "license_validated_at"]);
    return { valid: false, error: e.message, purgeToken: true };
  }
}

async function getDeviceId() {
  // In Service Workers, screen/navigator info is limited — no screen.width/height
  const { deviceId } = await chrome.storage.local.get("deviceId");
  if (deviceId) return deviceId;

  const raw = `${navigator.userAgent}-${navigator.language}-${Date.now()}`;
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(raw));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const newId = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").substring(0, 32);
  await chrome.storage.local.set({ deviceId: newId });
  return newId;
}
