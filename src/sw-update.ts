/**
 * Service Worker Update Manager
 * Forces cache refresh on new deployments — big-tech style.
 * 
 * Strategy:
 * 1. SW controllerchange → clear caches + hard reload
 * 2. Periodic SW update checks (every 30s)
 * 3. On window focus/visibility → check for new version via index.html hash
 * 4. Build version in localStorage → nuke caches on mismatch at startup
 */

const BUILD_VERSION = import.meta.env.VITE_BUILD_TIME || Date.now().toString();
const VERSION_KEY = 'clf_app_version';
const LAST_CHECK_KEY = 'clf_last_version_check';
const CHECK_INTERVAL_MS = 30_000; // 30s

/** Compare remote index.html to detect new deploy */
async function hasNewVersion(): Promise<boolean> {
  try {
    const now = Date.now();
    const lastCheck = parseInt(localStorage.getItem(LAST_CHECK_KEY) || '0', 10);
    if (now - lastCheck < CHECK_INTERVAL_MS) return false;
    localStorage.setItem(LAST_CHECK_KEY, now.toString());

    const res = await fetch('/?_vc=' + now, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) return false;
    const html = await res.text();
    // Extract the build time from the served HTML's main script
    const match = html.match(/VITE_BUILD_TIME['":\s]+["'](\d+)['"]/);
    if (match && match[1] !== BUILD_VERSION) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Clear all caches and reload */
async function nukeCachesAndReload() {
  if ('caches' in window) {
    const names = await caches.keys();
    await Promise.all(names.map(n => caches.delete(n)));
  }
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r => r.unregister()));
  }
  localStorage.setItem(VERSION_KEY, 'reloading');
  window.location.reload();
}

/** Check on visibility/focus if a new version is available */
async function onVisibilityOrFocus() {
  if (document.visibilityState === 'hidden') return;
  const isNew = await hasNewVersion();
  if (isNew) {
    console.log('[sw-update] New version detected, reloading...');
    await nukeCachesAndReload();
  }
}

export function registerSWUpdate() {
  if (!('serviceWorker' in navigator)) return;

  // Listen for SW controller change → hard reload
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    nukeCachesAndReload();
  });

  // Periodically check for SW updates (every 30s)
  setInterval(() => {
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg) reg.update();
    });
  }, CHECK_INTERVAL_MS);

  // On tab focus / visibility change → check for new deploy
  document.addEventListener('visibilitychange', onVisibilityOrFocus);
  window.addEventListener('focus', onVisibilityOrFocus);
}

/**
 * Force clear all caches on version mismatch at startup
 */
export function checkAppVersion() {
  const stored = localStorage.getItem(VERSION_KEY);

  if (stored === 'reloading') {
    // Just reloaded, store the new version
    localStorage.setItem(VERSION_KEY, BUILD_VERSION);
    return;
  }

  if (stored && stored !== BUILD_VERSION) {
    // Version changed → nuke caches and reload
    console.log('[sw-update] Build version changed, clearing caches...');
    localStorage.setItem(VERSION_KEY, BUILD_VERSION);
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(reg => reg.unregister());
      });
    }
  } else if (!stored) {
    localStorage.setItem(VERSION_KEY, BUILD_VERSION);
  }
}
