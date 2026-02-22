/**
 * Service Worker Update Manager
 * Silent cache refresh on new deployments with circuit breaker.
 */

const BUILD_VERSION = import.meta.env.VITE_BUILD_TIME || Date.now().toString();
const VERSION_KEY = 'clf_app_version';
const RELOAD_COUNT_KEY = 'clf_reload_count';
const RELOAD_TS_KEY = 'clf_reload_ts';
const CHECK_INTERVAL_MS = 300_000; // 5 minutes
const MAX_RELOADS_IN_WINDOW = 2;
const RELOAD_WINDOW_MS = 60_000; // 60s

/** Circuit breaker: prevent infinite reload loops */
function canReload(): boolean {
  try {
    const count = parseInt(sessionStorage.getItem(RELOAD_COUNT_KEY) || '0', 10);
    const lastTs = parseInt(sessionStorage.getItem(RELOAD_TS_KEY) || '0', 10);
    const now = Date.now();

    if (now - lastTs > RELOAD_WINDOW_MS) {
      // Window expired, reset
      sessionStorage.setItem(RELOAD_COUNT_KEY, '0');
      sessionStorage.setItem(RELOAD_TS_KEY, now.toString());
      return true;
    }

    if (count >= MAX_RELOADS_IN_WINDOW) {
      console.warn('[sw-update] Circuit breaker: too many reloads, skipping');
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function trackReload() {
  try {
    const count = parseInt(sessionStorage.getItem(RELOAD_COUNT_KEY) || '0', 10);
    sessionStorage.setItem(RELOAD_COUNT_KEY, (count + 1).toString());
    if (!sessionStorage.getItem(RELOAD_TS_KEY)) {
      sessionStorage.setItem(RELOAD_TS_KEY, Date.now().toString());
    }
  } catch { /* silent */ }
}

/** Clear all caches silently (no reload) */
async function nukeCachesSilently() {
  try {
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map(n => caches.delete(n)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
  } catch { /* silent */ }
}

/** Clear caches and reload (with circuit breaker) */
async function nukeCachesAndReload() {
  if (!canReload()) return;
  trackReload();
  await nukeCachesSilently();
  localStorage.setItem(VERSION_KEY, 'reloading');
  window.location.reload();
}

export function registerSWUpdate() {
  if (!('serviceWorker' in navigator)) return;

  // Periodically check for SW updates (every 5 min)
  setInterval(() => {
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg) reg.update();
    });
  }, CHECK_INTERVAL_MS);

  // On tab focus — silently clear stale caches (no reload)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      nukeCachesSilently();
    }
  });
}

/**
 * Check version at startup — only reload if mismatch AND circuit breaker allows
 */
export function checkAppVersion() {
  const stored = localStorage.getItem(VERSION_KEY);

  if (stored === 'reloading') {
    localStorage.setItem(VERSION_KEY, BUILD_VERSION);
    return;
  }

  if (stored && stored !== BUILD_VERSION) {
    console.log('[sw-update] Build version changed, clearing caches...');
    localStorage.setItem(VERSION_KEY, BUILD_VERSION);
    nukeCachesSilently();
    // Don't reload — the app is already loading the new version
  } else if (!stored) {
    localStorage.setItem(VERSION_KEY, BUILD_VERSION);
  }
}
