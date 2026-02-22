/**
 * Service Worker Update Manager
 * Forces cache refresh on new deployments — similar to how big tech handles SW updates.
 * Uses skipWaiting + clientsClaim via vite-plugin-pwa's autoUpdate,
 * plus a manual cache-busting mechanism for stubborn browsers.
 */

export function registerSWUpdate() {
  if (!('serviceWorker' in navigator)) return;

  // Listen for SW controller change → hard reload to get fresh assets
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    // Clear all caches before reloading
    caches.keys().then(names => {
      Promise.all(names.map(name => caches.delete(name))).then(() => {
        window.location.reload();
      });
    });
  });

  // Periodically check for SW updates (every 60s)
  setInterval(() => {
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg) reg.update();
    });
  }, 60 * 1000);
}

/**
 * Force clear all caches — call on app init to ensure fresh content
 * after a deployment. Uses a version key in localStorage.
 */
export function checkAppVersion() {
  const BUILD_VERSION = import.meta.env.VITE_BUILD_TIME || Date.now().toString();
  const STORED_VERSION = localStorage.getItem('clf_app_version');

  if (STORED_VERSION && STORED_VERSION !== BUILD_VERSION) {
    // Version changed → nuke caches
    localStorage.setItem('clf_app_version', BUILD_VERSION);
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    // Unregister old SW to force fresh install
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(reg => reg.unregister());
      });
    }
  } else if (!STORED_VERSION) {
    localStorage.setItem('clf_app_version', BUILD_VERSION);
  }
}
